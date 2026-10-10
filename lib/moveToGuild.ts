"use client";

// Bring your own (Pribadi) data into a guild, and back (docs/prd/PRD-007
// §2.7). Each row is copied to the guild under your name, its copy is kept in
// users/{uid}/moved so it can come back, and it leaves Pribadi — so there are
// never two copies drifting apart. Coming back takes the guild's latest
// version, team edits included.
//
// A client's chats, content and reports move after the client itself:
// firestore.rules lets you write under a guild client only once that client
// is yours there.

import { collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, query, setDoc, where, writeBatch, DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";

// noun: how a count of them reads ("3 lead"); clients count without their chats.
export const MOVE_GROUPS = [
  { id: "leads", label: "Leads (+ outreach, rejection)", noun: "lead & catatan", cols: ["leads", "outreach", "rejections"] },
  { id: "hunting", label: "Hunting (prospek, log DM, sesi)", noun: "data hunting", cols: ["prospects", "hunts", "huntSessions"] },
  { id: "jualan", label: "Penawaran & invoice", noun: "penawaran & invoice", cols: ["quotes", "invoices"] },
  { id: "klien", label: "Report Klien", noun: "klien", cols: ["clients"] },
] as const;
export type MoveGroup = (typeof MOVE_GROUPS)[number]["id"];
const CLIENT_SUBS = ["deals", "posts", "reports"];
// The team's catalogs: copied (never moved) by a Leader or Officer.
const CATALOGS = ["services", "pitchTemplates", "campaigns"];

const BATCH = 400;

async function commitAll(ops: ((b: ReturnType<typeof writeBatch>) => void)[], onStep?: (n: number) => void) {
  for (let i = 0; i < ops.length; i += BATCH) {
    const b = writeBatch(db);
    ops.slice(i, i + BATCH).forEach(op => op(b));
    await b.commit();
    onStep?.(Math.min(ops.length, i + BATCH));
  }
}

const archiveId = (g: string, path: string) => `${g}__${path.replace(/\//g, "__")}`.slice(0, 1400);

export async function countPersonal(uid: string): Promise<Record<MoveGroup, number>> {
  const n = async (c: string) => (await getCountFromServer(collection(db, "users", uid, c))).data().count;
  const out = {} as Record<MoveGroup, number>;
  for (const g of MOVE_GROUPS) out[g.id] = (await Promise.all(g.cols.map(n))).reduce((a, x) => a + x, 0);
  return out;
}

export async function countMoved(uid: string, g: string): Promise<number> {
  return (await getCountFromServer(query(collection(db, "users", uid, "moved"), where("guild", "==", g)))).data().count;
}

export async function moveToGuild(
  me: { uid: string; name: string }, g: string, groups: MoveGroup[], copyCatalogs: boolean,
  onStep?: (done: number) => void,
): Promise<number> {
  const at = Date.now();
  const owner = { ownerUid: me.uid, ownerName: me.name };
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  const later: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  const leave: DocumentReference[] = [];
  let rows = 0;
  const cols = MOVE_GROUPS.filter(x => groups.includes(x.id)).flatMap(x => x.cols as readonly string[]);

  for (const c of cols) {
    const snap = await getDocs(collection(db, "users", me.uid, c));
    for (const d of snap.docs) {
      const data = d.data();
      const path = `${c}/${d.id}`;
      rows++;
      ops.push(b => b.set(doc(db, "guilds", g, c, d.id), { ...data, ...owner }));
      ops.push(b => b.set(doc(db, "users", me.uid, "moved", archiveId(g, path)), { guild: g, path, data, at }));
      if (c !== "clients") { ops.push(b => b.delete(d.ref)); continue; }
      // A client's own rows go after the client exists in the guild.
      for (const sub of CLIENT_SUBS) {
        const subs = await getDocs(collection(db, "users", me.uid, "clients", d.id, sub));
        for (const s of subs.docs) {
          const sp = `${path}/${sub}/${s.id}`;
          rows++;
          later.push(b => b.set(doc(db, "guilds", g, "clients", d.id, sub, s.id), s.data()));
          later.push(b => b.set(doc(db, "users", me.uid, "moved", archiveId(g, sp)), { guild: g, path: sp, data: s.data(), at }));
          later.push(b => b.delete(s.ref));
        }
      }
      leave.push(d.ref);
    }
  }
  if (copyCatalogs) {
    for (const c of CATALOGS) {
      const snap = await getDocs(collection(db, "users", me.uid, c));
      for (const d of snap.docs) {
        const there = await getDoc(doc(db, "guilds", g, c, d.id)).catch(() => null);
        if (!there?.exists()) ops.push(b => b.set(doc(db, "guilds", g, c, d.id), d.data()));
      }
    }
    for (const s of ["business", "hunting"]) {
      const mine = await getDoc(doc(db, "users", me.uid, "settings", s));
      const theirs = await getDoc(doc(db, "guilds", g, "settings", s)).catch(() => null);
      if (mine.exists() && !theirs?.exists()) ops.push(b => b.set(doc(db, "guilds", g, "settings", s), mine.data()));
    }
  }

  const total = ops.length + later.length + leave.length;
  let done = 0;
  await commitAll(ops, n => onStep?.(Math.round(((done = n) / total) * 100)));
  await commitAll(later, n => onStep?.(Math.round(((done + n) / total) * 100)));
  await commitAll(leave.map(r => (b: ReturnType<typeof writeBatch>) => b.delete(r)));
  onStep?.(100);
  return rows;
}

// Everything moved into this guild comes back to Pribadi, as the guild has it now.
export async function restoreFromGuild(uid: string, g: string): Promise<number> {
  const moved = await getDocs(query(collection(db, "users", uid, "moved"), where("guild", "==", g)));
  const items = moved.docs.map(d => ({ ref: d.ref, ...(d.data() as { path: string; data: Record<string, unknown> }) }));
  // Deepest first in the guild (a client's rows before the client), shallowest first back home.
  const depth = (p: string) => p.split("/").length;
  for (const it of items.slice().sort((a, b) => depth(a.path) - depth(b.path))) {
    const there = await getDoc(doc(db, "guilds", g, ...it.path.split("/"))).catch(() => null);
    const latest = there?.exists() ? there.data() : it.data;
    const { ownerUid: _o, ownerName: _n, ...mine } = latest as Record<string, unknown>;
    void _o; void _n;
    await setDoc(doc(db, "users", uid, ...it.path.split("/")), mine);
  }
  for (const it of items.slice().sort((a, b) => depth(b.path) - depth(a.path))) {
    await deleteDoc(doc(db, "guilds", g, ...it.path.split("/"))).catch(() => undefined);
    await deleteDoc(it.ref);
  }
  return items.length;
}

// Which guild new data goes to: website leads included (users/{uid}/settings/workspace).
export async function setMainGuild(uid: string, g: string | null): Promise<void> {
  await setDoc(doc(db, "users", uid, "settings", "workspace"), { mainGuild: g }, { merge: true });
}
