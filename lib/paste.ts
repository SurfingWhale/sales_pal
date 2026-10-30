// Tempel apa saja → kolom terisi (PRD-018 §2). What a pasted link or block of
// text says about a lead, read with patterns only: no network, no AI. The
// add-lead form fills its empty fields from this, then asks the server only
// for what a pattern can't see (a Threads post, a short Maps link, a website).
// Pure; shared by the browser and tests.

import { PlaceText, isShortMapsLink, readPlace } from "@/lib/geo";

export type PasteKind = "threads" | "instagram" | "maps" | "site" | "text";

export interface PasteRead {
  kind: PasteKind;
  url: string;       // the link the kind came from
  name: string;      // only from a Maps link or the share text around it
  address: string;
  phone: string;     // 0812…, as people write it
  email: string;
  handle: string;    // @name on Threads or Instagram, or written in the text
  place: PlaceText;
}

// The lead's source for each kind (lib/leadEdit SOURCES); text keeps the form's.
export const PASTE_SOURCE: Partial<Record<PasteKind, string>> = { threads: "Threads", instagram: "DM IG", maps: "GMaps", site: "Lainnya" };
export const PASTE_LABEL: Record<PasteKind, string> = { threads: "Threads", instagram: "Instagram", maps: "Maps", site: "website", text: "teks" };

const LINK = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
// A mobile number (08…, +62 8…, 628…) or a landline with its area code ((021) 123 4567).
const PHONE = /(?:\+?62|\b0)[\s.-]?(?:8\d(?:[\s.-]?\d){7,11}|\(?[2-79]\d{1,2}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5})/g;
const HANDLE = /(^|[^\w.@/])@([A-Za-z0-9._]{2,30})/g;
const LABEL_ONLY = /^(wa|whatsapp|hp|no\.?\s*(hp|wa|telp?)|telp?|tel|phone|kontak|contact|email|e-mail|ig|instagram|threads)\s*[:.]?$/i;
const IG_NOT_PROFILE = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct"]);

const trimLink = (s: string) => s.replace(/[).,;:!?'"\]]+$/, "");
const urlOf = (s: string): URL | null => {
  try { return new URL(/^https?:/i.test(s) ? s : `https://${s}`); } catch { return null; }
};
const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");

export const isMapsLink = (u: URL) => {
  const h = host(u);
  return isShortMapsLink(u) || h === "maps.apple.com" || h === "openstreetmap.org" || h.startsWith("maps.google.")
    || (/^google\.[a-z.]+$/.test(h) && u.pathname.startsWith("/maps"));
};

/** 62812…, +62 812-…, 0812 … → 0812…; "" when it isn't a phone number. */
export function localPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  else if (d.startsWith("8")) d = "0" + d;
  return /^0\d{8,13}$/.test(d) ? d : "";
}

export function readPaste(text: string): PasteRead {
  const out: PasteRead = { kind: "text", url: "", name: "", address: "", phone: "", email: "", handle: "", place: readPlace(text) };
  // A bare domain on its own ("kopisenja.id") is a website; inside a sentence it's too easily something else.
  const bare = text.trim().match(/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i)?.[0];
  const links = (text.match(LINK) || (bare ? [bare] : [])).map(trimLink);
  let rest = links.reduce((t, l) => t.replace(l, "\n"), text);
  const found: Partial<Record<PasteKind, string>> = {};

  for (const link of links) {
    const u = urlOf(link);
    if (!u) continue;
    const h = host(u);
    if (h === "threads.com" || h === "threads.net") {
      found.threads ??= u.toString();
      out.handle ||= u.pathname.match(/^\/(@[A-Za-z0-9._]+)/)?.[1] || "";
    } else if (h === "instagram.com" || h === "instagr.am") {
      found.instagram ??= u.toString();
      const first = u.pathname.split("/")[1] || "";
      if (first && !IG_NOT_PROFILE.has(first.toLowerCase())) out.handle ||= `@${first.replace(/^@/, "")}`;
    } else if (isMapsLink(u)) {
      found.maps ??= u.toString();
    } else if (h === "wa.me" || h === "api.whatsapp.com" || h === "wa.link") {
      out.phone ||= localPhone(u.pathname.slice(1) || u.searchParams.get("phone") || "");
    } else if (h.includes(".")) {
      found.site ??= u.toString();
    }
  }
  if (out.place.point && !found.maps) found.maps = "";      // bare coordinates
  const kind = (["threads", "instagram", "maps", "site"] as const).find(k => k in found);
  if (kind) { out.kind = kind; out.url = found[kind] || ""; }

  out.email ||= (rest.match(EMAIL) || [])[0]?.toLowerCase() || "";
  rest = rest.replace(EMAIL, "\n");
  for (const m of rest.match(PHONE) || []) { const p = localPhone(m); if (p) { out.phone ||= p; rest = rest.replace(m, "\n"); } }
  const handle = Array.from(rest.matchAll(HANDLE))[0];
  if (handle) out.handle ||= `@${handle[2].replace(/\.+$/, "")}`;
  rest = rest.replace(HANDLE, "$1\n");

  // A Maps share sheet puts the place's name, then its address, around the
  // link. Plain text (a chat, a card) has no reliable name: that's for later.
  if (out.kind === "maps") {
    // Coordinates are the point already, and a label whose number or email was
    // taken ("WA", "Email:") is nothing on its own: neither is a name or an address.
    const lines = rest.split("\n")
      .map(l => l.replace(/^\s*(alamat|address)\s*:\s*/i, "").replace(/^[\s,·–-]+|[\s,·–-]+$/g, ""))
      .filter(l => l && !/^[-\d.,\s°'′"″NSEW]+$/i.test(l) && !LABEL_ONLY.test(l));
    out.name = out.place.name || lines.shift() || out.place.query;
    if (out.place.name && lines[0]?.toLowerCase() === out.place.name.toLowerCase()) lines.shift();
    out.address = lines.join(", ");
  }
  return out;
}

export const nothingIn = (r: PasteRead) => r.kind === "text" && !r.phone && !r.email && !r.handle;

export interface LeadText { name: string; contact: string; source: string; email: string; phone: string; notes: string }

/** What a paste adds to the form: empty fields only; notes get a line; the source follows the link. */
export function fillEmpty<T extends LeadText>(prev: T, patch: Partial<LeadText>): T {
  const next = { ...prev };
  for (const k of ["name", "contact", "email", "phone"] as const) {
    if (patch[k] && !prev[k].trim()) next[k] = patch[k] as string;
  }
  if (patch.source) next.source = patch.source;
  if (patch.notes && !prev.notes.includes(patch.notes)) next.notes = prev.notes.trim() ? `${prev.notes.trim()}\n${patch.notes}` : patch.notes;
  return next;
}
