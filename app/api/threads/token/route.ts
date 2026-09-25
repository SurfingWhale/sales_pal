import { GRAPH, graph, json } from "@/lib/threadsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The owner came back from Threads with a code: trade it for a 60-day token.
export async function POST(req: Request) {
  const appId = process.env.NEXT_PUBLIC_THREADS_APP_ID;
  const secret = process.env.THREADS_APP_SECRET;
  if (!appId || !secret) return json({ error: "Threads belum disetel di server (NEXT_PUBLIC_THREADS_APP_ID / THREADS_APP_SECRET)." }, 500);

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
    return json({ token: long.access_token, userId: me.id, username: me.username || "", expiresAt: now + long.expires_in * 1000, refreshedAt: now });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
