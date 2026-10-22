"use client";

// Guild (docs/prd/PRD-007): the team space. Found one or join by invite link;
// leaders and officers run the team, members sell, viewers read the frozen
// reports. Every rule here is also enforced by firestore.rules.

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, deleteField, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { today } from "@/lib/billing";
import { Deal, delta, juta, monthName, monthOf, shiftMonth } from "@/lib/funnel";
import {
  ACTIVITY_TEXT, AVATARS, Activity, Guild, GuildRef, Invite, Member, ROLES, ROLE_HINT, Role, Target, createInvite, foundGuild, invitable, inviteLink,
  isManager, isSeller, leaveGuild, logActivity, removeMember, setRole, teamMonth, titleOf, transferLeadership,
} from "@/lib/guild";
import TeamReportSheet from "@/components/TeamReportSheet";
import MoveToGuild from "@/components/MoveToGuild";
import ConfirmSheet from "@/components/ConfirmSheet";
import { FormNote, useDiscard, useSave } from "@/components/FormGuard";
import { Pipeline } from "@/components/ClientHub";
import { logoImage } from "@/lib/image";
import { PAID_TOOLS, TOOL_HINT, TOOL_LABEL, rolesFor, type ToolRoles } from "@/lib/tools";
import { badge, btnGhost, btnMuted, btnPrimary, btnWA, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

type View = "pipeline" | "report" | "aktivitas" | "anggota";
const ROLE_COLOR: Record<Role, string> = { leader: "#b45309", officer: "#7c3aed", member: "#005eb0", viewer: "#64748b" };
// The owner's art (public/guild): a badge per role, and a character wearing it.
const BADGE = (r: Role) => `/guild/badge-${r}.png`;
const PERSON = (r: Role) => `/guild/char-${r}.png`;

function RoleBadge({ guild, role, size = 20 }: { guild: Guild | null; role: Role; size?: number }) {
  return (
    <span style={{ ...badge(ROLE_COLOR[role]), display: "inline-flex", alignItems: "center", gap: 4, paddingInlineStart: 4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BADGE(role)} alt="" width={size} height={size} style={{ display: "block" }} />
      {titleOf(guild, role)}
    </span>
  );
}

// The character they picked, or their role's.
const avatarSrc = (role: Role, pick?: string) =>
  pick && (AVATARS as readonly string[]).includes(pick)
    ? (["owl", "lion", "dolphin", "rabbit"].includes(pick) ? `/archetypes/animal-${pick}.png` : PERSON(pick as Role))
    : PERSON(role);

export function Avatar({ role, size, ring, pick }: { role: Role; size: number; ring?: boolean; pick?: string }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", display: "inline-flex", alignItems: "flex-end", justifyContent: "center",
      background: `color-mix(in srgb, ${ROLE_COLOR[role]} 18%, var(--app-card))`, border: ring ? "2px solid var(--app-card)" : `1px solid ${ROLE_COLOR[role]}40` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarSrc(role, pick)} alt="" width={size} height={size} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.12) translateY(6%)" }} />
    </span>
  );
}

const fmtN = (n: number) => Math.round(n).toLocaleString("id-ID");
const n0 = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

function remember(g: string) { try { localStorage.setItem("sp-guild", g); } catch { /* private mode */ } }
function recalled(): string { try { return localStorage.getItem("sp-guild") || ""; } catch { return ""; } }

interface FrozenTeam { month: string; rows: ReturnType<typeof teamMonth>["rows"]; revenue: number; paidCount: number; leads: number; frozenAt: number }

export default function GuildHub({ uid, name, email, onUseSpace }: { uid: string; name: string; email: string; onUseSpace?: (g: string) => void }) {
  const [refs, setRefs] = useState<GuildRef[] | null>(null);
  const [gid, setGid] = useState("");
  const [guild, setGuild] = useState<Guild | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [reports, setReports] = useState<FrozenTeam[]>([]);
  const [view, setView] = useState<View>("pipeline");
  const [founding, setFounding] = useState<string | null>(null);
  // Right after founding or joining, the server may refuse a listener for a
  // moment (the membership write is still landing). A refused listener stops,
  // so listen again a few times instead of staying on "Memuat…".
  const [retry, setRetry] = useState(0);
  const look = useGuildLook(gid);
  const [editing, setEditing] = useState(false);
  const refused = (e: { code?: string }) => {
    if (e.code === "permission-denied") setTimeout(() => setRetry(r => (r < 6 ? r + 1 : r)), 1200);
  };

  // My guilds; drop the ones I'm no longer a member of.
  useEffect(() => onSnapshot(collection(db, "users", uid, "guilds"), snap => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as GuildRef)).sort((a, b) => a.name.localeCompare(b.name));
    setRefs(rows);
    setGid(cur => cur && rows.some(r => r.id === cur) ? cur : (rows.find(r => r.id === recalled())?.id || rows[0]?.id || ""));
    // Only entries already saved on the server: a guild just founded or joined
    // isn't readable yet, and must not be mistaken for one we left.
    snap.docs.filter(d => !d.metadata.hasPendingWrites && Date.now() - ((d.data().joinedAt as number) || 0) > 60000).forEach(d =>
      getDoc(doc(db, "guilds", d.id, "members", uid))
        .then(m => { if (!m.exists()) deleteDoc(d.ref); })
        .catch(e => { if ((e as { code?: string }).code === "permission-denied") deleteDoc(d.ref).catch(() => {}); }));
  }), [uid]);

  useEffect(() => {
    setGuild(null); setMe(null); setMembers([]);
    if (!gid) return;
    const u1 = onSnapshot(doc(db, "guilds", gid), s => setGuild(s.exists() ? ({ id: s.id, ...s.data() } as Guild) : null), refused);
    const u2 = onSnapshot(doc(db, "guilds", gid, "members", uid), s => setMe(s.exists() ? (s.data() as Member) : null), refused);
    const u3 = onSnapshot(collection(db, "guilds", gid, "members"), s => setMembers(s.docs.map(d => d.data() as Member)), refused);
    const u4 = onSnapshot(collection(db, "guilds", gid, "targets"), s => setTargets(s.docs.map(d => ({ id: d.id, ...d.data() } as Target))), refused);
    const u5 = onSnapshot(collection(db, "guilds", gid, "reports"), s => setReports(s.docs.map(d => d.data() as FrozenTeam)), refused);
    return () => { u1(); u2(); u3(); u4(); u5(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, uid, retry]);

  const role = me?.role;
  useEffect(() => {
    setDeals([]); setInvites([]);
    if (!gid || !role) return;
    const col = collection(db, "guilds", gid, "deals");
    const unsubs: (() => void)[] = [];
    if (isManager(role)) {
      unsubs.push(onSnapshot(col, s => setDeals(s.docs.map(d => ({ id: d.id, ...d.data() } as Deal))), refused));
      unsubs.push(onSnapshot(collection(db, "guilds", gid, "invites"), s => setInvites(s.docs.map(d => ({ id: d.id, ...d.data() } as Invite))), refused));
    } else if (isSeller(role)) {
      unsubs.push(onSnapshot(query(col, where("ownerUid", "==", uid)), s => setDeals(s.docs.map(d => ({ id: d.id, ...d.data() } as Deal))), refused));
    }
    return () => unsubs.forEach(u => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, role, uid, retry]);

  useEffect(() => { if (role === "viewer" && view === "pipeline") setView("report"); }, [role, view]);

  const foundSave = useSave();
  const [closeFound, foundAsk] = useDiscard(!!founding?.trim(), () => setFounding(null), "Nama guild");
  async function found() {
    if (!founding?.trim()) return;
    const n = founding;
    await foundSave.run(async () => {
      const g = await foundGuild({ uid, name, email }, n);
      remember(g); setGid(g); setFounding(null); setView("anggota");
    });
  }

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={heading}>Guild</div>
        <div style={subheading}>Ruang tim: pipeline bersama, peran, target, dan report sales per orang.</div>
      </div>
      {refs && refs.length > 0 && <button onClick={() => { foundSave.reset(); setFounding(""); }} style={btnGhost}>+ Guild baru</button>}
    </div>
  );

  const foundModal = founding !== null && (
    <div className="modal-overlay" onClick={() => { if (!foundSave.busy) closeFound(); }}>
      <form onSubmit={e => { e.preventDefault(); found(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Bikin guild</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Kamu jadi Leader. Anggota diundang lewat link.</div>
        <label htmlFor="gd-name" style={label}>Nama guild</label>
        <input id="gd-name" value={founding} onChange={e => setFounding(e.target.value)} placeholder="mis. Tim Contoh" maxLength={80} style={inputStyle} />
        <FormNote why={founding.trim() ? "" : "Isi nama guild dulu."} err={foundSave.err} />
        <div className="sp-form-foot">
          <button type="button" onClick={closeFound} disabled={foundSave.busy} style={btnMuted}>Batal</button>
          <button type="submit" disabled={!founding.trim() || foundSave.busy} style={{ ...btnPrimary, opacity: founding.trim() && !foundSave.busy ? 1 : 0.5 }}>{foundSave.busy ? "Membuat…" : "Bikin guild"}</button>
        </div>
      </form>
      {foundAsk}
    </div>
  );

  if (refs === null) return <div style={{ color: "var(--app-muted)", fontSize: 13 }}>Memuat guild…</div>;

  if (!refs.length) {
    return (
      <div className="sp-team" style={{ paddingBottom: 72 }}>
        {header}
        <div style={{ ...card, padding: "36px 22px", textAlign: "center", maxWidth: 720, marginInline: "auto" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BADGE("leader")} alt="" width={88} height={88} style={{ display: "block", margin: "0 auto 10px" }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ikut guild mana pun</div>
          <div style={{ fontSize: 12.5, color: "var(--app-muted)", marginBottom: 18, maxWidth: 440, marginInline: "auto", lineHeight: 1.6 }}>
            Bikin guild buat tim kamu (atau tim sales klien), terus undang orangnya lewat link. Leader & Officer lihat semua deal dan report tiap orang; Member kerjain deal-nya sendiri; Viewer cuma lihat report.
          </div>
          <button onClick={() => { foundSave.reset(); setFounding(""); }} style={btnPrimary}>+ Bikin guild</button>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 14 }}>Diundang orang? Buka link undangannya di HP ini.</div>
        </div>
        {foundModal}
      </div>
    );
  }

  return (
    <div className="sp-team" style={{ paddingBottom: 72 }}>
      {header}
      {refs.length > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <label htmlFor="guild-pick" style={{ position: "absolute", left: -9999 }}>Pilih guild</label>
          <select id="guild-pick" value={gid} onChange={e => { setGid(e.target.value); remember(e.target.value); }} style={{ ...inputStyle, width: "auto", minWidth: 160, fontWeight: 700 }}>
            {refs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}
      {guild && me && <GuildBanner guild={guild} me={me} members={members} deals={deals} targets={targets} look={look} onEdit={isManager(me.role) ? () => setEditing(true) : undefined} />}
      {guild && me && editing && <GuildSettings gid={gid} guild={guild} me={me} uid={uid} look={look} onClose={() => setEditing(false)} />}
      {guild && me && isSeller(me.role) && <MoveToGuild me={{ uid, name: me.name }} guild={{ id: guild.id, name: guild.name }} role={me.role} onUseGuild={() => onUseSpace?.(guild.id)} />}

      {!guild || !me ? (
        <div style={{ ...card, padding: 24, fontSize: 12.5, color: "var(--app-muted)", textAlign: "center" }}>Memuat…</div>
      ) : (
        <>
          <div role="tablist" aria-label="Bagian guild" className="sp-tabs sp-guild-tabs" style={{ display: "flex", gap: 4, background: "var(--app-inner)", padding: 4, borderRadius: 10, marginBottom: 18 }}>
            {([["pipeline", "Pipeline"], ["report", "Report Tim"], ["aktivitas", "Aktivitas"], ["anggota", `Anggota · ${members.length}`]] as const)
              .filter(([v]) => (v !== "pipeline" && v !== "aktivitas") || isSeller(role))
              .map(([v, l]) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: font,
                    background: view === v ? "var(--app-card)" : "transparent", color: view === v ? "#005eb0" : "var(--app-muted)",
                    boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {l}
                </button>
              ))}
          </div>
          {view === "pipeline" && isSeller(role) && (
            <>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>
                {isManager(role) ? "Semua deal tim. Deal baru tercatat atas nama kamu." : "Deal milik kamu. Leader & Officer bisa lihat semuanya."}
              </div>
              <Pipeline path={["guilds", gid, "deals"]} deals={deals} extra={{ ownerUid: uid, ownerName: me.name }} showOwner={isManager(role)}
                owners={isManager(role) ? members.filter(m => isSeller(m.role)).map(m => ({ uid: m.uid, name: m.name })) : undefined}
                onEvent={e => logActivity(gid, { uid, name: me.name }, e.what, { ref: e.ref, refName: e.refName, detail: e.detail, about: e.about })} />
            </>
          )}
          {view === "report" && <TeamReport gid={gid} guild={guild} me={me} members={members} deals={deals} targets={targets} reports={reports} />}
          {view === "aktivitas" && isSeller(role) && <Activities gid={gid} me={me} />}
          {view === "anggota" && <Members gid={gid} guild={guild} me={me} members={members} invites={invites} uid={uid} onSettings={() => setEditing(true)} />}
        </>
      )}
      {foundModal}
    </div>
  );
}

// ======================= Banner =======================
// The guild at a glance, like a guild card in a game (PRD-007): its crest,
// its people by role, its level from deals closed, and this month against
// the target. A Viewer sees no deals, so no level or month for them.

const CREST = ["#005eb0", "#b45309", "#7c3aed", "#0f766e", "#be123c", "#4d7c0f", "#334155", "#c2410c"];
// A symbol in place of the initials, picked in Atur guild.
const EMBLEMS = ["⚔️", "🦁", "🦅", "🐺", "🐉", "🔥", "⭐", "🌊", "⚡", "👑"];
// Deals lunas, all time, to reach each level.
const LEVELS = [0, 3, 10, 25, 50, 100, 200, 400];

// guilds/{g}/settings/look: the crest's colour, symbol or uploaded logo. A
// shared catalog doc, so Leader and Officer change it and sellers read it
// (firestore.rules); a Viewer sees the default crest.
export interface GuildLook { color?: string; emblem?: string; logo?: string }

function useGuildLook(gid: string): GuildLook {
  const [look, setLook] = useState<GuildLook>({});
  // Right after founding or joining, the server may refuse this read for a
  // moment (the membership write is still landing); a refused listener stops,
  // so listen again a few times rather than keep the default crest for good.
  const [retry, setRetry] = useState(0);
  useEffect(() => { setLook({}); setRetry(0); }, [gid]);
  useEffect(() => {
    if (!gid) return;
    return onSnapshot(doc(db, "guilds", gid, "settings", "look"), s => setLook((s.data() as GuildLook) || {}),
      e => { if ((e as { code?: string }).code === "permission-denied") setTimeout(() => setRetry(r => (r < 6 ? r + 1 : r)), 1200); });
  }, [gid, retry]);
  return look;
}

function crestColor(name: string, look?: GuildLook): string {
  if (look?.color && CREST.includes(look.color)) return look.color;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CREST[h % 6];
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "G";

function Crest({ name, look, size = 64 }: { name: string; look?: GuildLook; size?: number }) {
  const c = crestColor(name, look);
  if (look?.logo) {
    return (
      <span role="img" aria-label={`Logo ${name}`} style={{ width: size, height: size, flexShrink: 0, borderRadius: size * 0.28, overflow: "hidden", background: "#fff", boxShadow: `0 0 0 2px ${c}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={look.logo} alt="" style={{ width: "86%", height: "86%", objectFit: "contain" }} />
      </span>
    );
  }
  const sym = look?.emblem && EMBLEMS.includes(look.emblem) ? look.emblem : "";
  return (
    <svg width={size} height={size * 1.125} viewBox="0 0 64 72" role="img" aria-label={`Lambang ${name}`} style={{ flexShrink: 0 }}>
      <path d="M32 3 L58 12 V34 C58 52 46 63 32 69 C18 63 6 52 6 34 V12 Z" fill={c} fillOpacity="0.14" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 11 L50 17.5 V34 C50 47 42 55.5 32 60.5 C22 55.5 14 47 14 34 V17.5 Z" fill="none" stroke={c} strokeOpacity="0.45" strokeWidth="1.5" strokeLinejoin="round" />
      {sym
        ? <text x="32" y="44" textAnchor="middle" fontSize="24">{sym}</text>
        : <text x="32" y="42" textAnchor="middle" fontSize="19" fontWeight="800" fill={c} fontFamily="'Plus Jakarta Sans', sans-serif">{initials(name)}</text>}
    </svg>
  );
}

function GuildBanner({ guild, me, members, deals, targets, look, onEdit }: { guild: Guild; me: Member; members: Member[]; deals: Deal[]; targets: Target[]; look: GuildLook; onEdit?: () => void }) {
  const month = monthOf(today());
  const tm = useMemo(() => teamMonth(month, deals, members, targets), [month, deals, members, targets]);
  const sees = isSeller(me.role);
  const team = isManager(me.role);
  const rows = team ? tm.rows : tm.rows.filter(r => r.uid === me.uid);
  const target = rows.reduce((a, r) => a + r.targetRevenue, 0);
  const done = team ? tm.total.revenue : rows.reduce((a, r) => a + r.revenue, 0);
  const lunas = deals.filter(d => d.paidAt).length;
  const lv = LEVELS.filter(x => lunas >= x).length;
  const next = LEVELS[lv];
  const prev = LEVELS[lv - 1];
  const order: Role[] = ["leader", "officer", "member", "viewer"];
  const people = members.slice().sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  const shown = people.slice(0, 6);
  const c = crestColor(guild.name, look);
  const monthPct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const levelPct = next ? Math.round(((lunas - prev) / (next - prev)) * 100) : 100;
  // One small block per number: a label, the value, a thin bar.
  const meter = (labelText: string, value: string, pctv: number, aria: string, color: string) => (
    <div style={{ minWidth: 0, padding: "10px 12px", borderRadius: 12, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>
      <div style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{labelText}</div>
      <div className="tabnum" style={{ fontSize: 14, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div role="progressbar" aria-label={aria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctv} style={{ height: 4, borderRadius: 2, background: "var(--app-inner)", overflow: "hidden", marginTop: 8 }}>
        <div style={{ width: `${pctv}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
  return (
    <section aria-label={`Guild ${guild.name}`} style={{ ...card, padding: 16, marginBottom: 16, background: `linear-gradient(135deg, ${c}1f, var(--app-card) 60%)`, border: `1px solid ${c}40` }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Crest name={guild.name} look={look} size={56} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: font, lineHeight: 1.25, overflowWrap: "anywhere" }}>{guild.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <RoleBadge guild={guild} role={me.role} />
            <span style={{ fontSize: 12, color: "var(--app-muted)" }}>{members.length} anggota{sees ? ` · Level ${lv}` : ""}</span>
          </div>
          <div role="group" aria-label={`Anggota: ${people.map(m => `${m.name} (${titleOf(guild, m.role)})`).join(", ")}`} style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
            {shown.map((m, i) => (
              <span key={m.uid} title={`${m.name} · ${titleOf(guild, m.role)}`} style={{ marginInlineStart: i ? -8 : 0, display: "inline-flex" }}>
                <Avatar role={m.role} pick={m.avatar} size={32} ring />
              </span>
            ))}
            {people.length > shown.length && <span style={{ fontSize: 12, color: "var(--app-muted)", marginInlineStart: 8 }}>+{people.length - shown.length}</span>}
          </div>
        </div>
        {onEdit && <button onClick={onEdit} aria-label="Atur lambang & nama guild" title="Atur guild" className="sp-icon-btn" style={{ ...chip, flexShrink: 0, minWidth: 44, minHeight: 44, padding: 0, fontSize: 16, alignSelf: "flex-start" }}>✎</button>}
      </div>
      {sees && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          {meter(`${monthName(month)}${team ? "" : " · kamu"}`, target ? `${juta(done)} / ${juta(target)}` : `${juta(done)} lunas`, monthPct, "Omzet lunas bulan ini dibanding target", c)}
          {meter(`Level ${lv}`, next ? `${lunas}/${next} deal lunas` : "Level tertinggi", levelPct, "Menuju level berikutnya", "#00a862")}
        </div>
      )}
    </section>
  );
}

// ======================= Karakter =======================
// Each member picks their own character (QA 15 Okt: "kok gabisa milih"): the
// four people from the owner's art or the four customer-type animals. Saved on
// their own member doc; firestore.rules allows only this set.

const AVATAR_LABEL: Record<string, string> = { leader: "Bos bermahkota", officer: "Supervisor", member: "Sales", viewer: "Pengamat", owl: "Burung Hantu", lion: "Singa", dolphin: "Lumba-lumba", rabbit: "Kelinci" };

function AvatarSheet({ gid, me, onClose }: { gid: string; me: Member; onClose: () => void }) {
  const [pick, setPick] = useState<string>(me.avatar || "");
  const save = useSave();
  async function submit() {
    const ok = await save.run(() => updateDoc(doc(db, "guilds", gid, "members", me.uid), { avatar: pick || deleteField() }));
    if (ok) onClose();
  }
  const option = (id: string, l: string) => (
    <button key={id || "role"} type="button" role="radio" aria-checked={pick === id} onClick={() => setPick(id)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, minHeight: 44, borderRadius: 14, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
        background: pick === id ? `color-mix(in srgb, ${ROLE_COLOR[me.role]} 10%, var(--app-card))` : "var(--app-card)",
        border: `${pick === id ? 2 : 1}px solid ${pick === id ? ROLE_COLOR[me.role] : "var(--app-border)"}` }}>
      <Avatar role={me.role} pick={id || undefined} size={64} />
      <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>{l}</span>
    </button>
  );
  return (
    <div className="modal-overlay" onClick={() => { if (!save.busy) onClose(); }}>
      <form noValidate aria-labelledby="av-h" onSubmit={e => { e.preventDefault(); submit(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
        <div id="av-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Karakter kamu</div>
        <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 16 }}>Keliatan di banner dan daftar anggota. Peran kamu tetap {titleOf(null, me.role)}.</div>
        <div role="radiogroup" aria-label="Pilih karakter" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {option("", "Sesuai peran")}
          {AVATARS.filter(a => a !== me.role).map(a => option(a, AVATAR_LABEL[a]))}
        </div>
        <FormNote err={save.err} />
        <div className="sp-form-foot">
          <button type="button" onClick={onClose} disabled={save.busy} style={btnMuted}>Batal</button>
          <button type="submit" disabled={save.busy} style={{ ...btnPrimary, opacity: save.busy ? 0.6 : 1 }}>{save.busy ? "Menyimpan…" : "Simpan karakter"}</button>
        </div>
      </form>
    </div>
  );
}

// ======================= Atur guild =======================
// One sheet for how the guild looks and what it's called (QA 15 Okt: "edit
// guild logo jelek banget"): the crest first, with a live preview — colour,
// a symbol or an uploaded PNG logo — then the name, then the role names
// folded away. Leader and Officer change the look; only the Leader renames.

function GuildSettings({ gid, guild, me, uid, look, onClose }: { gid: string; guild: Guild; me: Member; uid: string; look: GuildLook; onClose: () => void }) {
  const leader = me.role === "leader";
  const first = useMemo(() => ({
    name: guild.name, titles: Object.fromEntries(ROLES.map(r => [r, guild.titles?.[r] || ""])) as Record<Role, string>,
    color: crestColor(guild.name, look), emblem: look.emblem || "", logo: look.logo || "",
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(first);
  const [msg, setMsg] = useState("");
  // Which roles may spend the paid Google tools (PRD-015), Leader only.
  const [toolsFirst, setToolsFirst] = useState<ToolRoles | null>(null);
  const [tools, setTools] = useState<ToolRoles>({});
  useEffect(() => {
    if (!leader) return;
    getDoc(doc(db, "guilds", gid, "settings", "tools")).then(s => {
      const t = (s.data() || {}) as ToolRoles;
      const full = Object.fromEntries(PAID_TOOLS.map(k => [k, rolesFor(t, k)])) as ToolRoles;
      setToolsFirst(full); setTools(full);
    }, () => setToolsFirst({}));
  }, [gid, leader]);
  const toolsChanged = Boolean(toolsFirst) && JSON.stringify(tools) !== JSON.stringify(toolsFirst);
  const save = useSave();
  const [close, ask] = useDiscard(JSON.stringify(f) !== JSON.stringify(first) || toolsChanged, onClose, "Perubahan guild");
  const preview: GuildLook = { color: f.color, emblem: f.emblem, logo: f.logo };

  async function pick(file?: File) {
    setMsg("");
    if (!file) return;
    try { setF(x => ({ ...x, logo: "" })); const logo = await logoImage(file, 256); setF(x => ({ ...x, logo })); }
    catch (e) { setMsg((e as Error).message); }
  }
  async function submit() {
    if (!f.name.trim()) return;
    const ok = await save.run(async () => {
      await setDoc(doc(db, "guilds", gid, "settings", "look"), { color: f.color, emblem: f.emblem, logo: f.logo });
      if (leader) {
        const titles = Object.fromEntries(ROLES.map(r => [r, f.titles[r].trim()]).filter(([, t]) => t));
        await updateDoc(doc(db, "guilds", gid), { name: f.name.trim().slice(0, 80), titles });
        await setDoc(doc(db, "users", uid, "guilds", gid), { name: f.name.trim().slice(0, 80) }, { merge: true });
        if (toolsChanged) await setDoc(doc(db, "guilds", gid, "settings", "tools"), tools);
      }
    });
    if (ok) onClose();
  }
  const section: React.CSSProperties = { marginBottom: 24 };
  const h: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 10 };
  const swatch = (on: boolean): React.CSSProperties => ({ width: 44, height: 44, borderRadius: "50%", cursor: "pointer", border: on ? "3px solid var(--app-text)" : "3px solid transparent", padding: 0 });

  return (
    <div className="modal-overlay" onClick={() => { if (!save.busy) close(); }}>
      <form noValidate aria-labelledby="gs-h" onSubmit={e => { e.preventDefault(); submit(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
        <div id="gs-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Atur guild</div>

        <section aria-label="Lambang" style={section}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, background: `linear-gradient(135deg, ${f.color}1f, var(--app-inner) 70%)`, marginBottom: 14 }}>
            <Crest name={f.name || guild.name} look={preview} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, overflowWrap: "anywhere" }}>{f.name || guild.name}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>Pratinjau lambang</div>
            </div>
          </div>

          <div style={h}>Logo</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <label className="sp-tap" style={{ ...btnGhost, display: "inline-flex", alignItems: "center", minHeight: 44, cursor: "pointer" }}>
              {f.logo ? "Ganti logo PNG" : "Upload logo PNG"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="vh" onChange={e => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
            </label>
            {f.logo && <button type="button" onClick={() => setF({ ...f, logo: "" })} style={{ ...btnMuted, minHeight: 44 }}>Hapus logo</button>}
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>{f.logo ? "Logo dipakai di banner guild. Warna di bawah jadi bingkainya." : "Ga ada logo? Pakai perisai: pilih warna dan simbolnya."}</div>
          {msg && <div role="alert" style={{ fontSize: 13, color: "var(--hot)", marginBottom: 12 }}>{msg}</div>}

          <div style={h}>Warna</div>
          <div role="radiogroup" aria-label="Warna lambang" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {CREST.map(c => (
              <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={`Warna ${c}`} onClick={() => setF({ ...f, color: c })}
                style={{ ...swatch(f.color === c), background: c, boxShadow: "inset 0 0 0 2px var(--app-card)" }} />
            ))}
          </div>

          {!f.logo && (
            <>
              <div style={h}>Simbol</div>
              <div role="radiogroup" aria-label="Simbol lambang" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["", ...EMBLEMS].map(e => (
                  <button key={e || "init"} type="button" role="radio" aria-checked={f.emblem === e} aria-label={e ? `Simbol ${e}` : "Inisial nama"} onClick={() => setF({ ...f, emblem: e })}
                    style={{ ...chip, minWidth: 48, minHeight: 48, fontSize: e ? 22 : 14, fontWeight: 800, color: f.color, ...(f.emblem === e ? { border: `2px solid ${f.color}`, background: `${f.color}14` } : {}) }}>
                    {e || initials(f.name || guild.name)}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {leader ? (
          <>
            <section aria-label="Nama" style={section}>
              <label htmlFor="gs-name" style={label}>Nama guild</label>
              <input id="gs-name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={80} style={inputStyle} />
            </section>
            <details style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, minHeight: 44, display: "flex", alignItems: "center" }}>Nama peran (opsional)</summary>
              <div style={{ fontSize: 12, color: "var(--app-muted)", margin: "4px 0 12px" }}>Ganti sesuai istilah tim, mis. Officer jadi Supervisor. Hak aksesnya tetap.</div>
              {ROLES.map(r => (
                <div key={r} style={{ marginBottom: 12 }}>
                  <label htmlFor={`gs-${r}`} style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BADGE(r)} alt="" width={22} height={22} />{titleOf(null, r)}
                  </label>
                  <input id={`gs-${r}`} value={f.titles[r]} onChange={e => setF({ ...f, titles: { ...f.titles, [r]: e.target.value } })} placeholder={titleOf(null, r)} maxLength={30} style={inputStyle} />
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 4 }}>{ROLE_HINT[r]}</div>
                </div>
              ))}
            </details>
            <section aria-labelledby="gs-tools-h" style={{ ...section, marginTop: 16 }}>
              <div id="gs-tools-h" style={h}>Akses alat berbayar</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", margin: "-4px 0 12px", lineHeight: 1.5 }}>
                Dua alat ini pakai key Google kamu. Pilih peran yang boleh. Leader selalu boleh.
              </div>
              {!toolsFirst ? <div role="status" style={{ fontSize: 13, color: "var(--app-muted)" }}>Memuat…</div> : PAID_TOOLS.map(k => (
                <fieldset key={k} style={{ border: "1px solid var(--app-border)", borderRadius: 12, padding: "10px 12px", margin: "0 0 10px" }}>
                  <legend style={{ fontSize: 14, fontWeight: 700, padding: "0 4px" }}>{TOOL_LABEL[k]}</legend>
                  <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6, lineHeight: 1.5 }}>{TOOL_HINT[k]}</div>
                  {(["officer", "member"] as Role[]).map(r => {
                    const on = (tools[k] || []).includes(r);
                    return (
                      <label key={r} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
                        <input type="checkbox" checked={on} aria-label={`${TOOL_LABEL[k]} buat ${titleOf(guild, r)}`}
                          onChange={() => setTools({ ...tools, [k]: on ? (tools[k] || []).filter(x => x !== r) : [...(tools[k] || []), r] })}
                          style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
                        {titleOf(guild, r)}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </section>
          </>
        ) : <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Nama guild & nama peran diatur Leader.</div>}

        <FormNote why={f.name.trim() ? "" : "Nama guild ga boleh kosong."} err={save.err} />
        <div className="sp-form-foot">
          <button type="button" onClick={close} disabled={save.busy} style={btnMuted}>Batal</button>
          <button type="submit" disabled={!f.name.trim() || save.busy} style={{ ...btnPrimary, opacity: f.name.trim() && !save.busy ? 1 : 0.5 }}>{save.busy ? "Menyimpan…" : "Simpan"}</button>
        </div>
      </form>
      {ask}
    </div>
  );
}

// ======================= Report Tim =======================

function TeamReport({ gid, guild, me, members, deals, targets, reports }: { gid: string; guild: Guild; me: Member; members: Member[]; deals: Deal[]; targets: Target[]; reports: FrozenTeam[] }) {
  const now = monthOf(today());
  const [month, setMonth] = useState(new Date().getDate() <= 7 ? shiftMonth(now, -1) : now);
  const [editing, setEditing] = useState<{ uid: string; name: string; revenue: string; deals: string } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [reopen, setReopen] = useState(false);
  const targetSave = useSave();
  const startTarget = useMemo(() => editing ? `${editing.revenue}|${editing.deals}` : "", [editing?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [closeTarget, targetAsk] = useDiscard(!!editing && `${editing.revenue}|${editing.deals}` !== startTarget, () => setEditing(null), "Target ini");
  const manager = isManager(me.role);
  const live = useMemo(() => teamMonth(month, deals, members, targets), [month, deals, members, targets]);
  const frozen = reports.find(r => r.month === month);
  const months = Array.from({ length: 13 }, (_, i) => shiftMonth(now, -i));

  const rows = frozen ? frozen.rows : manager ? live.rows : live.rows.filter(r => r.uid === me.uid);
  const revenue = frozen ? frozen.revenue : live.total.revenue;
  const paidCount = frozen ? frozen.paidCount : live.total.paidCount;
  const leads = frozen ? frozen.leads : live.total.leads;

  async function saveTarget() {
    if (!editing) return;
    const e = editing;
    const ok = await targetSave.run(() => setDoc(doc(db, "guilds", gid, "targets", `${month}_${e.uid}`), { uid: e.uid, month, revenue: n0(e.revenue), deals: n0(e.deals) }));
    if (!ok) return;
    logActivity(gid, { uid: me.uid, name: me.name }, "target_set", { refName: e.name, about: e.uid, detail: `${monthName(month)}: ${juta(n0(e.revenue))}${n0(e.deals) ? ` · ${n0(e.deals)} deal` : ""}` });
    setEditing(null);
  }
  async function freeze() {
    await setDoc(doc(db, "guilds", gid, "reports", month), JSON.parse(JSON.stringify({
      month, rows: live.rows, revenue: live.total.revenue, paidCount: live.total.paidCount, leads: live.total.leads, frozenAt: Date.now(),
    })));
    logActivity(gid, { uid: me.uid, name: me.name }, "report_frozen", { detail: monthName(month) });
  }
  async function unfreeze() {
    await deleteDoc(doc(db, "guilds", gid, "reports", month));
  }
  const share = [
    `Report ${guild.name} · ${monthName(month)}`,
    `Omzet lunas: ${juta(revenue)} (${paidCount} deal) · Chat masuk: ${leads}`,
    "",
    ...rows.map((r, i) => `${i + 1}. ${r.name}: ${juta(r.revenue)} · ${r.paid} lunas · ${r.leads} chat${r.targetRevenue ? ` · ${Math.round((r.revenue / r.targetRevenue) * 100)}% target` : ""}`),
  ].join("\n");

  const showLive = !frozen && me.role !== "viewer";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label htmlFor="tr-month" style={{ position: "absolute", left: -9999 }}>Bulan</label>
        <select id="tr-month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: "auto", fontWeight: 700 }}>
          {months.map(m => <option key={m} value={m}>{monthName(m)}{reports.some(r => r.month === m) ? " · beku" : ""}</option>)}
        </select>
        <span style={badge(frozen ? "#00a862" : "#b45309")}>{frozen ? `Dibekukan ${new Date(frozen.frozenAt).toLocaleDateString("id-ID")}` : manager ? "Live · angka masih bisa berubah" : me.role === "viewer" ? "Belum dibekukan" : "Report kamu (live)"}</span>
      </div>

      {me.role === "viewer" && !frozen ? (
        <div style={{ ...card, padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--app-muted)" }}>
          Report {monthName(month)} belum dibekukan. Viewer cuma bisa lihat report yang udah dibekukan Leader atau Officer.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="sp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {[
              ["Omzet lunas", juta(revenue), showLive && manager ? delta(revenue, live.base.revenue, "money").text : ""],
              ["Deal lunas", fmtN(paidCount), showLive && manager ? delta(paidCount, live.base.paidCount, "count").text : ""],
              ["Chat masuk", fmtN(leads), showLive && manager ? delta(leads, live.base.leads, "count").text : ""],
            ].map(([k, v, d]) => (
              <div key={k} style={{ ...card, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, color: "var(--app-muted)", fontWeight: 600 }}>{k}{!manager && !frozen ? " (kamu)" : ""}</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                {d && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{d}</div>}
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: 0, overflowX: "auto" }}>
            <table className="sp-rtable" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
              <thead>
                <tr style={{ background: "var(--app-inner)", textAlign: "left" }}>
                  {["#", "Sales", "Chat", "Penawaran", "Lunas", "Omzet", "Target", "Capaian", ""].map(h => <th key={h} style={{ padding: "9px 10px", fontSize: 12, color: "var(--app-muted)", fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} style={{ padding: 16, color: "var(--app-muted)", textAlign: "center" }}>Belum ada sales di guild ini.</td></tr>}
                {rows.map((r, i) => {
                  const pct = r.targetRevenue ? Math.round((r.revenue / r.targetRevenue) * 100) : null;
                  return (
                    <tr key={r.uid} style={{ borderTop: "1px solid var(--app-border)", fontVariantNumeric: "tabular-nums", background: r.uid === me.uid ? "var(--app-inner)" : undefined }}>
                      <td className="sp-rt-hide" style={{ padding: "9px 10px", color: "var(--app-muted)" }}>{i + 1}</td>
                      <td className="sp-rt-head" style={{ padding: "9px 10px", fontWeight: 700 }}>{rows.length > 1 ? <span className="sp-rt-only" style={{ color: "var(--app-muted)", fontWeight: 600 }}>{i + 1}. </span> : null}{r.name}{r.uid === me.uid ? " (kamu)" : ""}</td>
                      <td data-label="Chat" style={{ padding: "9px 10px" }}>{r.leads}</td>
                      <td data-label="Penawaran" style={{ padding: "9px 10px" }}>{r.quoted}</td>
                      <td data-label="Lunas" style={{ padding: "9px 10px" }}>{r.paid}</td>
                      <td data-label="Omzet" style={{ padding: "9px 10px", fontWeight: 700 }}>{juta(r.revenue)}</td>
                      <td data-label="Target" style={{ padding: "9px 10px", color: "var(--app-muted)" }}>{r.targetRevenue ? `${juta(r.targetRevenue)}${r.targetDeals ? ` · ${r.targetDeals} deal` : ""}` : "—"}</td>
                      <td data-label="Capaian" style={{ padding: "9px 10px", fontWeight: 700, color: pct == null ? "var(--app-muted)" : pct >= 100 ? "var(--ok)" : undefined }}>{pct == null ? "—" : `${pct}%`}</td>
                      <td className="sp-rt-wide" style={{ padding: "9px 10px" }}>
                        {manager && !frozen && <button onClick={() => { targetSave.reset(); setEditing({ uid: r.uid, name: r.name, revenue: r.targetRevenue ? fmtN(r.targetRevenue) : "", deals: r.targetDeals ? String(r.targetDeals) : "" }); }} aria-label={`Atur target ${r.name}`} style={{ ...chip, fontSize: 13, color: "var(--app-text)" }}>{r.targetRevenue ? "Ubah target" : "Atur target"}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)" }}>
            Omzet & lunas dihitung dari tanggal lunas; chat & penawaran dari chat yang masuk bulan ini. Pembanding = rata-rata 3 bulan sebelumnya; di bawah 10 kejadian ditulis tanpa persen.
          </div>

          {(manager || frozen) && (
            <div className="sp-actions">
              {manager && (!frozen ? <button onClick={freeze} style={btnPrimary}>Bekukan report tim</button> : <button onClick={() => setReopen(true)} style={btnMuted}>Buka lagi</button>)}
              <a className="sp-tap" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" style={{ ...btnWA, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Kirim via WA</a>
              <button onClick={() => setPrinting(true)} style={btnGhost}>Cetak / PDF</button>
            </div>
          )}
          {!manager && !frozen && rows.length > 0 && (
            <div className="sp-actions"><button onClick={() => setPrinting(true)} style={btnGhost}>Cetak / PDF</button></div>
          )}
        </div>
      )}

      {printing && (
        <TeamReportSheet guildName={guild.name} month={month} rows={rows} revenue={revenue} paidCount={paidCount} leads={leads}
          compare={showLive && manager ? { revenue: delta(revenue, live.base.revenue, "money").text, paidCount: delta(paidCount, live.base.paidCount, "count").text, leads: delta(leads, live.base.leads, "count").text } : undefined}
          frozenAt={frozen?.frozenAt} scope={manager || frozen ? "team" : "self"} onClose={() => setPrinting(false)} />
      )}
      {reopen && (
        <ConfirmSheet title="Buka lagi report ini?" action="Buka lagi" busyLabel="Membuka…" onConfirm={unfreeze} onClose={() => setReopen(false)}>
          Angka {monthName(month)} dihitung ulang dari deal sekarang. Bisa dibekukan lagi kapan aja.
        </ConfirmSheet>
      )}
      {editing && (
        <div className="modal-overlay" onClick={() => { if (!targetSave.busy) closeTarget(); }}>
          <form onSubmit={e => { e.preventDefault(); saveTarget(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Target {editing.name}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>{monthName(month)}</div>
            <label htmlFor="tg-rev" style={label}>Target omzet (Rp)</label>
            <input id="tg-rev" inputMode="numeric" value={editing.revenue} onChange={e => setEditing({ ...editing, revenue: e.target.value })} placeholder="50.000.000" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="tg-deals" style={label}>Target deal lunas</label>
            <input id="tg-deals" inputMode="numeric" value={editing.deals} onChange={e => setEditing({ ...editing, deals: e.target.value })} placeholder="4" style={inputStyle} />
            <FormNote err={targetSave.err} />
            <div className="sp-form-foot">
              <button type="button" onClick={closeTarget} disabled={targetSave.busy} style={btnMuted}>Batal</button>
              <button type="submit" disabled={targetSave.busy} style={{ ...btnPrimary, opacity: targetSave.busy ? 0.6 : 1 }}>{targetSave.busy ? "Menyimpan…" : "Simpan target"}</button>
            </div>
          </form>
          {targetAsk}
        </div>
      )}
    </div>
  );
}

// ======================= Anggota =======================

function Members({ gid, guild, me, members, invites, uid, onSettings }: { gid: string; guild: Guild; me: Member; members: Member[]; invites: Invite[]; uid: string; onSettings?: () => void }) {
  const [inviteRole, setInviteRole] = useState<Role>(invitable(me.role).includes("member") ? "member" : invitable(me.role)[0] || "member");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [handover, setHandover] = useState<string | null>(null);
  const [kicking, setKicking] = useState<Member | null>(null);
  const [picking, setPicking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [roleErr, setRoleErr] = useState("");
  const [inviting, setInviting] = useState(false);
  const hoSave = useSave();
  const sorted = [...members].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));
  const live = invites.filter(i => i.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
  const leader = me.role === "leader";

  // What I may set someone else's role to (mirrors firestore.rules).
  function rolesFor(m: Member): Role[] {
    if (m.uid === me.uid) return [];
    if (leader) return m.role === "leader" ? [] : ["officer", "member", "viewer"];
    if (me.role === "officer" && (m.role === "member" || m.role === "viewer")) return ["member", "viewer"];
    return [];
  }
  const canRemove = (m: Member) => m.uid !== me.uid && (leader || (me.role === "officer" && (m.role === "member" || m.role === "viewer")));

  const by = { uid, name: me.name };
  async function changeRole(m: Member, r: Role) {
    setRoleErr("");
    try { await setRole(gid, m.uid, r); } catch { setRoleErr(`Peran ${m.name} gagal diganti. Cek koneksi lalu coba lagi.`); return; }
    logActivity(gid, by, "role_changed", { refName: m.name, about: m.uid, detail: `${titleOf(guild, m.role)} → ${titleOf(guild, r)}` });
  }
  async function kick(m: Member) {
    await removeMember(gid, m.uid);
    logActivity(gid, by, "removed", { refName: m.name, about: m.uid });
  }
  async function makeInvite() {
    setInviting(true); setCopyMsg("");
    try {
      const c = await createInvite(guild, uid, inviteRole);
      logActivity(gid, by, "invited", { detail: titleOf(guild, inviteRole) });
      setLink(inviteLink(window.location.origin, gid, c));
      setCopied(false);
    } catch { setCopyMsg("Link gagal dibuat. Cek koneksi lalu coba lagi."); }
    finally { setInviting(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setCopyMsg(""); setTimeout(() => setCopied(false), 2000); }
    catch { setCopyMsg("Ga bisa nyalin otomatis. Tekan lama link di atas, lalu Salin."); }
  }
  async function leave() {
    await logActivity(gid, by, "left");
    await leaveGuild(gid, uid);
  }
  async function doHandover() {
    if (!handover) return;
    const h = handover;
    const ok = await hoSave.run(() => transferLeadership(gid, uid, h));
    if (!ok) return;
    const to = members.find(m => m.uid === h);
    logActivity(gid, by, "handover", { refName: to?.name, about: h });
    setHandover(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(m => {
          const options = rolesFor(m);
          return (
            <div key={m.uid} className="sp-member" style={{ ...card, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {m.uid === me.uid
                ? <button type="button" onClick={() => setPicking(true)} aria-label="Ganti karakter kamu" style={{ padding: 0, border: 0, background: "none", cursor: "pointer", borderRadius: "50%", position: "relative" }}>
                    <Avatar role={m.role} pick={m.avatar} size={44} />
                    <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: -2, bottom: -2, width: 18, height: 18, borderRadius: "50%", background: "var(--app-card)", border: "1px solid var(--app-border)", fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✎</span>
                  </button>
                : <Avatar role={m.role} pick={m.avatar} size={44} />}
              <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}{m.uid === me.uid ? " (kamu)" : ""}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              {options.length ? (
                <>
                  <label htmlFor={`role-${m.uid}`} style={{ position: "absolute", left: -9999 }}>Peran {m.name}</label>
                  <select id={`role-${m.uid}`} value={m.role} onChange={e => changeRole(m, e.target.value as Role)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
                    {Array.from(new Set([m.role, ...options])).map(r => <option key={r} value={r}>{titleOf(guild, r)}</option>)}
                  </select>
                </>
              ) : <RoleBadge guild={guild} role={m.role} />}
              {canRemove(m) && (
                <button onClick={() => setKicking(m)} aria-label={`Keluarkan ${m.name}`} style={{ ...chip, fontSize: 13, color: "color-mix(in srgb, #dc2626 70%, var(--app-text))", borderColor: "#dc262640" }}>Keluarkan</button>
              )}
            </div>
          );
        })}
        {roleErr && <div role="alert" style={{ fontSize: 13, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>{roleErr}</div>}
      </div>

      {invitable(me.role).length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Undang orang</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>Link berlaku 7 hari, buat siapa pun yang login pakai Gmail/email. Kirim ke orangnya lewat WA.</div>
          <div role="radiogroup" aria-label="Peran undangan" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 8, marginBottom: 12 }}>
            {invitable(me.role).map(r => (
              <button key={r} type="button" role="radio" aria-checked={inviteRole === r} onClick={() => setInviteRole(r)}
                style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "start", padding: 10, minHeight: 64, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
                  background: inviteRole === r ? `color-mix(in srgb, ${ROLE_COLOR[r]} 10%, var(--app-card))` : "var(--app-card)",
                  border: `${inviteRole === r ? 2 : 1}px solid ${inviteRole === r ? ROLE_COLOR[r] : "var(--app-border)"}` }}>
                <Avatar role={r} size={44} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{titleOf(guild, r)}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--app-muted)", lineHeight: 1.4 }}>{ROLE_HINT[r]}</span>
                </span>
              </button>
            ))}
          </div>
          <button onClick={makeInvite} disabled={inviting} style={{ ...btnPrimary, width: "100%", minHeight: 48, opacity: inviting ? 0.6 : 1 }}>{inviting ? "Membuat link…" : `Bikin link undangan ${titleOf(guild, inviteRole)}`}</button>
          {link && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor="inv-link" style={label}>Link undangan</label>
              <input id="inv-link" readOnly value={link} onFocus={e => e.currentTarget.select()} style={{ ...inputStyle, fontSize: 12 }} />
              <div className="sp-actions" style={{ marginTop: 8 }}>
                <button onClick={copy} style={btnGhost}>{copied ? "✓ Tersalin" : "Salin link"}</button>
                <a className="sp-tap" href={`https://wa.me/?text=${encodeURIComponent(`Gabung ke guild ${guild.name} di SalesPal: ${link}`)}`} target="_blank" rel="noreferrer" style={{ ...btnWA, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Kirim via WA</a>
              </div>
            </div>
          )}
          {copyMsg && <div role="alert" style={{ fontSize: 13, marginTop: 8, color: "var(--app-sub)" }}>{copyMsg}</div>}
          {live.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Undangan aktif</div>
              {live.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 13, padding: "5px 0" }}>
                  <span style={{ minWidth: 0 }}>{titleOf(guild, i.role)} · berlaku s/d {new Date(i.expiresAt).toLocaleDateString("id-ID")}</span>
                  <button onClick={() => deleteDoc(doc(db, "guilds", gid, "invites", i.id)).catch(() => setCopyMsg("Undangan gagal dicabut. Coba lagi."))} aria-label={`Cabut undangan ${titleOf(guild, i.role)}`} style={{ ...chip, fontSize: 13, flexShrink: 0 }}>Cabut</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sp-actions">
        {isManager(me.role) && onSettings && <button onClick={onSettings} style={btnGhost}>{leader ? "Atur guild & nama peran" : "Atur lambang guild"}</button>}
        {leader && members.length > 1 && <button onClick={() => { hoSave.reset(); setHandover(""); }} style={btnGhost}>Serahkan Leader</button>}
        {!leader && <button onClick={() => setLeaving(true)} style={{ ...btnMuted, color: "color-mix(in srgb, #dc2626 70%, var(--app-text))" }}>Keluar dari guild</button>}
      </div>

      {picking && <AvatarSheet gid={gid} me={me} onClose={() => setPicking(false)} />}
      {kicking && (
        <ConfirmSheet title={`Keluarkan ${kicking.name}?`} action="Keluarkan" busyLabel="Mengeluarkan…" onConfirm={() => kick(kicking)} onClose={() => setKicking(null)}>
          Dia ga bisa buka {guild.name} lagi. Deal miliknya tetap ada di guild. Bisa diundang lagi lewat link baru.
        </ConfirmSheet>
      )}
      {leaving && (
        <ConfirmSheet title={`Keluar dari ${guild.name}?`} action="Keluar" busyLabel="Keluar…" onConfirm={leave} onClose={() => setLeaving(false)}>
          Deal milik kamu tetap ada di guild. Buat balik lagi, minta link undangan baru.
        </ConfirmSheet>
      )}

      {handover !== null && (
        <div className="modal-overlay" onClick={() => { if (!hoSave.busy) setHandover(null); }}>
          <form onSubmit={e => { e.preventDefault(); doHandover(); }} onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Serahkan Leader</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14 }}>Dia jadi Leader, kamu turun jadi {titleOf(guild, "officer")}. Ga bisa dibatalin sendiri.</div>
            <label htmlFor="ho-who" style={label}>Ke siapa</label>
            <select id="ho-who" value={handover} onChange={e => setHandover(e.target.value)} style={inputStyle}>
              <option value="">— pilih anggota —</option>
              {members.filter(m => m.uid !== uid).map(m => <option key={m.uid} value={m.uid}>{m.name} · {titleOf(guild, m.role)}</option>)}
            </select>
            <FormNote why={handover ? "" : "Pilih anggota dulu."} err={hoSave.err} />
            <div className="sp-form-foot">
              <button type="button" onClick={() => setHandover(null)} disabled={hoSave.busy} style={btnMuted}>Batal</button>
              <button type="submit" disabled={!handover || hoSave.busy} style={{ ...btnPrimary, opacity: handover && !hoSave.busy ? 1 : 0.5 }}>{hoSave.busy ? "Menyerahkan…" : "Serahkan"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ======================= Aktivitas =======================

function ago(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "barusan";
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function Activities({ gid, me }: { gid: string; me: Member }) {
  const [items, setItems] = useState<Activity[] | null>(null);
  useEffect(() => {
    const col = collection(db, "guilds", gid, "activities");
    const rows = new Map<string, Activity>();
    const push = (docs: { id: string; data: () => unknown }[]) => {
      docs.forEach(d => rows.set(d.id, { id: d.id, ...(d.data() as Omit<Activity, "id">) }));
      setItems(Array.from(rows.values()).sort((a, b) => b.at - a.at).slice(0, 150));
    };
    // Leader & officer see everything; others what they did or what concerns them.
    const qs = isManager(me.role)
      ? [query(col, orderBy("at", "desc"), limit(150))]
      : [query(col, where("who", "==", me.uid)), query(col, where("about", "==", me.uid))];
    const unsubs = qs.map(q => onSnapshot(q, s => push(s.docs), () => setItems(cur => cur || [])));
    return () => unsubs.forEach(u => u());
  }, [gid, me.uid, me.role]);

  if (!items) return <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Memuat aktivitas…</div>;
  if (!items.length) {
    return <div style={{ ...card, padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--app-muted)" }}>Belum ada aktivitas. Tiap chat, geser deal, closing, dan perubahan anggota tercatat di sini.</div>;
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10 }}>
        {isManager(me.role) ? "Semua yang terjadi di guild, terbaru di atas." : "Yang kamu lakuin dan yang menyangkut kamu."} Catatan ini ga bisa diubah atau dihapus.
      </div>
      <div style={{ ...card, padding: "4px 14px" }}>
        {items.map(a => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--app-inner)", fontSize: 12.5 }}>
            <div style={{ minWidth: 0 }}>
              <b>{a.who === me.uid ? "Kamu" : a.whoName}</b> {ACTIVITY_TEXT[a.what] || a.what}
              {a.refName && <> · <b>{a.refName}</b></>}
              {a.detail && <span style={{ color: "var(--app-muted)" }}> · {a.detail}</span>}
            </div>
            <span style={{ color: "var(--app-muted)", whiteSpace: "nowrap", fontSize: 12 }}>{ago(a.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
