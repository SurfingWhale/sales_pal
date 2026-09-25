// Where the money comes from: leads grouped by the source that brought them,
// with what closed and what was actually paid.
//
// A lead's source is one string. Website leads read "Web · visufavor ·
// instagram/2026-09-boost" or "Member · visufavor · …"; everything else is
// what was picked by hand ("GMaps", "DM IG", "Threads"…).

import { Invoice, paid } from "@/lib/billing";

export interface SourcedLead {
  id: string;
  source: string;
  status: string;
  value: number;
}

export type ReportMode = "channel" | "campaign";

export interface SourceRow {
  key: string;
  leads: number;
  hot: number;       // Hot or Closed: worth a conversation
  closed: number;
  closedValue: number;
  collected: number; // paid on invoices raised for these leads
}

// "Web · visufavor · instagram/boost" → channel "Web · visufavor", campaign "instagram/boost".
export function splitSource(source: string): { channel: string; campaign: string } {
  const parts = (source || "").split(" · ").map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return { channel: "Tanpa sumber", campaign: "" };
  if ((parts[0] === "Web" || parts[0] === "Member") && parts.length >= 2) {
    return { channel: `${parts[0]} · ${parts[1]}`, campaign: parts.slice(2).join(" · ") };
  }
  return { channel: parts.join(" · "), campaign: "" };
}

// In campaign mode only tagged website leads count, keyed by campaign; the
// member and claim leads of one campaign are counted together.
export function sourceReport(leads: SourcedLead[], invoices: Invoice[], mode: ReportMode): SourceRow[] {
  const paidByLead = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.leadId) paidByLead.set(inv.leadId, (paidByLead.get(inv.leadId) || 0) + paid(inv));
  }
  const rows = new Map<string, SourceRow>();
  for (const l of leads) {
    const { channel, campaign } = splitSource(l.source);
    const key = mode === "channel" ? channel : campaign;
    if (!key) continue;
    let r = rows.get(key);
    if (!r) { r = { key, leads: 0, hot: 0, closed: 0, closedValue: 0, collected: 0 }; rows.set(key, r); }
    r.leads++;
    if (l.status === "Hot" || l.status === "Closed") r.hot++;
    if (l.status === "Closed") { r.closed++; r.closedValue += l.value || 0; }
    r.collected += paidByLead.get(l.id) || 0;
  }
  return Array.from(rows.values()).sort((a, b) => b.collected - a.collected || b.closedValue - a.closedValue || b.leads - a.leads);
}
