import { NextResponse } from "next/server";
import { graph, json } from "@/lib/threadsServer";
import { canStore, readConnection, requireUser, saveConnection } from "@/lib/serverAuth";
import { needsRefresh } from "@/lib/threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Another 60 days for the caller's stored token, once it is at least a day old
// and within 30 days of running out.
export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!canStore()) return json({ error: "Server belum bisa menyimpan token." }, 503);
  const conn = await readConnection(caller.uid, "threads");
  if (!conn) return json({ error: "Threads belum tersambung.", reconnect: true }, 404);
  if (!needsRefresh(conn)) return json({ userId: conn.userId, username: conn.username || "", expiresAt: conn.expiresAt, refreshedAt: conn.refreshedAt });
  try {
    const r = await graph<{ access_token: string; expires_in: number }>("/refresh_access_token", { grant_type: "th_refresh_token", access_token: conn.token });
    const now = Date.now();
    const next = { ...conn, token: r.access_token, expiresAt: now + r.expires_in * 1000, refreshedAt: now };
    await saveConnection(caller.uid, "threads", next);
    return json({ userId: next.userId, username: next.username || "", expiresAt: next.expiresAt, refreshedAt: next.refreshedAt });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
