// Finding the right leads fast (QA 15 Okt: "akses leads ga efisien, gaada data
// query"). One search across everything a lead holds, quick views for the
// questions a seller asks every day, and a sort. Pure; no Firestore.

import { addDays } from "@/lib/billing";

export interface QueryLead {
  id: string; name: string; contact: string; status: string; category: string; source: string;
  phone: string; email: string; notes: string; value: number; lastContact: string;
  nextAction?: string; nextActionDate?: string; lastReplyAt?: string;
  profile?: { need?: string; pain?: string; objection?: string; brief?: string };
}

export const VIEWS = [
  { id: "semua", label: "Semua" },
  { id: "hari-ini", label: "Follow-up hari ini" },
  { id: "telat", label: "Telat" },
  { id: "dibales", label: "Baru dibales" },
  { id: "lama", label: "7+ hari diam" },
  { id: "tanpa-nomor", label: "Belum ada nomor" },
] as const;
export type View = (typeof VIEWS)[number]["id"];

export const SORTS = [
  { id: "skor", label: "Skor tertinggi" },
  { id: "jadwal", label: "Follow-up terdekat" },
  { id: "nilai", label: "Nilai terbesar" },
  { id: "diam", label: "Paling lama diam" },
  { id: "nama", label: "Nama A–Z" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];

const open = (l: QueryLead) => l.status !== "Closed" && l.status !== "Lost";

export function inView(l: QueryLead, v: View, on: string): boolean {
  switch (v) {
    case "hari-ini": return open(l) && l.nextActionDate === on;
    case "telat": return open(l) && !!l.nextActionDate && l.nextActionDate < on;
    case "dibales": return !!l.lastReplyAt && l.lastReplyAt >= addDays(on, -3);
    case "lama": return open(l) && !!l.lastContact && l.lastContact <= addDays(on, -7);
    case "tanpa-nomor": return open(l) && (l.phone || "").replace(/\D/g, "").length < 8;
    default: return true;
  }
}

// Every word must match somewhere: name, contact, phone (digits too), category,
// source, notes, next step, and what the profile knows.
export function matches(l: QueryLead, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [l.name, l.contact, l.phone, (l.phone || "").replace(/\D/g, ""), l.email, l.category, l.source, l.status, l.notes,
    l.nextAction, l.profile?.need, l.profile?.pain, l.profile?.objection, l.profile?.brief].filter(Boolean).join(" ").toLowerCase();
  return words.every(w => hay.includes(w.replace(/^0/, "")) || hay.includes(w));
}

export function sortLeads<T extends QueryLead>(xs: T[], s: Sort, score: (l: T) => number): T[] {
  const by = (f: (l: T) => number | string) => [...xs].sort((a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; });
  switch (s) {
    case "jadwal": return by(l => l.nextActionDate || "9999");
    case "nilai": return by(l => -(l.value || 0));
    case "diam": return by(l => l.lastContact || "0000");
    case "nama": return by(l => l.name.toLowerCase());
    default: return by(l => -score(l));
  }
}

// Who to follow up now, oldest promise first.
export function followUpQueue<T extends QueryLead>(xs: T[], on: string): T[] {
  return xs.filter(l => open(l) && l.nextActionDate && l.nextActionDate <= on)
    .sort((a, b) => (a.nextActionDate || "").localeCompare(b.nextActionDate || ""));
}
