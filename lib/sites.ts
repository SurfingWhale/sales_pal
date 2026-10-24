// The studio's sites and what each shows of a package (PRD-017 §3a, §6;
// creative-hub standards/pricelist.md). Shared by the Paket screen and the
// pricelist routes, so no browser or server API here.

// Below this a margin is flagged (PRD-017 §3; the owner can change it later).
export const MARGIN_TARGET = 30;

// The sites that read the pricelist (creative-hub standards/pricelist.md).
export const SITES = [
  { id: "visufavor", name: "Visufavor" },
  { id: "untmd-sports", name: "UNTMD Sports" },
  { id: "beuntamed", name: "BeUntamed" },
] as const;
export type SiteId = (typeof SITES)[number]["id"];
export const isSiteId = (v: unknown): v is SiteId => SITES.some(x => x.id === v);

// A package's price on one site, shown as "mulai dari". Linked: always the
// SalesPal price. Unlinked: its own number.
export interface SitePrice {
  shown: boolean;
  linked: boolean;
  from: number;
  name?: string;          // a public name for that site, when it differs
  order?: number;
}

// What the site shows for this package right now.
export const sitePrice = (s: { price: number; sites?: Partial<Record<SiteId, SitePrice>> }, site: SiteId): number | null => {
  const p = s.sites?.[site];
  return p ? (p.linked ? s.price : p.from) : null;
};

// One change to a price, from SalesPal or a site's admin.
export interface PriceChange {
  id: string;
  serviceId: string;
  name: string;
  field: string;          // "price" (SalesPal) or "site:<id>"
  from: string;           // "salespal" or a site id
  by: string;
  old: number | null;
  new: number | null;
  belowTarget?: boolean;  // the change took the margin under MARGIN_TARGET
  at: number;
}

export const lines = (text?: string) => (text || "").split("\n").map(l => l.trim()).filter(Boolean);
