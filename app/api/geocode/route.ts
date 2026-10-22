import { NextResponse } from "next/server";
import { requireUser, takeQuota } from "@/lib/serverAuth";
import { GeoHit, PlaceText, isShortMapsLink, readPlace } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A lead's address, or a pasted map link, to a point on the map (PRD-013).
// Words go to Google Places (New) when GOOGLE_PLACES_API_KEY is set: the same
// key as Cari bisnis, and the best at business names. Without it, or when
// Google says no, they go to OpenStreetMap's free geocoders, Photon then
// Nominatim: good for streets and areas, thinner on small businesses. A short
// share link (maps.app.goo.gl/…) is opened here, since a browser cannot read
// its redirect, and the point is read from where it leads.
// Signed-in only, with a daily quota.

type Source = "google" | "osm" | "link";

// Nominatim's policy asks every caller to name itself.
const UA = "SalesPal/1.0 (+https://github.com/Untamed98x/sales_pal)";
// Indonesia, so a free search for "Jl. Sudirman" stays in the country.
const ID_BOX = "94.7,-11.2,141.1,6.3";

async function google(q: string, key: string): Promise<GeoHit[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location" },
      body: JSON.stringify({ textQuery: q, languageCode: "id", regionCode: "ID", pageSize: 5 }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => ({})) as { places?: { displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number } }[]; error?: { message?: string } };
    if (!res.ok) { console.error("geocode: Google said no:", json.error?.message || res.statusText); return []; }
    return (json.places || [])
      .filter(p => typeof p.location?.latitude === "number" && typeof p.location?.longitude === "number")
      .map(p => ({ lat: p.location!.latitude!, lng: p.location!.longitude!, label: p.displayName?.text || "", address: p.formattedAddress || "" }));
  } catch { return []; }
}

async function photon(q: string): Promise<GeoHit[]> {
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${new URLSearchParams({ q, limit: "5", bbox: ID_BOX })}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = await res.json() as { features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, string | undefined> }[] };
    return (json.features || []).flatMap(f => {
      const [lng, lat] = f.geometry?.coordinates || [];
      if (typeof lat !== "number" || typeof lng !== "number") return [];
      const p = f.properties || {};
      const street = [p.street, p.housenumber].filter(Boolean).join(" ");
      const label = p.name || street || p.district || p.city || "";
      const address = [street, p.district, p.city, p.state].filter((s, i, all) => s && s !== label && all.indexOf(s) === i).join(", ");
      return [{ lat, lng, label, address }];
    });
  } catch { return []; }
}

async function nominatim(q: string): Promise<GeoHit[]> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "jsonv2", countrycodes: "id", limit: "5", "accept-language": "id" })}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = await res.json() as { lat?: string; lon?: string; name?: string; display_name?: string }[];
    return (Array.isArray(json) ? json : []).flatMap(r => {
      const lat = Number(r.lat), lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      const address = r.display_name || "";
      return [{ lat, lng, label: r.name || address.split(",")[0], address }];
    });
  } catch { return []; }
}

async function find(q: string): Promise<{ hits: GeoHit[]; source: Source }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (key) {
    const hits = await google(q, key);
    if (hits.length) return { hits, source: "google" };
  }
  const hits = await photon(q);
  return { hits: hits.length ? hits : await nominatim(q), source: "osm" };
}

// Follows a short share link's redirects, only ever requesting short-link
// hosts, and returns the first full link it leads to ("" when it leads nowhere).
async function openShort(link: string): Promise<string> {
  let at = new URL(link);
  for (let hop = 0; hop < 4; hop++) {
    if (!isShortMapsLink(at) || (at.protocol !== "https:" && at.protocol !== "http:")) return at.toString();
    const res = await fetch(at, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    await res.body?.cancel();
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return "";
    at = new URL(next, at);
  }
  return "";
}

const linkHit = (p: PlaceText, around: PlaceText): GeoHit =>
  ({ ...p.point!, label: p.name || around.name, address: around.note || p.query || around.query });

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  let q = "";
  try { q = String((await req.json())?.q || "").trim().slice(0, 600); } catch { /* handled below */ }
  if (!q) return NextResponse.json({ error: "Tulis alamat atau nama tempat, atau tempel link Google Maps." }, { status: 400 });

  // A point written in the text needs no lookup.
  const pasted = readPlace(q);
  if (pasted.point) return NextResponse.json({ hits: [linkHit(pasted, pasted)], source: "link" });

  const limit = parseInt(process.env.GEOCODE_DAILY_LIMIT || "", 10) || 100;
  const quota = await takeQuota(caller.uid, "geocode", limit);
  if (!quota.ok) return NextResponse.json({ error: `Batas cari alamat hari ini (${limit}) udah habis. Tandai di peta aja dulu.` }, { status: 429 });

  let words = pasted.query || pasted.name || pasted.note;
  if (pasted.short) {
    let to = "";
    try { to = await openShort(pasted.short); } catch { /* a dead link or no network: fall back to the words around it */ }
    const opened = to ? readPlace(to) : null;
    if (opened?.point) return NextResponse.json({ hits: [linkHit(opened, pasted)], source: "link" });
    words = opened?.query || opened?.name || pasted.note;
    if (!words) return NextResponse.json({ error: "Link-nya ga bisa dibuka. Di Google Maps: buka tempatnya → Bagikan → Salin link, lalu tempel lagi di sini." }, { status: 422 });
  }

  const { hits, source } = await find((words || q).slice(0, 160));
  const seen = new Set<string>();
  const unique = hits.filter(h => { const k = `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`; return !seen.has(k) && !!seen.add(k); });
  return NextResponse.json({ hits: unique.slice(0, 5), source });
}
