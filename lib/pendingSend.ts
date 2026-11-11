// Kiriman tertunda (docs/interaction/ambiguities.md AMB-06).
//
// A message counts as Terkirim only once the seller confirms it (GLOSSARY). The
// question "udah kekirim?" used to live in the screen that asked it, so it was
// lost when the seller switched tabs, closed the sheet, or iOS reloaded the PWA
// while they were in WhatsApp, and the send was never recorded.
//
// Every question is now also kept here, in sessionStorage, until it is answered.
// The screen that asks it "owns" it while it is on screen. When nobody owns one
// any more (that screen is gone, or the app was reloaded), the app-wide sheet
// (components/PendingSends.tsx) asks instead, and records it the same way.

import type { Send } from "@/lib/prospectStore";

export type PendingSend = {
  id: string;
  at: number;
  label: string;           // "Pesan ke @kopisore"
  space: string;           // workspace key; another workspace's sends wait their turn
} & (
  | { kind: "hunt"; send: Send; prospectId?: string; sessionId?: string }
  | { kind: "lead"; leadId: string; what: string; followUp?: boolean }
  // A Beranda card's WhatsApp: a lead's follow-up, a quote's nudge, a bill's reminder.
  | { kind: "todo"; target: { type: "lead" | "quote" | "invoice"; id: string } }
);

const KEY = "sp-pending-sends";
const MAX_AGE = 12 * 60 * 60 * 1000;   // a question older than half a day isn't asked again
const owned = new Set<string>();
const listeners = new Set<() => void>();

function read(): PendingSend[] {
  try {
    const all = JSON.parse(sessionStorage.getItem(KEY) || "[]") as PendingSend[];
    return all.filter(p => Date.now() - p.at < MAX_AGE);
  } catch { return []; }
}
function write(list: PendingSend[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: in-memory only */ }
  listeners.forEach(f => f());
}

// Omit over each member of the union, so each kind keeps its own fields.
type NewPending = PendingSend extends infer T ? (T extends PendingSend ? Omit<T, "id" | "at"> & { id?: string } : never) : never;

/** Keep a question until it is answered. Returns its id; the caller owns it. */
export function addPending(p: NewPending): string {
  const id = p.id || `ps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  owned.add(id);
  write([...read().filter(x => x.id !== id), { ...p, id, at: Date.now() } as PendingSend]);
  return id;
}
/** Answered (Udah or Belum): forget it. */
export function removePending(id: string | undefined) {
  if (!id) return;
  owned.delete(id);
  write(read().filter(x => x.id !== id));
}
/** The screen that asked it is gone: the app-wide sheet asks instead. */
export function release(id: string | undefined) {
  if (!id || !owned.delete(id)) return;
  listeners.forEach(f => f());
}
/** Questions nobody on screen is asking. */
export function orphans(space: string): PendingSend[] {
  return read().filter(p => p.space === space && !owned.has(p.id));
}
export function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
