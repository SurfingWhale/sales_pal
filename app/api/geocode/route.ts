import { NextResponse } from "next/server";
import { requireUser, takeQuota } from "@/lib/serverAuth";
import type { GeoHit } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A lead's address to a point on the map (PRD-013). Uses the same Places API
// (New) key as Cari bisnis, so nothing new to enable: Text Search returns the
// place's location. Signed-in only, with a daily quota.

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "Cari alamat belum disetel di server. Tandai titiknya langsung di peta, atau pakai lokasi kamu sekarang." }, { status: 503 });

  let q = "";
  try { q = String((await req.json())?.q || "").trim().slice(0, 160); } catch { /* handled below */ }
  if (!q) return NextResponse.json({ error: "Tulis dulu alamat atau nama tempatnya." }, { status: 400 });

  const limit = parseInt(process.env.GEOCODE_DAILY_LIMIT || "", 10) || 100;
  const quota = await takeQuota(caller.uid, "geocode", limit);
  if (!quota.ok) return NextResponse.json({ error: `Batas cari alamat hari ini (${limit}) udah habis. Tandai di peta aja dulu.` }, { status: 429 });

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
    body: JSON.stringify({ textQuery: q, languageCode: "id", regionCode: "ID", pageSize: 5 }),
  });
  const json = await res.json().catch(() => ({})) as { places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }[]; error?: { message?: string } };
  if (!res.ok) return NextResponse.json({ error: `Google Maps nolak permintaan: ${json.error?.message || res.statusText}` }, { status: 502 });

  const hits: GeoHit[] = (json.places || [])
    .filter(p => typeof p.location?.latitude === "number" && typeof p.location?.longitude === "number")
    .map(p => ({ lat: p.location!.latitude!, lng: p.location!.longitude!, label: p.displayName?.text || "", address: p.formattedAddress || "" }));
  return NextResponse.json({ hits });
}
