import { NextResponse } from "next/server";
import { requireUser } from "@/lib/serverAuth";
import { enforced, isAdmin, isOpen, isOwner, mayEnter, mayUse, monthlyLeft, requestOf } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What the signed-in person may do while SalesPal is invite-only (PRD-015):
// open the app at all, and use each paid tool here (?guild= narrows it to the
// workspace they're in). The app asks once on load; every paid route checks
// again for itself.
export async function GET(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;
  const guild = (new URL(req.url).searchParams.get("guild") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128) || null;
  const [app, open, places, geocode, month, admin, request] = await Promise.all([
    mayEnter(caller), isOpen(), mayUse(caller, "places", guild), mayUse(caller, "geocode", guild), monthlyLeft("places"), isAdmin(caller), requestOf(caller.uid),
  ]);
  return NextResponse.json({ app, open, owner: isOwner(caller), admin, enforced: enforced(), request: request ? { status: request.status } : null,
    tools: { places, geocode }, left: { places: month } },
    { headers: { "Cache-Control": "no-store, max-age=0" } });
}
