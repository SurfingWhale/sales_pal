// What needs a move today (PRD-007 §2.6) — pure math, no Firebase, so the
// dashboard and the morning push (app/api/cron/digest) count the same way.

import type { Deal } from "@/lib/funnel";

export const STALL_DAYS = 7;
export const QUOTE_WAIT_DAYS = 3;

const dayMs = 86400000;
const toDay = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
export const daysFrom = (from: string, to: string) => Math.round((toDay(to) - toDay(from)) / dayMs);
export const shift = (iso: string, days: number) => new Date(toDay(iso) + days * dayMs).toISOString().slice(0, 10);

// Today's date in Jakarta, for the server (which runs in UTC).
export const wibToday = (now = Date.now()) => new Date(now + 7 * 3600000).toISOString().slice(0, 10);

export function lastMove(d: Deal): string {
  return [d.leadAt, d.qualifiedAt, d.quotedAt, d.wonAt].filter(Boolean).sort().pop() || d.leadAt;
}

export function stalled(deals: Deal[], on: string): { deal: Deal; lastMove: string; days: number }[] {
  return deals
    .filter(d => d.stage !== "paid" && d.stage !== "lost" && d.leadAt)
    .map(d => ({ deal: d, lastMove: lastMove(d), days: daysFrom(lastMove(d), on) }))
    .filter(x => x.days >= STALL_DAYS);
}

interface LeadLike { status?: string; nextActionDate?: string }
interface QuoteLike { status?: string; sentAt?: string }
interface InvoiceLike { dueDate?: string; items?: { qty?: number; price?: number }[]; discount?: number; payments?: { amount?: number }[] }
interface RejectionLike { followUpDate?: string }

const owed = (i: InvoiceLike) => {
  const total = Math.max(0, (i.items || []).reduce((a, x) => a + (x.qty || 0) * (x.price || 0), 0) - (i.discount || 0));
  return total - (i.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
};

// prospects: Hunting journeys due today (PRD-008), counted by lib/prospects.ts.
export interface DigestCounts { followUps: number; quotes: number; invoices: number; stalled: number; prospects?: number }

export function digest(on: string, d: { leads: LeadLike[]; quotes: QuoteLike[]; invoices: InvoiceLike[]; rejections: RejectionLike[]; deals: Deal[] }): DigestCounts {
  return {
    followUps:
      d.leads.filter(l => l.nextActionDate && l.nextActionDate <= on && l.status !== "Closed").length
      + d.rejections.filter(r => r.followUpDate === on).length,
    quotes: d.quotes.filter(q => q.status === "Terkirim" && q.sentAt && daysFrom(q.sentAt, on) >= QUOTE_WAIT_DAYS).length,
    invoices: d.invoices.filter(i => owed(i) > 0 && i.dueDate && i.dueDate < on).length,
    stalled: stalled(d.deals, on).length,
  };
}

// "3 follow-up · 1 penawaran nunggu · 2 deal macet" — or "" when nothing's due.
export function digestText(c: DigestCounts): string {
  return [
    c.prospects && `${c.prospects} prospek nunggu intro/follow-up`,
    c.followUps && `${c.followUps} follow-up`,
    c.quotes && `${c.quotes} penawaran nunggu jawaban`,
    c.invoices && `${c.invoices} invoice telat`,
    c.stalled && `${c.stalled} deal macet`,
  ].filter(Boolean).join(" · ");
}
