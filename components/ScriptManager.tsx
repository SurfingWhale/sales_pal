"use client";

import { useRef, useState } from "react";
import { deleteDoc, deleteField, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSpaceCollection } from "@/lib/billing";
import { canEditCatalog, spaceDoc, useSpace } from "@/lib/space";
import type { PitchTemplate } from "@/lib/hunting";
import { FillData, SAMPLE, STAGES, STARTERS, Stage, VARIABLES, WORKFLOWS, Workflow, brandOf, fillTemplate, stageOf, workflowOf } from "@/lib/templates";
import { CATEGORIES } from "@/lib/leadEdit";
import { SITES } from "@/lib/sites";
import Sheet from "@/components/Sheet";
import { useConfirm } from "@/components/ConfirmSheet";
import { btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";

// Script Management (PRD-022 §4, QA-4 Chat): every script of the workspace in
// one place, by stage, brand and where it's used. Archiving keeps a script out
// of every list without losing it or the numbers behind it.

type View = Stage | "semua" | "arsip";
const stageIndex = (t: PitchTemplate) => STAGES.findIndex(s => s.id === stageOf(t));
const brandName = (id?: string) => SITES.find(s => s.id === id)?.name || "Semua brand";
const useName = (w: Workflow) => WORKFLOWS.find(x => x.id === w)?.label;

const select: React.CSSProperties = { ...inputStyle, minHeight: 44, fontSize: 16 };

export default function ScriptManager({ onClose, startNew, stage, data }: {
  onClose: () => void;
  startNew?: boolean;   // straight to a new script; leaving it closes this too
  stage?: Stage;        // the stage a new script starts on
  data?: FillData;      // who to preview with, when someone's open
}) {
  const space = useSpace();
  const canEdit = canEditCatalog(space);
  const all = useSpaceCollection<PitchTemplate>(space, "pitchTemplates");
  const sample = data?.nama || data?.kebutuhan ? data : SAMPLE;
  const blank = (s: Stage = stage || "intro"): PitchTemplate => ({ id: "", title: "", body: "", stage: s });
  const [editing, setEditing] = useState<PitchTemplate | null>(startNew ? blank() : null);
  const [brand, setBrand] = useState("");
  const [use, setUse] = useState<"" | Workflow>("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("semua");
  const [more, setMore] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [ask, askSheet] = useConfirm();

  const leave = () => { if (startNew) onClose(); else setEditing(null); };
  const ref = (id: string) => spaceDoc(space, "pitchTemplates", id);
  async function run(fn: () => Promise<unknown>) {
    setErr("");
    try { await fn(); setMore(null); } catch { setErr("Gagal menyimpan. Cek koneksi, lalu coba lagi."); }
  }

  const needle = q.trim().toLowerCase();
  const pool = all.filter(t => (!brand || !brandOf(t) || brandOf(t) === brand)
    && (!use || workflowOf(t) === use || workflowOf(t) === "semua")
    && (!needle || `${t.title} ${t.body}`.toLowerCase().includes(needle)));
  const live = pool.filter(t => !t.archived);
  const gone = pool.filter(t => t.archived);
  const list = (view === "arsip" ? gone : view === "semua" ? live : live.filter(t => stageOf(t) === view)).slice()
    .sort((a, b) => stageIndex(a) - stageIndex(b) || Number(!!b.isDefault) - Number(!!a.isDefault) || a.title.localeCompare(b.title));

  const rail: { id: View; word: string; n: number }[] = [
    { id: "semua", word: "Semua", n: live.length },
    ...STAGES.map(s => ({ id: s.id as View, word: s.label, n: live.filter(t => stageOf(t) === s.id).length })),
    { id: "arsip", word: "Arsip", n: gone.length },
  ];

  // One default per stage: it comes first, and the app puts it in by itself.
  function makeDefault(t: PitchTemplate) {
    const b = writeBatch(db);
    all.filter(x => x.isDefault && stageOf(x) === stageOf(t)).forEach(x => b.update(ref(x.id), { isDefault: deleteField() }));
    b.update(ref(t.id), { isDefault: true });
    return b.commit();
  }

  return (
    <Sheet full title={editing ? (editing.id ? "Ubah script" : "Script baru") : "Script pesan"} onClose={onClose}>
      {askSheet}
      {editing ? <ScriptEditor start={editing} sample={sample} onDone={leave} /> : (
        <div className="sp-scripts">
          <div role="group" aria-label="Tahap" className="sp-chiprow sp-scripts-rail" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {rail.map(r => (
              <button key={r.id} type="button" aria-pressed={view === r.id} onClick={() => setView(r.id)}
                style={{ ...chip, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: view === r.id ? 700 : 500, ...(view === r.id ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
                <span>{r.word}</span><span className="tabnum" style={{ opacity: 0.75 }}>{r.n}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <label className="vh" htmlFor="sm-brand">Brand</label>
              <select id="sm-brand" value={brand} onChange={e => setBrand(e.target.value)} style={select}>
                <option value="">Semua brand</option>
                {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="vh" htmlFor="sm-use">Dipakai di</label>
              <select id="sm-use" value={use} onChange={e => setUse(e.target.value as "" | Workflow)} style={select}>
                <option value="">Leads & Hunting</option>
                {WORKFLOWS.filter(w => w.id !== "semua").map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label className="vh" htmlFor="sm-q">Cari script</label>
              <input id="sm-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari script" style={{ ...select, flex: 1, minWidth: 0 }} />
              {canEdit && <button type="button" onClick={() => setEditing(blank(view === "semua" || view === "arsip" ? undefined : view))} style={{ ...btnPrimary, minHeight: 44, flexShrink: 0 }}>Buat script</button>}
            </div>
            {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--hot)" }}>{err}</p>}

            {list.length === 0 ? (
              <div style={{ padding: "24px 4px", display: "grid", gap: 10, justifyItems: "start" }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--app-muted)" }}>{all.length ? "Ga ada script di sini." : "Belum ada script."}</p>
                {canEdit && view !== "semua" && view !== "arsip" && !needle && (
                  <button type="button" onClick={() => run(() => setDoc(ref(`tpl_${Date.now()}`), { ...STARTERS[view], stage: view }))} style={{ ...btnMuted, minHeight: 44 }}>Pakai contoh</button>
                )}
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {list.map(t => (
                  <li key={t.id} style={{ padding: "12px 14px", border: "1px solid var(--app-border)", borderRadius: 16, background: "var(--app-card)" }}>
                    <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600 }}>
                      <span style={{ minWidth: 0 }}>{t.title}</span>
                      {t.isDefault && <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--brand-tint)", color: "var(--brand-text)" }}>Default</span>}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--app-muted)" }}>{[STAGES[stageIndex(t)]?.label, useName(workflowOf(t)), brandName(brandOf(t))].join(" · ")}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.45, color: "var(--app-ink-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fillTemplate(t.body, sample)}</p>
                    {canEdit && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" aria-label={`Ubah ${t.title}`} onClick={() => setEditing(t)} style={{ ...chip, minHeight: 44 }}>Ubah</button>
                        <button type="button" aria-label={`Lainnya: ${t.title}`} aria-expanded={more === t.id} onClick={() => setMore(more === t.id ? null : t.id)} style={{ ...chip, minHeight: 44 }}>Lainnya</button>
                        {more === t.id && (t.archived ? (
                          <>
                            <button type="button" onClick={() => run(() => updateDoc(ref(t.id), { archived: deleteField() }))} style={{ ...chip, minHeight: 44 }}>Balikin</button>
                            <button type="button" onClick={() => ask(`Hapus script ${t.title}?`, "Angka DM yang udah kecatat tetap ada.", () => deleteDoc(ref(t.id)))} style={{ ...chip, minHeight: 44, color: "var(--hot)" }}>Hapus</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => {
                              const { id: _id, isDefault: _isDefault, ...copy } = t;
                              run(() => setDoc(ref(`tpl_${Date.now()}`), { ...copy, title: `${t.title} (salinan)` }));
                            }} style={{ ...chip, minHeight: 44 }}>Duplikat</button>
                            {!t.isDefault && <button type="button" onClick={() => run(() => makeDefault(t))} style={{ ...chip, minHeight: 44 }}>Jadikan default</button>}
                            <button type="button" onClick={() => run(() => updateDoc(ref(t.id), { archived: true, isDefault: deleteField() }))} style={{ ...chip, minHeight: 44 }}>Arsipkan</button>
                          </>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ScriptEditor({ start, sample, onDone }: { start: PitchTemplate; sample: FillData; onDone: () => void }) {
  const space = useSpace();
  // Until it's set here, "Dipakai di" follows what the message says (workflowOf).
  const [t, setT] = useState(start);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const ready = !!t.title.trim() && !!t.body.trim();

  function insert(key: string) {
    const el = body.current;
    const token = `{${key}}`;
    const at = el ? el.selectionStart : t.body.length;
    const end = el ? el.selectionEnd : at;
    setT({ ...t, body: t.body.slice(0, at) + token + t.body.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  }

  async function save() {
    if (!ready || saving) return;
    setSaving(true); setErr("");
    try {
      await setDoc(spaceDoc(space, "pitchTemplates", t.id || `tpl_${Date.now()}`), {
        title: t.title.trim(), body: t.body.trim(), stage: stageOf(t), workflow: workflowOf(t),
        brand: brandOf(t),
        ...(t.categories?.length ? { categories: t.categories } : {}),
        ...(t.isDefault ? { isDefault: true } : {}),
        ...(t.archived ? { archived: true } : {}),
      });
      onDone();
    } catch { setErr("Gagal menyimpan. Cek koneksi, lalu coba lagi."); setSaving(false); }
  }

  const picked = (on: boolean): React.CSSProperties => ({ ...chip, minHeight: 44, fontWeight: 700, ...(on ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) });
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      <div>
        <label htmlFor="tpl-title" style={label}>Nama script</label>
        <input id="tpl-title" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} placeholder="mis. Intro restoran" style={select} />
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div>
          <label htmlFor="tpl-brand" style={label}>Brand</label>
          <select id="tpl-brand" value={brandOf(t)} onChange={e => setT({ ...t, brand: e.target.value })} style={select}>
            <option value="">Semua brand</option>
            {SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tpl-use" style={label}>Dipakai di</label>
          <select id="tpl-use" value={workflowOf(t)} onChange={e => setT({ ...t, workflow: e.target.value as Workflow })} style={select}>
            {WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div style={label}>Tahap</div>
        <div role="radiogroup" aria-label="Tahap" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STAGES.map((s, i) => <button key={s.id} type="button" role="radio" aria-checked={stageOf(t) === s.id} onClick={() => setT({ ...t, stage: s.id })} style={picked(stageOf(t) === s.id)}>{i + 1}. {s.label}</button>)}
        </div>
      </div>
      <div>
        <div style={label}>Buat tipe bisnis <span style={{ fontWeight: 400, color: "var(--app-muted)" }}>(opsional)</span></div>
        <div role="group" aria-label="Buat tipe bisnis" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map(c => {
            const on = !!t.categories?.includes(c);
            return <button key={c} type="button" aria-pressed={on} onClick={() => setT({ ...t, categories: on ? (t.categories || []).filter(x => x !== c) : [...(t.categories || []), c] })} style={picked(on)}>{c}</button>;
          })}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--app-muted)" }}>
          {t.categories?.length ? `Dipilih otomatis duluan buat lead ${t.categories.join(", ")}, dan ga ditawarin ke tipe lain.` : "Kosong = buat semua tipe bisnis."}
        </p>
      </div>
      <div>
        <label htmlFor="tpl-body" style={label}>Isi pesan</label>
        <div role="group" aria-label="Sisipkan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {VARIABLES.map(v => <button key={v.key} type="button" onClick={() => insert(v.key)} title={v.desc} aria-label={`Sisipkan {${v.key}}: ${v.desc}`} style={{ ...chip, minHeight: 44 }}>{`{${v.key}}`}</button>)}
        </div>
        <textarea ref={body} id="tpl-body" value={t.body} onChange={e => setT({ ...t, body: e.target.value })} rows={7} placeholder="Halo {nama}, …" style={{ ...inputStyle, fontSize: 16, lineHeight: 1.5, resize: "vertical" }} />
      </div>
      {t.body.trim() && (
        <div>
          <div style={label}>Pratinjau</div>
          <p style={{ margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--app-inner)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{fillTemplate(t.body, sample)}</p>
        </div>
      )}
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--hot)" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onDone} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>Batal</button>
        <button type="button" disabled={!ready || saving} onClick={save} style={{ ...btnPrimary, flex: 1, minHeight: 48, opacity: ready ? 1 : 0.5 }}>{saving ? "Menyimpan…" : "Simpan"}</button>
      </div>
    </div>
  );
}
