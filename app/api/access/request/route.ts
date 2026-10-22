import { NextResponse } from "next/server";
import { canStore, requireUser } from "@/lib/serverAuth";
import { apply } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Someone the invite-only gate keeps out asks to come in (PRD-015 §2b).
export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!canStore()) return NextResponse.json({ error: "Permintaan akses belum bisa disimpan di server ini." }, { status: 503 });
  let name = "", note = "";
  try { const b = await req.json(); name = String(b?.name || "").trim(); note = String(b?.note || "").trim(); } catch { /* empty is fine */ }
  const r = await apply(caller, name, note);
  return NextResponse.json({ status: r.status }, { headers: { "Cache-Control": "no-store" } });
}
