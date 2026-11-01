// Where a lead stands (PRD-021): one word for the list, what's missing, and
// the next move. Prospecting and selling are one funnel, so all of it is read
// from what actually happened, not from a date a form stamped.
// Pure; no Firestore.

import { daysBetween } from "@/lib/billing";

export type StandId = "belum" | "dikontak" | "dibales" | "penawaran" | "deal" | "gugur";
export type Move = { kind: "chat" | "edit" | "open"; label: string };

export interface StandLead {
  id: string; name: string; status: string; source: string; contact: string; phone: string; lastContact: string;
  email?: string; lastReplyAt?: string; contactedAt?: string; geo?: unknown; quoted?: boolean;
}

// What says a lead was really reached, and which quotes still count as an offer.
export interface Touches {
  outreach: { leadId?: string; leadName: string }[];
  hunts: { leadId?: string }[];
  quotes: { leadId: string; leadName: string; number: string; project?: string; status: string }[];
  invoices: { leadId: string; leadName: string; number: string; project?: string }[];
}

const OFFER = new Set(["Terkirim", "Disetujui"]);
const low = (s: string) => (s || "").trim().toLowerCase();

// Until 29 Okt every new or imported lead was stamped "contacted today", so a
// Cold lead's lastContact proves nothing by itself. Without a chat, a DM, a
// reply, a document or contactedAt behind it, the lead was never contacted: it
// reads as new everywhere (the list, the score, the first script), and nothing
// is rewritten. contactedAt lives on the lead because a Member can't read
// another seller's Outreach rows.
// `quoted` and `docs` (quote and invoice numbers, for search) come along.
export function withStand<T extends StandLead>(leads: T[], t: Touches): (T & { quoted: boolean; docs: string })[] {
  const reached = new Set<string>();
  const quoted = new Set<string>();
  const docs = new Map<string, string[]>();
  const keys = (x: { leadId?: string; leadName?: string }) => [x.leadId, x.leadName && `n:${low(x.leadName)}`].filter(Boolean) as string[];
  const note = (x: { leadId: string; leadName: string; number: string; project?: string }) => {
    for (const k of keys(x)) { reached.add(k); docs.set(k, [...(docs.get(k) || []), x.number, x.project || ""]); }
  };
  for (const o of t.outreach) keys(o).forEach(k => reached.add(k));
  for (const h of t.hunts) if (h.leadId) reached.add(h.leadId);
  for (const q of t.quotes) { note(q); if (OFFER.has(q.status)) keys(q).forEach(k => quoted.add(k)); }
  for (const i of t.invoices) note(i);

  return leads.map(l => {
    const both = [l.id, `n:${low(l.name)}`];
    const never = l.status === "Cold" && !l.lastReplyAt && !l.contactedAt && !both.some(k => reached.has(k));
    return {
      ...l,
      ...(never ? { lastContact: "" } : {}),
      quoted: both.some(k => quoted.has(k)),
      docs: both.flatMap(k => docs.get(k) || []).filter(Boolean).join(" "),
    };
  });
}

export function standId(l: Pick<StandLead, "status" | "quoted" | "lastReplyAt" | "lastContact">): StandId {
  if (l.status === "Lost") return "gugur";
  if (l.status === "Closed") return "deal";
  if (l.quoted) return "penawaran";
  if (l.lastReplyAt) return "dibales";
  return l.lastContact ? "dikontak" : "belum";
}

const ago = (iso: string, on: string) => {
  const d = daysBetween(iso, on);
  return d <= 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`;
};

export function standOf(l: StandLead, on: string): { id: StandId; word: string; color: string } {
  const id = standId(l);
  switch (id) {
    case "gugur": return { id, word: "Gugur", color: "var(--app-muted)" };
    case "deal": return { id, word: "Deal", color: "var(--ok)" };
    case "penawaran": return { id, word: "Penawaran terkirim", color: "var(--brand-text)" };
    case "dibales": return { id, word: `Dibales ${ago(l.lastReplyAt as string, on)}`, color: "var(--ok)" };
    case "dikontak": return { id, word: `Dikontak ${ago(l.lastContact, on)}`, color: "var(--warm)" };
    // Neutral: most of a list is here, and red is Hot's color.
    default: return { id, word: "Belum dikontak", color: "var(--app-muted)" };
  }
}

const noNumber = (l: Pick<StandLead, "phone">) => (l.phone || "").replace(/\D/g, "").length < 8;

/** What the lead's record still lacks to be worked. */
export const missingOf = (l: StandLead) => [noNumber(l) ? "No HP" : "", l.geo ? "" : "Lokasi"].filter(Boolean);

// A DM lead needs no phone number: the script is copied into the DM.
const reachedByDm = (l: StandLead) => /threads|instagram|\big\b/i.test(l.source || "") || (l.contact || "").startsWith("@");

// They answered and we haven't: if we wrote last, it's a follow-up. Marking a
// reply stamps lastContact too, so contactedAt, what we sent, decides once it
// exists. Dates are whole days: a reply on the day we wrote reads as ours.
export function ourTurn(l: Pick<StandLead, "status" | "quoted" | "lastReplyAt" | "lastContact" | "contactedAt">): boolean {
  if (standId(l) !== "dibales") return false;
  const reply = l.lastReplyAt as string;
  return l.contactedAt ? reply > l.contactedAt : reply >= l.lastContact;
}

export function nextMove(l: StandLead): Move {
  const id = standId(l);
  if (id === "deal" || id === "gugur") return { kind: "open", label: "Buka" };
  if (id === "penawaran") return { kind: "open", label: "Lihat penawaran" };
  if (noNumber(l) && !reachedByDm(l) && !l.email) return { kind: "edit", label: "Tambah nomor" };
  if (ourTurn(l)) return { kind: "chat", label: "Balas" };
  return { kind: "chat", label: id === "belum" ? "Kirim intro" : "Follow-up" };
}
