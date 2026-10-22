// Dashboard tim (PRD-014 §2): what each seller did in a period and what came
// of it, counted from the same activities as Log aktivitas (lib/activity.ts),
// set against the period before it.

import { Activity, addDay } from "@/lib/activity";
import { rupiah, today } from "@/lib/billing";
import type { ReportDoc } from "@/lib/reportPdf";

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

// A rate against one that didn't exist (nothing sent before) is new, not "+100 poin".
export function rateChange(cur: number | null, prev: number | null): ReturnType<typeof change> {
  if (prev === null) return { text: cur === null ? "sama" : "baru", dir: 0 };
  return change(cur ?? 0, prev, "rate");
}

const dd = (d: string, year = false) => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
export const rangeText = (r: Range) => (r.from === r.to ? dd(r.from, true) : `${dd(r.from)} – ${dd(r.to, true)}`);

// The dashboard as a monthly-style report (PRD-014): the same numbers as on
// screen, for the Leader to send. One seller = their own report.
export function dashboardDoc(o: {
  title: string; team: boolean; period: string; cur: Range; prev: Range; s: Stats; p: Stats;
  trend: { day: string; n: number }[]; rows: { name: string; s: Stats }[]; quiet: { name: string; lastAt: number }[];
}): ReportDoc {
  const { s, p } = o;
  const kpi = (label: string, a: string, b: string, ch: ReturnType<typeof change>) => [label, a, b, ch.text];
  const rate = (x: Stats) => rateOf(x.replies, x.dms);
  const peak = o.trend.reduce((m, d) => (d.n > m.n ? d : m), o.trend[0] || { day: o.cur.to, n: 0 });
  const total = o.trend.reduce((a, d) => a + d.n, 0);
  const funnel: [string, number][] = [["Prospek baru", s.prospects], ["DM terkirim", s.dms], ["Dibales", s.replies], ["Jadi ETB", s.etb], ["Penawaran dikirim", s.quotesSent], ["Closing", s.won]];
  const busy = [...o.rows].filter(r => r.s.activities).sort((a, b) => b.s.activities - a.s.activities).slice(0, 3);
  const money = [...o.rows].filter(r => r.s.paid).sort((a, b) => b.s.paid - a.s.paid)[0];
  const n = o.trend.length;
  return {
    kicker: o.team ? "LAPORAN SALES TIM" : "LAPORAN SALES",
    title: o.title,
    subtitle: `${o.period} · ${rangeText(o.cur)}`,
    meta: [`Dibanding ${rangeText(o.prev)}`, `Dibuat ${dd(today(), true)}`],
    sections: [
      { title: "Angka utama", table: { head: ["Metrik", "Periode ini", "Sebelumnya", "Perubahan"], widths: [3.2, 2, 2, 2], bold: [1], rows: [
        kpi("Aktivitas", String(s.activities), String(p.activities), change(s.activities, p.activities)),
        kpi("Prospek baru", String(s.prospects), String(p.prospects), change(s.prospects, p.prospects)),
        kpi("DM terkirim", String(s.dms), String(p.dms), change(s.dms, p.dms)),
        kpi("Dibales", pct(rate(s)), pct(rate(p)), rateChange(rate(s), rate(p))),
        kpi("Jadi ETB (kasih data)", String(s.etb), String(p.etb), change(s.etb, p.etb)),
        kpi("Penawaran dikirim", String(s.quotesSent), String(p.quotesSent), change(s.quotesSent, p.quotesSent)),
        kpi("Closing (penawaran diterima)", String(s.won), String(p.won), change(s.won, p.won)),
        kpi("Uang masuk", rupiah(s.paid), rupiah(p.paid), change(s.paid, p.paid, "money")),
      ] } },
      { title: "Aktivitas per hari", chart: { values: o.trend.map(d => d.n), labels: n ? [dd(o.trend[0].day), dd(o.trend[Math.floor((n - 1) / 2)].day), dd(o.trend[n - 1].day)] : [] },
        note: total ? `Total ${total} aktivitas. Paling rame ${dd(peak.day)} (${peak.n}).` : "Belum ada aktivitas di periode ini." },
      { title: "Funnel", table: { head: ["Tahap", "Jumlah", "Dari tahap sebelumnya"], widths: [4, 2, 3], bold: [1],
        rows: funnel.map(([l, v], i) => [l, String(v), i ? pct(rateOf(v, funnel[i - 1][1])) : "—"]) },
        note: "Dihitung dari kejadian di periode ini, bukan per orang yang sama (cohort ada di Report Klien)." },
      ...(o.team && o.rows.length ? [{ title: "Per sales", table: {
        head: ["Sales", "Aktivitas", "DM", "Dibales", "ETB", "Penawaran", "Closing", "Uang masuk"], widths: [3, 1.4, 1, 1.4, 1, 1.6, 1.3, 2.4], bold: [0, 7],
        rows: o.rows.map(r => [r.name, String(r.s.activities), String(r.s.dms), pct(rate(r.s)), String(r.s.etb), String(r.s.quotesSent), String(r.s.won), rupiah(r.s.paid)]),
      } }] : []),
      ...(o.team ? [{ title: "Sorotan", lines: [
        busy.length ? `Paling aktif: ${busy.map(r => `${r.name} (${r.s.activities})`).join(", ")}.` : "Belum ada yang aktif di periode ini.",
        ...(money ? [`Uang masuk terbanyak: ${money.name} (${rupiah(money.s.paid)}).`] : []),
        ...(o.quiet.length ? [`Perlu dicek, ga ada aktivitas 3 hari atau lebih: ${o.quiet.map(q => q.name).join(", ")}.`] : []),
      ] }] : []),
    ],
    footer: "Dihitung dari yang tercatat di SalesPal: journey prospek, log DM, sesi hunting, penawaran, invoice & pembayaran, Outreach dan Rejection Log. Dibales dan ETB dihitung dari DM di periode yang sama. Perubahan di bawah 10 ditulis selisihnya, bukan persen. Omzet pipeline guild ada di Report Tim.",
  };
}
