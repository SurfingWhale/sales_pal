"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Icon, { IconName, MoreDots } from "@/components/Icon";
import HeatDots from "@/components/HeatDots";
import WaImport, { WaPatch } from "@/components/WaImport";
import { Score } from "@/lib/score";
import { LeadProfile, guessArchetype, hasProfile, objectionTypeOf, scriptsFor } from "@/lib/profile";
import { archetypes, objections } from "@/lib/salespal-data";
import { addDays, longDate, today, waLink } from "@/lib/billing";

// A lead, as drawn in the SalesPal Redesign canvas (PRD-008):
//   LeadPanel — the detail beside the list on Leads (desktop)
//   LeadPage  — "Profil customer", full screen on phones and behind
//               "Profil lengkap" on desktop
// Both run the same actions: schedule the next step, mark a reply, fill the
// profile by hand or from WhatsApp, open the right script, quote, delete.

export interface DetailLead {
  id: string; name: string; contact: string; phone: string; email: string; category: string; source: string;
  status: string; value: number; notes: string; lastContact: string; lastReplyAt?: string;
  nextAction?: string; nextActionDate?: string; profile?: LeadProfile; ownerName?: string;
}

export interface DetailActions {
  onSaveProfile: (p: LeadProfile) => Promise<void> | void;
  onImport: (patch: WaPatch) => Promise<void> | void;
  onReplied: () => void;
  onSchedule: (action: string, date: string) => Promise<void> | void;
  onDone: () => Promise<void> | void;
  onQuote: () => void;
  onDelete: () => void;
}

const STATUS_COLOR: Record<string, string> = { Hot: "var(--hot)", Warm: "var(--warm)", Cold: "var(--cold)", Closed: "var(--ok)" };
const ARCH_ICON: Record<string, IconName> = { lion: "bolt", owl: "brief", dolphin: "chat", rabbit: "shield" };
const jt = (n: number) => (n ? `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : "Belum ada nilai");
const initials = (n: string) => n.replace(/[^A-Za-z0-9À-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const dayText = (iso?: string) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "");
const pill = (primary: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, padding: "0 18px", borderRadius: 999,
  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "none", whiteSpace: "nowrap",
  border: primary ? 0 : "1px solid var(--app-line-strong)", background: primary ? "#005eb0" : "transparent", color: primary ? "#fff" : "var(--app-text)",
});
const field: React.CSSProperties = { width: "100%", background: "var(--app-card)", border: "1px solid var(--app-line-strong)", borderRadius: 12, color: "var(--app-text)", padding: "10px 12px", fontSize: 16, fontFamily: "inherit", resize: "vertical" };

// ---------------------------------------------------------------- shared bits

// Escape, focus and Tab for every .modal-overlay come from components/ModalA11y.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "flex-end", padding: 8, background: "var(--scrim)", zIndex: 130 }}>
      <section role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 32, padding: "10px 18px 22px", background: "var(--app-card)", color: "var(--app-text)", boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 999, background: "var(--app-line-strong)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, marginRight: -8, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--app-ink-2)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={13} stroke={2.4} /></span>
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

function FollowUp({ lead, actions }: { lead: DetailLead; actions: DetailActions }) {
  const [fu, setFu] = useState({ action: lead.nextAction || "", date: lead.nextActionDate || "" });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="vh" htmlFor="fu-action">Tindakan berikutnya</label>
      <input id="fu-action" value={fu.action} onChange={e => setFu({ ...fu, action: e.target.value })} style={field} placeholder="mis. Kirim portfolio, telpon owner" aria-label="Tindakan berikutnya" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {([["Besok", 1], ["3 hari", 3], ["1 minggu", 7]] as [string, number][]).map(([l, d]) => {
          const on = fu.date === addDays(today(), d);
          return <button key={l} onClick={() => setFu({ ...fu, date: addDays(today(), d) })} aria-pressed={on} style={{ height: 36, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? "var(--app-text)" : "var(--app-line-strong)"}`, background: on ? "var(--app-text)" : "transparent", color: on ? "var(--app-card)" : "var(--app-ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>;
        })}
        <input type="date" value={fu.date} onChange={e => setFu({ ...fu, date: e.target.value })} aria-label="Tanggal follow-up" style={{ ...field, width: "auto", height: 36, padding: "0 10px", fontSize: 14 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => actions.onSchedule(fu.action.trim(), fu.date)} disabled={!fu.date} style={{ ...pill(true), opacity: fu.date ? 1 : 0.5 }}>Simpan jadwal</button>
        {lead.nextActionDate && <button onClick={async () => { await actions.onDone(); setFu({ action: "", date: "" }); }} style={pill(false)}>✓ Selesai</button>}
      </div>
    </div>
  );
}

function ProfileEditor({ profile, onSave, onClose }: { profile: LeadProfile; onSave: (p: LeadProfile) => Promise<void> | void; onClose: () => void }) {
  const [edit, setEdit] = useState<LeadProfile>({ ...profile });
  const guess = !edit.archetype ? guessArchetype([edit.need, edit.pain, edit.objection].join(" ")) : null;
  const detected = edit.objection && !edit.objectionType ? objectionTypeOf(edit) : null;
  const chip = (on: boolean): React.CSSProperties => ({ height: 36, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? "var(--app-text)" : "var(--app-line-strong)"}`, background: on ? "var(--app-text)" : "transparent", color: on ? "var(--app-card)" : "var(--app-ink-2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" });
  return (
    <Sheet title="Profil" onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        {([["pf-need", "need", "Kebutuhan", "mis. foto menu baru buat 3 cabang sebelum Desember"], ["pf-pain", "pain", "Pain point", "mis. foto antar cabang beda-beda gaya"], ["pf-obj", "objection", "Keberatan", "mis. budget dibagi sama renovasi"]] as const).map(([id, k, l, ph]) => (
          <div key={id}>
            <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{l}</label>
            <textarea id={id} rows={2} value={edit[k] || ""} placeholder={ph} onChange={e => setEdit({ ...edit, [k]: e.target.value })} style={field} />
          </div>
        ))}
        <div role="group" aria-label="Jenis keberatan">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Jenis keberatan {detected && <span style={{ fontWeight: 500, color: "var(--app-muted)" }}>· ketebak: {objections.find(o => o.id === detected)?.label}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {objections.filter(o => o.id !== "ghosting").map(o => {
              const on = (edit.objectionType || detected) === o.id;
              return <button key={o.id} aria-pressed={on} onClick={() => setEdit({ ...edit, objectionType: on && edit.objectionType ? undefined : o.id })} style={chip(on)}>{o.icon} {o.label}</button>;
            })}
          </div>
        </div>
        <div role="group" aria-label="Tipe customer">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tipe customer {guess && <span style={{ fontWeight: 500, color: "var(--app-muted)" }}>· kayaknya {archetypes.find(a => a.id === guess)?.name}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {archetypes.map(a => {
              const on = (edit.archetype || guess) === a.id;
              return <button key={a.id} aria-pressed={on} onClick={() => setEdit({ ...edit, archetype: edit.archetype === a.id ? undefined : a.id })} style={chip(on)}>{a.animal} {a.name}</button>;
            })}
          </div>
        </div>
        <button onClick={async () => {
          const next: LeadProfile = {
            ...profile, ...edit,
            need: (edit.need || "").trim(), pain: (edit.pain || "").trim(), objection: (edit.objection || "").trim(),
            archetype: edit.archetype || guess || undefined, objectionType: edit.objectionType || detected || undefined,
            source: profile.source || "manual", at: today(),
          };
          await onSave(JSON.parse(JSON.stringify(next)));
          onClose();
        }} style={{ ...pill(true), width: "100%", minHeight: 50 }}>Simpan profil</button>
      </div>
    </Sheet>
  );
}

function Why({ score, onReplied }: { score: Score; onReplied: () => void }) {
  return (
    <>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {score.signals.map(r => (
          <li key={r.key} style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{r.label}</span>
              <span style={{ color: "var(--app-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.detail}</span>
              <span className="tabnum" style={{ marginLeft: "auto", fontWeight: 600, color: r.pts ? "var(--app-text)" : "var(--app-muted)" }}>{r.pts ? `+${r.pts}` : "0"}</span>
              <span className="tabnum" style={{ color: "var(--app-muted)", width: 30, textAlign: "right" }}>/ {r.max}</span>
            </div>
            <div aria-hidden="true" style={{ marginTop: 8, height: 4, borderRadius: 999, background: "var(--app-inner)", overflow: "hidden" }}><div style={{ width: `${(r.pts / r.max) * 100}%`, height: "100%", borderRadius: 999, background: "#005eb0" }} /></div>
          </li>
        ))}
      </ul>
      {score.tip && <p style={{ margin: "8px 0 0", padding: "12px 14px", borderRadius: 12, background: "var(--brand-tint)", fontSize: 13, lineHeight: 1.5, color: "var(--app-ink-2)" }}><span style={{ fontWeight: 600, color: "var(--brand-text)" }}>Biar naik:</span> {score.tip}.</p>}
      <button onClick={onReplied} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 36, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        <Icon name="chat" size={15} stroke={1.8} /> Mereka bales hari ini
      </button>
    </>
  );
}

function Menu({ lead, actions, onEdit, compact }: { lead: DetailLead; actions: DetailActions; onEdit: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button className={compact ? undefined : "glass"} aria-label="Menu lead" aria-expanded={open} onClick={() => setOpen(!open)} style={{ ...(compact ? { width: 36, height: 36, marginTop: -4, background: "transparent", color: "var(--app-muted)" } : {}), width: compact ? 36 : 44, height: compact ? 36 : 44, border: 0, borderRadius: "50%", color: "var(--app-text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><MoreDots /></button>
      {open && (
        <div role="menu" className="frost" style={{ position: "absolute", right: 0, top: 50, zIndex: 20, minWidth: 210, borderRadius: 18, padding: 6, boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 12px 32px var(--frost-float)" }}>
          <button role="menuitem" className="rowhover" onClick={() => { setOpen(false); onEdit(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", border: 0, borderRadius: 12, background: "transparent", color: "var(--app-text)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}><Icon name="brief" size={17} /> Ubah profil</button>
          <button role="menuitem" className="rowhover" aria-label={`Hapus lead ${lead.name}`} onClick={() => { setOpen(false); actions.onDelete(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", border: 0, borderRadius: 12, background: "transparent", color: "var(--hot)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}><Icon name="trash" size={17} /> Hapus lead</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- LeadPanel

export function LeadPanel({ lead, score, actions, onOpenFull, shareFile }: {
  lead: DetailLead; score: Score; actions: DetailActions; onOpenFull: () => void; shareFile?: File | null;
}) {
  const p = lead.profile || {};
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(Boolean(shareFile));
  const [scheduling, setScheduling] = useState(false);
  const late = lead.nextActionDate && lead.nextActionDate < today();

  return (
    <aside aria-label="Detail lead" style={{ position: "sticky", top: 120, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, boxShadow: "var(--panel-shadow)", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span aria-hidden="true" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(lead.name)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.02em" }}>{lead.name}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--app-muted)" }}>{lead.category} · dari {lead.source || "—"} · {jt(lead.value)}</p>
        </div>
        <span style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 999, background: "var(--app-inner)", color: STATUS_COLOR[lead.status] || "var(--app-ink-2)", fontSize: 12, fontWeight: 600 }}>{lead.status}</span>
        <Menu lead={lead} actions={actions} onEdit={() => setEditing(true)} compact />
      </div>

      <div style={{ marginTop: 24, padding: "20px 0", borderTop: "1px solid var(--app-border)", borderBottom: "1px solid var(--app-border)", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Skor potensi</p>
          <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 6 }}><span className="num" style={{ fontSize: 64 }}>{score.total}</span><span className="num" style={{ fontSize: 24, color: "var(--app-muted)" }}>/ 100</span></p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, paddingBottom: 4 }}>
          <HeatDots level={score.level} size={9} gap={4} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--app-ink-2)" }}>Potensi {score.word.toLowerCase()}</span>
        </div>
      </div>

      <h3 style={{ margin: "20px 0 4px", fontSize: 14, fontWeight: 600 }}>Kenapa {score.total}</h3>
      <Why score={score} onReplied={actions.onReplied} />

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--app-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <Icon name="clock" style={{ color: "var(--app-muted)" }} />
          <span style={{ color: "var(--app-muted)" }}>Berikutnya</span>
          <span style={{ fontWeight: 600, color: lead.nextActionDate ? (late ? "var(--hot)" : "var(--app-text)") : "var(--app-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lead.nextActionDate ? `${lead.nextAction || "Follow-up"} · ${longDate(lead.nextActionDate)}` : "Belum dijadwalkan"}
          </span>
          <button onClick={() => setScheduling(!scheduling)} aria-expanded={scheduling} style={{ marginLeft: "auto", flexShrink: 0, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Jadwalkan</button>
        </div>
        {scheduling && <div style={{ marginTop: 12 }}><FollowUp lead={lead} actions={actions} /></div>}
      </div>

      <div style={{ margin: "24px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Profil</h3>
        <button onClick={onOpenFull} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Profil lengkap <Icon name="chevronRight" size={14} stroke={2} /></button>
      </div>
      {hasProfile(p) ? (
        <>
          <dl style={{ margin: "8px 0 0", display: "grid", gap: 14 }}>
            {p.brief && !p.need && <div><dt style={{ fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>Brief</dt><dd style={{ margin: "3px 0 0", fontSize: 14, lineHeight: 1.5 }}>{p.brief}</dd></div>}
            {([["Kebutuhan", p.need], ["Pain point", p.pain], ["Keberatan", p.objection]] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt style={{ fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>{k}</dt><dd style={{ margin: "3px 0 0", fontSize: 14, lineHeight: 1.5 }}>{v}</dd></div>
            ))}
          </dl>
          <p style={{ margin: "12px 0 0", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--app-muted)" }}>
            <Icon name="chat" size={13} stroke={1.8} />
            {p.source === "wa-export" ? `Dari chat WhatsApp, ${dayText(p.at)}` : `Diisi manual, ${dayText(p.at)}`}
            <button onClick={() => setImporting(true)} style={{ marginLeft: "auto", padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{p.source === "wa-export" ? "Tarik ulang" : "Tarik dari WhatsApp"}</button>
          </p>
        </>
      ) : (
        <div style={{ marginTop: 8, padding: 16, border: "1px dashed var(--app-line-strong)", borderRadius: 12 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--app-muted)" }}>Belum diisi. Tarik dari chat WhatsApp, atau isi sendiri setelah chat pertama. QuickPitch pakai ini buat nyusun pitch.</p>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setImporting(true)} style={{ ...pill(true), minHeight: 40, padding: "0 16px", fontSize: 13 }}><Icon name="chat" size={15} stroke={1.8} />Tarik dari WhatsApp</button>
            <button onClick={() => setEditing(true)} style={{ ...pill(false), minHeight: 40, padding: "0 16px", fontSize: 13 }}>Isi manual</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {lead.phone
          ? <a href={waLink(lead.phone, `Halo ${lead.contact || lead.name}, `)} target="_blank" rel="noreferrer" style={{ ...pill(true), flex: "1 1 160px" }}><Icon name="chat" />Chat WhatsApp</a>
          : <button onClick={() => setEditing(true)} style={{ ...pill(true), flex: "1 1 160px" }}>Tambah nomor</button>}
        <button onClick={actions.onQuote} style={{ ...pill(false), flex: "1 1 140px" }}>Buat penawaran</button>
      </div>

      {editing && <ProfileEditor profile={p} onSave={actions.onSaveProfile} onClose={() => setEditing(false)} />}
      {importing && <WaImport leadName={lead.contact || lead.name} profile={p} initialFile={shareFile} onSave={actions.onImport} onClose={() => setImporting(false)} />}
    </aside>
  );
}

// ---------------------------------------------------------------- LeadPage

export function LeadPage({ lead, score, actions, onClose, shareFile }: {
  lead: DetailLead; score: Score; actions: DetailActions; onClose: () => void; shareFile?: File | null;
}) {
  const p = lead.profile || {};
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(Boolean(shareFile));
  const [scheduling, setScheduling] = useState(false);
  const [why, setWhy] = useState(false);
  const [script, setScript] = useState(false);
  const [tone, setTone] = useState<"santai" | "formal">("santai");
  const [copied, setCopied] = useState(false);
  const { archetype, objection, scripts } = scriptsFor(p);
  const sc = scripts.find(s => s.tone === tone) || scripts[0];
  const name = lead.contact || lead.name;
  const scriptText = sc ? sc.script.replace(/\{nama\}/gi, name) : "";
  const chat = p.chat;

  const section: React.CSSProperties = { background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20 };
  const h2: React.CSSProperties = { margin: "0 4px 8px", fontSize: 13, fontWeight: 600, color: "var(--app-muted)" };
  const quick = (primary: boolean): React.CSSProperties => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0 10px", borderRadius: 18, fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer", fontFamily: "inherit", border: primary ? 0 : "1px solid var(--app-border)", background: primary ? "#005eb0" : "var(--app-card)", color: primary ? "#fff" : "var(--brand-text)" });
  const max = chat ? Math.max(1, ...chat.perWeek.map(w => w.n)) : 1;
  const total = chat ? chat.mine + chat.theirs || 1 : 1;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay sp-leadpage" onClick={onClose}
      style={{ alignItems: "stretch", justifyContent: "center", padding: 0, background: "var(--scrim)", zIndex: 110 }}>
      <div role="dialog" aria-modal="true" aria-label={`Profil ${lead.name}`} onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 480, height: "100%", overflowY: "auto", background: "var(--app-bg)", color: "var(--app-text)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 9, height: 0 }}>
          <div className="pb t" aria-hidden="true" style={{ top: 0, height: 100 }}><span /><span /><span /><span /><span /><span /></div>
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 100, background: "linear-gradient(to bottom, var(--bar-tint) 0%, var(--bar-tint) 35%, transparent 100%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="glass" onClick={onClose} aria-label="Kembali ke Leads" style={{ width: 44, height: 44, border: 0, borderRadius: "50%", color: "var(--app-text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><Icon name="chevronLeft" size={20} stroke={2} /></button>
            <Menu lead={lead} actions={actions} onEdit={() => setEditing(true)} />
          </div>
        </div>

        <div style={{ padding: "68px 16px 150px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <span aria-hidden="true" style={{ width: 92, height: 92, borderRadius: "50%", background: "linear-gradient(160deg, #6ea9e4 0%, #005eb0 100%)", color: "#fff", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 28px rgba(0,94,176,0.28)" }}>{initials(lead.name)}</span>
            <h1 style={{ margin: "14px 0 0", fontSize: 27, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.02em" }}>{lead.name}</h1>
            <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--app-muted)" }}>{[lead.contact, lead.category, p.wa?.category].filter(Boolean).join(" · ")}{lead.ownerName ? ` · 👤 ${lead.ownerName}` : ""}</p>
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {lead.phone && <span style={{ height: 28, padding: "0 11px", borderRadius: 999, background: "var(--app-card)", border: "1px solid var(--app-border)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--app-ink-2)" }}><Icon name="shield" size={14} stroke={1.9} style={{ color: "var(--brand-text)" }} />Nomor WhatsApp ada</span>}
              <span style={{ height: 28, padding: "0 11px", borderRadius: 999, background: "var(--app-card)", border: "1px solid var(--app-border)", display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: STATUS_COLOR[lead.status] || "var(--app-ink-2)" }}>{lead.status}</span>
            </div>
          </div>

          <nav aria-label="Aksi cepat" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {lead.phone ? <a href={waLink(lead.phone, `Halo ${name}, `)} target="_blank" rel="noreferrer" style={quick(true)}><Icon name="chat" size={22} />Chat</a> : <button onClick={() => setEditing(true)} style={quick(true)}><Icon name="chat" size={22} />Chat</button>}
            {lead.phone ? <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} style={quick(false)}><Icon name="phone" size={22} />Telepon</a> : <button disabled style={{ ...quick(false), opacity: 0.5 }}><Icon name="phone" size={22} />Telepon</button>}
            <button onClick={actions.onQuote} style={quick(false)}><Icon name="doc" size={22} />Penawaran</button>
            <button onClick={() => setScheduling(true)} style={quick(false)}><Icon name="calendar" size={22} />Jadwal</button>
          </nav>

          <section aria-labelledby="brief-h" style={{ marginTop: 20, position: "relative", isolation: "isolate", borderRadius: 26, overflow: "hidden" }}>
            <span aria-hidden="true" style={{ position: "absolute", width: 240, height: 240, left: -60, top: -90, borderRadius: "50%", background: "radial-gradient(circle, var(--glow-a) 0%, transparent 70%)" }} />
            <span aria-hidden="true" style={{ position: "absolute", width: 220, height: 220, right: -70, top: -40, borderRadius: "50%", background: "radial-gradient(circle, var(--glow-b) 0%, transparent 70%)" }} />
            <div className="frost" style={{ position: "relative", padding: "18px 18px 16px", borderRadius: 26, boxShadow: "inset 0 0 0 1px var(--frost-ring)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h2 id="brief-h" style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600 }}><Icon name="brief" size={17} style={{ color: "var(--brand-text)" }} />Brief</h2>
                {chat && <span className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)" }}>dari {chat.messages} pesan WA</span>}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: p.brief ? "var(--app-text)" : "var(--app-muted)" }}>{p.brief || lead.notes || "Belum ada brief. Tarik dari chat WhatsApp biar SalesPal ngerangkum siapa mereka dan posisi deal-nya."}</p>
              <dl style={{ margin: "14px 0 0", paddingTop: 14, borderTop: "1px solid var(--frost-line)", display: "grid", gap: 12 }}>
                {([["Kebutuhan", p.need], ["Pain point", p.pain], ["Keberatan", p.objection]] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt style={{ fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>{k}</dt><dd style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.45 }}>{v}</dd></div>
                ))}
                <div><dt style={{ fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>Berikutnya</dt><dd style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.45, fontWeight: 600 }}>{lead.nextActionDate ? `${lead.nextAction || "Follow-up"} · ${longDate(lead.nextActionDate)}` : "Belum dijadwalkan"}</dd></div>
              </dl>
              {!hasProfile(p) && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setImporting(true)} style={{ ...pill(true), minHeight: 40, padding: "0 16px", fontSize: 13 }}><Icon name="chat" size={15} stroke={1.8} />Tarik dari WhatsApp</button>
                  <button onClick={() => setEditing(true)} style={{ ...pill(false), minHeight: 40, padding: "0 16px", fontSize: 13 }}>Isi manual</button>
                </div>
              )}
            </div>
          </section>

          <div style={{ ...section, marginTop: 12, padding: 0, overflow: "hidden" }}>
            <button onClick={() => setWhy(!why)} aria-expanded={why} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", border: 0, background: "transparent", color: "var(--app-text)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <span className="num" style={{ fontSize: 42 }}>{score.total}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Potensi {score.word.toLowerCase()}</span>
                <HeatDots level={score.level} size={9} gap={4} />
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 13, fontWeight: 600, color: "var(--brand-text)" }}>Kenapa {score.total}<Icon name={why ? "chevronDown" : "chevronRight"} size={14} stroke={2} /></span>
            </button>
            {why && <div style={{ padding: "0 16px 14px" }}><Why score={score} onReplied={actions.onReplied} /></div>}
          </div>

          <section aria-labelledby="wa-h" style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 8px" }}>
              <h2 id="wa-h" style={{ ...h2, margin: 0 }}>Kontak</h2>
              <button onClick={() => setImporting(true)} style={{ display: "inline-flex", alignItems: "center", minHeight: 32, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{p.source === "wa-export" ? "Tarik ulang" : "Tarik dari WhatsApp"}</button>
            </div>
            <dl style={{ ...section, margin: 0, overflow: "hidden" }}>
              {([["Nama kontak", lead.contact], ["Nomor", lead.phone], ["Email", lead.email], ["Kategori bisnis", p.wa?.category || lead.category], ["Sumber", lead.source], ["Kontak terakhir", lead.lastContact ? longDate(lead.lastContact) : ""], ["Info lain", p.wa?.notes]] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v], i) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "13px 16px", borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                  <dt style={{ fontSize: 14, color: "var(--app-muted)" }}>{k}</dt>
                  <dd className="tabnum" style={{ margin: 0, fontSize: 14, fontWeight: 500, textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{v}</dd>
                </div>
              ))}
            </dl>
            {lead.notes && p.brief && <p style={{ margin: "8px 4px 0", fontSize: 12, lineHeight: 1.5, color: "var(--app-muted)" }}>Catatan: {lead.notes}</p>}
          </section>

          {chat && (
            <section aria-labelledby="pola-h" style={{ marginTop: 28 }}>
              <h2 id="pola-h" style={h2}>Pola chat</h2>
              <div style={{ ...section, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  <div><p className="num" style={{ margin: 0, fontSize: 32 }}>{chat.messages}</p><p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.35, color: "var(--app-muted)" }}>pesan sejak {dayText(chat.since)}</p></div>
                  <div><p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 3 }}><span className="num" style={{ fontSize: 32 }}>{chat.avgReplyMin === null ? "—" : chat.avgReplyMin < 60 ? chat.avgReplyMin : Math.round(chat.avgReplyMin / 60)}</span><span style={{ fontSize: 12, fontWeight: 600, color: "var(--app-muted)" }}>{chat.avgReplyMin !== null && chat.avgReplyMin >= 60 ? "jam" : "mnt"}</span></p><p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.35, color: "var(--app-muted)" }}>rata-rata mereka bales</p></div>
                  <div><p className="num" style={{ margin: 0, fontSize: 32 }}>{chat.activeHours || "—"}</p><p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.35, color: "var(--app-muted)" }}>jam paling aktif</p></div>
                </div>
                <p style={{ margin: "20px 0 10px", fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>Pesan dari mereka per minggu</p>
                <div role="img" aria-label={`Pesan dari mereka per minggu: ${chat.perWeek.map(w => w.n).join(", ")}`} style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 84, borderBottom: "1px solid var(--app-border)" }}>
                  {chat.perWeek.map((w, i) => <span key={w.week} title={`${w.n} pesan`} style={{ flex: 1, height: `${Math.max(4, (w.n / max) * 100)}%`, borderRadius: "4px 4px 0 0", background: i === chat.perWeek.length - 1 ? "#005eb0" : "color-mix(in srgb, #005eb0 45%, var(--app-card))" }} />)}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>{chat.perWeek.map(w => <span key={w.week} className="tabnum" style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--app-muted)" }}>{w.week}</span>)}</div>
                <p style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>Siapa yang lebih banyak ngechat</p>
                <div role="img" aria-label={`Kamu ${chat.mine} pesan, mereka ${chat.theirs} pesan`} style={{ display: "flex", gap: 2, height: 8 }}>
                  <span style={{ width: `${(chat.mine / total) * 100}%`, borderRadius: "4px 0 0 4px", background: "var(--app-ink-2)" }} />
                  <span style={{ flex: 1, borderRadius: "0 4px 4px 0", background: "#005eb0" }} />
                </div>
                <div className="tabnum" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                  <span style={{ color: "var(--app-ink-2)", fontWeight: 600 }}>Kamu {chat.mine}</span>
                  <span style={{ color: "var(--brand-text)", fontWeight: 600 }}>Mereka {chat.theirs}</span>
                </div>
              </div>
            </section>
          )}

          {archetype && (
            <section aria-labelledby="tipe-h" style={{ marginTop: 28 }}>
              <h2 id="tipe-h" style={h2}>Tipe customer</h2>
              <div style={{ ...section, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 14, background: `color-mix(in srgb, ${archetype.color} 18%, var(--app-card))`, color: `color-mix(in srgb, ${archetype.color} 75%, var(--app-text))`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={ARCH_ICON[archetype.id] || "person"} size={22} stroke={1.8} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{archetype.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--app-muted)" }}>{archetype.traits.slice(0, 2).join(", ")}</p>
                  </div>
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5 }}>{archetype.strategy}</p>
                {p.cues && p.cues.length > 0 && (
                  <>
                    <p style={{ margin: "14px 0 8px", fontSize: 12, fontWeight: 500, color: "var(--app-muted)" }}>Kata yang muncul di chat</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {p.cues.map(c => <span key={c.word} className="tabnum" style={{ height: 28, padding: "0 10px", borderRadius: 999, background: "var(--app-inner)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500 }}>“{c.word}” <span style={{ color: "var(--app-muted)" }}>{c.n}×</span></span>)}
                    </div>
                  </>
                )}
                <button onClick={() => setScript(!script)} aria-expanded={script} style={{ ...pill(false), width: "100%", marginTop: 14 }}>{script ? "Tutup script" : `Buka script ${archetype.name}`}</button>
                {script && (
                  sc ? (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--app-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Script: {objection?.icon} {objection?.label}</div>
                        <div role="group" aria-label="Gaya bahasa" style={{ display: "flex", gap: 4 }}>
                          {(["santai", "formal"] as const).map(t => <button key={t} aria-pressed={tone === t} onClick={() => setTone(t)} style={{ height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${tone === t ? "var(--app-text)" : "var(--app-line-strong)"}`, background: tone === t ? "var(--app-text)" : "transparent", color: tone === t ? "var(--app-card)" : "var(--app-ink-2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t === "santai" ? "Santai" : "Formal"}</button>)}
                        </div>
                      </div>
                      <p style={{ margin: "10px 0 4px", fontSize: 14, lineHeight: 1.55 }}>{scriptText}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--app-muted)" }}>{sc.tips}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => { navigator.clipboard?.writeText(scriptText).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); }} style={{ ...pill(false), minHeight: 40 }}>{copied ? "✓ Tersalin" : "Copy"}</button>
                        {lead.phone && <a href={waLink(lead.phone, scriptText)} target="_blank" rel="noreferrer" style={{ ...pill(true), minHeight: 40 }}>Kirim WA</a>}
                      </div>
                    </div>
                  ) : <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Isi jenis keberatannya (Ubah profil) buat dapet script yang pas.</p>
                )}
              </div>
            </section>
          )}

          {p.questions && p.questions.length > 0 && (
            <section aria-labelledby="tanya-h" style={{ marginTop: 28 }}>
              <h2 id="tanya-h" style={h2}>Yang mereka tanya</h2>
              <ul style={{ ...section, listStyle: "none", margin: 0, padding: 0, overflow: "hidden" }}>
                {p.questions.slice().reverse().map((q, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 12px 13px 16px", borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>“{q.text}”</p>
                      <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: q.answered ? 400 : 600, color: q.answered ? "var(--app-muted)" : "var(--hot)" }}>{dayText(q.at)} · {q.answered ? "dijawab" : "belum dijawab"}</p>
                    </div>
                    {!q.answered && lead.phone && <a href={waLink(lead.phone, "")} target="_blank" rel="noreferrer" style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", textDecoration: "none" }}>Balas</a>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div style={{ position: "sticky", bottom: 0, height: 0, zIndex: 9 }}>
          <div className="glass" style={{ position: "absolute", left: 14, right: 14, bottom: 22, padding: 6, borderRadius: 32, display: "flex", gap: 6 }}>
            {lead.phone
              ? <a href={waLink(lead.phone, `Halo ${name}, `)} target="_blank" rel="noreferrer" style={{ flex: 1, height: 52, borderRadius: 26, background: "#005eb0", color: "#fff", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}><Icon name="chat" size={19} stroke={1.8} />Chat di WhatsApp</a>
              : <button onClick={actions.onQuote} style={{ flex: 1, height: 52, border: 0, borderRadius: 26, background: "#005eb0", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Buat penawaran</button>}
            <button onClick={() => setImporting(true)} aria-label="Tarik ulang dari WhatsApp" style={{ width: 52, height: 52, border: 0, borderRadius: "50%", background: "var(--glass-btn)", color: "var(--app-text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="refresh" size={20} stroke={1.8} /></button>
          </div>
        </div>
      </div>

      {scheduling && <Sheet title="Langkah berikutnya" onClose={() => setScheduling(false)}><FollowUp lead={lead} actions={actions} /></Sheet>}
      {editing && <ProfileEditor profile={p} onSave={actions.onSaveProfile} onClose={() => setEditing(false)} />}
      {importing && <WaImport leadName={name} profile={p} initialFile={shareFile} onSave={actions.onImport} onClose={() => setImporting(false)} />}
    </div>,
    document.body
  );
}
