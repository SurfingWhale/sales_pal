import { NextResponse } from "next/server";
import { isSiteId } from "@/lib/sites";
import { parseWrite, readPricelist, siteKeyOk, writeFromSite } from "@/lib/pricelistServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The studio's pricelist for one site (creative-hub standards/pricelist.md).
// GET is public and cached at the CDN for five minutes; POST is a new package
// from that site's admin, through its own server and key (PRD-017 §6).

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...cors, "Access-Control-Max-Age": "86400" } });
}

export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get("site");
  if (!isSiteId(site)) return NextResponse.json({ error: "Unknown site." }, { status: 404, headers: cors });
  try {
    const { updatedAt, packages } = await readPricelist(site);
    return NextResponse.json({ v: 0, site, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null, currency: "IDR", packages },
      { headers: { ...cors, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Pricelist unavailable." }, { status: 503, headers: { ...cors, "Cache-Control": "no-store" } });
  }
}

export async function POST(req: Request) {
  const site = new URL(req.url).searchParams.get("site");
  if (!isSiteId(site)) return NextResponse.json({ error: "Unknown site." }, { status: 404 });
  if (!siteKeyOk(site, req.headers.get("authorization"))) return NextResponse.json({ error: "Wrong or missing site key." }, { status: 401 });
  const w = parseWrite(await req.json().catch(() => null));
  const r = await writeFromSite(site, null, w);
  return NextResponse.json(r.json, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
