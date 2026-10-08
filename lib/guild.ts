// Guilds (docs/prd/PRD-007): a shared team space any signed-in user can found
// or join by invite link, with four roles. firestore.rules enforces who may do
// what; this module holds the shapes, the writes, and the team report math.
//
//   guilds/{g}                 { name, leaderUid, titles, createdAt }
//   guilds/{g}/members/{uid}   { uid, name, email, role, inviteCode?, joinedAt }
//   guilds/{g}/invites/{code}  { role, guildName, createdBy, createdAt, expiresAt }
//   guilds/{g}/deals/{id}      a Deal (lib/funnel.ts) + ownerUid, ownerName
//   guilds/{g}/targets/{m_uid} { uid, month, revenue, deals }
//   guilds/{g}/reports/{m}     a frozen team month
//   guilds/{g}/activities/{id} who did what, append-only
//   users/{uid}/guilds/{g}     { name, joinedAt } — the user's own list of guilds

import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Baseline, Deal, MonthNumbers, baseline, computeMonth } from "@/lib/funnel";

export type Role = "leader" | "officer" | "member" | "viewer";
export const ROLES: Role[] = ["leader", "officer", "member", "viewer"];
export const DEFAULT_TITLES: Record<Role, string> = { leader: "Leader", officer: "Officer", member: "Member", viewer: "Viewer" };
export const ROLE_HINT: Record<Role, string> = {
  leader: "Pemilik guild: atur nama, peran, undangan, dan serah-terima.",
  officer: "Ngurus tim: lihat semua deal, atur target, undang member & viewer.",
  member: "Jualan: kerjain dan lihat deal miliknya sendiri.",
  viewer: "Lihat report yang udah dibekukan dan daftar anggota. Cocok buat klien.",
};

export interface Guild { id: string; name: string; leaderUid: string; titles?: Partial<Record<Role, string>>; createdAt: number }
export interface Member { uid: string; name: string; email: string; role: Role; joinedAt: number; inviteCode?: string }
export interface Invite { id: string; role: Role; roleTitle?: string; guildName: string; createdBy: string; createdAt: number; expiresAt: number }
export interface Target { id: string; uid: string; month: string; revenue: number; deals: number }
export interface GuildRef { id: string; name: string; joinedAt: number }

export const titleOf = (g: Pick<Guild, "titles"> | null | undefined, r: Role) => g?.titles?.[r]?.trim() || DEFAULT_TITLES[r];
export const isManager = (r?: Role) => r === "leader" || r === "officer";
export const isSeller = (r?: Role) => r === "leader" || r === "officer" || r === "member";
// Roles a person may hand out by invite, matching firestore.rules.
export const invitable = (r?: Role): Role[] => (r === "leader" ? ["officer", "member", "viewer"] : r === "officer" ? ["member", "viewer"] : []);

export const INVITE_DAYS = 7;

function code(len = 20): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => abc[b % abc.length]).join("");
}

export function inviteLink(origin: string, g: string, c: string) {
  return `${origin}/join?g=${encodeURIComponent(g)}&c=${encodeURIComponent(c)}`;
}

export interface Person { uid: string; name: string; email: string }

export async function foundGuild(p: Person, name: string): Promise<string> {
  const g = `g_${code(12)}`;
  const now = Date.now();
  const b = writeBatch(db);
  b.set(doc(db, "guilds", g), { name: name.trim().slice(0, 80), leaderUid: p.uid, titles: {}, createdAt: now });
  b.set(doc(db, "guilds", g, "members", p.uid), { uid: p.uid, name: p.name, email: p.email, role: "leader", joinedAt: now });
  b.set(doc(db, "users", p.uid, "guilds", g), { name: name.trim().slice(0, 80), joinedAt: now });
  await b.commit();
  return g;
}

export async function createInvite(g: Guild, by: string, role: Role): Promise<string> {
  const c = code();
  const now = Date.now();
  await setDoc(doc(db, "guilds", g.id, "invites", c), {
    role, roleTitle: titleOf(g, role).slice(0, 30), guildName: g.name, createdBy: by, createdAt: now, expiresAt: now + INVITE_DAYS * 86400000,
  });
  return c;
}

export async function readInvite(g: string, c: string): Promise<Invite | null> {
  const snap = await getDoc(doc(db, "guilds", g, "invites", c));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invite) : null;
}

export async function isMemberOf(g: string, uid: string): Promise<boolean> {
  try { return (await getDoc(doc(db, "guilds", g, "members", uid))).exists(); }
  catch { return false; }
}

export async function joinGuild(p: Person, g: string, inv: Invite) {
  const now = Date.now();
  const b = writeBatch(db);
  b.set(doc(db, "guilds", g, "members", p.uid), { uid: p.uid, name: p.name, email: p.email, role: inv.role, inviteCode: inv.id, joinedAt: now });
  b.set(doc(db, "users", p.uid, "guilds", g), { name: inv.guildName, joinedAt: now });
  await b.commit();
}

export async function leaveGuild(g: string, uid: string) {
  const b = writeBatch(db);
  b.delete(doc(db, "guilds", g, "members", uid));
  b.delete(doc(db, "users", uid, "guilds", g));
  await b.commit();
}

export async function setRole(g: string, uid: string, role: Role) {
  await setDoc(doc(db, "guilds", g, "members", uid), { role }, { merge: true });
}

export async function removeMember(g: string, uid: string) {
  await deleteDoc(doc(db, "guilds", g, "members", uid));
}

// Hand the guild over: the new leader becomes leader, the old one an officer.
export async function transferLeadership(g: string, from: string, to: string) {
  const b = writeBatch(db);
  b.update(doc(db, "guilds", g), { leaderUid: to });
  b.update(doc(db, "guilds", g, "members", to), { role: "leader" });
  b.update(doc(db, "guilds", g, "members", from), { role: "officer" });
  await b.commit();
}

// ---------- the team report ----------

export interface SellerRow {
  uid: string;
  name: string;
  leads: number;
  quoted: number;
  paid: number;          // deals that became lunas this month (by paid date)
  revenue: number;
  targetRevenue: number;
  targetDeals: number;
}

export interface TeamMonth {
  month: string;
  total: MonthNumbers;
  base: Baseline;
  rows: SellerRow[];
}

export function teamMonth(month: string, deals: Deal[], members: Member[], targets: Target[], threshold = 5_000_000): TeamMonth {
  const total = computeMonth(month, deals, [], threshold);
  const base = baseline(month, deals, [], threshold);
  const sellers = members.filter(m => isSeller(m.role));
  // Anyone who owns deals shows up, even after leaving the guild.
  for (const d of deals) {
    if (d.ownerUid && !sellers.some(s => s.uid === d.ownerUid)) {
      sellers.push({ uid: d.ownerUid, name: `${d.ownerName || "?"} (keluar)`, email: "", role: "member", joinedAt: 0 });
    }
  }
  const rows = sellers.map(s => {
    const mine = deals.filter(d => d.ownerUid === s.uid);
    const m = computeMonth(month, mine, [], threshold);
    const t = targets.find(x => x.uid === s.uid && x.month === month);
    return {
      uid: s.uid, name: s.name, leads: m.leads, quoted: m.quoted, paid: m.paidCount, revenue: m.revenue,
      targetRevenue: t?.revenue || 0, targetDeals: t?.deals || 0,
    };
  }).sort((a, b) => b.revenue - a.revenue || b.paid - a.paid || b.leads - a.leads);
  return { month, total, base, rows };
}

// ---------- activity log ----------
// Append-only (firestore.rules): who did what, when. `about` is the member an
// entry concerns besides its author (a reassigned deal's new owner, a promoted
// member), so they see it too. Never blocks the action it records.

export type ActivityWhat =
  | "deal_created" | "deal_moved" | "deal_paid" | "deal_lost" | "deal_deleted" | "deal_reassigned"
  | "joined" | "left" | "role_changed" | "removed" | "invited" | "target_set" | "report_frozen" | "handover";

export interface Activity {
  id: string; who: string; whoName: string; what: ActivityWhat;
  ref?: string; refName?: string; detail?: string; about?: string; at: number;
}

export const ACTIVITY_TEXT: Record<ActivityWhat, string> = {
  deal_created: "nyatet chat", deal_moved: "geser deal", deal_paid: "closing lunas", deal_lost: "deal gugur",
  deal_deleted: "hapus deal", deal_reassigned: "pindah pemilik deal", joined: "gabung guild", left: "keluar dari guild",
  role_changed: "ganti peran", removed: "ngeluarin anggota", invited: "bikin undangan", target_set: "atur target",
  report_frozen: "bekukan report", handover: "serahin Leader",
};

export function logActivity(g: string, by: { uid: string; name: string }, what: ActivityWhat, f: { ref?: string; refName?: string; detail?: string; about?: string } = {}) {
  const entry = Object.fromEntries(Object.entries({ who: by.uid, whoName: by.name, what, ...f, at: Date.now() })
    .filter(([, v]) => v !== undefined && v !== ""));
  return addDoc(collection(db, "guilds", g, "activities"), entry).catch(() => { /* the action itself already happened */ });
}
