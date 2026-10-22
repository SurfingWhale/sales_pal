import { NextResponse } from "next/server";
import { requireUser, takeQuota } from "@/lib/serverAuth";
import type { Place } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Searching Google Maps for businesses to pitch (PRD-012), through Google's
// own Places API (New) — not by scraping maps.google.com, which Google's terms
// forbid and which breaks. Needs GOOGLE_PLACES_API_KEY on the server; every
// search spends that key, so it is signed-in only with a daily quota.
// With withEmail, each result's website is read once for a public address.

const FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.websiteUri", "places.rating", "places.userRatingCount", "places.googleMapsUri", "places.primaryTypeDisplayName", "places.reviews", "places.location",
  "nextPageToken",
].join(",");

interface GPlace {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; googleMapsUri?: string; primaryTypeDisplayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  reviews?: { rating?: number; text?: { text?: string }; originalText?: { text?: string }; relativePublishTimeDescription?: string }[];
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NOT_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|@2x|domain\.com/i;

// A public email on the business's own site: its home page, then a contact page.
// Only a public web address: no IP literals, no local or internal hosts.
function publicSite(site: string): boolean {
  try {
    const u = new URL(site);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return h.includes(".") && !/^[\d.]+$/.test(h) && !h.includes(":") && !/(^|\.)(localhost|local|internal|lan)$/.test(h);
  } catch { return false; }
}

async function emailOf(site: string): Promise<string> {
  if (!publicSite(site)) return "";
  for (const path of ["", "/kontak", "/contact", "/hubungi-kami"]) {
    try {
      const url = new URL(path || "/", site).toString();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const get = (u: string) => fetch(u, { signal: ctrl.signal, redirect: "manual", headers: { "User-Agent": "SalesPal/1.0 (+lead finder)" } });
      let res = await get(url);
      // One redirect (http → https, www), and only to another public site.
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (next) { const to = new URL(next, url).toString(); if (!publicSite(to)) { clearTimeout(t); continue; } res = await get(to); }
      clearTimeout(t);
      if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) continue;
      const html = (await res.text()).slice(0, 400_000);
      const found = (html.match(EMAIL) || []).map(e => e.toLowerCase()).filter(e => !NOT_EMAIL.test(e));
      const host = new URL(site).hostname.replace(/^www\./, "");
      const own = found.find(e => e.endsWith(`@${host}`));
      if (own || found[0]) return own || found[0];
    } catch { /* unreachable site: try the next page */ }
  }
  return "";
}

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Cari di Google Maps belum disetel: GOOGLE_PLACES_API_KEY belum diisi di server. Sementara itu pakai Import Excel." }, { status: 503 });
  }

  let query = "", pageToken = "", withEmail = false;
  try {
    const b = await req.json();
    query = String(b?.query || "").trim().slice(0, 120);
    pageToken = String(b?.pageToken || "");
    withEmail = !!b?.withEmail;
  } catch { /* handled below */ }
  if (!query) return NextResponse.json({ error: "Tulis dulu yang dicari, mis. \"coffee shop Jakarta Selatan\"." }, { status: 400 });

  const limit = parseInt(process.env.PLACES_DAILY_LIMIT || "", 10) || 30;
  const quota = await takeQuota(caller.uid, "places", limit);
  if (!quota.ok) return NextResponse.json({ error: `Batas pencarian hari ini (${limit}) udah habis. Coba lagi besok.` }, { status: 429 });

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({ textQuery: query, languageCode: "id", regionCode: "ID", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = (json as { error?: { message?: string } })?.error?.message || res.statusText;
    return NextResponse.json({ error: `Google Maps nolak permintaan: ${why}` }, { status: 502 });
  }

  const places: Place[] = ((json as { places?: GPlace[] }).places || []).map(g => ({
    id: g.id,
    name: g.displayName?.text || "",
    category: g.primaryTypeDisplayName?.text || "",
    address: g.formattedAddress || "",
    phone: g.nationalPhoneNumber || g.internationalPhoneNumber || "",
    website: g.websiteUri || "",
    rating: typeof g.rating === "number" ? g.rating : null,
    reviewCount: g.userRatingCount || 0,
    mapsUrl: g.googleMapsUri || "",
    ...(typeof g.location?.latitude === "number" && typeof g.location?.longitude === "number" ? { lat: g.location.latitude, lng: g.location.longitude } : {}),
    reviews: (g.reviews || []).map(r => ({ rating: r.rating || 0, text: r.originalText?.text || r.text?.text || "", when: r.relativePublishTimeDescription || "" })),
  }));

  if (withEmail) {
    await Promise.all(places.filter(p => p.website).slice(0, 20).map(async p => { p.email = await emailOf(p.website); }));
  }

  return NextResponse.json({ places, nextPageToken: (json as { nextPageToken?: string }).nextPageToken || "" });
}
