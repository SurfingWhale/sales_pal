import { NextResponse } from "next/server";
import { deny, requireUser } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// Opens a Threads post link for Hunting (docs/prd/PRD-009 §5): who wrote it
// and what they wrote, read from the redirect and the page's preview tags,
// the same ones a chat app shows as a link preview. One request per link the
// user shares; nothing is stored here.

const HOSTS = new Set(["threads.com", "www.threads.com", "threads.net", "www.threads.net"]);
const UA = "SalesPal-LinkPreview/1.0 (+https://salespal-alpha.vercel.app)";
const MAX_HOPS = 3;
const TIMEOUT_MS = 5000;

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

function allowed(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && HOSTS.has(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function meta(html: string, prop: string): string {
  const tag = html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*>`, "i"))?.[0] || "";
  const m = tag.match(/content=(["'])([\s\S]*?)\1/i);
  return m ? decode(m[2]).trim() : "";
}

// /@user/post/ID → its parts, without the tracking query the share link adds.
function postParts(u: URL): { handle: string; postId: string; postUrl: string } | null {
  const m = u.pathname.match(/^\/(@[A-Za-z0-9._]+)\/post\/([A-Za-z0-9_-]+)/);
  return m ? { handle: m[1], postId: m[2], postUrl: `https://www.threads.com/${m[1]}/post/${m[2]}` } : null;
}

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  const body = await req.json().catch(() => ({}));
  let url = allowed(String(body?.url || "").trim());
  if (!url) return deny("Bukan link Threads.", 400);

  let html = "";
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    if (!res) break;
    if (res.status >= 300 && res.status < 400) {
      const next = allowed(new URL(res.headers.get("location") || "", url).toString());
      if (!next) break;
      url = next;
      continue;
    }
    if (res.ok) html = (await res.text()).slice(0, 400_000);
    break;
  }

  const parts = postParts(url);
  const title = meta(html, "og:title");                       // "Name (@user) on Threads"
  const fromTitle = title.match(/^(.*?)\s*\((@[A-Za-z0-9._]+)\)/);
  const handle = parts?.handle || fromTitle?.[2] || "";
  if (!handle) return reply({ error: "Link-nya ga kebaca. Isi username-nya manual." }, 422);
  const canonical = allowed(meta(html, "og:url"));
  const post = (canonical && postParts(canonical)) || parts;
  return reply({
    handle,
    name: fromTitle?.[1]?.trim() || "",
    text: meta(html, "og:description").slice(0, 500),
    postUrl: post?.postUrl || "",
    postId: post?.postId || "",
  });
}
