"use client";

import { useEffect, useRef, useState } from "react";
import { deleteDoc, setDoc } from "firebase/firestore";
import { spaceDoc, useSpace } from "@/lib/space";
import { PitchTemplate, TemplateScore, pct } from "@/lib/hunting";
import { FillData, SAMPLE, STAGES, STARTERS, Stage, VARIABLES, fillTemplate, missingIn, stageOf } from "@/lib/templates";
import { btnMuted, btnPrimary, btnWA, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// The message deck as a kanban of the conversation (docs/prd/PRD-009 §13):
// one column per stage, the column that fits this person lit up, and every
// template filled in with what their post said.

export default function TemplateBoard({ templates, scores, data, stage, blocked, copiedId, copyFail, onPick, canEdit, sampleName }: {
  templates: PitchTemplate[]; scores: TemplateScore[]; data: FillData; stage: Stage; blocked: boolean;
  copiedId: string | null; copyFail: string | null; onPick: (t: PitchTemplate, how: "copy" | "wa") => void;
  canEdit: boolean; sampleName: string;
}) {
  const space = useSpace();
  const [editing, setEditing] = useState<PitchTemplate | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  // Bring the column that fits into view, inside the board only.
  useEffect(() => {
    const b = board.current;
    const col = b?.querySelector<HTMLElement>(`[data-stage="${stage}"]`);
    if (b && col) b.scrollTo({ left: Math.max(0, col.offsetLeft - b.offsetLeft - 4), behavior: "smooth" });
  }, [stage]);

  async function save() {
    if (!editing || !editing.title.trim() || !editing.body.trim() || !canEdit) return;
    const id = editing.id || `tpl_${Date.now()}`;
    await setDoc(spaceDoc(space, "pitchTemplates", id), { title: editing.title.trim(), body: editing.body.trim(), stage: stageOf(editing) });
    setEditing(null);
  }

  async function addStarter(s: Stage) {
    if (!canEdit) return;
    await setDoc(spaceDoc(space, "pitchTemplates", `tpl_${Date.now()}`), { ...STARTERS[s], stage: s });
  }

  function insert(key: string) {
    if (!editing) return;
    const el = body.current;
    const token = `{${key}}`;
    const at = el ? el.selectionStart : editing.body.length;
    const end = el ? el.selectionEnd : at;
    const next = editing.body.slice(0, at) + token + editing.body.slice(end);
    setEditing({ ...editing, body: next });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  }

  const preview = (b: string) => fillTemplate(b, data.nama || data.kebutuhan ? data : SAMPLE);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih pesan</div>
        {canEdit && <button onClick={() => setEditing({ id: "", title: "", body: "", stage })} style={chip}>+ Template</button>}
      </div>
      <div ref={board} role="list" aria-label="Template per tahap" style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x proximity", paddingBottom: 6, scrollbarWidth: "thin" }}>
        {STAGES.map((s, i) => {
          const list = templates.filter(t => stageOf(t) === s.id);
          const on = s.id === stage;
          return (
            <section key={s.id} role="listitem" data-stage={s.id} aria-label={`Tahap ${i + 1}: ${s.label}${on ? ", cocok sekarang" : ""}`}
              style={{ flex: "0 0 272px", scrollSnapAlign: "start", borderRadius: 14, padding: 10, background: on ? "#005eb00f" : "transparent", border: `1px solid ${on ? "#005eb0" : "var(--app-border)"}`, display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: "var(--app-muted)" }}>{i + 1} ·</span> {s.label}</div>
                  {on && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-text)" }}>Cocok sekarang</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{s.when}</div>
              </div>
              {list.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "8px 2px" }}>
                  Belum ada template.
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      <button onClick={() => addStarter(s.id)} style={{ ...chip, minHeight: 34, fontWeight: 700, color: "var(--brand-text)" }}>+ Pakai contoh</button>
                      <button onClick={() => setEditing({ id: "", title: "", body: "", stage: s.id })} style={{ ...chip, minHeight: 34 }}>Tulis sendiri</button>
                    </div>
                  )}
                </div>
              )}
              {list.length > 0 && canEdit && !list.some(t => t.title === STARTERS[s.id].title) && (
                <button onClick={() => addStarter(s.id)} style={{ ...chip, minHeight: 34, alignSelf: "flex-start", color: "var(--brand-text)", order: 1 }}>+ Pakai contoh personal</button>
              )}
              {list.map(t => {
                const sc = scores.find(x => x.templateId === t.id);
                const missing = missingIn(t.body, data);
                return (
                  <div key={t.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", opacity: blocked ? 0.5 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                      {canEdit && <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} style={{ ...chip, padding: "2px 8px" }}>✎</button>}
                    </div>
                    {sc && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>{sc.sent} terkirim · dibales {pct(sc.responseRate)} · tertarik {pct(sc.winRate)}</div>}
                    <div style={{ fontSize: 12.5, color: "var(--app-sub)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8, flex: 1 }}>{fillTemplate(t.body, data)}</div>
                    {missing.length > 0 && sampleName && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Kosong buat orang ini: {missing.map(k => `{${k}}`).join(", ")}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onPick(t, "copy")} disabled={blocked} style={{ ...chip, flex: 1, minHeight: 40, fontSize: 12, fontWeight: 700, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedId === t.id ? "var(--ok)" : "var(--app-border)"}` }}>
                        {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                      </button>
                      <button onClick={() => onPick(t, "wa")} disabled={blocked} style={{ ...btnWA, flex: 1, minHeight: 40, padding: "8px", fontSize: 12 }}>Kirim WA</button>
                    </div>
                    {copyFail === t.id && <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="tpl-dialog-title" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 520 }}>
            <div id="tpl-dialog-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 16 }}>{editing.id ? "Edit template" : "Template baru"}</div>

            <label htmlFor="tpl-title" style={label}>Judul</label>
            <input id="tpl-title" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="mis. Intro — foto katalog" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />

            <div style={label}>Tahap</div>
            <div role="radiogroup" aria-label="Tahap" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {STAGES.map((s, i) => {
                const on = stageOf(editing) === s.id;
                return (
                  <button key={s.id} role="radio" aria-checked={on} onClick={() => setEditing({ ...editing, stage: s.id })}
                    style={{ ...chip, minHeight: 34, fontWeight: 700, ...(on ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{i + 1}. {s.label}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>
              Dipakai pas: {STAGES.find(s => s.id === stageOf(editing))!.when.toLowerCase()}. {STAGES.find(s => s.id === stageOf(editing))!.tip}
            </div>

            <label htmlFor="tpl-body" style={label}>Isi pesan</label>
            <div role="group" aria-label="Sisipkan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => insert(v.key)} title={v.desc} aria-label={`Sisipkan {${v.key}}: ${v.desc}`}
                  style={{ ...chip, minHeight: 32, fontFamily: "ui-monospace, monospace", color: "var(--brand-text)" }}>{`{${v.key}}`}</button>
              ))}
            </div>
            <textarea ref={body} id="tpl-body" value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })}
              placeholder="Halo {nama}![ Aku liat kamu lagi nyari {kebutuhan}.] …" style={{ ...inputStyle, fontSize: 16, height: 130, resize: "vertical", marginBottom: 8 }} />
            <details style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Apa aja yang bisa dipakai?</summary>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                {VARIABLES.map(v => <li key={v.key}><code>{`{${v.key}}`}</code> — {v.desc}, mis. <i>{v.example}</i></li>)}
                <li>Bagian dalam <code>[ ]</code> ilang sendiri kalau isinya kosong, mis. <code>{"[ buat {waktu}]"}</code>.</li>
                <li>Isinya dibaca dari post orangnya; bisa dibenerin di kartu prospek (✎ Ubah konteks).</li>
              </ul>
            </details>

            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 4 }}>Contoh jadinya{data.nama || data.kebutuhan ? ` buat ${sampleName}` : ""}:</div>
            <div role="status" style={{ fontSize: 13, lineHeight: 1.55, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginBottom: 16, whiteSpace: "pre-wrap", minHeight: 44 }}>
              {editing.body.trim() ? preview(editing.body) : "Tulis pesannya dulu."}
            </div>
            {editing.id && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>Kalau isinya berubah banyak, mending bikin template baru supaya angka evaluasinya ga kecampur.</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={save} disabled={!editing.title.trim() || !editing.body.trim()} style={{ ...btnPrimary, opacity: editing.title.trim() && editing.body.trim() ? 1 : 0.5 }}>Simpan</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>Batal</button>
              {editing.id && (
                <button onClick={async () => { if (confirm(`Hapus template ${editing.title}? Angka DM yang udah kecatat tetap ada.`)) { await deleteDoc(spaceDoc(space, "pitchTemplates", editing.id)); setEditing(null); } }}
                  style={{ ...btnMuted, marginLeft: "auto", background: "transparent", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>Hapus</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
