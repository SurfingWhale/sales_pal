// The pricelist the studio's sites read and write (PRD-017 §6,
// creative-hub standards/pricelist.md). Server only: Admin SDK, so the
// rules don't apply here and every check below is the gate.
//
// One space (the owner's own, or a guild they lead) is the source; its
// `services` are the packages. config/pricelist names it, and only the owner
// sets it (app/api/pricelist/source). A site reads what is shown on it and,
// with its own key, changes its own price: one copy, two doors.
//
// Env: PRICELIST_KEY_VISUFAVOR, PRICELIST_KEY_UNTMD_SPORTS, PRICELIST_KEY_BEUNTAMED,
// one long random secret per site, held by that site's server and by SalesPal.

import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/serverAuth";
import { MARGIN_TARGET, SiteId, SitePrice, lines } from "@/lib/sites";

const SOURCE = "config/pricelist";
const SPACE = /^(users|guilds)\/[A-Za-z0-9_-]{1,128}$/;

interface Pkg {
  name: string; price: number; unit?: string; description?: string; excludes?: string; cost?: number;
  sites?: Partial<Record<SiteId, SitePrice>>; version?: number; updatedAt?: number; updatedFrom?: string;
}

export interface PublicPackage {
  id: string; name: string; from: number; unit: string; includes: string[]; excludes: string[]; order: number; version: number;
}

export async function sourceSpace(): Promise<string | null> {
  const v = (await adminDb().doc(SOURCE).get()).data()?.space;
  return typeof v === "string" && SPACE.test(v) ? v : null;
}

export async function setSourceSpace(space: string, by: string) {
  if (!SPACE.test(space)) throw new Error("bad space");
  await adminDb().doc(SOURCE).set({ space, by, at: Date.now() });
}

// What a site shows of one package. Nothing internal: no cost, no vendor, no notes.
export function toPublic(id: string, p: Pkg, site: SiteId): PublicPackage {
  const sp = p.sites?.[site];
  return {
    id, name: sp?.name || p.name, from: sp ? (sp.linked ? p.price : sp.from) : p.price, unit: p.unit || "",
    includes: lines(p.description), excludes: lines(p.excludes), order: sp?.order ?? 0, version: p.version || 0,
  };
}

export async function readPricelist(site: SiteId): Promise<{ updatedAt: number; packages: PublicPackage[] }> {
  const space = await sourceSpace();
  if (!space) return { updatedAt: 0, packages: [] };
  const snap = await adminDb().collection(`${space}/services`).get();
  const shown = snap.docs.filter(d => (d.data() as Pkg).sites?.[site]?.shown);
  const packages = shown.map(d => toPublic(d.id, d.data() as Pkg, site))
    .sort((a, b) => a.order - b.order || a.from - b.from || a.name.localeCompare(b.name));
  const updatedAt = Math.max(0, ...shown.map(d => (d.data() as Pkg).updatedAt || 0));
  return { updatedAt, packages };
}

export function siteKeyOk(site: SiteId, header: string | null): boolean {
  const want = process.env[`PRICELIST_KEY_${site.toUpperCase().replace(/-/g, "_")}`] || "";
  const got = (header || "").startsWith("Bearer ") ? (header as string).slice(7).trim() : "";
  if (want.length < 16 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export interface SiteWrite {
  version?: number; name?: string; from?: number; unit?: string; includes?: string[]; excludes?: string[]; order?: number; shown?: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const int = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(x => x.trim().slice(0, 200)).filter(Boolean).slice(0, 30) : undefined);

// A site's body, reduced to what a site may say about its own price.
export function parseWrite(b: unknown): SiteWrite {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  return {
    version: int(o.version, 1e9), name: str(o.name, 120) || undefined, from: int(o.from, 1e11), unit: str(o.unit, 40),
    includes: list(o.includes), excludes: list(o.excludes), order: int(o.order, 1e4), shown: typeof o.shown === "boolean" ? o.shown : undefined,
  };
}

type Result = { status: number; json: Record<string, unknown> };

// A change from a site's admin. Linked: it is the SalesPal price too, and every
// linked site follows. Unlinked: only this site's number. A change made on a
// stale copy is refused with the current one, so nothing is overwritten unseen.
export async function writeFromSite(site: SiteId, id: string | null, w: SiteWrite): Promise<Result> {
  const space = await sourceSpace();
  if (!space) return { status: 503, json: { error: "SalesPal has no pricelist yet." } };
  const col = adminDb().collection(`${space}/services`);
  const ref = id ? col.doc(id) : col.doc(`svc_${site.replace(/-/g, "")}_${Date.now()}`);
  const hist = adminDb().collection(`${space}/pricelistHistory`);
  return adminDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as Pkg) : null;
    if (id && !cur) return { status: 404, json: { error: "No such package." } };
    if (!cur && (!w.name || w.from === undefined)) return { status: 400, json: { error: "A new package needs a name and a price (from)." } };
    if (cur && (cur.version || 0) !== w.version) {
      return { status: 409, json: { error: "Changed since you read it.", current: toPublic(ref.id, cur, site), updatedFrom: cur.updatedFrom || "salespal", updatedAt: cur.updatedAt || 0 } };
    }
    const now = Date.now();
    const sp: SitePrice = cur?.sites?.[site] || { shown: true, linked: true, from: w.from ?? cur?.price ?? 0 };
    const next: SitePrice = {
      ...sp,
      ...(w.shown !== undefined ? { shown: w.shown } : {}),
      ...(w.order !== undefined ? { order: w.order } : {}),
      ...(w.name && cur && w.name !== cur.name ? { name: w.name } : {}),
    };
    const oldFrom = cur ? (sp.linked ? cur.price : sp.from) : null;
    const patch: Record<string, unknown> = { version: (cur?.version || 0) + 1, updatedAt: now, updatedFrom: site };
    let price = cur?.price ?? w.from ?? 0;
    if (w.from !== undefined) {
      if (next.linked) { price = w.from; patch.price = w.from; next.from = w.from; } else next.from = w.from;
    }
    if (!cur) Object.assign(patch, { name: w.name, price, unit: w.unit || "per project", category: "Other", description: (w.includes || []).join("\n") });
    else {
      if (w.unit !== undefined) patch.unit = w.unit;
      if (w.includes) patch.description = w.includes.join("\n");
    }
    if (w.excludes) patch.excludes = w.excludes.join("\n");
    patch.sites = { ...(cur?.sites || {}), [site]: next };
    tx.set(ref, patch, { merge: true });
    const newFrom = next.linked ? price : next.from;
    if (oldFrom !== newFrom) {
      const cost = cur?.cost;
      const belowTarget = typeof cost === "number" && price > 0 && ((price - cost) / price) * 100 < MARGIN_TARGET;
      tx.set(hist.doc(), {
        serviceId: ref.id, name: w.name || cur?.name || "", field: `site:${site}`, from: site, by: `admin ${site}`,
        old: oldFrom, new: newFrom, at: now, ...(belowTarget ? { belowTarget: true } : {}),
      });
    }
    const merged: Pkg = { ...(cur || { name: w.name || "", price }), ...(patch as Partial<Pkg>), sites: patch.sites as Pkg["sites"] };
    return { status: cur ? 200 : 201, json: { package: toPublic(ref.id, merged, site) } };
  });
}
