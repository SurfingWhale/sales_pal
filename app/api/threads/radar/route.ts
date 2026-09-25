import { json, radar, validToken } from "@/lib/threadsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Who replied to or mentioned the owner lately.
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  if (!validToken(token)) return json({ error: "Token tidak valid." }, 400);
  try {
    return json(await radar(token));
  } catch (e) {
    const status = (e as { status?: number }).status;
    return json({ error: (e as Error).message, expired: status === 401 || status === 400 }, 502);
  }
}
