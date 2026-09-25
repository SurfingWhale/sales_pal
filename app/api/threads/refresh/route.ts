import { graph, json, validToken } from "@/lib/threadsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Another 60 days for a token that is at least a day old and not yet expired.
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!validToken(token)) return json({ error: "Token tidak valid." }, 400);
  try {
    const r = await graph<{ access_token: string; expires_in: number }>("/refresh_access_token", { grant_type: "th_refresh_token", access_token: token });
    const now = Date.now();
    return json({ token: r.access_token, expiresAt: now + r.expires_in * 1000, refreshedAt: now });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
