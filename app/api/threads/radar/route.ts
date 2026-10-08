import { NextResponse } from "next/server";
import { json, radar } from "@/lib/threadsServer";
import { canStore, readConnection, requireUser } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Who replied to or mentioned the caller lately, using the token in the vault.
export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!canStore()) return json({ error: "Server belum bisa menyimpan token." }, 503);
  const conn = await readConnection(caller.uid, "threads");
  if (!conn) return json({ error: "Threads belum tersambung. Hubungkan lagi.", expired: true }, 404);
  try {
    return json(await radar(conn.token));
  } catch (e) {
    const status = (e as { status?: number }).status;
    return json({ error: (e as Error).message, expired: status === 401 || status === 400 }, 502);
  }
}
