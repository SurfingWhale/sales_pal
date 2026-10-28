"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Space, SpaceCollection, spaceDoc, spaceQuery } from "@/lib/space";
import type { SiteId, SitePrice } from "@/lib/sites";

// Selling a service, after the lead: the packages on offer, the quote sent,
// the invoice that follows it, and the money that comes in against it.
// Everything lives under users/{uid}/, which firestore.rules already covers.

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  description: string;
  cost?: number;          // internal: what one unit costs you (HPP); never printed
  // The pricelist the sites read (PRD-017 §3a, §6). description doubles as
  // "what's included" there; excludes is what isn't, one point per line.
  excludes?: string;
  sites?: Partial<Record<SiteId, SitePrice>>;
  version?: number;       // goes up on every change, from SalesPal or a site's admin
  updatedAt?: number;
  updatedFrom?: string;   // "salespal" or a site id
}

export { SITES, isSiteId, sitePrice } from "@/lib/sites";
export type { SiteId, SitePrice, PriceChange } from "@/lib/sites";

export interface LineItem {
  name: string;
  qty: number;
  price: number;
  description?: string;   // what's included, printed under the name
  // Internal (PRD-017): never printed, never sent to the client.
  unit?: string;
  cost?: number;          // what one unit costs you
  vendor?: string;        // who you pay for it
  componentId?: string;   // the catalog component it came from
  serviceId?: string;     // the package it came from
}

// The parts a price is built from (PRD-017 §2): your own time, gear, vendors,
// a studio, transport. Kept per space like the packages; internal only.
export const COMPONENT_KINDS = ["Jasa sendiri", "Alat", "Vendor", "Tempat/studio", "Transport & akomodasi", "Lainnya"] as const;
export const COMPONENT_UNITS = ["jam", "hari", "orang", "pcs", "paket", "km", "sesi"] as const;

export interface Component {
  id: string;
  name: string;
  kind: string;
  unit: string;
  cost: number;           // what one unit costs you
  price: number;          // what you charge for one unit by default
  vendor?: string;
  notes?: string;
}

// What the items cost you, and what is left of the price after that (before
// tax, which is not yours). Null when no item carries a cost yet.
export function costOf(items: LineItem[]): number | null {
  return items.some(i => typeof i.cost === "number") ? items.reduce((a, i) => a + (i.qty || 0) * (i.cost || 0), 0) : null;
}

export function marginOf(d: { items: LineItem[]; discount: number }): { amount: number; percent: number | null } | null {
  const cost = costOf(d.items);
  if (cost === null) return null;
  const net = Math.max(0, subtotal(d.items) - (d.discount || 0));
  return { amount: net - cost, percent: net ? Math.round(((net - cost) / net) * 100) : null };
}

export { MARGIN_TARGET } from "@/lib/sites";

// A quote kept to start the next one from (PRD-017 §4): the items with their
// internal cost, what the client gets, the payment schedule. Never the client.
export interface QuoteTemplate {
  id: string;
  name: string;
  items: LineItem[];
  deliverables?: string;
  exclusions?: string;
  timeline?: string;
  notes?: string;
  schedule?: Term[];
  taxPercent?: number;
  validDays?: number;
  createdAt: number;
}

// Digantikan: a revision of it was accepted, so its terms are no longer the
// effective ones (PRD-011 §4); it stays readable.
export const QUOTE_STATUS = ["Draft", "Terkirim", "Disetujui", "Ditolak", "Digantikan"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];

// What the job is, so it doesn't all end up in "Catatan" (QA 15 Okt): a title,
// when and where it happens, and what the client gets at the end.
export interface Brief {
  project?: string;       // "Foto katalog menu baru"
  eventDate?: string;     // YYYY-MM-DD, also feeds the job calendar
  eventTime?: string;     // "13.30–15.00 WIB"
  venue?: string;
  deliverables?: string;  // one per line
  timeline?: string;      // estimated work time: "File final 7 hari kerja setelah acara"
  exclusions?: string;    // outside the scope, one per line
}

// One row of a payment schedule: "DP 50% saat booking". Amounts come from the
// document's total; the last row takes the rounding remainder.
export interface Term { label: string; percent: number; when?: string }

export interface Quote extends Brief {
  id: string;
  number: string;
  leadId: string;
  leadName: string;
  contact: string;
  phone: string;
  items: LineItem[];
  discount: number;
  dpPercent: number;
  notes: string;
  date: string;
  validUntil: string;
  status: QuoteStatus;
  sentAt?: string;
  followUpAt?: string;     // the last nudge sent from Follow-up WA
  invoiceId?: string;       // the first invoice (older quotes have only this)
  invoiceIds?: string[];    // every invoice made from it (one per schedule row)
  ownerUid?: string;
  ownerName?: string;
  taxPercent?: number;      // PPN or other, on (subtotal − discount)
  schedule?: Term[];        // payment schedule; none = derived from dpPercent
  acceptedAt?: string;
  supersedes?: string;      // the quote this one revises
  supersededBy?: string;    // the accepted revision that replaced it
  // Frozen when the quote is sent (PRD-011): the letterhead and the terms it
  // went out with. Changing the business later never rewrites it.
  issuer?: Issuer;
  terms?: DocTerms;
  // Optional papers sent with it. Sending is not signing: signedAt is set
  // only when the owner marks it signed.
  spk?: Agreement;
  nda?: Agreement;
}

export interface Agreement {
  title: string;
  body: string;            // the filled text, as sent
  sentAt: string;
  signedAt?: string;
  declinedAt?: string;
}

export interface Payment {
  date: string;
  amount: number;
  note: string;
}

export interface Invoice extends Brief {
  id: string;
  number: string;
  quoteId: string;
  leadId: string;
  leadName: string;
  contact: string;
  phone: string;
  items: LineItem[];
  discount: number;
  dpPercent: number;
  notes: string;
  date: string;
  dueDate: string;
  payments: Payment[];
  ownerUid?: string;      // guild: the seller (lib/space.ts stamp)
  ownerName?: string;
  issuer?: Issuer;        // frozen when the invoice is made (PRD-011)
  taxPercent?: number;
  // Issuing is its own step, apart from being paid. Older invoices have no
  // field and count as issued.
  issue?: "Draft" | "Diterbitkan" | "Dibatalkan";
  issuedAt?: string;
  term?: { index: number; label: string; percent: number };  // which schedule row it bills
}

export interface Business {
  name: string;
  phone: string;
  email: string;
  bank: string;
  accountNo: string;
  accountName: string;
  footer: string;          // syarat & ketentuan, printed under every quote and invoice
  tagline?: string;        // what you do, under the name: "Fotografi & video event"
  logo?: string;           // small PNG/JPEG data URL (lib/image.ts), max ~120 KB
  address?: string;
  docs?: DocDefaults;      // copied into each new quote, then the quote's own
}

// The business's defaults for new paperwork (PRD-011 §4). Every field is
// optional; nothing assumes a 50% deposit or that it is non-refundable.
export interface DocDefaults {
  validDays?: number;      // quote valid for
  dpPercent?: number;
  dpWhen?: string;         // "saat booking"
  finalWhen?: string;      // "H-1 acara"
  revisions?: string;      // "1x revisi minor"
  cancellation?: string;   // cancellation and rescheduling
  schedule?: Term[];       // default payment schedule; none = from dpPercent
  taxPercent?: number;
  spkAuto?: boolean;       // tick the work agreement when sending a quote
  spkTitle?: string;       // "Perjanjian Kerja"
  spkTemplate?: string;
  ndaTemplate?: string;
}

// What a sent quote carries of the defaults.
export type DocTerms = Pick<DocDefaults, "dpWhen" | "finalWhen" | "revisions" | "cancellation">;

export type Issuer = Omit<Business, "docs">;

export const EMPTY_BUSINESS: Business = { name: "", phone: "", email: "", bank: "", accountNo: "", accountName: "", footer: "", tagline: "", logo: "", address: "" };

export function issuerOf(b: Business): Issuer {
  const { docs: _docs, ...rest } = b; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...EMPTY_BUSINESS, ...rest };
}
export function termsOf(b: Business): DocTerms {
  const d = b.docs || {};
  return { dpWhen: d.dpWhen || "", finalWhen: d.finalWhen || "", revisions: d.revisions || "", cancellation: d.cancellation || "" };
}

// ---- dates & money -------------------------------------------------------

// Local calendar dates. toISOString() is UTC, which in WIB turns every
// midnight-to-7am into yesterday and shifts addDays back by one.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function today(): string {
  return ymd(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + "T00:00:00").getTime() - new Date(fromIso + "T00:00:00").getTime()) / 86400000);
}

export function rupiah(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

// The same amount in a narrow cell: "Rp 27,5 jt", "Rp 1,2 M", "Rp 750 rb".
export function rupiahShort(n: number): string {
  const v = Math.round(n || 0), a = Math.abs(v);
  const f = (x: number) => x.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return a >= 1e9 ? `Rp ${f(v / 1e9)} M` : a >= 1e6 ? `Rp ${f(v / 1e6)} jt` : a >= 1e3 ? `Rp ${f(v / 1e3)} rb` : rupiah(v);
}

export function longDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function subtotal(items: LineItem[]): number {
  return items.reduce((a, i) => a + (i.qty || 0) * (i.price || 0), 0);
}

export function taxAmount(d: { items: LineItem[]; discount: number; taxPercent?: number }): number {
  const base = Math.max(0, subtotal(d.items) - (d.discount || 0));
  return d.taxPercent ? Math.round((base * d.taxPercent) / 100) : 0;
}

export function total(d: { items: LineItem[]; discount: number; taxPercent?: number }): number {
  return Math.max(0, subtotal(d.items) - (d.discount || 0)) + taxAmount(d);
}

// The schedule a quote is paid by: its own, or the old single DP split.
export function scheduleOf(q: { schedule?: Term[]; dpPercent: number }, t: { dpWhen?: string; finalWhen?: string } = {}): Term[] {
  if (q.schedule?.length) return q.schedule;
  if (!q.dpPercent || q.dpPercent >= 100) return [{ label: "Pembayaran penuh", percent: 100, ...(t.finalWhen ? { when: t.finalWhen } : {}) }];
  return [
    { label: "DP", percent: q.dpPercent, ...(t.dpWhen ? { when: t.dpWhen } : {}) },
    { label: "Pelunasan", percent: 100 - q.dpPercent, ...(t.finalWhen ? { when: t.finalWhen } : {}) },
  ];
}

// Each row's amount; the last row takes what rounding left over.
export function termAmounts(totalAmount: number, terms: Term[]): number[] {
  const out = terms.map(t => Math.round((totalAmount * (t.percent || 0)) / 100));
  if (out.length) out[out.length - 1] = totalAmount - out.slice(0, -1).reduce((a, n) => a + n, 0);
  return out;
}

export const scheduleSum = (terms: Term[]) => terms.reduce((a, t) => a + (t.percent || 0), 0);

export function dpAmount(d: { items: LineItem[]; discount: number; dpPercent: number }): number {
  return Math.round((total(d) * (d.dpPercent || 0)) / 100);
}

export function paid(inv: Invoice): number {
  return (inv.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
}

export function balance(inv: Invoice): number {
  return Math.max(0, total(inv) - paid(inv));
}

// Issued (older invoices without the field count as issued).
export const isIssued = (inv: Pick<Invoice, "issue">) => !inv.issue || inv.issue === "Diterbitkan";

// What the client still owes on it: nothing on a draft or a cancelled one.
export function owed(inv: Invoice): number {
  return isIssued(inv) ? balance(inv) : 0;
}

export type InvoiceState = "Lunas" | "DP masuk" | "Telat" | "Belum bayar" | "Draft" | "Dibatalkan";

export function invoiceState(inv: Invoice, on = today()): InvoiceState {
  if (inv.issue === "Dibatalkan") return "Dibatalkan";
  if (inv.issue === "Draft" && paid(inv) === 0) return "Draft";
  const p = paid(inv);
  if (p >= total(inv) && total(inv) > 0) return "Lunas";
  if (inv.dueDate && inv.dueDate < on) return "Telat";
  return p > 0 ? "DP masuk" : "Belum bayar";
}

export const invoiceColor: Record<InvoiceState, string> = {
  Lunas: "#00a862",
  "DP masuk": "#005eb0",
  Telat: "#ff4444",
  "Belum bayar": "#ff9900",
  Draft: "#64748b",
  Dibatalkan: "#94a3b8",
};

export const quoteColor: Record<QuoteStatus, string> = {
  Draft: "#64748b",
  Terkirim: "#005eb0",
  Disetujui: "#00a862",
  Ditolak: "#ff4444",
  Digantikan: "#94a3b8",
};

// Q-2609-001: prefix, year and month, then the next number in that month.
export function nextNumber(prefix: string, existing: string[], on = today()): string {
  const stem = `${prefix}-${on.slice(2, 4)}${on.slice(5, 7)}-`;
  const seq = existing
    .filter(n => n.startsWith(stem))
    .map(n => parseInt(n.slice(stem.length), 10) || 0);
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return stem + String(next).padStart(3, "0");
}

// ---- WhatsApp ------------------------------------------------------------

// wa.me wants the number in international form with no plus: 0812… → 62812…
export function waNumber(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}

export function waLink(phone: string, text: string): string {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

function itemLines(items: LineItem[]): string[] {
  return items.flatMap((i, n) => [
    `${n + 1}. ${i.name} — ${i.qty} × ${rupiah(i.price)} = ${rupiah(i.qty * i.price)}`,
    ...(i.description?.trim() ? i.description.trim().split("\n").map(l => `   ${l}`) : []),
  ]);
}

function briefLines(x: Brief): string[] {
  const when = [x.eventDate ? longDate(x.eventDate) : "", x.eventTime || ""].filter(Boolean).join(", ");
  const out = [
    x.project ? `*${x.project}*` : "",
    when ? `Acara: ${when}${x.venue ? ` · ${x.venue}` : ""}` : x.venue ? `Lokasi: ${x.venue}` : "",
  ].filter(Boolean);
  const del = (x.deliverables || "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (del.length) out.push("Deliverables:", ...del.map(l => `- ${l}`));
  if (x.timeline?.trim()) out.push(`Waktu pengerjaan: ${x.timeline.trim()}`);
  const ex = (x.exclusions || "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (ex.length) out.push("Di luar scope:", ...ex.map(l => `- ${l}`));
  return out.length ? [...out, ""] : [];
}

function signOff(b: Business): string[] {
  return [b.name, b.phone].filter(Boolean).length ? ["", [b.name, b.phone].filter(Boolean).join(" · ")] : [];
}

function transferLine(b: Business): string[] {
  return b.bank && b.accountNo
    ? ["", `Transfer ke: ${b.bank} ${b.accountNo}${b.accountName ? ` a.n. ${b.accountName}` : ""}`]
    : [];
}

export function quoteText(q: Quote, b: Business): string {
  const lines = [
    `*PENAWARAN ${q.number}*`,
    `Untuk: ${q.leadName}${q.contact && q.contact !== q.leadName ? ` (${q.contact})` : ""}`,
    `Tanggal: ${longDate(q.date)} · Berlaku s/d ${longDate(q.validUntil)}`,
    "",
    ...briefLines(q),
    ...itemLines(q.items),
    "",
  ];
  if (q.discount || q.taxPercent) lines.push(`Subtotal: ${rupiah(subtotal(q.items))}`);
  if (q.discount) lines.push(`Diskon: -${rupiah(q.discount)}`);
  if (q.taxPercent) lines.push(`Pajak ${q.taxPercent}%: ${rupiah(taxAmount(q))}`);
  lines.push(`*Total: ${rupiah(total(q))}*`);
  const terms = scheduleOf(q, q.terms);
  if (terms.length > 1) {
    const amt = termAmounts(total(q), terms);
    lines.push("", "Pembayaran:", ...terms.map((t, i) => `- ${t.label} ${t.percent}%: ${rupiah(amt[i])}${t.when ? ` (${t.when})` : ""}`));
  }
  if (q.notes) lines.push("", q.notes);
  lines.push(...signOff(b));
  return lines.join("\n");
}

export function invoiceText(inv: Invoice, b: Business): string {
  const p = paid(inv);
  const due = p === 0 && inv.dpPercent ? dpAmount(inv) : balance(inv);
  const lines = [
    `*INVOICE ${inv.number}*`,
    `Untuk: ${inv.leadName}`,
    `Tanggal: ${longDate(inv.date)} · Jatuh tempo: ${longDate(inv.dueDate)}`,
    "",
    ...briefLines(inv),
    ...itemLines(inv.items),
    "",
  ];
  if (inv.discount) lines.push(`Diskon: -${rupiah(inv.discount)}`);
  if (inv.taxPercent) lines.push(`Pajak ${inv.taxPercent}%: ${rupiah(taxAmount(inv))}`);
  lines.push(`Total: ${rupiah(total(inv))}`);
  if (p > 0) lines.push(`Sudah dibayar: ${rupiah(p)}`);
  lines.push(p === 0 && inv.dpPercent ? `*DP ${inv.dpPercent}% yang perlu dibayar: ${rupiah(due)}*` : `*Sisa tagihan: ${rupiah(due)}*`);
  lines.push(...transferLine(b));
  if (inv.notes) lines.push("", inv.notes);
  lines.push(...signOff(b));
  return lines.join("\n");
}

// ---- Firestore -----------------------------------------------------------

export function useUserCollection<T extends { id: string }>(uid: string, name: string): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    return onSnapshot(collection(db, "users", uid, name), snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
    });
  }, [uid, name]);
  return rows;
}

export function useBusiness(space: Space): Business {
  const [b, setB] = useState<Business>(EMPTY_BUSINESS);
  const key = `${space.kind}:${space.id}`;
  useEffect(() => {
    setB(EMPTY_BUSINESS);
    return onSnapshot(spaceDoc(space, "settings", "business"), snap => {
      setB({ ...EMPTY_BUSINESS, ...(snap.data() as Partial<Business> | undefined) });
    }, () => setB(EMPTY_BUSINESS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return b;
}

// A collection in the current workspace — in a guild, a Member's own rows.
export function useSpaceCollection<T extends { id: string }>(space: Space, name: SpaceCollection): T[] {
  const [rows, setRows] = useState<T[]>([]);
  const key = `${space.kind}:${space.id}:${space.role || ""}:${name}`;
  useEffect(() => {
    setRows([]);
    return onSnapshot(spaceQuery(space, name), snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
    }, () => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}
