import { NextResponse } from "next/server";
import { requireUser } from "@/lib/serverAuth";
import { isOwner } from "@/lib/access";
import { adminDb } from "@/lib/serverAuth";
import { setSourceSpace, sourceSpace } from "@/lib/pricelistServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Which space's packages the sites read (PRD-017 §6). The owner's alone: their
// own space, or a guild they belong to.
export async function GET(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!isOwner(caller)) return NextResponse.json({ error: "Owner only." }, { status: 403 });
  return NextResponse.json({ space: await sourceSpace() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  if (!isOwner(caller)) return NextResponse.json({ error: "Owner only." }, { status: 403 });
  const space = String((await req.json().catch(() => ({})))?.space || "");
  const [kind, id] = space.split("/");
  const mine = kind === "users" ? id === caller.uid
    : kind === "guilds" && /^[A-Za-z0-9_-]{1,128}$/.test(id || "") ? (await adminDb().doc(`guilds/${id}/members/${caller.uid}`).get()).exists : false;
  if (!mine) return NextResponse.json({ error: "Not a space of yours." }, { status: 400 });
  await setSourceSpace(space, caller.email || caller.uid);
  return NextResponse.json({ space }, { headers: { "Cache-Control": "no-store" } });
}
