// A lead's profile (PRD-008 §3–4): what they need, what hurts, what holds
// them back, and what kind of customer they are — so the next message fits.

import { archetypes, objections, scriptMatrix } from "@/lib/salespal-data";
import { detectObjection } from "@/lib/replies";

export interface LeadProfile {
  need?: string;
  pain?: string;
  objection?: string;
  objectionType?: string;   // lib/salespal-data objections[].id
  archetype?: string;       // lib/salespal-data archetypes[].id
  brief?: string;
  source?: "manual" | "wa-export";
  at?: string;              // YYYY-MM-DD
}

export const hasProfile = (p?: LeadProfile | null) => Boolean(p && (p.need || p.pain || p.objection || p.archetype));

// The customer type whose trigger words show up most in what was written.
export function guessArchetype(text: string): string | null {
  const t = (text || "").toLowerCase();
  let best: { id: string; n: number } | null = null;
  for (const a of archetypes) {
    const n = a.triggerWords.filter(w => t.includes(w.toLowerCase())).length;
    if (n && (!best || n > best.n)) best = { id: a.id, n };
  }
  return best?.id || null;
}

export const objectionTypeOf = (p: LeadProfile) => p.objectionType || (p.objection ? detectObjection(p.objection) : null);

// The scripts that fit this person: their type × their objection, both tones.
export function scriptsFor(p: LeadProfile) {
  const a = p.archetype && archetypes.find(x => x.id === p.archetype);
  const o = objectionTypeOf(p);
  if (!a) return { archetype: null, objection: null, scripts: [] };
  const obj = o ? objections.find(x => x.id === o) || null : null;
  return { archetype: a, objection: obj, scripts: obj ? scriptMatrix[a.id]?.[obj.id] || [] : [] };
}
