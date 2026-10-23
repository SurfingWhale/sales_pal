"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { deleteDoc, setDoc } from "firebase/firestore";
import { spaceDoc, useSpace } from "@/lib/space";
import { PitchTemplate, TemplateScore, pct } from "@/lib/hunting";
import { FillData, SAMPLE, STAGES, STARTERS, Stage, VARIABLES, fillTemplate, missingIn, stageOf } from "@/lib/templates";
import Icon from "@/components/Icon";
import { btnMuted, btnPrimary, btnWA, chip, font, inputStyle, label, modalBox } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmSheet";

// The message deck by stage of the conversation (docs/prd/PRD-009 §13): the
// stage that fits this person picked, and every template filled in with what
// their post said (or the workspace's defaults when it didn't say).

export default function TemplateBoard({ templates, scores, data, stage, blocked, copiedId, copyFail, onPick, canEdit, sampleName, send = { how: "wa", label: "Kirim WA" }, extra, newRequest = 0, manage, startNew, onEditDone, editorOnly }: {
  templates: PitchTemplate[]; scores: TemplateScore[]; data: FillData; stage: Stage; blocked: boolean;
  copiedId: string | null; copyFail: string | null; onPick: (t: PitchTemplate, how: "copy" | "wa" | "open") => void;
  // The second button: WhatsApp, or copy and open the DM / post (Hunting decides by platform).
  send?: { how: "wa" | "open"; label: string };
  canEdit: boolean; sampleName: string;
  extra?: ReactNode;                         // the header's tool (Hunting: its + menu)
  newRequest?: number;                       // bumped from outside: open a new template
  manage?: boolean;                          // editing the deck only: no send buttons
  startNew?: boolean;                        // open on a new template (Hunting's + menu, from the list)
  onEditDone?: () => void;                   // the editor closed, saved or not
  editorOnly?: boolean;                      // just the editor, no deck around it
}) {
  const [ask, askSheet] = useConfirm();
  const space = useSpace();
  const [editing, setEditingState] = useState<PitchTemplate | null>(startNew ? { id: "", title: "", body: "", stage } : null);
  const setEditing = (t: PitchTemplate | null) => { setEditingState(t); if (!t) onEditDone?.(); };
  // Long messages show four lines and "Lihat selengkapnya" (QA 15 Okt).
  const [full, setFull] = useState<Set<string>>(new Set());
  const board = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  // The stage that fits, until another chip is tapped; a new person resets it.
  const [picked, setPicked] = useState<Stage | null>(null);
  useEffect(() => setPicked(null), [stage, sampleName]);
  const shown = picked || stage;
  // "Template pesan baru" from Hunting's + menu opens the editor here, on the
  // stage in view: only a new request, never one already answered.
  const answered = useRef(newRequest);
  useEffect(() => {
    if (newRequest === answered.current) return;
    answered.current = newRequest;
    if (newRequest && canEdit) setEditingState({ id: "", title: "", body: "", stage: picked || stage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newRequest]);
  // Keep the picked chip in view, inside the chip row only.
  useEffect(() => {
    const b = board.current;
    const c = b?.querySelector<HTMLElement>(`[data-stage="${shown}"]`);
    if (!b || !c) return;
    const r = b.getBoundingClientRect(), x = c.getBoundingClientRect();
    if (x.left < r.left || x.right > r.right) b.scrollTo({ left: b.scrollLeft + x.left - r.left - 4, behavior: "smooth" });
  }, [shown]);

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

  const s = STAGES.find(x => x.id === shown) || STAGES[0];
  const list = templates.filter(t => stageOf(t) === s.id);
  const si = STAGES.findIndex(x => x.id === s.id);

  return (
    <>
      {askSheet}
      {!editorOnly && <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih pesan</div>
        <div className="sp-tpl-tools" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {extra}
          {canEdit && !extra && <button onClick={() => setEditing({ id: "", title: "", body: "", stage: s.id })} style={chip}>+ Template</button>}
        </div>
      </div>
      {/* One stage at a time (QA 15 Okt: "mesti scroll panjang"): the stages are
          chips, the one that fits this person picked and marked; its messages
          stack below, so the board is never wider than the phone. */}
      <div ref={board} role="tablist" aria-label="Tahap pesan" className="sp-tpl-stages" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4, marginBottom: 6 }}>
        {STAGES.map((x, i) => {
          const n = templates.filter(t => stageOf(t) === x.id).length;
          const sel = x.id === s.id, fit = x.id === stage;
          return (
            <button key={x.id} role="tab" aria-selected={sel} aria-controls="tpl-stage" data-stage={x.id} onClick={() => setPicked(x.id)}
              aria-label={`${i + 1}. ${x.label}, ${n} pesan${fit ? ", cocok sekarang" : ""}`}
              style={{ ...chip, flexShrink: 0, minHeight: 40, fontWeight: 700, whiteSpace: "nowrap",
                ...(sel ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : fit ? { color: "var(--brand-text)", border: "1px solid #005eb0" } : {}) }}>
              {fit && <span aria-hidden="true">● </span>}{i + 1}. {x.label}<span aria-hidden="true" style={{ opacity: 0.75, fontWeight: 600 }}> {n}</span>
            </button>
          );
        })}
      </div>
      <section id="tpl-stage" role="tabpanel" aria-label={`Tahap ${si + 1}: ${s.label}${s.id === stage ? ", cocok sekarang" : ""}`}>
        <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10 }}>
          {s.id === stage ? <b style={{ color: "var(--brand-text)" }}>Cocok sekarang · </b> : null}{s.when}
        </div>
        {list.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--app-muted)", padding: 12, borderRadius: 12, border: "1px dashed var(--app-border)" }}>
            Belum ada template buat tahap ini.
            {canEdit && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <button onClick={() => addStarter(s.id)} style={{ ...chip, minHeight: 34, fontWeight: 700, color: "var(--brand-text)" }}>+ Pakai contoh</button>
                <button onClick={() => setEditing({ id: "", title: "", body: "", stage: s.id })} style={{ ...chip, minHeight: 34 }}>Tulis sendiri</button>
              </div>
            )}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 10, alignItems: "start" }}>
          {list.map(t => {
            const sc = scores.find(x => x.templateId === t.id);
            const missing = missingIn(t.body, data);
            const text = fillTemplate(t.body, data);
            const long = text.length > 160 || text.split("\n").length > 4;
            const open = !long || full.has(t.id);
            return (
              <div key={t.id} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", filter: blocked ? "grayscale(1)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                  {canEdit && <button onClick={() => setEditing(t)} aria-label={`Edit ${t.title}`} title="Edit template" className="sp-icon-btn" style={{ ...chip, flexShrink: 0, minWidth: 32, minHeight: 32, padding: "2px 8px", margin: "-6px -6px 0 0", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="pencil" size={15} /></button>}
                </div>
                {sc && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>{sc.sent} terkirim · dibales {pct(sc.responseRate)} · tertarik {pct(sc.winRate)}</div>}
                <div id={`tpl-text-${t.id}`} style={{ fontSize: 14, color: "var(--app-sub)", lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: long ? 4 : 10,
                  ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }) }}>{text}</div>
                {long && (
                  <button onClick={() => setFull(f => { const n = new Set(f); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                    aria-expanded={open} aria-controls={`tpl-text-${t.id}`}
                    style={{ alignSelf: "flex-start", background: "none", border: 0, padding: "0 0 8px", minHeight: 32, color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {open ? "Ringkas ▴" : "Lihat selengkapnya ▾"}
                  </button>
                )}
                {missing.length > 0 && sampleName && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Kosong buat orang ini: {missing.map(k => `{${k}}`).join(", ")}, bagiannya dilewati.</div>}
                {!manage && <div className="sp-tpl-acts" style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onPick(t, "copy")} disabled={blocked} style={{ ...chip, flex: 1, minHeight: 40, fontSize: 12, fontWeight: 700, color: copiedId === t.id ? "var(--ok)" : "var(--app-text)", border: `1px solid ${copiedId === t.id ? "var(--ok)" : "var(--app-border)"}` }}>
                    {copiedId === t.id ? "✓ Tersalin" : "Copy"}
                  </button>
                  <button onClick={() => onPick(t, send.how)} disabled={blocked}
                    style={{ ...(send.how === "wa" ? btnWA : { ...btnWA, background: "#005eb0", color: "#fff" }), flex: 1, minHeight: 40, padding: "8px", fontSize: 12 }}>{send.label}</button>
                </div>}
                {copyFail === t.id && <div role="status" style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Pilih teks di atas, lalu salin manual.</div>}
              </div>
            );
          })}
        </div>
        {list.length > 0 && canEdit && !list.some(t => t.title === STARTERS[s.id].title) && (
          <button onClick={() => addStarter(s.id)} style={{ ...chip, minHeight: 34, marginTop: 10, color: "var(--brand-text)" }}>+ Pakai contoh personal</button>
        )}
      </section>
      </>}

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
            {(!editing.title.trim() || !editing.body.trim()) && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>Isi judul dan isi pesan dulu buat nyimpen.</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {editing.id && (
                <button onClick={() => { const id = editing.id; ask(`Hapus template ${editing.title}?`, "Angka DM yang udah kecatat tetap ada.", async () => { await deleteDoc(spaceDoc(space, "pitchTemplates", id)); setEditing(null); }); }}
                  style={{ ...btnMuted, minHeight: 44, background: "transparent", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🗑 Hapus</button>
              )}
              <div style={{ display: "flex", gap: 10, marginLeft: "auto", flex: "1 1 220px", justifyContent: "flex-end" }}>
                <button onClick={() => setEditing(null)} style={{ ...btnMuted, flex: 1, maxWidth: 160, minHeight: 44 }}>Batal</button>
                <button onClick={save} disabled={!editing.title.trim() || !editing.body.trim()} style={{ ...btnPrimary, flex: 1, maxWidth: 160, minHeight: 44, opacity: editing.title.trim() && editing.body.trim() ? 1 : 0.5 }}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
