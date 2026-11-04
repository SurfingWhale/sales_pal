// Is this lead already here? (PRD-018 §2, PRD-022 Q12) By WhatsApp number,
// email, @handle, or the same name. The index is built once per list, so an
// import of thousands of rows checks each one in constant time. Pure.

export interface DupFields { name?: string; phone?: string; email?: string; contact?: string; notes?: string }
export type DupWhy = "no HP" | "email" | "@handle" | "nama";
export interface DupHit<T> { lead: T; why: DupWhy }

// 0812…, +62 812…, 62812… → 62812…; "" for anything too short to be a number.
export function phoneKey(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 9 ? d : "";
}

export const nameKey = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// @handles written in a contact or a note; an email's @domain is not one.
export const handlesIn = (s: string) =>
  Array.from((s || "").matchAll(/(^|[^\w.@])@([A-Za-z0-9._]{2,30})/g)).map(m => `@${m[2].replace(/\.+$/, "").toLowerCase()}`);

// Everything a row can be recognised by, surest first: a hit reports the best
// reason there is.
function keysOf(c: DupFields): [string, DupWhy][] {
  const keys: [string, DupWhy][] = [];
  const p = phoneKey(c.phone || ""); if (p) keys.push([`p:${p}`, "no HP"]);
  const e = (c.email || "").trim().toLowerCase(); if (e.includes("@")) keys.push([`e:${e}`, "email"]);
  for (const h of handlesIn(`${c.contact || ""} ${c.notes || ""}`)) keys.push([`h:${h}`, "@handle"]);
  const n = nameKey(c.name || ""); if (n.length >= 3) keys.push([`n:${n}`, "nama"]);
  return keys;
}

function remember<T extends DupFields>(by: Map<string, T>, row: T) {
  for (const [k] of keysOf(row)) if (!by.has(k)) by.set(k, row);
}

function firstHit<T>(by: Map<string, T>, c: DupFields): DupHit<T> | null {
  for (const [k, why] of keysOf(c)) {
    const lead = by.get(k);
    if (lead !== undefined) return { lead, why };
  }
  return null;
}

export function dupIndex<T extends DupFields>(leads: T[]): (c: DupFields) => DupHit<T> | null {
  const by = new Map<string, T>();
  for (const l of leads) remember(by, l);
  return c => firstHit(by, c);
}

// A row of a list coming in that shouldn't count twice: `of` is the lead it
// matches, or the earlier row of the same file when `inFile`.
export interface RowDupe { of: string; why: DupWhy; inFile: boolean }

// One answer per row, in order. A file can repeat itself as well as the list.
export function dupRows(rows: DupFields[], leads: DupFields[]): (RowDupe | null)[] {
  const listed = dupIndex(leads);
  const above = new Map<string, DupFields>();
  return rows.map(row => {
    const hit = listed(row);
    if (hit) return { of: hit.lead.name || "", why: hit.why, inFile: false };
    const repeat = firstHit(above, row);
    remember(above, row);
    return repeat ? { of: repeat.lead.name || "", why: repeat.why, inFile: true } : null;
  });
}
