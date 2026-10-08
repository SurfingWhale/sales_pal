// End-to-end funnel for an agency's clients (docs/prd/PRD-005): every chat
// keeps the source that brought it, every deal keeps the day it reached each
// stage, and the monthly report is computed from those — so sales and social
// finally join. Pure functions only; Firestore lives in components/ClientHub.
//
// Data, all under users/{uid}/clients/{clientId}/:
//   (client doc)  { name, segmentThreshold, createdAt }
//   deals/{id}    one purchase: contact, firstTouch, stage dates, amounts
//   posts/{id}    one published item (or a "total" row) with its numbers
//   reports/{m}   a frozen month: computed snapshot + edited narrative

export const CHANNELS = ["Instagram", "TikTok", "Facebook", "Threads", "WhatsApp", "Iklan", "Teman", "Repeat", "Lainnya", "Ga tau"] as const;
export type Channel = (typeof CHANNELS)[number];
export const UNKNOWN: Channel = "Ga tau";

export type TouchMethod = "self_report" | "link_code" | "promo_code" | "seller_guess" | "unknown";

// Set once when the chat is logged; only an unknown source may be filled in later.
export interface FirstTouch {
  channel: Channel;
  method: TouchMethod;
  code?: string;          // /go code or promo code, e.g. REEL12
  heardFrom?: string;     // "dari mana tahu kami?" verbatim
  at: string;             // YYYY-MM-DD
}

export const STAGES = ["lead", "qualified", "quoted", "won", "paid"] as const;
export type Stage = (typeof STAGES)[number] | "lost";
export const STAGE_LABEL: Record<Stage, string> = {
  lead: "Lead", qualified: "Qualified", quoted: "Penawaran", won: "Won", paid: "Lunas", lost: "Gugur",
};
const STAGE_FIELD = { lead: "leadAt", qualified: "qualifiedAt", quoted: "quotedAt", won: "wonAt", paid: "paidAt" } as const;

export interface Deal {
  id: string;
  contactName: string;
  phone: string;
  firstTouch: FirstTouch;
  stage: Stage;
  leadAt: string;
  qualifiedAt?: string;
  quotedAt?: string;
  wonAt?: string;
  paidAt?: string;
  lostAt?: string;
  lostReason?: string;
  quoteValue?: number;
  paidAmount?: number;
  isRepeat?: boolean;
  note?: string;
  ownerUid?: string;      // guild deals: the seller who owns it
  ownerName?: string;
}

export const PLATFORMS = ["Instagram", "TikTok", "Facebook", "Threads"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface Post {
  id: string;
  month: string;          // YYYY-MM
  platform: Platform;
  title: string;
  format?: string;        // video / reel / static / carousel / total
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface Client { id: string; name: string; segmentThreshold?: number }

// ---------- small helpers ----------

export const monthOf = (iso?: string) => (iso ? iso.slice(0, 7) : "");

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function juta(n: number): string {
  if (Math.abs(n) >= 1e6) return `Rp ${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
const pct1 = (r: number) => `${(r * 100).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
const num = (n: number) => Math.round(n).toLocaleString("id-ID");
const dec1 = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// Wilson 95% interval for k of n — honest bounds on small numbers.
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// A deal that got to a later stage counts as having passed every earlier one,
// even if it was logged straight as lunas.
export const reached = (d: Deal, s: (typeof STAGES)[number]) =>
  STAGES.slice(STAGES.indexOf(s)).some(x => Boolean(d[STAGE_FIELD[x]]));

// ---------- stage moves ----------

// The update that moves a deal to `to`, filling the date of every stage it
// skipped over so the funnel never shows a deal paid but never quoted.
export function advance(d: Deal, to: Stage, on: string, amount?: number): Partial<Deal> {
  if (to === "lost") return { stage: "lost", lostAt: on };
  const upd: Partial<Deal> = { stage: to };
  for (const s of STAGES) {
    const f = STAGE_FIELD[s];
    if (!d[f]) (upd as Record<string, string>)[f] = on;
    if (s === to) break;
  }
  if (to === "quoted" && amount != null) upd.quoteValue = amount;
  if (to === "paid" && amount != null) upd.paidAmount = amount;
  return upd;
}

// ---------- the monthly numbers ----------

export interface PlatformRow {
  platform: Platform;
  posts: number;
  views: number;
  engagement: number;
  erViews: number;        // (likes+comments+shares+saves) ÷ views
  savesPerView: number;
  sharesPerView: number;
  leads: number;          // chats this month whose first touch is this platform
  revenue: number;        // lunas this month, first touch on this platform
}

export interface MonthNumbers {
  month: string;
  // outcome, by the month the money came in
  revenue: number;
  paidCount: number;
  avgDeal: number;
  medianDeal: number;
  bigCount: number;       // deals at or above the client's segment threshold
  bigRevenue: number;
  smallCount: number;
  smallRevenue: number;
  bySource: { channel: Channel; count: number; revenue: number }[];
  unknownPaidShare: number;
  // funnel, by the month the chat came in (cohort)
  leads: number;
  qualified: number;
  quoted: number;
  won: number;
  paidFromCohort: number;
  lost: number;
  unknownLeadShare: number;
  cohortMature: boolean;
  // content
  posts: number;
  views: number;
  engagement: number;
  erViews: number;
  platforms: PlatformRow[];
  top: Post[];
  bottom: Post[];
  // the join
  leadsPer1kViews: number | null;
  revenuePer1kViews: number | null;
  hasData: boolean;
}

export function computeMonth(month: string, deals: Deal[], posts: Post[], threshold = 5_000_000, today = new Date().toISOString().slice(0, 10)): MonthNumbers {
  const paid = deals.filter(d => d.paidAt && monthOf(d.paidAt) === month);
  const amounts = paid.map(d => d.paidAmount || 0);
  const revenue = amounts.reduce((a, b) => a + b, 0);
  const big = paid.filter(d => (d.paidAmount || 0) >= threshold);
  const small = paid.filter(d => (d.paidAmount || 0) < threshold);

  const srcMap = new Map<Channel, { count: number; revenue: number }>();
  for (const d of paid) {
    const c = d.firstTouch?.channel || UNKNOWN;
    const e = srcMap.get(c) || { count: 0, revenue: 0 };
    e.count++; e.revenue += d.paidAmount || 0;
    srcMap.set(c, e);
  }
  if (!srcMap.has(UNKNOWN)) srcMap.set(UNKNOWN, { count: 0, revenue: 0 });
  const bySource = Array.from(srcMap.entries())
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => (a.channel === UNKNOWN ? 1 : b.channel === UNKNOWN ? -1 : b.revenue - a.revenue));

  const cohort = deals.filter(d => monthOf(d.leadAt) === month);
  const unknownLeads = cohort.filter(d => (d.firstTouch?.channel || UNKNOWN) === UNKNOWN).length;

  // A cohort is mature once its month ended longer ago than 3 in 4 deals take to pay.
  const lags = deals.filter(d => d.paidAt).map(d => Math.max(0, daysBetween(d.leadAt, d.paidAt as string)));
  const p75 = lags.length >= 5 ? percentile(lags, 0.75) : 30;
  const monthEnd = `${shiftMonth(month, 1)}-01`;
  const cohortMature = daysBetween(monthEnd, today) >= p75;

  const mPosts = posts.filter(p => p.month === month);
  const eng = (p: Post) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
  const views = mPosts.reduce((a, p) => a + (p.views || 0), 0);
  const engagement = mPosts.reduce((a, p) => a + eng(p), 0);
  const realPosts = mPosts.filter(p => p.format !== "total");

  const platforms: PlatformRow[] = PLATFORMS.map(platform => {
    const ps = mPosts.filter(p => p.platform === platform);
    const v = ps.reduce((a, p) => a + (p.views || 0), 0);
    const e = ps.reduce((a, p) => a + eng(p), 0);
    return {
      platform,
      posts: ps.filter(p => p.format !== "total").length,
      views: v,
      engagement: e,
      erViews: v ? e / v : 0,
      savesPerView: v ? ps.reduce((a, p) => a + (p.saves || 0), 0) / v : 0,
      sharesPerView: v ? ps.reduce((a, p) => a + (p.shares || 0), 0) / v : 0,
      leads: cohort.filter(d => d.firstTouch?.channel === platform).length,
      revenue: paid.filter(d => d.firstTouch?.channel === platform).reduce((a, d) => a + (d.paidAmount || 0), 0),
    };
  }).filter(r => r.views || r.posts || r.leads || r.revenue);

  const ranked = [...realPosts].sort((a, b) => b.views - a.views);

  return {
    month,
    revenue,
    paidCount: paid.length,
    avgDeal: paid.length ? revenue / paid.length : 0,
    medianDeal: median(amounts),
    bigCount: big.length,
    bigRevenue: big.reduce((a, d) => a + (d.paidAmount || 0), 0),
    smallCount: small.length,
    smallRevenue: small.reduce((a, d) => a + (d.paidAmount || 0), 0),
    bySource,
    unknownPaidShare: paid.length ? (srcMap.get(UNKNOWN)?.count || 0) / paid.length : 0,
    leads: cohort.length,
    qualified: cohort.filter(d => reached(d, "qualified")).length,
    quoted: cohort.filter(d => reached(d, "quoted")).length,
    won: cohort.filter(d => reached(d, "won")).length,
    paidFromCohort: cohort.filter(d => reached(d, "paid")).length,
    lost: cohort.filter(d => d.stage === "lost").length,
    unknownLeadShare: cohort.length ? unknownLeads / cohort.length : 0,
    cohortMature,
    posts: realPosts.length,
    views,
    engagement,
    erViews: views ? engagement / views : 0,
    platforms,
    top: ranked.slice(0, 5),
    bottom: ranked.length > 5 ? ranked.slice(-5).reverse() : [],
    leadsPer1kViews: views ? cohort.length / (views / 1000) : null,
    revenuePer1kViews: views ? revenue / (views / 1000) : null,
    hasData: paid.length > 0 || cohort.length > 0 || mPosts.length > 0,
  };
}

// ---------- comparison against the trailing three months ----------

export type Kind = "count" | "money" | "rate" | "ratio";

export interface Baseline {
  months: number;          // how many earlier months had data (0–3)
  revenue: number | null;
  paidCount: number | null;
  avgDeal: number | null;
  leads: number | null;
  views: number | null;
  erViews: number | null;
  leadsPer1kViews: number | null;
}

export function baseline(month: string, deals: Deal[], posts: Post[], threshold?: number, today?: string): Baseline {
  const prev = [1, 2, 3].map(i => computeMonth(shiftMonth(month, -i), deals, posts, threshold, today)).filter(m => m.hasData);
  const avg = (f: (m: MonthNumbers) => number | null, need: (m: MonthNumbers) => boolean = () => true) => {
    const xs = prev.filter(need).map(f).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  return {
    months: prev.length,
    revenue: avg(m => m.revenue),
    paidCount: avg(m => m.paidCount),
    avgDeal: avg(m => m.avgDeal, m => m.paidCount > 0),
    leads: avg(m => m.leads),
    views: avg(m => m.views, m => m.views > 0),
    erViews: avg(m => m.erViews, m => m.views > 0),
    leadsPer1kViews: avg(m => m.leadsPer1kViews, m => m.views > 0),
  };
}

// How a change is shown. It refuses what the numbers can't support:
// no baseline → "bulan dasar"; small counts → X → Y without a percent;
// rates → percentage points, never a percent of a percent.
export function delta(cur: number, base: number | null, kind: Kind): { text: string; tone: "up" | "down" | "flat" | "none" } {
  if (base == null) return { text: "— bulan dasar", tone: "none" };
  const tone = cur > base * 1.0001 ? "up" : cur < base * 0.9999 ? "down" : "flat";
  if (kind === "rate") {
    const pp = (cur - base) * 100;
    return { text: `${pp >= 0 ? "+" : "−"}${dec1(Math.abs(pp))} poin vs rata-rata 3 bln`, tone };
  }
  if (kind === "count" && (cur < 10 || base < 10)) {
    return { text: `basis kecil · rata-rata ${dec1(base)} → ${num(cur)}`, tone };
  }
  const fmt = kind === "money" ? juta : kind === "ratio" ? dec1 : num;
  if (!base) return { text: `${fmt(base)} → ${fmt(cur)}`, tone };
  const p = ((cur - base) / base) * 100;
  return { text: `${fmt(base)} → ${fmt(cur)} (${p >= 0 ? "+" : "−"}${Math.round(Math.abs(p))}%)`, tone };
}

// ---------- the words ----------

export function narrative(m: MonthNumbers, b: Baseline, clientName: string): string {
  const lines: string[] = [];
  const name = monthName(m.month);
  if (m.paidCount) {
    let line = `Omzet lunas ${name}: ${juta(m.revenue)} dari ${m.paidCount} deal`;
    if (b.revenue != null && b.avgDeal != null && b.paidCount != null) {
      line += b.revenue ? ` (rata-rata 3 bulan sebelumnya ${juta(b.revenue)}).` : ".";
      if (b.revenue && Math.abs(m.revenue - b.revenue) / b.revenue > 0.1) {
        const countMove = m.paidCount - b.paidCount;
        const sizeMove = m.avgDeal - b.avgDeal;
        const bySize = Math.abs(sizeMove * m.paidCount) > Math.abs(countMove * b.avgDeal);
        line += bySize
          ? ` Penggeraknya ukuran deal (rata-rata ${juta(b.avgDeal)} → ${juta(m.avgDeal)}), bukan jumlah deal.`
          : ` Penggeraknya jumlah deal (rata-rata ${dec1(b.paidCount)} → ${m.paidCount}).`;
      }
    } else line += " — ini bulan dasar, belum ada pembanding.";
    lines.push(line);
  } else {
    lines.push(`Belum ada deal lunas tercatat di ${name}.`);
  }
  const known = m.bySource.filter(s => s.channel !== UNKNOWN && s.revenue > 0);
  if (known.length) lines.push(`Sumber omzet terbesar: ${known[0].channel} (${juta(known[0].revenue)}, ${known[0].count} deal).`);
  if (m.leads) {
    lines.push(`Funnel chat ${name}: ${m.leads} chat → ${m.quoted} penawaran → ${m.paidFromCohort} lunas${m.cohortMature ? "" : " (masih berjalan, deal bulan ini belum semua sempat lunas)"}.`);
  }
  if (m.views) {
    let c = `Konten: ${m.posts || "—"} post, ${num(m.views)} views, ER ${pct1(m.erViews)} (engagement ÷ views)`;
    if (m.leadsPer1kViews != null) c += `, ${dec1(m.leadsPer1kViews)} chat per 1.000 views`;
    lines.push(c + ".");
    if (m.top[0]) lines.push(`Konten terbaik: "${m.top[0].title}" di ${m.top[0].platform} (${num(m.top[0].views)} views).`);
  }
  const unk = m.bySource.find(s => s.channel === UNKNOWN);
  if (m.paidCount && unk && unk.count) {
    lines.push(`${unk.count} dari ${m.paidCount} deal lunas belum ketahuan sumbernya — bulan depan tanya "dari mana tahu kami?" di chat pertama.`);
  }
  return `Report ${clientName} · ${name}\n\n` + lines.map(l => `• ${l}`).join("\n");
}

// Plain text for WhatsApp: the narrative plus the headline numbers.
export function shareText(m: MonthNumbers, narrativeText: string): string {
  const head = [
    `Omzet lunas: ${juta(m.revenue)} (${m.paidCount} deal)`,
    `Chat masuk: ${m.leads}`,
    m.views ? `Views: ${num(m.views)} · ER ${pct1(m.erViews)}` : "",
  ].filter(Boolean);
  return `${narrativeText}\n\n${head.join("\n")}`;
}

// ---------- tolerant import of Meta / TikTok exports ----------

const COLS: Record<keyof Omit<Post, "id" | "month" | "format">, string[]> = {
  platform: ["platform", "channel", "network", "akun"],
  title: ["title", "judul", "caption", "description", "deskripsi", "konten", "content", "post"],
  views: ["views", "view", "tayangan", "plays", "video views", "penayangan", "impressions"],
  likes: ["likes", "like", "suka", "reactions", "reaksi"],
  comments: ["comments", "comment", "komentar"],
  shares: ["shares", "share", "bagikan", "dibagikan"],
  saves: ["saves", "saved", "save", "simpan", "disimpan", "favorites", "favorit"],
};
const DATE_COLS = ["date", "tanggal", "publish time", "published", "waktu posting", "created", "posted"];

function pick(row: Record<string, unknown>, names: string[]): unknown {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find(k => k.toLowerCase().trim() === n);
    if (k) return row[k];
  }
  for (const n of names) {
    const k = keys.find(k => k.toLowerCase().includes(n));
    if (k) return row[k];
  }
  return undefined;
}
const toNum = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().toLowerCase().replace(/\s/g, "");
  const k = /k$/.test(s) ? 1e3 : /m$|jt$/.test(s) ? 1e6 : 1;
  const n = parseFloat(s.replace(/[^0-9.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return isFinite(n) ? Math.round(n * k) : 0;
};
function toPlatform(v: unknown, fallback: Platform): Platform {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("insta") || s === "ig") return "Instagram";
  if (s.includes("face") || s === "fb") return "Facebook";
  if (s.includes("thread")) return "Threads";
  return fallback;
}
function toMonth(v: unknown, fallback: string): string {
  if (typeof v === "number" && v > 30000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); // Excel serial date
    return d.toISOString().slice(0, 7);
  }
  const s = String(v ?? "");
  let m = s.match(/(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  return fallback;
}

export function postsFromRows(rows: Record<string, unknown>[], month: string, platform: Platform): Omit<Post, "id">[] {
  return rows
    .map(r => ({
      month: toMonth(pick(r, DATE_COLS), month),
      platform: toPlatform(pick(r, COLS.platform), platform),
      title: String(pick(r, COLS.title) ?? "").trim().slice(0, 140) || "(tanpa judul)",
      views: toNum(pick(r, COLS.views)),
      likes: toNum(pick(r, COLS.likes)),
      comments: toNum(pick(r, COLS.comments)),
      shares: toNum(pick(r, COLS.shares)),
      saves: toNum(pick(r, COLS.saves)),
    }))
    .filter(p => p.views || p.likes || p.comments || p.shares || p.saves);
}
