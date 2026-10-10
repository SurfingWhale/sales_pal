// Prospect journeys (docs/prd/PRD-009): one person per document, from the post
// they wrote to the day they hand over their details. Pure functions only —
// Firestore lives in lib/prospectStore.ts — so Hunting, the dashboard and the
// morning push read a prospect the same way.
//
// What is stored is what someone did: an intro went out, they answered, they
// asked not to be contacted. The automatic steps — "Belum respon" two days
// after a send, "Tidak terhubung" once the attempts run out, back in the queue
// when the parking ends — are worked out from dates when read, so nothing has
// to run on a schedule.

import { daysFrom, shift } from "@/lib/digest";
import type { HuntStatus, Platform } from "@/lib/hunting";

export type Contact = "baru" | "intro" | "terhubung" | "dnc";
export type Status = "baru" | "intro" | "belum" | "tidak" | "terhubung" | "dnc";
// The answer, once they answered: tolak = not interested, data = gave their details.
export type Result = "tertarik" | "pikir" | "nanti" | "tolak" | "data";
export type Segment = "NTB" | "ETB";
export type Channel = "post" | "dm";
export type SourceKind = "post" | "radar" | "manual";

export interface ProspectEvent {
  at: number;            // ms
  kind: "post" | "sent" | "reply" | "status" | "note" | "convert";
  text?: string;
  url?: string;
  channel?: Channel;
  template?: string;
  campaignId?: string;
  campaign?: string;
  huntId?: string;
}

export interface Prospect {
  id: string;
  platform: Platform;
  handle: string;          // "@user", "+62…", as typed
  name?: string;
  url?: string;            // the profile
  segment: Segment;
  contact: Contact;
  result?: Result | null;  // the latest answer; kept as "last result" after a new send
  remark?: string;
  attempts: number;        // sends since the last answer (or since the parking ended)
  firstSeenAt: string;     // YYYY-MM-DD
  firstSentAt?: string;
  lastSentAt?: string;
  firstReplyAt?: string;
  lastReplyAt?: string;
  attemptsToReply?: number;
  nextAt?: string | null;       // a follow-up they or you set
  parkedUntil?: string | null;  // not interested: leave them be until then
  convertedAt?: string;
  leadId?: string;
  dncAt?: string;
  source: { kind: SourceKind; url?: string; postId?: string; text?: string };
  sessionId?: string;
  history: ProspectEvent[];
  closed: boolean;         // DNC: kept only so the request is honoured
  createdAt: number;
  updatedAt: number;
  ownerUid?: string;
  ownerName?: string;
}

// The contact strategy (settings/hunting, PRD-009 §6.3). gaps[i] = days after
// send i+1 before the next follow-up; gaps[0] is also when "Belum respon" starts.
export interface Strategy {
  maxAttempts: number;
  gaps: number[];
  parkDays: number;
  declinedParkDays: number;
  thinkDays: number;
}
export const STRATEGY: Strategy = { maxAttempts: 3, gaps: [2, 5], parkDays: 60, declinedParkDays: 90, thinkDays: 3 };

export function strategyFrom(s?: Partial<Strategy> | null): Strategy {
  const ok = (n: unknown, min = 1) => typeof n === "number" && n >= min;
  return {
    maxAttempts: ok(s?.maxAttempts) ? s!.maxAttempts! : STRATEGY.maxAttempts,
    gaps: Array.isArray(s?.gaps) && s!.gaps!.every(g => ok(g)) && s!.gaps!.length ? s!.gaps! : STRATEGY.gaps,
    parkDays: ok(s?.parkDays) ? s!.parkDays! : STRATEGY.parkDays,
    declinedParkDays: ok(s?.declinedParkDays) ? s!.declinedParkDays! : STRATEGY.declinedParkDays,
    thinkDays: ok(s?.thinkDays) ? s!.thinkDays! : STRATEGY.thinkDays,
  };
}

export const HISTORY_MAX = 200;

// One document per person and platform, so sharing their post twice lands on
// the same journey.
export function prospectId(platform: Platform, handle: string): string {
  let h = handle.trim().toLowerCase().replace(/^@/, "");
  if (platform === "WA") h = h.replace(/\D/g, "").replace(/^0/, "62");
  h = h.replace(/[^a-z0-9._+-]/g, "_").replace(/_+/g, "_").slice(0, 120);
  return `${platform}_${h || "tanpa_nama"}`;
}

export interface View {
  status: Status;
  due: string | null;          // the day it needs a move, if any
  parkedUntil: string | null;
  reopened: boolean;           // parking over: the next send starts a new round
}

export function view(p: Prospect, on: string, s: Strategy = STRATEGY): View {
  const v: View = { status: "baru", due: null, parkedUntil: null, reopened: false };
  if (p.contact === "dnc") return { ...v, status: "dnc" };
  if (p.contact === "baru") return { ...v, due: p.firstSeenAt };
  if (p.contact === "terhubung") {
    if (p.result === "data") return { ...v, status: "terhubung" };
    if (p.result === "tolak") return { ...v, status: "terhubung", due: p.parkedUntil || null, parkedUntil: p.parkedUntil && p.parkedUntil > on ? p.parkedUntil : null };
    return { ...v, status: "terhubung", due: p.nextAt || null };
  }
  const last = p.lastSentAt || p.firstSeenAt;
  const stale = s.gaps[0];
  const waited = daysFrom(last, on);
  if (p.attempts >= s.maxAttempts) {
    if (waited < stale) return { ...v, status: "intro" };
    const until = shift(last, stale + s.parkDays);
    if (on < until) return { ...v, status: "tidak", due: until, parkedUntil: until };
    return { ...v, status: "belum", due: until, reopened: true };
  }
  const gap = s.gaps[Math.max(0, Math.min(p.attempts, s.gaps.length) - 1)];
  return { ...v, status: waited >= stale ? "belum" : "intro", due: shift(last, gap) };
}

export function isDue(p: Prospect, on: string, s: Strategy = STRATEGY): boolean {
  const v = view(p, on, s);
  return v.status !== "dnc" && v.status !== "tidak" && !!v.due && v.due <= on;
}

// What needs a move today, oldest first.
export function queue(ps: Prospect[], on: string, s: Strategy = STRATEGY): Prospect[] {
  return ps.filter(p => isDue(p, on, s)).sort((a, b) => (view(a, on, s).due || "").localeCompare(view(b, on, s).due || ""));
}

export const RESULT_LABEL: Record<Result, string> = {
  tertarik: "Tertarik", pikir: "Pikir-pikir", nanti: "Hubungi nanti", tolak: "Tidak tertarik", data: "Kasih data",
};

export function statusLabel(p: Prospect, v: View): string {
  switch (v.status) {
    case "dnc": return "Jangan dihubungi";
    case "baru": return "Baru";
    case "intro": return "Intro terkirim";
    case "belum": return v.reopened ? "Siap dihubungi lagi" : "Belum respon";
    case "tidak": return "Tidak terhubung";
    default: return p.result ? RESULT_LABEL[p.result] : "Terhubung";
  }
}

export function statusColor(p: Prospect, v: View): string {
  if (v.status === "dnc") return "#ff4444";
  if (v.status === "tidak") return "#8a94a6";
  if (v.status === "belum") return "#ff9900";
  if (v.status === "intro" || v.status === "baru") return "#005eb0";
  if (p.result === "data" || p.result === "tertarik") return "#00a862";
  if (p.result === "tolak") return "#a78bfa";
  return "#f59e0b";
}

// ---- writes, as patches the store applies --------------------------------

export interface Ctx { on: string; at: number; sessionId?: string }

// "11 Okt", for words a person reads in the history.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] || ""}`.trim();
}

export function withEvent(history: ProspectEvent[] | undefined, e: ProspectEvent): ProspectEvent[] {
  return [...(history || []), e].slice(-HISTORY_MAX);
}

export function newProspect(
  input: { platform: Platform; handle: string; name?: string; url?: string; source: Prospect["source"] },
  ctx: Ctx,
): Omit<Prospect, "id"> {
  const history: ProspectEvent[] = input.source.text ? [{ at: ctx.at, kind: "post", text: input.source.text, url: input.source.url }] : [];
  return {
    platform: input.platform, handle: input.handle, ...(input.name ? { name: input.name } : {}), ...(input.url ? { url: input.url } : {}),
    segment: "NTB", contact: "baru", attempts: 0, firstSeenAt: ctx.on, source: input.source,
    ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    history, closed: false, createdAt: ctx.at, updatedAt: ctx.at,
  };
}

// The same person posted again: their words go into the journey, and a
// parked "Tidak terhubung" gets another round.
export function postPatch(p: Prospect, source: Prospect["source"], name: string | undefined, ctx: Ctx): Partial<Prospect> {
  const known = p.history?.some(e => e.kind === "post" && e.url && e.url === source.url);
  const out: Partial<Prospect> = { updatedAt: ctx.at };
  if (name && !p.name) out.name = name;
  if (!known && source.text) out.history = withEvent(p.history, { at: ctx.at, kind: "post", text: source.text, url: source.url });
  if (p.contact === "intro" && p.attempts > 0) out.attempts = 0;
  return out;
}

export function sentPatch(
  p: Prospect,
  e: { text: string; channel: Channel; template?: string; campaignId?: string; campaign?: string; huntId?: string; url?: string },
  ctx: Ctx, s: Strategy = STRATEGY,
): Partial<Prospect> {
  const v = view(p, ctx.on, s);
  const fresh = p.contact !== "intro" || v.reopened;
  return {
    contact: "intro",
    attempts: (fresh ? 0 : p.attempts) + 1,
    firstSentAt: p.firstSentAt || ctx.on,
    lastSentAt: ctx.on,
    nextAt: null,
    parkedUntil: null,
    updatedAt: ctx.at,
    history: withEvent(p.history, { at: ctx.at, kind: "sent", ...e }),
  };
}

export function replyPatch(p: Prospect, text: string, ctx: Ctx): Partial<Prospect> {
  return {
    contact: "terhubung",
    result: null,
    attempts: 0,
    firstReplyAt: p.firstReplyAt || ctx.on,
    lastReplyAt: ctx.on,
    attemptsToReply: p.firstReplyAt ? p.attemptsToReply ?? p.attempts : p.attempts,
    nextAt: null,
    parkedUntil: null,
    updatedAt: ctx.at,
    history: withEvent(p.history, { at: ctx.at, kind: "reply", ...(text.trim() ? { text: text.trim() } : {}) }),
  };
}

// An answer they gave. Marking a result on someone not yet marked as answered
// counts as the answer too.
export function resultPatch(
  p: Prospect, result: Exclude<Result, "data">, extra: { remark?: string; nextAt?: string },
  ctx: Ctx, s: Strategy = STRATEGY,
): Partial<Prospect> {
  const base = p.contact === "terhubung" ? { history: p.history } : replyPatch(p, "", ctx);
  const nextAt = result === "tertarik" ? extra.nextAt || shift(ctx.on, 1)
    : result === "pikir" ? extra.nextAt || shift(ctx.on, s.thinkDays)
    : result === "nanti" ? extra.nextAt || shift(ctx.on, 7)
    : null;
  const remark = (extra.remark || "").trim();
  return {
    ...base,
    contact: "terhubung",
    result,
    remark,
    nextAt,
    parkedUntil: result === "tolak" ? shift(ctx.on, s.declinedParkDays) : null,
    updatedAt: ctx.at,
    history: withEvent(base.history, { at: ctx.at, kind: "status", text: [RESULT_LABEL[result], remark].filter(Boolean).join(" — ") + (nextAt ? ` · follow-up ${shortDate(nextAt)}` : "") }),
  };
}

export function convertPatch(p: Prospect, leadId: string, summary: string, ctx: Ctx): Partial<Prospect> {
  const base = p.contact === "terhubung" ? { history: p.history } : replyPatch(p, "", ctx);
  return {
    ...base,
    contact: "terhubung",
    result: "data",
    segment: "ETB",
    convertedAt: ctx.on,
    leadId,
    nextAt: null,
    parkedUntil: null,
    updatedAt: ctx.at,
    history: withEvent(base.history, { at: ctx.at, kind: "convert", text: summary }),
  };
}

// Asked not to be contacted: the conversation goes, the request stays.
export function dncPatch(p: Prospect, reason: string, ctx: Ctx): Partial<Prospect> {
  return {
    contact: "dnc",
    closed: true,
    remark: reason.trim(),
    dncAt: ctx.on,
    firstReplyAt: p.firstReplyAt || ctx.on,
    nextAt: null,
    parkedUntil: null,
    source: { kind: p.source?.kind || "manual" },
    history: [{ at: ctx.at, kind: "status", text: "Minta ga dihubungi lagi. Riwayat percakapan dihapus." }],
    updatedAt: ctx.at,
  };
}

export function notePatch(p: Prospect, text: string, ctx: Ctx): Partial<Prospect> {
  return { updatedAt: ctx.at, history: withEvent(p.history, { at: ctx.at, kind: "note", text: text.trim() }) };
}

// ---- the DM log (hunts) and the journey stay in step ---------------------

// What the latest DM to them should read in the log, once they answered.
export function huntStatusFor(p: Prospect): HuntStatus | null {
  if (p.contact === "dnc") return "Ditolak";
  if (p.contact !== "terhubung") return null;
  if (p.result === "tertarik" || p.result === "data") return "Tertarik";
  if (p.result === "tolak") return "Ditolak";
  return "Dibales";
}

export function lastHuntId(p: Prospect): string | undefined {
  for (let i = (p.history || []).length - 1; i >= 0; i--) if (p.history[i].kind === "sent" && p.history[i].huntId) return p.history[i].huntId;
  return undefined;
}

// A status tapped in the DM log, as the journey reads it.
export function patchFromHunt(p: Prospect, status: HuntStatus, note: string, ctx: Ctx, s: Strategy = STRATEGY): Partial<Prospect> | null {
  if (p.contact === "dnc") return null;
  if (status === "Dibales") return p.contact === "terhubung" ? null : replyPatch(p, "", ctx);
  if (status === "Tertarik") return p.result === "tertarik" ? null : resultPatch(p, "tertarik", {}, ctx, s);
  if (status === "Ditolak") return resultPatch(p, "tolak", { remark: note }, ctx, s);
  return null;
}

interface HuntLike {
  id: string; target: string; platform: Platform; templateTitle?: string; status: HuntStatus;
  note?: string; date: string; createdAt: number; leadId?: string; url?: string; prospectId?: string;
}

const RESPONDED: HuntStatus[] = ["Dibales", "Tertarik", "Ditolak"];

// The DMs logged before journeys existed, one prospect per person (PRD-009 §9).
export function fromHunts(hunts: HuntLike[], ctx: Ctx): { id: string; data: Omit<Prospect, "id">; huntIds: string[] }[] {
  const groups = new Map<string, HuntLike[]>();
  for (const h of hunts) {
    if (h.prospectId || !h.target?.trim()) continue;
    const id = prospectId(h.platform, h.target);
    groups.set(id, [...(groups.get(id) || []), h]);
  }
  return Array.from(groups, ([id, hs]) => {
    hs.sort((a, b) => a.createdAt - b.createdAt);
    const firstAnswer = hs.findIndex(h => RESPONDED.includes(h.status));
    const lastAnswer = hs.map(h => RESPONDED.includes(h.status)).lastIndexOf(true);
    const answered = lastAnswer >= 0 ? hs[lastAnswer] : null;
    const history: ProspectEvent[] = [];
    for (const h of hs) {
      history.push({ at: h.createdAt, kind: "sent", channel: "dm", huntId: h.id, ...(h.templateTitle ? { template: h.templateTitle } : {}) });
      if (RESPONDED.includes(h.status)) history.push({ at: h.createdAt + 1, kind: "status", text: [h.status, h.note].filter(Boolean).join(" — ") + " (dari log DM lama)" });
    }
    const latest = hs[hs.length - 1];
    const result: Result | null = answered?.status === "Tertarik" ? "tertarik" : answered?.status === "Ditolak" ? "tolak" : null;
    const data: Omit<Prospect, "id"> = {
      platform: latest.platform, handle: latest.target.trim(), ...(latest.url ? { url: latest.url } : {}),
      segment: "NTB",
      contact: answered && lastAnswer === hs.length - 1 ? "terhubung" : "intro",
      result,
      remark: answered?.note || "",
      attempts: answered ? hs.length - 1 - lastAnswer : hs.length,
      firstSeenAt: hs[0].date, firstSentAt: hs[0].date, lastSentAt: latest.date,
      ...(firstAnswer >= 0 ? { firstReplyAt: hs[firstAnswer].date, lastReplyAt: hs[lastAnswer].date, attemptsToReply: firstAnswer + 1 } : {}),
      nextAt: result === "tertarik" ? ctx.on : null,
      parkedUntil: result === "tolak" ? shift(hs[lastAnswer].date, STRATEGY.declinedParkDays) : null,
      ...(hs.find(h => h.leadId) ? { leadId: hs.find(h => h.leadId)!.leadId } : {}),
      source: { kind: "manual" },
      history: history.slice(-HISTORY_MAX),
      closed: false, createdAt: hs[0].createdAt, updatedAt: ctx.at,
    };
    // An answer and then more DMs: those DMs wait on a new answer.
    if (answered && lastAnswer < hs.length - 1) data.contact = "intro";
    return { id, data, huntIds: hs.map(h => h.id) };
  });
}

// ---- campaigns (PRD-009 §7) ----------------------------------------------

export const GROUPS = ["baru", "nunggu", "terhubung", "tolak", "etb"] as const;
export type Group = (typeof GROUPS)[number];
export const GROUP_LABEL: Record<Group, string> = {
  baru: "Baru", nunggu: "Nunggu jawaban", terhubung: "Terhubung (Tertarik, Pikir-pikir, Nanti)", tolak: "Tidak tertarik (parkir lewat)", etb: "ETB",
};

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  segment: Segment | "all";
  groups: Group[];
  createdAt: number;
}

export function groupOf(p: Prospect, on: string, s: Strategy = STRATEGY): Group | null {
  const v = view(p, on, s);
  if (v.status === "dnc" || v.status === "tidak") return null;
  if (v.status === "baru") return "baru";
  if (v.status === "intro" || v.status === "belum") return p.attempts >= s.maxAttempts && !v.reopened ? null : "nunggu";
  if (p.result === "data") return "etb";
  if (p.result === "tolak") return v.parkedUntil ? null : "tolak";
  return "terhubung";
}

export function sentIn(p: Prospect, campaignId: string): boolean {
  return (p.history || []).some(e => e.kind === "sent" && e.campaignId === campaignId);
}

// Who the campaign still has to reach, oldest prospect first.
export function audience(ps: Prospect[], c: Campaign, on: string, s: Strategy = STRATEGY): Prospect[] {
  return ps
    .filter(p => !p.closed && (c.segment === "all" || p.segment === c.segment))
    .filter(p => { const g = groupOf(p, on, s); return !!g && c.groups.includes(g); })
    .filter(p => !sentIn(p, c.id))
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ---- sessions (PRD-009 §4) -----------------------------------------------

export interface HuntSession {
  id: string;
  startedAt: number;
  lastActionAt: number;
  endedAt: number | null;
  counts: { prospects: number; intros: number; replies: number; converted: number };
  ownerUid?: string;
}

// A session nobody touched for this long ended at its last action.
export const IDLE_MS = 30 * 60 * 1000;

export function isLive(s: HuntSession, now: number): boolean {
  return !s.endedAt && now - (s.lastActionAt || s.startedAt) < IDLE_MS;
}

export function sessionEnd(s: HuntSession, now: number): number {
  return s.endedAt || (isLive(s, now) ? now : s.lastActionAt || s.startedAt);
}

export function sessionMinutes(s: HuntSession, now: number): number {
  return Math.max(0, (sessionEnd(s, now) - s.startedAt) / 60000);
}

// ---- metrics (PRD-009 §8) ------------------------------------------------

// Under this many, a rate says more about luck than about the hunter (PRD-005 §7).
export const SMALL = 10;

export function rate(n: number, d: number): string {
  if (!d) return "—";
  return d < SMALL ? `${n} dari ${d}` : `${Math.round((n / d) * 100)}%`;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface Journey {
  masuk: number;
  intro: number;
  terhubung: number;
  minat: number;
  data: number;
  dnc: number;
  attemptsToReply: number | null;
  daysToReply: number | null;
  channel: Record<Channel, { intro: number; terhubung: number }>;
  source: Record<SourceKind, { masuk: number; data: number }>;
  remarks: { label: string; n: number }[];
}

export function journey(ps: Prospect[], since?: string): Journey {
  const rows = since ? ps.filter(p => p.firstSeenAt >= since) : ps;
  // Every rate counts within those who got an intro, so no part outgrows its whole.
  const sent = rows.filter(p => p.firstSentAt);
  const replied = sent.filter(p => p.firstReplyAt);
  const firstChannel = (p: Prospect): Channel => (p.history || []).find(e => e.kind === "sent")?.channel || "dm";
  const channel = { post: { intro: 0, terhubung: 0 }, dm: { intro: 0, terhubung: 0 } };
  for (const p of sent) { const c = firstChannel(p); channel[c].intro++; if (p.firstReplyAt) channel[c].terhubung++; }
  const source = { post: { masuk: 0, data: 0 }, radar: { masuk: 0, data: 0 }, manual: { masuk: 0, data: 0 } };
  for (const p of rows) { const k = p.source?.kind || "manual"; source[k].masuk++; if (p.convertedAt) source[k].data++; }
  const remarks = new Map<string, number>();
  for (const p of rows) if (p.result === "tolak" && p.remark) remarks.set(p.remark, (remarks.get(p.remark) || 0) + 1);
  return {
    masuk: rows.length,
    intro: sent.length,
    terhubung: replied.length,
    minat: replied.filter(p => p.result === "tertarik" || p.convertedAt).length,
    data: sent.filter(p => p.convertedAt).length,
    dnc: replied.filter(p => p.contact === "dnc").length,
    attemptsToReply: median(replied.map(p => p.attemptsToReply ?? 1).filter(n => n > 0)),
    daysToReply: median(replied.filter(p => p.firstSentAt).map(p => Math.max(0, daysFrom(p.firstSentAt!, p.firstReplyAt!)))),
    channel, source,
    remarks: Array.from(remarks, ([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 5),
  };
}

// ---- Threads links ------------------------------------------------------

// A Threads link the server has to open (a /share/ short link, or a post whose
// words we want), as opposed to a profile link the app reads by itself.
export function threadsPostLink(text: string): string | null {
  const m = (text || "").match(/https?:\/\/(?:www\.)?threads\.(?:com|net)\/(?:share\/[A-Za-z0-9_-]+|@[A-Za-z0-9._]+\/post\/[A-Za-z0-9_-]+)[^\s]*/);
  return m ? m[0].replace(/[),.]+$/, "") : null;
}
