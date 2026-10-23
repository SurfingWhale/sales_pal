// Where a lead is (PRD-013): a point on the street map, and how it was set.
// Shared by the server's geocode route and the map, so no browser or server API.

export interface LeadGeo {
  lat: number;
  lng: number;
  // Google Maps result, address search, a tap on the map, the phone's GPS, a pasted map link or coordinates
  by: "maps" | "alamat" | "pin" | "gps" | "link";
}

export interface GeoHit { lat: number; lng: number; label: string; address: string }

// Jakarta, when nothing has a location yet.
export const HOME: [number, number] = [106.8272, -6.1754];

export const validGeo = (g: unknown): g is LeadGeo =>
  !!g && typeof (g as LeadGeo).lat === "number" && typeof (g as LeadGeo).lng === "number"
  && Math.abs((g as LeadGeo).lat) <= 90 && Math.abs((g as LeadGeo).lng) <= 180;

// Directions in Google Maps, from wherever the phone is.
export const routeUrl = (g: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`;

// Straight-line distance in km (haversine): enough to say what is near.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// "350 m", "2,3 km", "18 km".
export const distanceText = (km: number) =>
  km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toLocaleString("id-ID", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;

// ---------------------------------------------------------------- pasted places

// What a pasted text says about a place: a Google Maps, Apple Maps or
// OpenStreetMap link, a WhatsApp shared location, or coordinates copied from a
// dropped pin ("-6.175392, 106.827153" or 6°10'31.4"S 106°49'38.0"E).
export interface PlaceText {
  point: { lat: number; lng: number } | null;
  name: string;    // the place's name, when the link carries it
  query: string;   // the place as words in the link (?q=Name, address), for links without a point
  short: string;   // a short share link only the server can open (maps.app.goo.gl/…)
  note: string;    // the words around the link: share sheets put the name and address there
}

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;
const point = (a: string | number, b: string | number) => {
  const lat = Number(a), lng = Number(b);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat || lng) ? { lat, lng } : null;
};
// A link parameter that is a coordinate pair and nothing else.
const pairOf = (s: string | null) => {
  const m = (s || "").trim().match(new RegExp(`^(${NUM})\\s*[,\\s]\\s*(${NUM})$`));
  return m ? point(m[1], m[2]) : null;
};
const dms = (d: string, m: string, s: string, h: string) => (Number(d) + Number(m) / 60 + Number(s) / 3600) * (/[SW]/i.test(h) ? -1 : 1);
const words = (s: string) => s.replace(/\+/g, " ").replace(/\s+/g, " ").replace(/^[\s,·–-]+|[\s,·–-]+$/g, "");
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export const isShortMapsLink = (u: URL) => {
  const host = u.hostname.replace(/^www\./, "");
  return host === "maps.app.goo.gl" || host === "maps.apple" || (host === "goo.gl" && u.pathname.startsWith("/maps"));
};

export function readPlace(text: string): PlaceText {
  const out: PlaceText = { point: null, name: "", query: "", short: "", note: "" };
  const links: string[] = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  let rest = links.reduce((t, l) => t.replace(l, " "), text);
  const set = (p: { lat: number; lng: number } | null) => { if (p && !out.point) out.point = p; };

  // Google's place pin (…!3d-6.17!4d106.82) is exact; @-6.17,106.82 further down is only the map's centre.
  let m = text.match(new RegExp(`!3d(${NUM})!4d(${NUM})`));
  if (m) set(point(m[1], m[2]));
  for (const link of links) {
    let u: URL;
    try { u = new URL(link); } catch { continue; }
    if (!out.short && isShortMapsLink(u)) out.short = link;
    const p = u.searchParams;
    for (const k of ["q", "query", "ll", "sll", "destination", "daddr", "center", "coordinate", "loc"]) set(pairOf(p.get(k)));
    set(point(p.get("mlat") ?? NaN, p.get("mlon") ?? NaN));                       // OpenStreetMap marker
    m = u.hash.match(new RegExp(`map=[\\d.]+/(${NUM})/(${NUM})`));                  // OpenStreetMap view
    if (m) set(point(m[1], m[2]));
    const place = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (place && !out.name) { const n = words(decode(place[1])); if (!/\d°|^-?\d+\.\d+,/.test(n)) out.name = n; }
    if (!out.name) out.name = words(p.get("name") || "");                          // Apple Maps
    for (const k of ["q", "query", "address", "daddr", "destination"]) {
      const v = p.get(k);
      if (v && !out.query && !pairOf(v)) out.query = words(v);
    }
  }
  m = text.match(new RegExp(`@(${NUM}),(${NUM})`));
  if (m) set(point(m[1], m[2]));
  m = rest.match(/(\d{1,2})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([NS])[\s,+]*(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([EW])/i);
  if (m) { set(point(dms(m[1], m[2], m[3], m[4]), dms(m[5], m[6], m[7], m[8]))); rest = rest.replace(m[0], " "); }
  // Bare coordinates need four decimals, so prices and phone numbers are not read as a place.
  m = rest.match(/(?:^|[^\d.])(-?\d{1,2}\.\d{4,})\s*[,\s]\s*(-?\d{1,3}\.\d{4,})(?![\d.])/);
  if (m) { set(point(m[1], m[2])); rest = rest.replace(m[0], " "); }
  out.note = words(rest);
  return out;
}
