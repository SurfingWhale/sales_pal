// Is this lead already here? (PRD-018 §2) By WhatsApp number, email, @handle,
// or the same name. The index is built once per list, so an import of
// thousands of rows checks each one in constant time. Pure.

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

export const nameKey = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// @handles written in a contact or a note; an email's @domain is not one.
export const handlesIn = (s: string) =>
  Array.from((s || "").matchAll(/(^|[^\w.@])@([A-Za-z0-9._]{2,30})/g)).map(m => `@${m[2].replace(/\.+$/, "").toLowerCase()}`);

export function dupIndex<T extends DupFields>(leads: T[]): (c: DupFields) => DupHit<T> | null {
  const by = new Map<string, T>();
  const put = (k: string, l: T) => { if (!by.has(k)) by.set(k, l); };
  for (const l of leads) {
    const p = phoneKey(l.phone || ""); if (p) put(`p:${p}`, l);
    const e = (l.email || "").trim().toLowerCase(); if (e.includes("@")) put(`e:${e}`, l);
    for (const h of handlesIn(`${l.contact || ""} ${l.notes || ""}`)) put(`h:${h}`, l);
    const n = nameKey(l.name || ""); if (n.length >= 3) put(`n:${n}`, l);
  }
  return c => {
    const tries: [string, DupWhy][] = [
      [`p:${phoneKey(c.phone || "")}`, "no HP"],
      [`e:${(c.email || "").trim().toLowerCase()}`, "email"],
      ...handlesIn(`${c.contact || ""} ${c.notes || ""}`).map(h => [`h:${h}`, "@handle"] as [string, DupWhy]),
      [`n:${nameKey(c.name || "")}`, "nama"],
    ];
    for (const [k, why] of tries) {
      if (k.length > 2 && by.has(k)) return { lead: by.get(k) as T, why };
    }
    return null;
  };
}
