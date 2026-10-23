"use client";

import { useState } from "react";
import LeadMap, { MapLead } from "@/components/LeadMap";
import Icon, { IconName } from "@/components/Icon";
import { longDate, waLink } from "@/lib/billing";

// Beranda (PRD-008 §1, canvas "Beranda — desktop" / "Beranda — HP"): what to
// do today first, then the numbers, then the lead map. Every card has one
// main action.
//
// Three modes (PRD-008 §6), because the day isn't one flow: Jualan (what to
// move today), Report & closing (how the month is going, to the money in),
// Belajar (what the numbers teach, and practice). The last one picked is
// remembered on this device.

export type BerandaMode = "jualan" | "report" | "belajar";
const MODES: [BerandaMode, string][] = [["jualan", "Jualan"], ["report", "Report & closing"], ["belajar", "Belajar"]];
const MODE_KEY = "sp-beranda-mode";
function savedMode(): BerandaMode {
  try { const m = localStorage.getItem(MODE_KEY); return m === "report" || m === "belajar" ? m : "jualan"; } catch { return "jualan"; }
}

export interface HuntingStrip { live: boolean; sentToday: number; goal: number; queued: number; onStart: () => void; onOpen: () => void }

export interface Todo {
  key: string; when: string; icon: IconName; title: string; what: string;
  kind: string;        // "Kirim penawaran", "Invoice jatuh tempo", …
  action: string;      // the main button
  phone: string; text: string;  // a WhatsApp message, when the action is one
  wa?: boolean;        // the main action is the WhatsApp message
  snooze?: () => void; // "Tunda": push it to tomorrow
  open: () => void;
  // A prospect from Hunting: how far along, the chat so far, their profile.
  journey?: { steps: readonly string[]; at: number; color: string; chat: { who: "kamu" | "dia" | "info"; text: string; at: number }[]; profile?: string };
}

export interface Numbers {
  active: number; newThisWeek: number;
  high: number;
  closedThisMonth: number; closingTarget: number; paidThisMonth: string;
  pipeline: number; pipelineHigh: number;
}

// Juta, one decimal under 100 (12,5) and whole above it (331), as in the canvas.
const jtNum = (n: number) => (n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: n >= 100_000_000 ? 0 : 1 });

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

const CAROUSEL = 10;

// One colour per kind of task, on its icon tile, so the queue reads at a glance.
function kindColor(kind: string): string {
  if (/telat/i.test(kind)) return "#c62828";
  if (/invoice/i.test(kind)) return "#0f7b4a";
  if (/hunting/i.test(kind)) return "#b93a06";
  if (/penawaran/i.test(kind)) return "#005eb0";
  if (/follow/i.test(kind)) return "#6d4fc2";
  if (/macet/i.test(kind)) return "#9a6700";
  return "#5b636c";
}

// Where each task sits in its own path, drawn as a line of steps on the card.
function stepsOf(t: { kind: string; action: string }): { steps: string[]; at: number } {
  if (/tertarik/i.test(t.kind)) return { steps: ["Intro", "Follow-up", "Tertarik", "Lead"], at: 2 };
  if (/hunting/i.test(t.kind)) return { steps: ["Intro", "Follow-up", "Tertarik", "Lead"], at: /intro/i.test(t.action) ? 0 : 1 };
  if (/penawaran/i.test(t.kind)) return { steps: ["Dibuat", "Terkirim", "Disetujui"], at: 1 };
  if (/invoice/i.test(t.kind)) return { steps: ["Terbit", "Ditagih", "Lunas"], at: 1 };
  if (/macet/i.test(t.kind)) return { steps: ["Lead", "Penawaran", "Closing"], at: 1 };
  if (/follow/i.test(t.kind)) return { steps: ["Kontak", "Follow-up", "Penawaran", "Closing"], at: 1 };
  return { steps: ["Ditolak", "Coba lagi", "Lead"], at: 1 };
}

const css = `
.sp-b-panel { display: flex; flex-direction: column; }
.sp-b-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
.sp-b-date { margin: 0 0 10px; font-size: 14px; color: var(--app-muted); text-transform: capitalize; }
.sp-b-h1 { margin: 0; font-size: 34px; line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; max-width: 620px; }


.sp-card { background: var(--app-card); border: 1px solid var(--app-border); border-radius: 16px; }
.sp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 12px; font: 600 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; text-decoration: none; white-space: nowrap; border: 0; }
.sp-btn.line { border: 1px solid var(--app-line-strong); background: transparent; color: var(--app-text); }
.sp-btn.blue { background: #005eb0; color: #fff; }
.sp-btn.hunt { background: #b93a06; color: #fff; }
.sp-btn.ghost { background: transparent; color: var(--app-ink-2); font-weight: 500; padding: 0 12px; }

.sp-find { display: flex; align-items: center; gap: 14px; padding: 16px; margin-top: 12px; }
.sp-find-ic { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: #005eb0; color: #fff; }
.sp-find-sub { display: block; font-size: 13px; color: var(--app-muted); }

.sp-today { margin-top: 20px; display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; padding: 12px 16px; }
.sp-today-txt { font-size: 14px; min-width: 0; flex: 1 1 200px; display: flex; align-items: center; gap: 10px; }
.sp-today-main { display: contents; }
.sp-today-bar { display: none; }

.sp-kpis { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; background: var(--app-border); border-top: 1px solid var(--app-border); border-bottom: 1px solid var(--app-border); }
.sp-kpi { background: var(--app-bg); padding: 24px 24px 26px; }
.sp-kpi:first-child { padding-left: 0; }
.sp-kpi .lbl { margin: 0; font-size: 13px; font-weight: 500; color: var(--app-muted); }
.sp-kpi .val { margin: 14px 0 0; display: flex; align-items: baseline; gap: 6px; }
.sp-kpi .unit { font-size: 16px; font-weight: 600; color: var(--app-muted); }
.sp-kpi .sub { margin: 10px 0 0; font-size: 13px; color: var(--app-muted); }
/* A tablet is touched too: the target link keeps a 44pt row. */
.sp-kpi .sub button { min-height: 44px; vertical-align: baseline; }
.sp-kpi .big { font-size: 64px; }

.sp-todo-sec { margin-top: clamp(24px, 5vw, 56px); }
.sp-todo-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.sp-todo-more { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; background: none; border: none; padding: 0; color: var(--brand-text); font: 500 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
.sp-todo { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.sp-task { display: flex; flex-direction: column; border-radius: 20px; padding: 20px; min-height: 216px; gap: 14px; background: var(--app-card); color: var(--app-text); border: 1px solid var(--app-border); }
.sp-task h3 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-task-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--app-muted); }
.sp-task-when { margin-left: auto; white-space: nowrap; }
.sp-task-when.is-late { color: var(--hot); font-weight: 600; }
.sp-task-when.is-today { color: var(--app-text); font-weight: 600; }
.sp-task-flag { margin-left: auto; font-size: 12px; padding: 3px 8px; border-radius: 999px; white-space: nowrap; background: rgba(255,255,255,0.16); color: #fff; }
.sp-task-what { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--app-muted); }
.sp-task-acts { margin-top: auto; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.sp-task .sp-btn { border-radius: 999px; }
.sp-task.is-first { background: #005eb0; color: #fff; border-color: #005eb0; }
.sp-task.is-first .sp-task-meta { color: rgba(255,255,255,0.88); }
.sp-task.is-first .sp-task-what { color: rgba(255,255,255,0.92); }
.sp-task.is-first .sp-btn.line { background: #fff; color: #004a8c; border-color: #fff; }
.sp-task.is-first .sp-btn.ghost { color: #fff; }
.sp-task-tile { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; color: color-mix(in srgb, var(--k) 75%, var(--app-text)); background: color-mix(in srgb, var(--k) 12%, transparent); }
.sp-task-kind { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-task.is-first .sp-task-tile { color: #fff; background: rgba(255,255,255,0.16); }
.sp-task-end { align-items: center; justify-content: center; gap: 4px; cursor: pointer; font-family: inherit; }
@media (min-width: 768px) { .sp-todo > .sp-task:nth-child(n+5), .sp-todo > .sp-task-end { display: none; } }

/* The whole queue: a sheet that scrolls inside itself. */
.sp-todo-sheet { background: var(--app-card); color: var(--app-text); border-radius: 20px; width: 100%; max-width: 480px; max-height: min(80dvh, 640px); display: flex; flex-direction: column; overflow: hidden; }
.sp-todo-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 8px 4px 20px; box-shadow: inset 0 -1px 0 var(--app-border); flex-shrink: 0; }
.sp-todo-list { list-style: none; margin: 0; padding: 0 0 8px; overflow-y: auto; overscroll-behavior: contain; }
.sp-todo-list button { width: 100%; min-height: 60px; display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 20px; border: 0; background: none; color: inherit; text-align: start; font-family: inherit; cursor: pointer; }
.sp-todo-list li + li button { box-shadow: inset 0 1px 0 var(--app-border); }
.sp-todo-list button > svg:last-child { color: var(--app-muted); flex-shrink: 0; }
.sp-row-title { display: block; font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-row-sub { display: block; margin-top: 2px; font-size: 13px; color: var(--app-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-row-sub .is-late { color: var(--hot); font-weight: 600; }
.sp-chat-flow { padding: 12px 20px 4px; }
.sp-chat { list-style: none; margin: 0; padding: 8px 16px 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; overscroll-behavior: contain; }
.sp-chat li { max-width: 85%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.sp-chat li.them { align-self: flex-start; background: var(--app-inner); border-bottom-left-radius: 4px; }
.sp-chat li.me { align-self: flex-end; background: color-mix(in srgb, #005eb0 12%, var(--app-card)); border-bottom-right-radius: 4px; }
.sp-chat-who { display: block; font-size: 11px; color: var(--app-muted); margin-bottom: 2px; }
.sp-chat-acts { display: flex; gap: 8px; padding: 8px 16px calc(12px + env(safe-area-inset-bottom, 0px)); box-shadow: inset 0 1px 0 var(--app-border); }
.sp-chat-acts > * { flex: 1; }
.sp-b-map { margin-top: 24px; }
/* The path line: done steps filled in the task's colour, the current one ringed. */
.sp-flow { list-style: none; margin: 0; padding: 0; display: flex; position: relative; }
.sp-flow li { flex: 1; position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; font-size: 11px; font-weight: 500; color: var(--app-muted); }
.sp-flow li::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--app-line-strong); position: relative; z-index: 1; }
.sp-flow li:not(:last-child)::after { content: ""; position: absolute; left: 8px; right: 0; top: 3px; height: 2px; border-radius: 1px; background: var(--app-border); }
.sp-flow li.done::before, .sp-flow li.done::after { background: color-mix(in srgb, var(--k) 80%, var(--app-text)); }
.sp-flow li.now::before { background: var(--app-card); box-shadow: 0 0 0 2px color-mix(in srgb, var(--k) 80%, var(--app-text)); }
.sp-flow li.now { color: var(--app-text); font-weight: 700; }
.sp-flow li span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 4px; }
.sp-task.is-first .sp-flow li { color: rgba(255,255,255,0.86); }
.sp-task.is-first .sp-flow li.now { color: #fff; }
.sp-task.is-first .sp-flow li::before, .sp-task.is-first .sp-flow li:not(:last-child)::after { background: rgba(255,255,255,0.35); }
.sp-task.is-first .sp-flow li.done::before, .sp-task.is-first .sp-flow li.done::after { background: #fff; }
.sp-task.is-first .sp-flow li.now::before { background: #005eb0; box-shadow: 0 0 0 2px #fff; }
.sp-b-more { margin-top: clamp(24px, 5vw, 56px); display: flex; flex-direction: column; gap: 32px; }

@media (min-width: 768px) and (max-width: 1099px) {
  .sp-kpi { padding: 20px 16px 22px; }
  .sp-kpi .big { font-size: 48px; }
}
@media (max-width: 767px) {
  .sp-b-desk { display: none !important; }
  /* One rhythm on a phone: 16px between blocks, 8/12px inside them. */
  .sp-b-panel { gap: 16px; }
  .sp-b-date { margin: 0 0 4px; font-size: 13px; }
  .sp-b-h1 { font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; }
  .sp-seg { max-width: none; margin-bottom: 12px; }
  .sp-card { border-radius: 14px; }

  /* Buttons: a 44px tap box drawn as a 32px shape. The transparent block
     border keeps the target; the fill and line sit on the padding box, and
     the negative margin gives the 12px back to the layout. */
  .sp-btn { height: 44px; margin-block: -6px; border: 0 solid transparent; border-block-width: 6px; background-clip: padding-box; border-radius: 14px; padding: 0 12px; font-size: 13px; gap: 6px; }
  .sp-btn.line { border-color: transparent; border-inline-width: 0; box-shadow: inset 0 0 0 1px var(--app-line-strong); }
  .sp-btn.tint { background-color: color-mix(in srgb, #005eb0 10%, transparent); color: var(--brand-text); }

  .sp-find { margin: 0; padding: 12px; gap: 12px; }
  .sp-find-ic { width: 32px; height: 32px; border-radius: 8px; }
  .sp-find-ttl { font-size: 14px !important; }
  .sp-find-sub { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* One filled action per screen (Mulai hunting): Cari bisnis steps down to a tint. */
  .sp-find .sp-find-go { background-color: color-mix(in srgb, #005eb0 10%, transparent); color: var(--brand-text); }

  .sp-today { margin: 0; flex-wrap: nowrap; gap: 12px; padding: 12px; }
  .sp-today-main { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
  .sp-today-txt { flex: none; font-size: 13px; gap: 8px; align-items: flex-start; line-height: 1.35; }
  .sp-today-txt > svg { margin-top: 1px; flex-shrink: 0; }
  .sp-today-sep { display: none; }
  .sp-today-q { display: block; color: var(--app-muted); }
  .sp-today-bar { display: block; height: 3px; border-radius: 2px; background: var(--app-inner); overflow: hidden; margin-left: 26px; }
  .sp-today-bar > span { display: block; height: 100%; border-radius: 2px; background: #b93a06; }
  .sp-today .sp-btn { flex-shrink: 0; height: 48px; margin-block: -6px; padding: 0 14px; font-size: 14px; }

  .sp-kpis { margin: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; background: var(--app-card); border: 1px solid var(--app-border); border-radius: 14px; overflow: hidden; }
  .sp-kpi { background: transparent; padding: 12px; }
  .sp-kpi:first-child { padding-left: 12px; }
  .sp-kpi + .sp-kpi { box-shadow: inset 1px 0 0 var(--app-border); }
  .sp-kpi.closing { display: none; }
  .sp-kpi.closing + .sp-kpi { box-shadow: inset 1px 0 0 var(--app-border); }
  .sp-kpi .lbl { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sp-kpi .val { margin-top: 4px; gap: 3px; }
  .sp-kpi .big { font: 700 24px/1.15 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .sp-kpi .unit { font-size: 13px; }
  .sp-kpi .sub { display: none; }

  /* Perlu ditindak: a swipe queue. Cards snap, the next one peeks, and every
     card is the same height so the row never jumps. */
  .sp-todo-sec { margin: 0; }
  .sp-todo-head { margin-bottom: 8px; }
  .sp-todo { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: min(80%, 300px); gap: 12px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-padding-inline: 16px; margin: 0 -16px; padding: 2px 16px 4px; scrollbar-width: none; }
  .sp-todo::-webkit-scrollbar { display: none; }
  .sp-task, .sp-task.is-first { scroll-snap-align: start; height: 214px; min-height: 0; padding: 14px; border-radius: 18px; gap: 10px; color: var(--app-text); border: 1px solid color-mix(in srgb, var(--k, #5b636c) 18%, var(--app-border));
    background: radial-gradient(140% 100% at 0% 0%, color-mix(in srgb, var(--k, #5b636c) 15%, var(--app-card)) 0%, var(--app-card) 62%); }
  .sp-task.is-first .sp-flow li { color: var(--app-muted); }
  .sp-task.is-first .sp-flow li.now { color: var(--app-text); }
  .sp-task.is-first .sp-flow li:not(:last-child)::after { background: var(--app-border); }
  .sp-task.is-first .sp-flow li::before { background: var(--app-line-strong); }
  .sp-task.is-first .sp-flow li.done::before, .sp-task.is-first .sp-flow li.done::after { background: color-mix(in srgb, var(--k) 80%, var(--app-text)); }
  .sp-task.is-first .sp-flow li.now::before { background: var(--app-card); box-shadow: 0 0 0 2px color-mix(in srgb, var(--k) 80%, var(--app-text)); }
  .sp-b-map { margin: 0; }
  /* Each block gets a soft wash of its own colour, so none is a blank box. */
  .sp-today { background: radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, #b93a06 12%, var(--app-card)) 0%, var(--app-card) 58%); border-color: color-mix(in srgb, #b93a06 16%, var(--app-border)); }
  .sp-find { background: radial-gradient(120% 140% at 0% 100%, color-mix(in srgb, #005eb0 10%, var(--app-card)) 0%, var(--app-card) 60%); }
  .sp-kpis { background: linear-gradient(180deg, color-mix(in srgb, #005eb0 6%, var(--app-card)) 0%, var(--app-card) 100%); }
  .sp-task.is-first { border-color: color-mix(in srgb, #005eb0 45%, var(--app-border)); }
  .sp-task.is-first .sp-task-tile { color: color-mix(in srgb, var(--k) 75%, var(--app-text)); background: color-mix(in srgb, var(--k) 12%, transparent); }
  .sp-task h3 { font-size: 16px; line-height: 1.3; }
  .sp-task-meta, .sp-task.is-first .sp-task-meta { font-size: 12px; gap: 8px; color: var(--app-muted); }
  .sp-task-what, .sp-task.is-first .sp-task-what { margin-top: 2px; font-size: 13px; line-height: 1.4; color: var(--app-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sp-task-flag { background: color-mix(in srgb, #005eb0 12%, transparent); color: var(--brand-text); font-weight: 600; padding: 2px 8px; }
  .sp-task-acts { margin-top: auto; gap: 4px; flex-wrap: nowrap; }
  .sp-task .sp-btn { border-radius: 14px; }
  .sp-task .sp-btn.ghost { padding: 0 8px; }
  .sp-task.is-first .sp-btn.line { background-color: color-mix(in srgb, #005eb0 10%, transparent); color: var(--brand-text); box-shadow: none; }
  .sp-task.is-first .sp-btn.ghost { color: var(--app-ink-2); }
  .sp-task-end { background: var(--app-inner) !important; border-style: dashed !important; }
  /* On a phone the sheet rises from the bottom edge. */
  .sp-todo-sheet { max-width: none; width: calc(100% + 32px); margin: 0 -16px calc(-1 * max(20px, env(safe-area-inset-bottom))); border-radius: 20px 20px 0 0; max-height: 85dvh; padding-bottom: env(safe-area-inset-bottom); }
  .sp-b-more { margin-top: 8px; gap: 16px; }
  .sp-sources { padding: 16px !important; margin-bottom: 0 !important; border-radius: 14px !important; }
}
@media (max-width: 360px) {
  .sp-today { flex-direction: column; align-items: stretch; }
  .sp-today .sp-btn { width: 100%; }
  .sp-kpi .lbl { white-space: normal; min-height: 2.6em; line-height: 1.3; }
  .sp-seg-btn { font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) { .sp-seg-btn > span { transition: none; } }
`;

export default function Beranda({ now, todo, numbers, mapLeads, onOpenLead, onImport, onFind, onAdd, onAllLeads, onSetTarget, hunting, report, learn, children }: {
  now: string; todo: Todo[]; numbers: Numbers; mapLeads: MapLead[];
  onOpenLead: (id: string) => void; onImport: () => void; onFind?: () => void; onAdd: () => void; onAllLeads: () => void; onSetTarget: () => void;
  hunting?: HuntingStrip; report?: React.ReactNode; learn?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [mode, setModeState] = useState<BerandaMode>(savedMode);
  const setMode = (m: BerandaMode) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ } };
  const [sheet, setSheet] = useState(false);
  const [chatOf, setChatOf] = useState<Todo | null>(null);
  const due = todo.filter(t => t.when <= now).length;
  // A queue, not a feed: the phone swipes through the first ten (the desktop
  // grid shows four), and the whole list opens in its own scrolling sheet.
  const shown = todo.slice(0, CAROUSEL);
  const whenOf = (t: Todo) => t.when < now ? `Telat ${Math.round((Date.parse(now) - Date.parse(t.when)) / 86400000)} hari` : t.when === now ? "Hari ini" : longDate(t.when);
  const day = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  const pct = numbers.closingTarget ? Math.min(100, (numbers.closedThisMonth / numbers.closingTarget) * 100) : 0;

  const tabs = (
    <div role="tablist" aria-label="Mode Beranda" className="sp-seg">
      {MODES.map(([m, l]) => (
        <button key={m} role="tab" className="sp-seg-btn" id={`bm-${m}`} aria-selected={mode === m} aria-controls="beranda-panel" onClick={() => setMode(m)}>
          <span>{l}</span>
        </button>
      ))}
    </div>
  );

  if (mode !== "jualan") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <style>{css}</style>
        {tabs}
        <div id="beranda-panel" role="tabpanel" aria-labelledby={`bm-${mode}`}>{mode === "report" ? report : learn}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{css}</style>
      {tabs}
      <div id="beranda-panel" role="tabpanel" aria-labelledby="bm-jualan" className="sp-b-panel">
      <div className="sp-b-head">
        <div style={{ minWidth: 0 }}>
          <p className="sp-b-date">{day}</p>
          <h1 className="sp-b-h1">
            {due ? (
              <><span className="sp-b-desk">{greeting()}. Ada </span>{due} hal <span className="sp-b-desk">yang </span>perlu ditindak hari ini.</>
            ) : (
              <><span className="sp-b-desk">{greeting()}. </span>Belum ada yang mendesak hari ini.</>
            )}
          </h1>
        </div>
        <div className="sp-b-desk" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onImport} className="sp-btn line" style={{ borderRadius: 999 }}><Icon name="upload" stroke={1.6} />Import</button>
          <button onClick={onAdd} className="sp-btn blue" style={{ borderRadius: 999 }}><Icon name="plus" stroke={1.8} />Tambah lead</button>
        </div>
      </div>

      {hunting && (
        // The day's one main move: today's DMs against the goal, then start.
        <section aria-label="Hunting hari ini" className="sp-card sp-today">
          <span className="sp-today-main">
          <span className="sp-today-txt">
            <Icon name="target" size={18} />
            <span><b className="tabnum">{hunting.sentToday}/{hunting.goal}</b> DM hari ini<span className="sp-today-sep"> · </span><span className="sp-today-q"><b className="tabnum">{hunting.queued}</b> prospek di antrian</span></span>
          </span>
          <span className="sp-today-bar" aria-hidden="true"><span style={{ width: `${hunting.goal ? Math.min(100, (hunting.sentToday / hunting.goal) * 100) : 0}%` }} /></span>
          </span>
          {hunting.live
            ? <button onClick={hunting.onOpen} className="sp-btn line">Sesi jalan · buka Hunting</button>
            : <button onClick={hunting.onStart} className="sp-btn hunt"><Icon name="play" size={16} />Mulai hunting</button>}
        </section>
      )}

      {/* The map comes right after the day's move: where the leads are, by
          potential or on the street (PRD-013). */}
      <div className="sp-b-map">
        <LeadMap leads={mapLeads} onOpen={onOpenLead} onAll={onAllLeads} onAdd={onAdd} onImport={onImport} />
      </div>

      {onFind && (
        // Cari bisnis (PRD-012): new prospects from Google Maps or an Excel list.
        <section aria-label="Cari calon klien" className="sp-card sp-find">
          <span aria-hidden="true" className="sp-find-ic"><Icon name="search" size={18} stroke={1.8} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="sp-find-ttl" style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Cari calon klien</span>
            <span className="sp-find-sub">Bisnis dari Google Maps, titik lemahnya, dan pesan pembuka. Atau import daftar Excel.</span>
          </span>
          <button onClick={onFind} className="sp-btn blue sp-find-go" style={{ flexShrink: 0 }}>Cari bisnis</button>
        </section>
      )}

      <section aria-label="Ringkasan pipeline" className="sp-kpis">
        <div className="sp-kpi">
          <p className="lbl">Lead aktif</p>
          <p className="val"><span className="num big">{numbers.active}</span></p>
          <p className="sub">{numbers.newThisWeek ? `+${numbers.newThisWeek} minggu ini` : "Belum ada yang baru minggu ini"}</p>
        </div>
        <div className="sp-kpi">
          <p className="lbl">Potensi tinggi</p>
          <p className="val"><span className="num big">{numbers.high}</span></p>
          <p className="sub">Skor 70 ke atas</p>
        </div>
        <div className="sp-kpi closing">
          <p className="lbl">Closing bulan ini</p>
          <p className="val">
            <span className="num big">{numbers.closedThisMonth}</span>
            {numbers.closingTarget > 0 && <span className="num" style={{ fontSize: 30, color: "var(--app-muted)" }}>/ {numbers.closingTarget}</span>}
          </p>
          {numbers.closingTarget > 0 ? (
            <button onClick={onSetTarget} aria-label={`${numbers.closedThisMonth} dari target ${numbers.closingTarget} deal. Ubah target`} style={{ display: "block", width: "100%", marginTop: 14, padding: 0, border: 0, background: "none", cursor: "pointer" }}>
              <span style={{ display: "block", height: 4, borderRadius: 999, background: "var(--app-border)", overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 999, background: "#005eb0" }} /></span>
            </button>
          ) : (
            <p className="sub">{numbers.paidThisMonth} · <button onClick={onSetTarget} style={{ padding: 0, border: 0, background: "none", color: "var(--brand-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Atur target</button></p>
          )}
        </div>
        <div className="sp-kpi">
          <p className="lbl">Nilai pipeline</p>
          <p className="val">
            <span className="unit">Rp</span>
            <span className="num big">{jtNum(numbers.pipeline)}</span>
            <span className="unit">jt</span>
          </p>
          <p className="sub">Rp {jtNum(numbers.pipelineHigh)} jt di potensi tinggi</p>
        </div>
      </section>

      <section aria-labelledby="todo-h" className="sp-todo-sec">
        <div className="sp-todo-head">
          <h2 id="todo-h" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Perlu ditindak <span className="tabnum" style={{ color: "var(--app-muted)", fontWeight: 500 }}>{due}{todo.length > due ? ` hari ini · ${todo.length - due} nanti` : ""}</span></h2>
          {todo.length > 1 && <button onClick={() => setSheet(true)} className="sp-todo-more" aria-haspopup="dialog">Lihat semua<Icon name="chevronRight" size={14} stroke={1.8} /></button>}
        </div>
        {todo.length === 0 ? (
          <div className="sp-card" style={{ padding: 16, fontSize: 14, color: "var(--app-muted)" }}>
            Aman. Ga ada follow-up, penawaran, deal macet, atau tagihan yang nunggu. Pasang jadwal follow-up dari detail lead.
          </div>
        ) : (
          <div className="sp-todo">
            {shown.map((t, i) => {
              const first = i === 0;
              const late = t.when < now;
              const whenText = whenOf(t);
              return (
                <article key={t.key} className={`sp-task${first ? " is-first" : " lift"}`} style={{ "--k": kindColor(t.kind) } as React.CSSProperties}>
                  <div className="sp-task-meta">
                    <span className="sp-task-tile" aria-hidden="true"><Icon name={t.icon} size={16} /></span>
                    <span className="sp-task-kind">{t.kind}</span>
                    {first
                      ? <span className="sp-task-flag">Paling mendesak</span>
                      : <span className={`sp-task-when tabnum${late ? " is-late" : t.when === now ? " is-today" : ""}`}>{whenText}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{t.title}</h3>
                    <p className="sp-task-what">{t.what}{first ? ` · ${whenText.toLowerCase()}` : ""}</p>
                  </div>
                  {(() => {
                    // A prospect shows its real journey; other tasks the path of their kind.
                    const f = t.journey ? { steps: t.journey.steps, at: t.journey.at } : stepsOf(t);
                    return (
                      <ol className="sp-flow" style={t.journey ? { "--k": t.journey.color } as React.CSSProperties : undefined} aria-label={`Tahap sekarang: ${f.steps[f.at]}, ${f.at + 1} dari ${f.steps.length}`}>
                        {f.steps.map((st, n) => <li key={st} className={n < f.at ? "done" : n === f.at ? "now" : undefined} aria-hidden="true"><span>{st}</span></li>)}
                      </ol>
                    );
                  })()}
                  <div className="sp-task-acts">
                    {t.wa && t.phone
                      ? <a href={waLink(t.phone, t.text)} target="_blank" rel="noreferrer" className="sp-btn line">{t.action}</a>
                      : <button onClick={t.open} className="sp-btn line">{t.action}</button>}
                    {t.snooze && <button onClick={t.snooze} className="sp-btn ghost">Tunda</button>}
                    {!t.snooze && t.wa && t.phone && <button onClick={t.open} className="sp-btn ghost">Buka</button>}
                    {t.journey && t.journey.chat.length > 0 && <button onClick={() => setChatOf(t)} className="sp-btn ghost" aria-haspopup="dialog" aria-label={`Chat terakhir dengan ${t.title}`}>Chat</button>}
                  </div>
                </article>
              );
            })}
            {todo.length > CAROUSEL && (
              <button className="sp-task sp-task-end" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label={`Lihat semua ${todo.length}`}>
                <span style={{ fontSize: 28, fontWeight: 700 }} className="tabnum">+{todo.length - CAROUSEL}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-text)" }}>Lihat semua {todo.length}</span>
              </button>
            )}
          </div>
        )}
        {chatOf?.journey && (
          // The chat so far with a prospect, without leaving Beranda.
          <div className="modal-overlay" onClick={() => setChatOf(null)} style={{ alignItems: "flex-end" }}>
            <div role="dialog" aria-modal="true" aria-labelledby="chat-h" data-own-layout className="sp-todo-sheet" onClick={e => e.stopPropagation()}>
              <div className="sp-todo-sheet-head">
                <h2 id="chat-h" style={{ margin: 0, fontSize: 17, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatOf.title}</h2>
                <button onClick={() => setChatOf(null)} className="sp-btn ghost" style={{ color: "var(--brand-text)", fontWeight: 600, flexShrink: 0 }}>Tutup</button>
              </div>
              <ol className="sp-flow sp-chat-flow" style={{ "--k": chatOf.journey.color } as React.CSSProperties} aria-label={`Tahap sekarang: ${chatOf.journey.steps[chatOf.journey.at]}`}>
                {chatOf.journey.steps.map((st, n) => <li key={st} className={n < chatOf.journey!.at ? "done" : n === chatOf.journey!.at ? "now" : undefined} aria-hidden="true"><span>{st}</span></li>)}
              </ol>
              <ul className="sp-chat" aria-label="Chat terakhir">
                {chatOf.journey.chat.map((m, i) => (
                  <li key={i} className={m.who === "kamu" ? "me" : "them"}>
                    <span className="sp-chat-who">{m.who === "kamu" ? "Kamu" : "Dia"} · {new Date(m.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                    {m.text}
                  </li>
                ))}
              </ul>
              <div className="sp-chat-acts">
                {chatOf.journey.profile && <a href={chatOf.journey.profile} target="_blank" rel="noreferrer" className="sp-btn line"><Icon name="arrowUpRight" size={16} />Buka profil</a>}
                <button onClick={() => { const t = chatOf; setChatOf(null); t.open(); }} className="sp-btn blue">{chatOf.action}</button>
              </div>
            </div>
          </div>
        )}
        {sheet && (
          // The full queue scrolls inside its own sheet; the page stays short.
          <div className="modal-overlay" onClick={() => setSheet(false)} style={{ alignItems: "flex-end" }}>
            <div role="dialog" aria-modal="true" aria-labelledby="todo-all-h" data-own-layout className="sp-todo-sheet" onClick={e => e.stopPropagation()}>
              <div className="sp-todo-sheet-head">
                <h2 id="todo-all-h" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Perlu ditindak <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{todo.length}</span></h2>
                <button onClick={() => setSheet(false)} className="sp-btn ghost" style={{ color: "var(--brand-text)", fontWeight: 600 }}>Tutup</button>
              </div>
              <ul className="sp-todo-list">
                {todo.map(t => (
                  <li key={t.key} style={{ "--k": kindColor(t.kind) } as React.CSSProperties}>
                    <button onClick={() => { setSheet(false); t.open(); }}>
                      <span className="sp-task-tile" aria-hidden="true"><Icon name={t.icon} size={16} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="sp-row-title">{t.title}</span>
                        <span className="sp-row-sub">{t.kind} · <span className={t.when < now ? "is-late" : undefined}>{whenOf(t)}</span></span>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <div className="sp-b-more">
        {children}
      </div>
      </div>
    </div>
  );
}
