// Hunting Mode (docs/prd/PRD-002-hunting-mode.md): every DM sent while hunting
// is logged against the template it used, so the numbers say which pitch works.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { daysBetween, today } from "@/lib/billing";

export const PLATFORMS = ["Threads", "IG", "WA", "Lainnya"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const HUNT_STATUS = ["Terkirim", "Dibales", "Tertarik", "Ditolak", "Ghosting"] as const;
export type HuntStatus = (typeof HUNT_STATUS)[number];

export const huntIcon: Record<HuntStatus, string> = {
  Terkirim: "📤", Dibales: "💬", Tertarik: "✅", Ditolak: "❌", Ghosting: "👻",
};
export const huntColor: Record<HuntStatus, string> = {
  Terkirim: "#8a94a6", Dibales: "#005eb0", Tertarik: "#00a862", Ditolak: "#ff4444", Ghosting: "#a78bfa",
};

export interface PitchTemplate {
  id: string;
  title: string;
  body: string;
}

export interface Hunt {
  id: string;
  target: string;
  platform: Platform;
  templateId: string;
  templateTitle: string; // kept so the log still reads after a template is deleted
  status: HuntStatus;
  note: string;
  date: string;          // local YYYY-MM-DD the DM went out
  createdAt: number;
  leadId?: string;       // set once "Jadiin Lead" has run
  url?: string;          // the profile, to go back and check for a reply
}

export const DEFAULT_GOAL = 20;

// DMs a day to aim for, from users/{uid}/settings/hunting.
export function useHuntGoal(uid: string): number {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  useEffect(() => onSnapshot(doc(db, "users", uid, "settings", "hunting"), snap => {
    const n = (snap.data() as { dailyGoal?: number } | undefined)?.dailyGoal;
    setGoal(n && n > 0 ? n : DEFAULT_GOAL);
  }), [uid]);
  return goal;
}

// A reply of any kind, a no included, means the message got read and answered.
export function responded(h: Hunt): boolean {
  return h.status === "Dibales" || h.status === "Tertarik" || h.status === "Ditolak";
}

// Sent and still silent after this many days: worth a follow-up.
export const STALE_DAYS = 2;
export function isStale(h: Hunt, on = today()): boolean {
  return h.status === "Terkirim" && daysBetween(h.date, on) >= STALE_DAYS;
}

export interface TemplateScore {
  templateId: string;
  title: string;
  sent: number;
  replied: number;
  interested: number;
  responseRate: number; // 0..1
  winRate: number;      // 0..1
}

// Fewer sends than this and a rate says more about luck than the message.
export const MIN_SAMPLE = 5;

export function scoreTemplates(hunts: Hunt[], templates: PitchTemplate[]): TemplateScore[] {
  const byId = new Map<string, TemplateScore>();
  for (const h of hunts) {
    const key = h.templateId || "_none";
    let s = byId.get(key);
    if (!s) {
      const title = templates.find(t => t.id === h.templateId)?.title || h.templateTitle || "Tanpa template";
      s = { templateId: key, title, sent: 0, replied: 0, interested: 0, responseRate: 0, winRate: 0 };
      byId.set(key, s);
    }
    s.sent++;
    if (responded(h)) s.replied++;
    if (h.status === "Tertarik") s.interested++;
  }
  const out = Array.from(byId.values());
  for (const s of out) {
    s.responseRate = s.sent ? s.replied / s.sent : 0;
    s.winRate = s.sent ? s.interested / s.sent : 0;
  }
  return out.sort((a, b) => b.winRate - a.winRate || b.responseRate - a.responseRate || b.sent - a.sent);
}

// One line of advice from the scores, or null while the sample is too small.
export function verdict(scores: TemplateScore[]): string | null {
  const ready = scores.filter(s => s.sent >= MIN_SAMPLE && s.templateId !== "_none");
  if (ready.length < 2) return null;
  const best = ready.reduce((a, b) => (b.responseRate > a.responseRate ? b : a));
  const worst = ready.reduce((a, b) => (b.responseRate < a.responseRate ? b : a));
  if (best === worst || best.responseRate - worst.responseRate < 0.1) return null;
  return `"${best.title}" dibales ${pct(best.responseRate)}, "${worst.title}" cuma ${pct(worst.responseRate)}. Pakai yang pertama lebih sering, revisi yang kedua.`;
}

export function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

// {nama} reads as a name: "@kopisenja" → "kopisenja", a phone number → "kak".
export function fill(body: string, target: string): string {
  const t = target.trim().replace(/^@/, "");
  const name = !t || /^\+?[0-9][0-9 -]{6,}$/.test(t) ? "kak" : t;
  return body.replace(/\{nama\}/gi, name);
}

// WhatsApp straight to the target when the target is a number.
export function waLinkFor(target: string, text: string): string {
  const digits = /^\+?[0-9][0-9 -]{6,}$/.test(target.trim()) ? target.replace(/\D/g, "").replace(/^0/, "62") : "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Where a hunt lands in Leads.
export const platformSource: Record<Platform, string> = {
  Threads: "Threads", IG: "DM IG", WA: "WhatsApp", Lainnya: "Lainnya",
};

// A profile link or handle pasted from the app, or passed in the URL
// (?hunt&target=…&platform=…&url=…): who to DM, and where.
export function parseProfile(text: string): { target: string; platform?: Platform; url?: string } | null {
  const t = (text || "").trim();
  if (!t) return null;
  const m = t.match(/https?:\/\/[^\s]+/);
  if (m) {
    const raw = m[0].replace(/[),.]+$/, "");
    let u: URL;
    try { u = new URL(raw); } catch { return null; }
    const host = u.hostname.replace(/^www\./, "");
    const first = u.pathname.split("/").filter(Boolean)[0] || "";
    const url = `${u.origin}/${first}`;
    if (/^threads\.(net|com)$/.test(host) && first.startsWith("@")) return { target: first, platform: "Threads", url };
    if (/^instagram\.com$/.test(host) && first && !["p", "reel", "reels", "stories", "explore"].includes(first)) return { target: `@${first}`, platform: "IG", url };
    if (/^(wa\.me|api\.whatsapp\.com)$/.test(host)) {
      const num = first.replace(/\D/g, "") || (u.searchParams.get("phone") || "").replace(/\D/g, "");
      return num ? { target: `+${num}`, platform: "WA", url: `https://wa.me/${num}` } : null;
    }
    return { target: host + (first ? `/${first}` : ""), platform: "Lainnya", url: raw };
  }
  const handle = t.split(/\s+/)[0].slice(0, 80);
  return { target: handle };
}
