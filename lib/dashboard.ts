// Dashboard tim (PRD-014 §2): what each seller did in a period and what came
// of it, counted from the same activities as Log aktivitas (lib/activity.ts),
// set against the period before it.

import { Activity, addDay } from "@/lib/activity";

export type PeriodId = "7d" | "30d" | "month" | "lastMonth";
export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "7d", label: "7 hari" }, { id: "30d", label: "30 hari" },
  { id: "month", label: "Bulan ini" }, { id: "lastMonth", label: "Bulan lalu" },
];

export interface Range { from: string; to: string }

const monthStart = (day: string) => day.slice(0, 8) + "01";
const monthEnd = (day: string) => addDay(addDay(monthStart(day), 32).slice(0, 8) + "01", -1);
const span = (r: Range) => Math.round((new Date(r.to + "T12:00:00").getTime() - new Date(r.from + "T12:00:00").getTime()) / 86400000) + 1;

// The period, and the one before it to compare with. "Bulan ini" is set
// against the same number of days of last month, not all of it.
export function rangeOf(id: PeriodId, today: string): { cur: Range; prev: Range } {
  if (id === "7d" || id === "30d") {
    const n = id === "7d" ? 7 : 30;
    const cur = { from: addDay(today, -(n - 1)), to: today };
    return { cur, prev: { from: addDay(cur.from, -n), to: addDay(cur.from, -1) } };
  }
  if (id === "month") {
    const cur = { from: monthStart(today), to: today };
    const pFrom = monthStart(addDay(cur.from, -1));
    const pTo = addDay(pFrom, span(cur) - 1);
    return { cur, prev: { from: pFrom, to: pTo > monthEnd(pFrom) ? monthEnd(pFrom) : pTo } };
  }
  const from = monthStart(addDay(monthStart(today), -1));
  const cur = { from, to: monthEnd(from) };
  const pFrom = monthStart(addDay(from, -1));
  return { cur, prev: { from: pFrom, to: monthEnd(pFrom) } };
}

export const inRange = (a: Activity, r: Range) => a.day >= r.from && a.day <= r.to;

export interface Stats {
  activities: number;
  prospects: number;   // new prospects (a post saved, or typed in)
  dms: number;         // intros and follow-ups sent
  replies: number;
  etb: number;         // gave their data: NTB → ETB
  quotesSent: number;
  won: number;         // quotes accepted
  paid: number;        // rupiah in
  lastAt: number;      // ms, 0 = never
}

export function stats(acts: Activity[], r?: Range): Stats {
  const s: Stats = { activities: 0, prospects: 0, dms: 0, replies: 0, etb: 0, quotesSent: 0, won: 0, paid: 0, lastAt: 0 };
  for (const a of acts) {
    if (a.at > s.lastAt) s.lastAt = a.at;
    if (r && !inRange(a, r)) continue;
    s.activities++;
    if (a.type === "post") s.prospects++;
    else if (a.type === "dm") s.dms++;
    else if (a.type === "reply") s.replies++;
    else if (a.type === "etb") s.etb++;
    else if (a.type === "quoteSent") s.quotesSent++;
    else if (a.type === "won") s.won++;
    else if (a.type === "payment") s.paid += a.amount || 0;
  }
  return s;
}

// A share of sends; null when nothing was sent. Capped: a reply can come in a
// period after its DM.
export const rateOf = (part: number, whole: number) => (whole ? Math.min(1, part / whole) : null);
export const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

// The change against the period before, said so a small number isn't a big
// percentage (PRD-005: under 10, the difference itself).
export function change(cur: number, prev: number, kind: "count" | "money" | "rate" = "count"): { text: string; dir: -1 | 0 | 1 } {
  const d = cur - prev;
  const dir = (d > 0 ? 1 : d < 0 ? -1 : 0) as -1 | 0 | 1;
  if (!d) return { text: "sama", dir };
  const sign = d > 0 ? "+" : "−";
  if (kind === "rate") return { text: `${sign}${Math.abs(Math.round(d * 100))} poin`, dir };
  if (prev < 10 && kind === "count") return { text: `${sign}${Math.abs(d)}`, dir };
  if (!prev) return { text: "baru", dir };
  return { text: `${sign}${Math.abs(Math.round((d / prev) * 100))}%`, dir };
}

export function perDay(acts: Activity[], r: Range): { day: string; n: number }[] {
  const m = new Map<string, number>();
  for (const a of acts) if (inRange(a, r)) m.set(a.day, (m.get(a.day) || 0) + 1);
  const out: { day: string; n: number }[] = [];
  for (let d = r.from; d <= r.to; d = addDay(d, 1)) out.push({ day: d, n: m.get(d) || 0 });
  return out;
}

// Whose is it: the record's owner, or you in your own space.
export const ownerOf = (a: Activity, me: string) => a.owner || me;

export const daysSince = (ms: number, now = Date.now()) => (ms ? Math.floor((now - ms) / 86400000) : Infinity);
