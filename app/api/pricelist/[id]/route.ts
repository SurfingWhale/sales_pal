import { NextResponse } from "next/server";
import { isSiteId } from "@/lib/sites";
import { parseWrite, siteKeyOk, writeFromSite } from "@/lib/pricelistServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A change to one package's price from a site's admin (PRD-017 §6): the site's
// server forwards it with its key and the version it last read; a stale one
// gets 409 with the current package.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const site = new URL(req.url).searchParams.get("site");
  if (!isSiteId(site)) return NextResponse.json({ error: "Unknown site." }, { status: 404 });
  if (!siteKeyOk(site, req.headers.get("authorization"))) return NextResponse.json({ error: "Wrong or missing site key." }, { status: 401 });
  const id = (params.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
  if (!id) return NextResponse.json({ error: "No package id." }, { status: 400 });
  const w = parseWrite(await req.json().catch(() => null));
  if (w.version === undefined) return NextResponse.json({ error: "Send the version you read." }, { status: 400 });
  const r = await writeFromSite(site, id, w);
  return NextResponse.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
