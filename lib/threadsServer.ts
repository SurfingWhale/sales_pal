// Server side of the Threads Radar: talks to graph.threads.net. The app
// secret stays here (THREADS_APP_SECRET); the owner's token comes with each
// request and is only ever used to read their own account.

import { NextResponse } from "next/server";
import type { RadarItem } from "@/lib/threads";

export const GRAPH = "https://graph.threads.net";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

// A Threads token is one long opaque word; anything else is refused before
// it reaches Meta.
export function validToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_\-|.]{20,1024}$/.test(t);
}

export async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error?.message || `Threads answered ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, code: body.error?.code });
  }
  return body as T;
}

interface Post { id: string; text?: string; permalink?: string; timestamp?: string }
interface Reply extends Post { username?: string; is_reply_owned_by_me?: boolean }
interface Page<T> { data?: T[] }

const REPLY_FIELDS = "id,text,username,permalink,timestamp,is_reply_owned_by_me";

// The owner's latest posts, everything said under them, and mentions.
export async function radar(token: string, posts = 15): Promise<{ items: RadarItem[]; warnings: string[] }> {
  const warnings: string[] = [];
  const mine = await graph<Page<Post>>("/v1.0/me/threads", { fields: "id,text,permalink,timestamp", limit: String(posts), access_token: token });
  const list = mine.data || [];

  const items: RadarItem[] = [];
  // A few at a time: plenty fast, and gentle on the rate limit.
  for (let i = 0; i < list.length; i += 5) {
    const batch = await Promise.all(list.slice(i, i + 5).map(async (p) => {
      try {
        const conv = await graph<Page<Reply>>(`/v1.0/${p.id}/conversation`, { fields: REPLY_FIELDS, limit: "50", access_token: token });
        return (conv.data || []).filter(r => !r.is_reply_owned_by_me && r.username).map((r): RadarItem => ({
          id: r.id, kind: "reply", username: r.username as string, text: (r.text || "").slice(0, 500),
          permalink: r.permalink || p.permalink || "", timestamp: r.timestamp || p.timestamp || "",
          postText: (p.text || "").slice(0, 140), postPermalink: p.permalink || "",
        }));
      } catch (e) {
        warnings.push(`Balasan untuk satu post tidak terbaca: ${(e as Error).message}`);
        return [];
      }
    }));
    batch.forEach(b => items.push(...b));
  }

  try {
    const m = await graph<Page<Reply>>("/v1.0/me/mentions", { fields: "id,text,username,permalink,timestamp", limit: "50", access_token: token });
    for (const r of m.data || []) {
      if (!r.username) continue;
      items.push({ id: r.id, kind: "mention", username: r.username, text: (r.text || "").slice(0, 500), permalink: r.permalink || "", timestamp: r.timestamp || "", postText: "", postPermalink: "" });
    }
  } catch (e) {
    warnings.push(`Mention tidak terbaca: ${(e as Error).message}`);
  }
  return { items, warnings };
}
