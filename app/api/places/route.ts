import { NextResponse } from "next/server";
import { requireUser, takeQuota } from "@/lib/serverAuth";
import { giveBackMonthly, mayUse, takeMonthly } from "@/lib/access";
import type { Place } from "@/lib/places";
import { emailOf } from "@/lib/siteRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Searching Google Maps for businesses to pitch (PRD-012), through Google's
// own Places API (New) — not by scraping maps.google.com, which Google's terms
// forbid and which breaks. Needs GOOGLE_PLACES_API_KEY on the server; every
// search spends that key, so (PRD-015) only the owner or a role their guild's
// Leader allowed may search, each with a daily quota, and the whole app stays
// under Google's free monthly calls (lib/access.ts).
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

export async function POST(req: Request) {
  const caller = await requireUser(req);
  if (caller instanceof NextResponse) return caller;

  let query = "", pageToken = "", withEmail = false, guild = "";
  try {
    const b = await req.json();
    query = String(b?.query || "").trim().slice(0, 120);
    pageToken = String(b?.pageToken || "").slice(0, 2000);
    withEmail = !!b?.withEmail;
    guild = String(b?.guild || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
  } catch { /* handled below */ }

  const allowed = await mayUse(caller, "places", guild || null);
  if (!allowed.ok) return NextResponse.json({ error: allowed.why, denied: true }, { status: 403 });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Cari di Google Maps belum disetel: GOOGLE_PLACES_API_KEY belum diisi di server. Sementara itu pakai Import Excel." }, { status: 503 });
  }
  if (!query) return NextResponse.json({ error: "Tulis dulu yang dicari, mis. \"coffee shop Jakarta Selatan\"." }, { status: 400 });

  const limit = parseInt(process.env.PLACES_DAILY_LIMIT || "", 10) || 30;
  const quota = await takeQuota(caller.uid, "places", limit);
  if (!quota.ok) return NextResponse.json({ error: `Batas pencarian kamu hari ini (${limit}) udah habis. Coba lagi besok.` }, { status: 429 });
  const month = await takeMonthly("places");
  if (!month.ok) return NextResponse.json({ error: `Jatah gratis Cari bisnis bulan ini (${month.limit} pencarian buat semua akun) udah habis. Mulai lagi tanggal 1; sementara pakai Import Excel.` }, { status: 429 });

  let res: Response;
  try {
    res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, languageCode: "id", regionCode: "ID", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
    });
  } catch {
    await giveBackMonthly("places");
    return NextResponse.json({ error: "Google Maps ga bisa dihubungi. Coba lagi sebentar." }, { status: 502 });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    await giveBackMonthly("places");
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

  return NextResponse.json({
    places, nextPageToken: (json as { nextPageToken?: string }).nextPageToken || "",
    left: { today: Math.max(0, limit - quota.used), month: Math.max(0, month.limit - month.used) },
  });
}
