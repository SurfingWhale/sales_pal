// Who may use SalesPal while it's invite-only, and who may spend the paid
// Google key (docs/prd/PRD-015). Server only: the browser asks /api/access.
//
// - The owner: a verified address in OWNER_EMAILS (default: the one isOwner()
//   in firestore.rules names).
// - Anyone in a guild whose Leader is the owner. For a paid tool, only the
//   roles that Leader allowed in guilds/{g}/settings/tools.
// - Everyone signed in, while config/access.open is true (or ACCESS_OPEN=1
//   when that document doesn't exist). The flow tests run this way.
//
// Env:
//   OWNER_EMAILS            comma-separated; replaces the default
//   ACCESS_OPEN             "1" = open to every signed-in account
//   PLACES_MONTHLY_LIMIT    Cari bisnis calls a month for the whole app (default 900;
//                           Google's free Text Search Enterprise + Atmosphere is 1,000)
//   GEOCODE_MONTHLY_LIMIT   address lookups a month (default 4,500; Text Search Pro is 5,000 free)
//   SCAN_MONTHLY_LIMIT      AI image scans a month (default 300; x.ai has no free tier)

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, canStore, type Caller } from "@/lib/serverAuth";
import type { Role } from "@/lib/guild";
import { TOOL_LABEL, rolesFor, type PaidTool, type ToolRoles } from "@/lib/tools";

export type { PaidTool };

const MONTHLY: Record<PaidTool, number> = {
  places: parseInt(process.env.PLACES_MONTHLY_LIMIT || "", 10) || 900,
  geocode: parseInt(process.env.GEOCODE_MONTHLY_LIMIT || "", 10) || 4500,
  scan: parseInt(process.env.SCAN_MONTHLY_LIMIT || "", 10) || 300,
};

const owners = () => (process.env.OWNER_EMAILS || "fauzymuhamad43@gmail.com")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export const isOwner = (c: Caller) => Boolean(c.email && c.emailVerified && owners().includes(c.email.toLowerCase()));

// Open to every signed-in account: the server-only config/access document,
// else ACCESS_OPEN.
export async function isOpen(): Promise<boolean> {
  if (canStore()) {
    const doc = await adminDb().collection("config").doc("access").get().catch(() => null);
    if (doc?.exists) return doc.data()?.open === true;
  }
  return process.env.ACCESS_OPEN === "1";
}

// The guilds this person is in whose Leader is the owner, with their role
// there and what that guild allows for each tool.
interface OwnerGuild { id: string; role: Role; tools: ToolRoles }
async function ownerGuilds(uid: string, only?: string | null): Promise<OwnerGuild[]> {
  if (!canStore()) return [];
  const db = adminDb();
  const ids = only ? [only] : (await db.collection("users").doc(uid).collection("guilds").get()).docs.map(d => d.id);
  const out: OwnerGuild[] = [];
  for (const id of ids.slice(0, 10)) {
    const [g, m, t] = await Promise.all([
      db.collection("guilds").doc(id).get(),
      db.collection("guilds").doc(id).collection("members").doc(uid).get(),
      db.collection("guilds").doc(id).collection("settings").doc("tools").get(),
    ]);
    if (!g.exists || !m.exists) continue;
    const leaderUid = g.data()?.leaderUid as string | undefined;
    if (!leaderUid) continue;
    // The Leader's address from Auth, not from a document anyone in the guild can write.
    const leader = await adminAuth().getUser(leaderUid).catch(() => null);
    if (!leader?.email || !leader.emailVerified || !owners().includes(leader.email.toLowerCase())) continue;
    out.push({ id, role: m.data()?.role as Role, tools: (t.data() || {}) as OwnerGuild["tools"] });
  }
  return out;
}

// May this person open the app at all? Without stored credentials
// (FIREBASE_SERVICE_ACCOUNT unset) guilds can't be checked: rather than lock
// the owner's team out, let everyone in. The paid tools stay the owner's
// alone, since mayUse finds no guild either.
export async function mayEnter(c: Caller): Promise<boolean> {
  if (isOwner(c) || (await isOpen()) || !canStore()) return true;
  return (await ownerGuilds(c.uid)).length > 0;
}

// Whether the gate and the monthly caps really work here (they need the
// service account to read guilds and to count across server instances).
export const enforced = () => canStore();

// May this person spend the key on a tool? A guild id narrows it to that guild.
export async function mayUse(c: Caller, tool: PaidTool, guildId?: string | null): Promise<{ ok: true } | { ok: false; why: string }> {
  if (isOwner(c) || (await isOpen())) return { ok: true };
  const gs = await ownerGuilds(c.uid, guildId);
  if (gs.some(g => rolesFor(g.tools, tool).includes(g.role))) return { ok: true };
  return { ok: false, why: gs.length
    ? `${TOOL_LABEL[tool]} belum dibuka buat peran kamu. Minta Leader guild buka aksesnya di Guild → Atur guild.`
    : `${TOOL_LABEL[tool]} cuma buat tim yang diundang. Minta link undangan guild ke Leader kamu.` };
}

// ---- the whole app's monthly allowance --------------------------------------
// usage/global_{tool}_{YYYY-MM} (server only), so the key stays inside
// Google's free tier however many people use it.
const memory = new Map<string, number>();
const monthId = (tool: PaidTool) => `global_${tool}_${new Date().toISOString().slice(0, 7)}`;

export async function takeMonthly(tool: PaidTool): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = MONTHLY[tool];
  const id = monthId(tool);
  if (!canStore()) {
    const used = memory.get(id) || 0;
    if (used >= limit) return { ok: false, used, limit };
    memory.set(id, used + 1);
    return { ok: true, used: used + 1, limit };
  }
  const ref = adminDb().collection("usage").doc(id);
  return adminDb().runTransaction(async tx => {
    const used = ((await tx.get(ref)).data()?.count as number | undefined) || 0;
    if (used >= limit) return { ok: false, used, limit };
    tx.set(ref, { key: tool, month: id.slice(-7), count: FieldValue.increment(1), at: Date.now() }, { merge: true });
    return { ok: true, used: used + 1, limit };
  });
}

// Give one back when the call never reached Google (or Google refused it).
export async function giveBackMonthly(tool: PaidTool): Promise<void> {
  const id = monthId(tool);
  if (!canStore()) { memory.set(id, Math.max(0, (memory.get(id) || 0) - 1)); return; }
  await adminDb().collection("usage").doc(id).set({ count: FieldValue.increment(-1) }, { merge: true }).catch(() => undefined);
}

export async function monthlyLeft(tool: PaidTool): Promise<{ left: number; limit: number }> {
  const limit = MONTHLY[tool];
  const id = monthId(tool);
  const used = canStore()
    ? (((await adminDb().collection("usage").doc(id).get().catch(() => null))?.data()?.count as number | undefined) || 0)
    : memory.get(id) || 0;
  return { left: Math.max(0, limit - used), limit };
}
