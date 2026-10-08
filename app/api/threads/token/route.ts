import { NextResponse } from "next/server";
import { GRAPH, graph, json } from "@/lib/threadsServer";
import { canStore, dropConnection, requireUser, saveConnection } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The owner came back from Threads with a code: trade it for a 60-day token and
// keep the token in the server's vault (connections/, never readable by the
// browser). The app only gets back who is connected and until when.
export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID;
  const secret = process.env.THREADS_APP_SECRET;
  if (!appId || !secret) return json({ error: "Threads belum disetel di server (NEXT_PUBLIC_THREADS_APP_ID / THREADS_APP_SECRET)." }, 500);
  if (!canStore()) return json({ error: "Server belum bisa menyimpan token (FIREBASE_SERVICE_ACCOUNT belum diisi)." }, 503);

  const { code, redirectUri } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code || typeof redirectUri !== "string" || !/^https:\/\/[^\s]+\/threads\/callback$/.test(redirectUri)) {
    return json({ error: "Kode atau alamat balik tidak valid." }, 400);
  }
  try {
    const form = new URLSearchParams({ client_id: appId, client_secret: secret, code: code.replace(/#_$/, ""), grant_type: "authorization_code", redirect_uri: redirectUri });
    const res = await fetch(`${GRAPH}/oauth/access_token`, { method: "POST", body: form, cache: "no-store" });
    const short = await res.json();
    if (!res.ok || !short.access_token) return json({ error: short.error?.message || short.error_message || "Threads menolak kodenya." }, 400);

    const long = await graph<{ access_token: string; expires_in: number }>("/access_token", { grant_type: "th_exchange_token", client_secret: secret, access_token: short.access_token });
    const me = await graph<{ id: string; username?: string }>("/v1.0/me", { fields: "id,username", access_token: long.access_token });
    const now = Date.now();
    const meta = { userId: me.id, username: me.username || "", expiresAt: now + long.expires_in * 1000, refreshedAt: now };
    await saveConnection(caller.uid, "threads", { token: long.access_token, ...meta });
    return json(meta);
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

// Disconnect: forget the token.
export async function DELETE(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (canStore()) await dropConnection(caller.uid, "threads");
  return json({ ok: true });
}
