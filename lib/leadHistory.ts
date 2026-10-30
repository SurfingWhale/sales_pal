// A customer's whole story in one list (PRD-021): every DM, chat, offer and
// invoice that belongs to a lead, newest first, so opening a lead answers
// "what have we already offered them?". Pure; no Firestore.

import { Invoice, Quote, invoiceState, rupiah, total } from "@/lib/billing";

export interface HistoryItem {
  id: string;
  at: string;                                  // YYYY-MM-DD
  kind: "penawaran" | "invoice" | "chat" | "dm" | "balas";
  title: string;
  note?: string;
  docId?: string;                              // a quote or invoice that can be opened
}

export interface HistorySources {
  quotes: Quote[];
  invoices: Invoice[];
  outreach: { id: string; leadId?: string; leadName: string; type: string; subject: string; date: string }[];
  hunts: { id: string; leadId?: string; templateTitle: string; status: string; date: string }[];
}

export function leadHistory(l: { id: string; name: string; lastReplyAt?: string }, s: HistorySources): HistoryItem[] {
  const mine = (x: { leadId?: string; leadName?: string }) => x.leadId ? x.leadId === l.id : x.leadName === l.name;
  const items: HistoryItem[] = [
    ...s.quotes.filter(mine).map((q): HistoryItem => ({
      id: `q_${q.id}`, kind: "penawaran", at: q.sentAt || q.date, docId: q.id,
      title: `Penawaran ${q.number}${q.project ? ` · ${q.project}` : ""}`, note: `${rupiah(total(q))} · ${q.status}`,
    })),
    ...s.invoices.filter(mine).map((i): HistoryItem => ({
      id: `i_${i.id}`, kind: "invoice", at: i.date, docId: i.id,
      title: `Invoice ${i.number}${i.project ? ` · ${i.project}` : ""}`, note: `${rupiah(total(i))} · ${invoiceState(i)}`,
    })),
    ...s.outreach.filter(mine).map((o): HistoryItem => ({ id: `o_${o.id}`, kind: "chat", at: o.date, title: `${o.type || "Pesan"}: ${o.subject}` })),
    ...s.hunts.filter(h => h.leadId === l.id).map((h): HistoryItem => ({ id: `h_${h.id}`, kind: "dm", at: h.date, title: `DM: ${h.templateTitle}`, note: h.status })),
    ...(l.lastReplyAt ? [{ id: "reply", kind: "balas", at: l.lastReplyAt, title: "Mereka bales" } as HistoryItem] : []),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** "2 penawaran · 1 invoice": what's on file, at a glance. */
export function historySummary(items: HistoryItem[]): string {
  const n = (k: HistoryItem["kind"]) => items.filter(i => i.kind === k).length;
  return [n("penawaran") && `${n("penawaran")} penawaran`, n("invoice") && `${n("invoice")} invoice`].filter(Boolean).join(" · ");
}
