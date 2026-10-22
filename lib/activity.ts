// What you did, day by day (Log aktivitas): read from the records each action
// already leaves — prospect journeys, the DM log, hunting sessions, quotes,
// invoices and the Outreach / Rejection logs. Nothing extra is written, so
// there is nothing new for firestore.rules to cover.

import type { HuntSession, Prospect } from "@/lib/prospects";
import type { Hunt } from "@/lib/hunting";
import type { Invoice, Quote } from "@/lib/billing";
import { rupiah } from "@/lib/billing";

export type ActKind = "hunt" | "reply" | "sell" | "note";
export const ACT_KINDS: { id: ActKind; label: string }[] = [
  { id: "hunt", label: "Hunting" }, { id: "reply", label: "Respon" },
  { id: "sell", label: "Jualan" }, { id: "note", label: "Catatan" },
];
export const kindLabel = (k: ActKind) => ACT_KINDS.find(x => x.id === k)!.label;

// What happened, for counting (Dashboard tim, PRD-014): the kind above is for reading.
export type ActType = "post" | "dm" | "reply" | "status" | "etb" | "note" | "session"
  | "quote" | "quoteSent" | "won" | "invoice" | "payment" | "outreach" | "rejection";

export interface Activity {
  id: string;
  at: number;        // ms; a date-only record sits at noon
  day: string;       // local YYYY-MM-DD
  timed: boolean;    // false: the record only knows the day
  kind: ActKind;
  type: ActType;
  title: string;
  detail?: string;
  tab: string;       // where it lives in the app
  owner?: string;    // ownerUid in a guild
  amount?: number;   // a payment, in rupiah
}

type Owned = { ownerUid?: string };
type OutreachRow = { id: string; leadName: string; type: string; date: string; subject: string } & Owned;
type RejectionRow = { id: string; leadName: string; date: string; reason: string } & Owned;

export function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A stored date: ms, an ISO timestamp, or a plain YYYY-MM-DD.
function when(v: unknown): { at: number; day: string; timed: boolean } | null {
  if (typeof v === "number" && v > 0) return { at: v, day: ymd(v), timed: true };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  if (v.length === 10) return { at: new Date(v + "T12:00:00").getTime(), day: v, timed: false };
  const at = Date.parse(v);
  return Number.isNaN(at) ? null : { at, day: ymd(at), timed: true };
}

const clip = (s: string | undefined, n = 120) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t || undefined;
};

const KIND: Record<ActType, ActKind> = {
  post: "hunt", dm: "hunt", session: "hunt", reply: "reply", status: "reply", etb: "reply", rejection: "reply",
  quote: "sell", quoteSent: "sell", won: "sell", invoice: "sell", payment: "sell", note: "note", outreach: "note",
};
// Old DM log statuses that mean they answered.
const ANSWERED = ["Dibales", "Tertarik", "Ditolak"];

export function activities(src: {
  prospects: (Prospect & Owned)[]; hunts: (Hunt & Owned)[]; sessions: (HuntSession & Owned)[];
  quotes: (Quote & Owned)[]; invoices: (Invoice & Owned)[]; outreach: OutreachRow[]; rejections: RejectionRow[];
}): Activity[] {
  const out: Activity[] = [];
  const add = (id: string, v: unknown, type: ActType, title: string, tab: string, row: Owned, detail?: string, amount?: number) => {
    const w = when(v);
    if (!w) return;
    out.push({ id, ...w, kind: KIND[type], type, title, tab, ...(detail ? { detail } : {}), ...(row.ownerUid ? { owner: row.ownerUid } : {}), ...(amount ? { amount } : {}) });
  };

  const fromJourney = new Set<string>();
  for (const p of src.prospects) {
    const who = p.name ? `${p.name} (${p.handle})` : p.handle;
    (p.history || []).forEach((e, i) => {
      const id = `p_${p.id}_${i}`;
      if (e.huntId) fromJourney.add(e.huntId);
      if (e.kind === "post") add(id, e.at, "post", `Simpan post ${who}`, "Hunting", p, clip(e.text));
      else if (e.kind === "sent") add(id, e.at, "dm", `${e.channel === "post" ? "Balas di post" : "DM"} ke ${who}`, "Hunting", p,
        [e.template && `Pesan: ${e.template}`, e.campaign && `Kampanye: ${e.campaign}`].filter(Boolean).join(" · ") || undefined);
      else if (e.kind === "reply") add(id, e.at, "reply", `${who} bales`, "Hunting", p, clip(e.text));
      else if (e.kind === "status") add(id, e.at, "status", `${who}: ${clip(e.text, 80) || "status berubah"}`, "Hunting", p);
      else if (e.kind === "convert") add(id, e.at, "etb", `${who} jadi lead (ETB)`, "Leads", p, clip(e.text));
      else if (e.kind === "note") add(id, e.at, "note", `Catatan buat ${who}`, "Hunting", p, clip(e.text));
    });
    // Typed in rather than saved from a post: the journey starts when it was made.
    if (!(p.history || []).some(e => e.kind === "post")) add(`pc_${p.id}`, p.createdAt, "post", `Prospek baru ${who}`, "Hunting", p);
  }

  // DM log rows that aren't part of a journey (older ones, or typed by hand).
  for (const h of src.hunts) {
    if (h.prospectId || fromJourney.has(h.id)) continue;
    add(`h_${h.id}`, h.createdAt || h.date, "dm", `DM ke ${h.target}`, "Hunting", h, h.templateTitle ? `Pesan: ${h.templateTitle}` : undefined);
    if (h.status !== "Terkirim" && h.statusAt) add(`hs_${h.id}`, h.statusAt, ANSWERED.includes(h.status) ? "reply" : "status", `${h.target}: ${h.status}`, "Hunting", h, clip(h.note));
  }

  for (const s of src.sessions) {
    const end = s.endedAt || s.lastActionAt || s.startedAt;
    const min = Math.max(1, Math.round((end - s.startedAt) / 60000));
    const c = s.counts || { prospects: 0, intros: 0, replies: 0, converted: 0 };
    add(`s_${s.id}`, s.startedAt, "session", `Sesi hunting ${min} menit`, "Hunting", s,
      `${c.prospects} prospek · ${c.intros} intro · ${c.replies} dibales${c.converted ? ` · ${c.converted} ETB` : ""}`);
  }

  for (const q of src.quotes) {
    const what = `${q.number || "penawaran"} · ${q.leadName || "tanpa nama"}`;
    add(`q_${q.id}`, q.date, "quote", `Bikin penawaran ${what}`, "Penawaran", q);
    if (q.sentAt) add(`qs_${q.id}`, q.sentAt, "quoteSent", `Kirim penawaran ${what}`, "Penawaran", q);
    if (q.acceptedAt) add(`qa_${q.id}`, q.acceptedAt, "won", `Penawaran diterima ${what}`, "Penawaran", q);
  }

  for (const inv of src.invoices) {
    const what = `${inv.number || "invoice"} · ${inv.leadName || "tanpa nama"}`;
    if (inv.issuedAt) add(`i_${inv.id}`, inv.issuedAt, "invoice", `Terbitkan invoice ${what}`, "Invoice", inv);
    (inv.payments || []).forEach((pay, i) => add(`ip_${inv.id}_${i}`, pay.date, "payment", `Pembayaran masuk ${rupiah(pay.amount || 0)}`, "Invoice", inv, what, pay.amount || 0));
  }

  for (const o of src.outreach) add(`o_${o.id}`, o.date, "outreach", `${o.type || "Pesan"} ke ${o.leadName}`, "Outreach", o, clip(o.subject));
  for (const r of src.rejections) add(`r_${r.id}`, r.date, "rejection", `${r.leadName} nolak`, "Rejection Log", r, clip(r.reason));

  return out.sort((a, b) => b.at - a.at);
}

export function countByDay(acts: Activity[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of acts) m.set(a.day, (m.get(a.day) || 0) + 1);
  return m;
}

export const addDay = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d.getTime());
};

// Columns of seven days, Monday first, the last column holding today; days
// after today are null.
export function weekColumns(today: string, weeks: number): (string | null)[][] {
  const dow = (new Date(today + "T12:00:00").getDay() + 6) % 7; // Mon = 0
  const start = addDay(today, -dow - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => { const day = addDay(start, w * 7 + d); return day > today ? null : day; }));
}

// Days in a row with something done, up to today (or yesterday, while today is still open).
export function streak(counts: Map<string, number>, today: string): number {
  let day = counts.get(today) ? today : addDay(today, -1);
  let n = 0;
  while (counts.get(day)) { n++; day = addDay(day, -1); }
  return n;
}

// 0 = nothing, 1–4 = a quarter of the busiest day each.
export function heatLevel(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!n || !max) return 0;
  return Math.min(4, Math.max(1, Math.ceil((n / max) * 4))) as 1 | 2 | 3 | 4;
}
