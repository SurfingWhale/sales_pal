"use client";

import { useState } from "react";
import { deleteDoc, setDoc } from "firebase/firestore";
import { today, useSpaceCollection } from "@/lib/billing";
import { canEditCatalog, spaceDoc, useSpace } from "@/lib/space";
import { PitchTemplate, fill } from "@/lib/hunting";
import { Campaign, GROUPS, GROUP_LABEL, Group, Prospect, Segment, Strategy, audience, rate, sentIn } from "@/lib/prospects";
import { clean, recordSend } from "@/lib/prospectStore";
import { btnMuted, btnPrimary, card, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// A campaign is one message for a group of prospects (docs/prd/PRD-008 §7).
// There is no sending in bulk — the platforms have no API for it — so it runs
// as a queue: copy, send it yourself, next.

type Draft = { name: string; templateId: string; segment: Segment | "all"; groups: Group[] };

export default function Campaigns({ prospects, templates, strategy, sessionId }: {
  prospects: Prospect[]; templates: PitchTemplate[]; strategy: Strategy; sessionId?: string;
}) {
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const campaigns = useSpaceCollection<Campaign>(space, "campaigns").slice().sort((a, b) => b.createdAt - a.createdAt);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [running, setRunning] = useState<{ id: string; skipped: string[] } | null>(null);
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [msg, setMsg] = useState("");
  const on = today();

  async function save() {
    if (!draft || !draft.name.trim() || !draft.templateId || !draft.groups.length || !canEdit) return;
    const id = `cmp_${Date.now()}`;
    await setDoc(spaceDoc(space, "campaigns", id), clean({ name: draft.name.trim(), templateId: draft.templateId, segment: draft.segment, groups: draft.groups, createdAt: Date.now() }));
    setDraft(null);
  }

  async function send(c: Campaign, p: Prospect, t: PitchTemplate) {
    const text = fill(t.body, p.handle);
    setMsg("");
    const copied = await (navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false));
    try {
      const back = await recordSend(space, {
        target: p.handle, platform: p.platform, url: p.url, templateId: t.id, templateTitle: t.title, text,
        channel: "dm", campaignId: c.id, campaignName: c.name,
      }, p, sessionId, strategy);
      const label = `${copied ? "Tersalin & tercatat" : "Tercatat (salin manual)"}: ${p.handle}`;
      setUndo({ label, run: back });
      setTimeout(() => setUndo(u => (u?.run === back ? null : u)), 5000);
    } catch {
      setMsg("Gagal nyatet. Coba lagi.");
    }
  }

  return (
    <div style={{ ...card, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>Kampanye</div>
        {canEdit && <button onClick={() => setDraft({ name: "", templateId: templates[0]?.id || "", segment: "all", groups: ["nunggu", "terhubung"] })} style={chip}>+ Kampanye</button>}
      </div>
      <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 12 }}>Satu pesan buat sekelompok prospek, dikirim satu-satu. Yang Jangan dihubungi dan yang lagi diparkir otomatis dilewati.</div>
      {campaigns.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada kampanye.</div>}
      {campaigns.map(c => {
        const t = templates.find(x => x.id === c.templateId);
        const left = audience(prospects, c, on, strategy);
        const reached = prospects.filter(p => sentIn(p, c.id));
        const replied = reached.filter(p => {
          const sentAt = (p.history || []).find(e => e.kind === "sent" && e.campaignId === c.id)?.at || 0;
          return (p.history || []).some(e => (e.kind === "reply" || e.kind === "convert" || e.kind === "status") && e.at > sentAt);
        });
        const isRunning = running?.id === c.id;
        const queue = left.filter(p => !running?.skipped.includes(p.id));
        const cur = isRunning ? queue[0] : undefined;
        return (
          <div key={c.id} style={{ borderTop: "1px solid var(--app-inner)", padding: "12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                  {t?.title || "Template dihapus"} · {c.segment === "all" ? "NTB + ETB" : c.segment} · {c.groups.map(g => GROUP_LABEL[g].split(" (")[0]).join(", ")}
                </div>
                <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                  {reached.length} terkirim · dijawab {rate(replied.length, reached.length)} · {left.length} belum
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {t && left.length > 0 && <button onClick={() => setRunning(isRunning ? null : { id: c.id, skipped: [] })} aria-pressed={isRunning} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--brand-text)", border: "1px solid #005eb060" }}>{isRunning ? "Tutup" : "Mulai antrian"}</button>}
                {canEdit && <button onClick={async () => { if (confirm(`Hapus kampanye ${c.name}? Riwayat kirimnya tetap ada di journey.`)) await deleteDoc(spaceDoc(space, "campaigns", c.id)); }} aria-label={`Hapus kampanye ${c.name}`} style={{ ...chip, minHeight: 36 }}>🗑</button>}
              </div>
            </div>
            {isRunning && t && (
              <div role="region" aria-label={`Antrian kampanye ${c.name}`} style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
                {!cur ? (
                  <div style={{ fontSize: 12 }}>Antrian habis {reached.length ? `· ${reached.length} terkirim` : ""}.</div>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 6 }}>{reached.length + 1} dari {reached.length + queue.length}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{cur.name ? `${cur.name} (${cur.handle})` : cur.handle} · {cur.platform}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 10 }}>{fill(t.body, cur.handle)}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => send(c, cur, t)} style={{ ...btnPrimary, padding: "8px 14px" }}>Copy & catat</button>
                      {cur.url && <a href={cur.url} target="_blank" rel="noreferrer" style={{ ...chip, minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none", color: "var(--app-text)" }}>Buka profil ↗</a>}
                      <button onClick={() => setRunning({ id: c.id, skipped: [...(running?.skipped || []), cur.id] })} style={{ ...chip, minHeight: 36 }}>Lewati</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {undo && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#005eb014", border: "1px solid #005eb050", fontSize: 12 }}>
          <span>{undo.label}</span>
          <button onClick={async () => { const u = undo; setUndo(null); await u.run(); }} style={{ ...chip, minHeight: 32, fontWeight: 700 }}>Batal</button>
        </div>
      )}
      {msg && <div role="status" style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 8 }}>{msg}</div>}

      {draft && (
        <div className="modal-overlay" onClick={() => setDraft(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="cmp-title" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 460 }}>
            <div id="cmp-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>Kampanye baru</div>
            <label htmlFor="cmp-name" style={label}>Nama</label>
            <input id="cmp-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="mis. Promo foto menu Oktober" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
            <label htmlFor="cmp-template" style={label}>Pesan (template)</label>
            <select id="cmp-template" value={draft.templateId} onChange={e => setDraft({ ...draft, templateId: e.target.value })} style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }}>
              {templates.length === 0 && <option value="">Belum ada template</option>}
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <div style={label}>Segmen</div>
            <div role="radiogroup" aria-label="Segmen" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["all", "NTB", "ETB"] as const).map(s => (
                <button key={s} role="radio" aria-checked={draft.segment === s} onClick={() => setDraft({ ...draft, segment: s })}
                  style={{ ...chip, minHeight: 36, fontWeight: 700, ...(draft.segment === s ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{s === "all" ? "Semua" : s}</button>
              ))}
            </div>
            <div style={label}>Kirim ke</div>
            <div role="group" aria-label="Kirim ke" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {GROUPS.map(g => {
                const onG = draft.groups.includes(g);
                return (
                  <button key={g} aria-pressed={onG} onClick={() => setDraft({ ...draft, groups: onG ? draft.groups.filter(x => x !== g) : [...draft.groups, g] })}
                    style={{ ...chip, minHeight: 36, textAlign: "left", fontSize: 12, ...(onG ? { color: "var(--app-text)", border: "1px solid #005eb0", background: "#005eb014" } : {}) }}>{onG ? "☑" : "☐"} {GROUP_LABEL[g]}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={!draft.name.trim() || !draft.templateId || !draft.groups.length} style={{ ...btnPrimary, opacity: draft.name.trim() && draft.templateId && draft.groups.length ? 1 : 0.5 }}>Simpan</button>
              <button onClick={() => setDraft(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
