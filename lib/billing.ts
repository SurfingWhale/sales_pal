"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
}

export interface LineItem {
  name: string;
  qty: number;
  price: number;
}

export const QUOTE_STATUS = ["Draft", "Terkirim", "Disetujui", "Ditolak"] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];

export interface Quote {
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
  invoiceId?: string;
}

export interface Payment {
  date: string;
  amount: number;
  note: string;
}

export interface Invoice {
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
}

export interface Business {
  name: string;
  phone: string;
  email: string;
  bank: string;
  accountNo: string;
  accountName: string;
  footer: string;
}

export const EMPTY_BUSINESS: Business = { name: "", phone: "", email: "", bank: "", accountNo: "", accountName: "", footer: "" };

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

export function longDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function subtotal(items: LineItem[]): number {
  return items.reduce((a, i) => a + (i.qty || 0) * (i.price || 0), 0);
}

export function total(d: { items: LineItem[]; discount: number }): number {
  return Math.max(0, subtotal(d.items) - (d.discount || 0));
}

export function dpAmount(d: { items: LineItem[]; discount: number; dpPercent: number }): number {
  return Math.round((total(d) * (d.dpPercent || 0)) / 100);
}

export function paid(inv: Invoice): number {
  return (inv.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
}

export function balance(inv: Invoice): number {
  return Math.max(0, total(inv) - paid(inv));
}

export type InvoiceState = "Lunas" | "DP masuk" | "Telat" | "Belum bayar";

export function invoiceState(inv: Invoice, on = today()): InvoiceState {
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
};

export const quoteColor: Record<QuoteStatus, string> = {
  Draft: "#64748b",
  Terkirim: "#005eb0",
  Disetujui: "#00a862",
  Ditolak: "#ff4444",
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
  return items.map((i, n) => `${n + 1}. ${i.name} — ${i.qty} × ${rupiah(i.price)} = ${rupiah(i.qty * i.price)}`);
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
    ...itemLines(q.items),
    "",
  ];
  if (q.discount) lines.push(`Subtotal: ${rupiah(subtotal(q.items))}`, `Diskon: -${rupiah(q.discount)}`);
  lines.push(`*Total: ${rupiah(total(q))}*`);
  if (q.dpPercent) lines.push(`DP ${q.dpPercent}% untuk kunci jadwal: ${rupiah(dpAmount(q))}`);
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
    ...itemLines(inv.items),
    "",
  ];
  if (inv.discount) lines.push(`Diskon: -${rupiah(inv.discount)}`);
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

export function useBusiness(uid: string): Business {
  const [b, setB] = useState<Business>(EMPTY_BUSINESS);
  useEffect(() => {
    return onSnapshot(doc(db, "users", uid, "settings", "business"), snap => {
      setB({ ...EMPTY_BUSINESS, ...(snap.data() as Partial<Business> | undefined) });
    });
  }, [uid]);
  return b;
}
