"use client";

// Guild (docs/prd/PRD-007): the team space. Found one or join by invite link;
// leaders and officers run the team, members sell, viewers read the frozen
// reports. Every rule here is also enforced by firestore.rules.

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { today } from "@/lib/billing";
import { Deal, delta, juta, monthName, monthOf, shiftMonth } from "@/lib/funnel";
import {
  ACTIVITY_TEXT, Activity, Guild, GuildRef, Invite, Member, ROLES, ROLE_HINT, Role, Target, createInvite, foundGuild, invitable, inviteLink,
  isManager, isSeller, leaveGuild, logActivity, removeMember, setRole, teamMonth, titleOf, transferLeadership,
} from "@/lib/guild";
import TeamReportSheet from "@/components/TeamReportSheet";
import { Pipeline } from "@/components/ClientHub";
import { badge, btnGhost, btnMuted, btnPrimary, btnWA, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

type View = "pipeline" | "report" | "aktivitas" | "anggota";
const ROLE_COLOR: Record<Role, string> = { leader: "#b45309", officer: "#7c3aed", member: "#005eb0", viewer: "#64748b" };
const fmtN = (n: number) => Math.round(n).toLocaleString("id-ID");
const n0 = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

function remember(g: string) { try { localStorage.setItem("sp-guild", g); } catch { /* private mode */ } }
function recalled(): string { try { return localStorage.getItem("sp-guild") || ""; } catch { return ""; } }

interface FrozenTeam { month: string; rows: ReturnType<typeof teamMonth>["rows"]; revenue: number; paidCount: number; leads: number; frozenAt: number }

export default function GuildHub({ uid, name, email }: { uid: string; name: string; email: string }) {
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

  async function found() {
    if (!founding?.trim()) return;
    const g = await foundGuild({ uid, name, email }, founding);
    remember(g); setGid(g); setFounding(null); setView("anggota");
  }

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={heading}>Guild</div>
        <div style={subheading}>Ruang tim: pipeline bersama, peran, target, dan report sales per orang.</div>
      </div>
      <button onClick={() => setFounding("")} style={btnGhost}>+ Guild baru</button>
    </div>
  );

  const foundModal = founding !== null && (
    <div className="modal-overlay" onClick={() => setFounding(null)}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Bikin guild</div>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Kamu jadi Leader. Anggota diundang lewat link.</div>
        <label htmlFor="gd-name" style={label}>Nama guild</label>
        <input id="gd-name" value={founding} onChange={e => setFounding(e.target.value)} placeholder="mis. Tim Sales Jaya" maxLength={80} style={inputStyle} />
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={found} disabled={!founding.trim()} style={{ ...btnPrimary, opacity: founding.trim() ? 1 : 0.5 }}>Bikin guild</button>
          <button onClick={() => setFounding(null)} style={btnMuted}>Batal</button>
        </div>
      </div>
    </div>
  );

  if (refs === null) return <div style={{ color: "var(--app-muted)", fontSize: 13 }}>Memuat guild…</div>;

  if (!refs.length) {
    return (
      <div style={{ paddingBottom: 72 }}>
        {header}
        <div style={{ ...card, padding: "36px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ikut guild mana pun</div>
          <div style={{ fontSize: 12.5, color: "var(--app-muted)", marginBottom: 18, maxWidth: 440, marginInline: "auto", lineHeight: 1.6 }}>
            Bikin guild buat tim lo (atau tim sales klien), terus undang orangnya lewat link. Leader & Officer lihat semua deal dan report tiap orang; Member kerjain deal-nya sendiri; Viewer cuma lihat report.
          </div>
          <button onClick={() => setFounding("")} style={btnPrimary}>+ Bikin guild</button>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 14 }}>Diundang orang? Buka link undangannya di HP ini.</div>
        </div>
        {foundModal}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 72 }}>
      {header}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <label htmlFor="guild-pick" style={{ position: "absolute", left: -9999 }}>Pilih guild</label>
        <select id="guild-pick" value={gid} onChange={e => { setGid(e.target.value); remember(e.target.value); }} style={{ ...inputStyle, width: "auto", minWidth: 160, fontWeight: 700 }}>
          {refs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {role && <span style={badge(ROLE_COLOR[role])}>{titleOf(guild, role)}</span>}
      </div>

      {!guild || !me ? (
        <div style={{ ...card, padding: 24, fontSize: 12.5, color: "var(--app-muted)", textAlign: "center" }}>Memuat…</div>
      ) : (
        <>
          <div role="tablist" aria-label="Bagian guild" style={{ display: "flex", gap: 4, background: "var(--app-inner)", padding: 4, borderRadius: 10, marginBottom: 18 }}>
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
          {view === "anggota" && <Members gid={gid} guild={guild} me={me} members={members} invites={invites} uid={uid} />}
        </>
      )}
      {foundModal}
    </div>
  );
}

// ======================= Report Tim =======================

function TeamReport({ gid, guild, me, members, deals, targets, reports }: { gid: string; guild: Guild; me: Member; members: Member[]; deals: Deal[]; targets: Target[]; reports: FrozenTeam[] }) {
  const now = monthOf(today());
  const [month, setMonth] = useState(new Date().getDate() <= 7 ? shiftMonth(now, -1) : now);
  const [editing, setEditing] = useState<{ uid: string; name: string; revenue: string; deals: string } | null>(null);
  const [printing, setPrinting] = useState(false);
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
    await setDoc(doc(db, "guilds", gid, "targets", `${month}_${editing.uid}`), { uid: editing.uid, month, revenue: n0(editing.revenue), deals: n0(editing.deals) });
    logActivity(gid, { uid: me.uid, name: me.name }, "target_set", { refName: editing.name, about: editing.uid, detail: `${monthName(month)}: ${juta(n0(editing.revenue))}${n0(editing.deals) ? ` · ${n0(editing.deals)} deal` : ""}` });
    setEditing(null);
  }
  async function freeze() {
    await setDoc(doc(db, "guilds", gid, "reports", month), JSON.parse(JSON.stringify({
      month, rows: live.rows, revenue: live.total.revenue, paidCount: live.total.paidCount, leads: live.total.leads, frozenAt: Date.now(),
    })));
    logActivity(gid, { uid: me.uid, name: me.name }, "report_frozen", { detail: monthName(month) });
  }
  async function unfreeze() {
    if (!confirm("Buka lagi report ini? Angkanya dihitung ulang dari deal sekarang.")) return;
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
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
                      <td style={{ padding: "9px 10px", color: "var(--app-muted)" }}>{i + 1}</td>
                      <td style={{ padding: "9px 10px", fontWeight: 700 }}>{r.name}{r.uid === me.uid ? " (kamu)" : ""}</td>
                      <td style={{ padding: "9px 10px" }}>{r.leads}</td>
                      <td style={{ padding: "9px 10px" }}>{r.quoted}</td>
                      <td style={{ padding: "9px 10px" }}>{r.paid}</td>
                      <td style={{ padding: "9px 10px", fontWeight: 700 }}>{juta(r.revenue)}</td>
                      <td style={{ padding: "9px 10px", color: "var(--app-muted)" }}>{r.targetRevenue ? `${juta(r.targetRevenue)}${r.targetDeals ? ` · ${r.targetDeals} deal` : ""}` : "—"}</td>
                      <td style={{ padding: "9px 10px", fontWeight: 700, color: pct == null ? "var(--app-muted)" : pct >= 100 ? "var(--ok)" : undefined }}>{pct == null ? "—" : `${pct}%`}</td>
                      <td style={{ padding: "9px 10px" }}>
                        {manager && !frozen && <button onClick={() => setEditing({ uid: r.uid, name: r.name, revenue: r.targetRevenue ? fmtN(r.targetRevenue) : "", deals: r.targetDeals ? String(r.targetDeals) : "" })} aria-label={`Atur target ${r.name}`} style={{ ...chip, fontSize: 12 }}>Target</button>}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {manager && (!frozen ? <button onClick={freeze} style={btnPrimary}>Bekukan report tim</button> : <button onClick={unfreeze} style={btnMuted}>Buka lagi</button>)}
              <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" style={{ ...btnWA, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Kirim via WA</a>
              <button onClick={() => setPrinting(true)} style={btnGhost}>Cetak / PDF</button>
            </div>
          )}
          {!manager && !frozen && rows.length > 0 && (
            <div><button onClick={() => setPrinting(true)} style={btnGhost}>Cetak / PDF</button></div>
          )}
        </div>
      )}

      {printing && (
        <TeamReportSheet guildName={guild.name} month={month} rows={rows} revenue={revenue} paidCount={paidCount} leads={leads}
          compare={showLive && manager ? { revenue: delta(revenue, live.base.revenue, "money").text, paidCount: delta(paidCount, live.base.paidCount, "count").text, leads: delta(leads, live.base.leads, "count").text } : undefined}
          frozenAt={frozen?.frozenAt} scope={manager || frozen ? "team" : "self"} onClose={() => setPrinting(false)} />
      )}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Target {editing.name}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>{monthName(month)}</div>
            <label htmlFor="tg-rev" style={label}>Target omzet (Rp)</label>
            <input id="tg-rev" inputMode="numeric" value={editing.revenue} onChange={e => setEditing({ ...editing, revenue: e.target.value })} placeholder="50.000.000" style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="tg-deals" style={label}>Target deal lunas</label>
            <input id="tg-deals" inputMode="numeric" value={editing.deals} onChange={e => setEditing({ ...editing, deals: e.target.value })} placeholder="4" style={inputStyle} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveTarget} style={btnPrimary}>Simpan target</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================= Anggota =======================

function Members({ gid, guild, me, members, invites, uid }: { gid: string; guild: Guild; me: Member; members: Member[]; invites: Invite[]; uid: string }) {
  const [inviteRole, setInviteRole] = useState<Role>(invitable(me.role).includes("member") ? "member" : invitable(me.role)[0] || "member");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<{ name: string; titles: Record<Role, string> } | null>(null);
  const [handover, setHandover] = useState<string | null>(null);
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
    await setRole(gid, m.uid, r);
    logActivity(gid, by, "role_changed", { refName: m.name, about: m.uid, detail: `${titleOf(guild, m.role)} → ${titleOf(guild, r)}` });
  }
  async function kick(m: Member) {
    if (!confirm(`Keluarkan ${m.name} dari guild?`)) return;
    await removeMember(gid, m.uid);
    logActivity(gid, by, "removed", { refName: m.name, about: m.uid });
  }
  async function makeInvite() {
    const c = await createInvite(guild, uid, inviteRole);
    logActivity(gid, by, "invited", { detail: titleOf(guild, inviteRole) });
    setLink(inviteLink(window.location.origin, gid, c));
    setCopied(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* the link stays selectable */ }
  }
  async function saveSettings() {
    if (!settings || !settings.name.trim()) return;
    const titles = Object.fromEntries(ROLES.map(r => [r, settings.titles[r].trim()]).filter(([, t]) => t));
    await updateDoc(doc(db, "guilds", gid), { name: settings.name.trim().slice(0, 80), titles });
    await setDoc(doc(db, "users", uid, "guilds", gid), { name: settings.name.trim().slice(0, 80) }, { merge: true });
    setSettings(null);
  }
  async function leave() {
    if (!confirm(`Keluar dari ${guild.name}? Deal milik kamu tetap ada di guild.`)) return;
    await logActivity(gid, by, "left");
    await leaveGuild(gid, uid);
  }
  async function doHandover() {
    if (!handover) return;
    await transferLeadership(gid, uid, handover);
    const to = members.find(m => m.uid === handover);
    logActivity(gid, by, "handover", { refName: to?.name, about: handover });
    setHandover(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(m => {
          const options = rolesFor(m);
          return (
            <div key={m.uid} style={{ ...card, padding: "11px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 180px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}{m.uid === me.uid ? " (kamu)" : ""}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
              </div>
              {options.length ? (
                <>
                  <label htmlFor={`role-${m.uid}`} style={{ position: "absolute", left: -9999 }}>Peran {m.name}</label>
                  <select id={`role-${m.uid}`} value={m.role} onChange={e => changeRole(m, e.target.value as Role)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}>
                    {Array.from(new Set([m.role, ...options])).map(r => <option key={r} value={r}>{titleOf(guild, r)}</option>)}
                  </select>
                </>
              ) : <span style={badge(ROLE_COLOR[m.role])}>{titleOf(guild, m.role)}</span>}
              {canRemove(m) && (
                <button onClick={() => kick(m)} aria-label={`Keluarkan ${m.name}`} style={{ ...chip, color: "#dc2626", borderColor: "#dc262640" }}>Keluarkan</button>
              )}
            </div>
          );
        })}
      </div>

      {invitable(me.role).length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Undang orang</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>Link berlaku 7 hari, buat siapa pun yang login pakai Gmail/email. Kirim ke orangnya lewat WA.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor="inv-role" style={{ position: "absolute", left: -9999 }}>Peran undangan</label>
            <select id="inv-role" value={inviteRole} onChange={e => setInviteRole(e.target.value as Role)} style={{ ...inputStyle, width: "auto" }}>
              {invitable(me.role).map(r => <option key={r} value={r}>{titleOf(guild, r)}</option>)}
            </select>
            <button onClick={makeInvite} style={btnPrimary}>Bikin link undangan</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 8 }}>{ROLE_HINT[inviteRole]}</div>
          {link && (
            <div style={{ marginTop: 12 }}>
              <label htmlFor="inv-link" style={label}>Link undangan</label>
              <input id="inv-link" readOnly value={link} onFocus={e => e.currentTarget.select()} style={{ ...inputStyle, fontSize: 12 }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button onClick={copy} style={btnGhost}>{copied ? "✓ Tersalin" : "Salin link"}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`Gabung ke guild ${guild.name} di SalesPal: ${link}`)}`} target="_blank" rel="noreferrer" style={{ ...btnWA, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Kirim via WA</a>
              </div>
            </div>
          )}
          {live.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Undangan aktif</div>
              {live.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 12, padding: "5px 0" }}>
                  <span>{titleOf(guild, i.role)} · berlaku s/d {new Date(i.expiresAt).toLocaleDateString("id-ID")}</span>
                  <button onClick={() => deleteDoc(doc(db, "guilds", gid, "invites", i.id))} style={chip}>Cabut</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {leader && <button onClick={() => setSettings({ name: guild.name, titles: Object.fromEntries(ROLES.map(r => [r, guild.titles?.[r] || ""])) as Record<Role, string> })} style={btnGhost}>Atur guild & nama peran</button>}
        {leader && members.length > 1 && <button onClick={() => setHandover("")} style={btnGhost}>Serahkan Leader</button>}
        {!leader && <button onClick={leave} style={{ ...btnMuted, color: "#dc2626" }}>Keluar dari guild</button>}
      </div>

      {settings && (
        <div className="modal-overlay" onClick={() => setSettings(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Atur guild</div>
            <label htmlFor="gs-name" style={label}>Nama guild</label>
            <input id="gs-name" value={settings.name} onChange={e => setSettings({ ...settings, name: e.target.value })} maxLength={80} style={{ ...inputStyle, marginBottom: 14 }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Nama peran</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10 }}>Ganti sesuai istilah tim lo (mis. Officer → Supervisor). Hak aksesnya tetap.</div>
            {ROLES.map(r => (
              <div key={r} style={{ marginBottom: 8 }}>
                <label htmlFor={`gs-${r}`} style={label}>{r === "leader" ? "Leader" : r === "officer" ? "Officer" : r === "member" ? "Member" : "Viewer"} — {ROLE_HINT[r]}</label>
                <input id={`gs-${r}`} value={settings.titles[r]} onChange={e => setSettings({ ...settings, titles: { ...settings.titles, [r]: e.target.value } })} placeholder={titleOf(null, r)} maxLength={30} style={inputStyle} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={saveSettings} style={btnPrimary}>Simpan</button>
              <button onClick={() => setSettings(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {handover !== null && (
        <div className="modal-overlay" onClick={() => setHandover(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Serahkan Leader</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14 }}>Dia jadi Leader, kamu turun jadi {titleOf(guild, "officer")}. Ga bisa dibatalin sendiri.</div>
            <label htmlFor="ho-who" style={label}>Ke siapa</label>
            <select id="ho-who" value={handover} onChange={e => setHandover(e.target.value)} style={inputStyle}>
              <option value="">— pilih anggota —</option>
              {members.filter(m => m.uid !== uid).map(m => <option key={m.uid} value={m.uid}>{m.name} · {titleOf(guild, m.role)}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={doHandover} disabled={!handover} style={{ ...btnPrimary, opacity: handover ? 1 : 0.5 }}>Serahkan</button>
              <button onClick={() => setHandover(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
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
