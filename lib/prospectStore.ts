"use client";

// The Firestore side of prospect journeys (docs/prd/PRD-008). lib/prospects.ts
// decides what each action changes; this file reads and writes it, inside the
// current workspace (lib/space.ts).

import { useEffect, useRef, useState } from "react";
import { deleteDoc, getDocs, increment, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Space, spaceDoc, spaceQuery, stamp } from "@/lib/space";
import { today } from "@/lib/billing";
import { authFetch } from "@/lib/authFetch";
import type { Platform } from "@/lib/hunting";
import {
  Channel, Ctx, HuntSession, Prospect, Strategy, huntStatusFor, isLive, lastHuntId, newProspect,
  prospectId, sentPatch, strategyFrom,
} from "@/lib/prospects";

// Firestore refuses undefined anywhere in a document.
export function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, clean(x)])) as T;
  }
  return v;
}

const keyOf = (s: Space) => `${s.kind}:${s.id}:${s.role || ""}`;
const mine = (s: Space) => (r: { ownerUid?: string }) => s.kind === "me" || !r.ownerUid || r.ownerUid === s.me.uid;

export function ctx(sessionId?: string): Ctx {
  return { on: today(), at: Date.now(), ...(sessionId ? { sessionId } : {}) };
}

// The journeys still open. DNC ones are closed and only loaded on request,
// so the list stays cheap to read every time the app opens (PRD-008 §9).
export function useProspects(space: Space): { rows: Prospect[]; ready: boolean } {
  const [state, setState] = useState<{ rows: Prospect[]; ready: boolean }>({ rows: [], ready: false });
  const key = keyOf(space);
  useEffect(() => {
    setState({ rows: [], ready: false });
    return onSnapshot(query(spaceQuery(space, "prospects"), where("closed", "==", false)), snap => {
      setState({ rows: snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)), ready: true });
    }, () => setState({ rows: [], ready: true }));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export async function loadClosed(space: Space): Promise<Prospect[]> {
  const snap = await getDocs(query(spaceQuery(space, "prospects"), where("closed", "==", true)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));
}

export function useStrategy(space: Space): Strategy {
  const [s, setS] = useState<Strategy>(strategyFrom(null));
  const key = keyOf(space);
  useEffect(() => onSnapshot(spaceDoc(space, "settings", "hunting"), snap => {
    setS(strategyFrom((snap.data() as { strategy?: Partial<Strategy> } | undefined)?.strategy));
  }, () => setS(strategyFrom(null))), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

export interface CostItem { id: string; name: string; category: string; amount: number }
export const COST_CATEGORIES = ["Hosting", "Tool", "Scraping", "Iklan", "Domain", "Lainnya"] as const;

// Running costs for one month (costs/{yyyy-mm}), for cost per prospect and per conversion.
export function useCosts(space: Space, month: string): CostItem[] {
  const [items, setItems] = useState<CostItem[]>([]);
  const key = `${keyOf(space)}:${month}`;
  useEffect(() => {
    setItems([]);
    return onSnapshot(spaceDoc(space, "costs", month), snap => setItems(((snap.data() as { items?: CostItem[] } | undefined)?.items) || []), () => setItems([]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return items;
}

export async function saveCosts(space: Space, month: string, items: CostItem[]): Promise<void> {
  await setDoc(spaceDoc(space, "costs", month), { items: clean(items) });
}

// ---- hunting sessions -----------------------------------------------------

export function useHuntSession(space: Space) {
  const [rows, setRows] = useState<HuntSession[]>([]);
  const key = keyOf(space);
  useEffect(() => {
    setRows([]);
    return onSnapshot(spaceQuery(space, "huntSessions"), snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as HuntSession)).filter(mine(space)).sort((a, b) => b.startedAt - a.startedAt));
    }, () => setRows([]));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A session left open past the idle limit ended at its last action.
  useEffect(() => {
    const now = Date.now();
    for (const s of rows) if (!s.endedAt && !isLive(s, now)) updateDoc(spaceDoc(space, "huntSessions", s.id), { endedAt: s.lastActionAt || s.startedAt }).catch(() => undefined);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = rows.find(s => !s.endedAt) || null;
  const live = open && isLive(open, Date.now()) ? open : null;

  async function start(): Promise<void> {
    const at = Date.now();
    await setDoc(spaceDoc(space, "huntSessions", `hs_${at}`), stamp(space, {
      startedAt: at, lastActionAt: at, endedAt: null, counts: { prospects: 0, intros: 0, replies: 0, converted: 0 },
    }));
  }
  async function end(): Promise<void> {
    if (open) await updateDoc(spaceDoc(space, "huntSessions", open.id), { endedAt: Date.now() });
    sessionNotice(null);
  }
  return { live, sessions: rows, start, end };
}

export type Counter = keyof HuntSession["counts"];

export function bump(space: Space, sessionId: string | undefined, what: Counter, by = 1): void {
  if (!sessionId) return;
  updateDoc(spaceDoc(space, "huntSessions", sessionId), { [`counts.${what}`]: increment(by), lastActionAt: Date.now() }).catch(() => undefined);
}

// Android keeps a quiet notification while a session runs, the nearest a web
// app gets to a bar over other apps (PRD-008 §4.3). Only with permission
// already given for the morning push; never asks.
export async function sessionNotice(body: string | null): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) return;
    if (!("serviceWorker" in navigator) || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return;
    if (body === null) { (await reg.getNotifications({ tag: "hunt-session" })).forEach(n => n.close()); return; }
    await reg.showNotification("Hunting aktif", { tag: "hunt-session", body, silent: true, icon: "/logo-mark.png", badge: "/logo-mark.png", data: { url: "/dashboard?hunt" } });
  } catch { /* a notification is a nicety */ }
}

// ---- links handed to Hunting from elsewhere (the bar, a share) -------------

export type HuntInbox = { kind: "link"; text: string } | { kind: "queue" };
let pending: HuntInbox | null = null;
const listeners = new Set<(m: HuntInbox) => void>();

export function sendToHunting(m: HuntInbox): void {
  if (listeners.size) listeners.forEach(l => l(m));
  else pending = m;
}

export function useHuntInbox(fn: (m: HuntInbox) => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const l = (m: HuntInbox) => ref.current(m);
    if (pending) { const m = pending; pending = null; l(m); }
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
}

// ---- Threads links -----------------------------------------------------------

export interface Unfurled { handle: string; name: string; text: string; postUrl: string; postId: string }

export async function unfurl(url: string): Promise<Unfurled | { error: string }> {
  try {
    const res = await authFetch("/api/hunt/unfurl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const body = await res.json().catch(() => ({}));
    return res.ok ? (body as Unfurled) : { error: body.error || "Link-nya nggak kebaca." };
  } catch {
    return { error: "Nggak nyambung ke server. Isi username-nya manual." };
  }
}

// ---- writes ----------------------------------------------------------------

const strip = (p: Prospect): Omit<Prospect, "id"> => { const { id: _id, ...rest } = p; void _id; return rest; };

export async function saveProspect(space: Space, p: Prospect, patch: Partial<Prospect>): Promise<void> {
  await updateDoc(spaceDoc(space, "prospects", p.id), clean(patch) as Record<string, unknown>);
}

export async function createProspect(space: Space, id: string, data: Omit<Prospect, "id">): Promise<void> {
  await setDoc(spaceDoc(space, "prospects", id), clean(stamp(space, data)));
}

export async function removeProspect(space: Space, p: Prospect): Promise<void> {
  await deleteDoc(spaceDoc(space, "prospects", p.id));
}

// The latest DM to them reads the same as their journey, so the template
// numbers count this answer too.
export function syncHunt(space: Space, p: Prospect): void {
  const id = lastHuntId(p);
  const status = huntStatusFor(p);
  if (!id || !status) return;
  updateDoc(spaceDoc(space, "hunts", id), clean({ status, ...(status === "Ditolak" && p.remark ? { note: p.remark } : {}) })).catch(() => undefined);
}

export interface Send {
  target: string; platform: Platform; url?: string;
  templateId: string; templateTitle: string; text: string; channel: Channel;
  source?: Prospect["source"]; name?: string;
  campaignId?: string; campaignName?: string;
}

// One message out: a row in the DM log and a step in the person's journey,
// written together. Returns the way back, for "Batal".
export async function recordSend(space: Space, a: Send, existing: Prospect | undefined, sessionId: string | undefined, s: Strategy): Promise<() => Promise<void>> {
  const c = ctx(sessionId);
  const huntId = `hunt_${c.at}`;
  const pid = existing?.id || prospectId(a.platform, a.target);
  const base: Prospect = existing || {
    id: pid,
    ...newProspect({ platform: a.platform, handle: a.target.trim(), name: a.name, url: a.url, source: a.source || { kind: "manual" } }, c),
  };
  const patch = sentPatch(base, {
    text: a.text, channel: a.channel, template: a.templateTitle, huntId,
    campaignId: a.campaignId, campaign: a.campaignName, url: a.url,
  }, c, s);
  const hunt = {
    target: a.target.trim(), platform: a.platform, templateId: a.templateId, templateTitle: a.templateTitle,
    status: "Terkirim", note: "", date: c.on, createdAt: c.at, prospectId: pid, channel: a.channel,
    url: a.url, campaignId: a.campaignId, sessionId,
  };
  const b = writeBatch(db);
  b.set(spaceDoc(space, "hunts", huntId), clean(stamp(space, hunt, existing)));
  if (existing) b.update(spaceDoc(space, "prospects", pid), clean(patch) as Record<string, unknown>);
  else b.set(spaceDoc(space, "prospects", pid), clean(stamp(space, { ...strip(base), ...patch })));
  await b.commit();
  bump(space, sessionId, "intros");
  if (!existing) bump(space, sessionId, "prospects");

  return async () => {
    const u = writeBatch(db);
    u.delete(spaceDoc(space, "hunts", huntId));
    if (existing) u.set(spaceDoc(space, "prospects", pid), clean(strip(existing)));
    else u.delete(spaceDoc(space, "prospects", pid));
    await u.commit();
    bump(space, sessionId, "intros", -1);
    if (!existing) bump(space, sessionId, "prospects", -1);
  };
}
