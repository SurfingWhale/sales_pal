"use client";

import { toast } from "@/lib/toast";
import { useEffect, useRef, useState } from "react";
import { deleteDoc, deleteField, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSpaceCollectionLive } from "@/lib/billing";
import { canEditCatalog, spaceDoc, useSpace } from "@/lib/space";
import type { PitchTemplate } from "@/lib/hunting";
import { FillData, SAMPLE, STAGES, STARTERS, Stage, VARIABLES, WORKFLOWS, Workflow, bareNeed, brandOf, fillTemplate, stageOf, workflowOf } from "@/lib/templates";
import { CATEGORIES } from "@/lib/leadEdit";
import { SITES } from "@/lib/sites";
import Sheet from "@/components/Sheet";
import Icon from "@/components/Icon";
import ConfirmSheet, { useConfirm } from "@/components/ConfirmSheet";
import { btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";

// Script Management (PRD-022 §4, QA-4 Chat): every script of the workspace in
// one place, by stage, brand and where it's used. Archiving keeps a script out
// of every list without losing it or the numbers behind it.

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
  const [all, status] = useSpaceCollectionLive<PitchTemplate>(space, "pitchTemplates");
  const sample = data?.nama || data?.kebutuhan ? data : SAMPLE;
  const blank = (s: Stage = stage || "intro"): PitchTemplate => ({ id: "", title: "", body: "", stage: s });
  const [editing, setEditing] = useState<PitchTemplate | null>(startNew ? blank() : null);
  const [brand, setBrand] = useState("");
  const [use, setUse] = useState<"" | Workflow>("");
  const [shelf, setShelf] = useState<"aktif" | "arsip">("aktif");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Stage | "semua">("semua");
  const [menu, setMenu] = useState<PitchTemplate | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [err, setErr] = useState("");
  const [ask, askSheet] = useConfirm();

  // List and editor are two steps (PRD-024 §7): Back or Batal in the editor goes
  // back to the list where it was, or to where it was opened from; ✕ leaves Script
  // pesan. Unsaved typing is never thrown away without asking. On a laptop the
  // list stays beside the editor (master–detail), so the list keeps its place.
  const dirty = useRef(false);
  const top = useRef<HTMLDivElement>(null);
  const scrollAt = useRef(0);
  const [asking, setAsking] = useState<null | (() => void)>(null);
  const scroller = () => top.current?.closest<HTMLElement>(".sp-sheet") || null;
  const guard = (then: () => void) => { if (dirty.current) setAsking(() => then); else then(); };
  const open = (t: PitchTemplate) => guard(() => { if (!editing) scrollAt.current = scroller()?.scrollTop || 0; dirty.current = false; setEditing(t); });
  const leave = () => {
    dirty.current = false;
    if (startNew) { onClose(); return; }
    setEditing(null);
    requestAnimationFrame(() => { const el = scroller(); if (el) el.scrollTop = scrollAt.current; });
  };
  // The question closes first and takes its history entry with it; the editor
  // (or the whole sheet) closes once that step back has landed, one step at a
  // time, so WebKit never gets two dialogs' entries dropped at once.
  const afterBack = (then: () => void) => {
    let done = false;
    const go = () => { if (done) return; done = true; window.removeEventListener("popstate", go); requestAnimationFrame(then); };
    window.addEventListener("popstate", go);
    setTimeout(go, 600);
  };
  const back = () => (editing ? guard(leave) : onClose());
  const shut = () => (editing ? guard(onClose) : onClose());
  const ref = (id: string) => spaceDoc(space, "pitchTemplates", id);
  async function run(fn: () => Promise<unknown>, done?: { text: string; undo?: () => Promise<unknown> }) {
    setErr("");
    // The app's toast: Batal for 10 s like everywhere else (GAP-SCR-2).
    try { await fn(); setMenu(null); if (done) toast(done); } catch { setErr("Gagal menyimpan. Cek koneksi, lalu coba lagi."); }
  }

  const needle = q.trim().toLowerCase();
  const pool = all.filter(t => (!brand || !brandOf(t) || brandOf(t) === brand)
    && (!use || workflowOf(t) === use || workflowOf(t) === "semua")
    && (!needle || `${t.title} ${t.body}`.toLowerCase().includes(needle)));
  const shown = pool.filter(t => (shelf === "arsip" ? !!t.archived : !t.archived));
  const order = (a: PitchTemplate, b: PitchTemplate) => stageIndex(a) - stageIndex(b) || Number(!!b.isDefault) - Number(!!a.isDefault) || a.title.localeCompare(b.title);
  const inStage = (s: Stage) => shown.filter(t => stageOf(t) === s).sort(order);
  const groups = (view === "semua" ? STAGES.map(s => s.id as Stage) : [view]).map(s => ({ stage: s, rows: inStage(s) }));
  const total = shown.length;
  const filters = [
    brand && { key: "brand", word: brandName(brand), clear: () => setBrand("") },
    use && { key: "use", word: useName(use), clear: () => setUse("") },
    shelf === "arsip" && { key: "shelf", word: "Arsip", clear: () => setShelf("aktif") },
  ].filter(Boolean) as { key: string; word: string; clear: () => void }[];
  const clearAll = () => { setBrand(""); setUse(""); setShelf("aktif"); setQ(""); };
  const here = view === "semua" ? null : STAGES.find(s => s.id === view)!;

  // One default per stage: it comes first, and the app puts it in by itself.
  function makeDefault(t: PitchTemplate) {
    const b = writeBatch(db);
    all.filter(x => x.isDefault && stageOf(x) === stageOf(t)).forEach(x => b.update(ref(x.id), { isDefault: deleteField() }));
    b.update(ref(t.id), { isDefault: true });
    return b.commit();
  }
  const duplicate = (t: PitchTemplate) => {
    const { id: _id, isDefault: _isDefault, ...copy } = t;
    return run(() => setDoc(ref(`tpl_${Date.now()}`), { ...copy, title: `${t.title} (salinan)` }), { text: `Disalin: ${t.title} (salinan)` });
  };
  const archive = (t: PitchTemplate) => run(() => updateDoc(ref(t.id), { archived: true, isDefault: deleteField() }),
    { text: `Diarsipkan: ${t.title}`, undo: () => updateDoc(ref(t.id), { archived: deleteField(), ...(t.isDefault ? { isDefault: true } : {}) }) });
  const starters = () => run(async () => {
    const b = writeBatch(db);
    STAGES.forEach((s, i) => b.set(ref(`tpl_${Date.now()}_${i}`), { ...STARTERS[s.id as Stage], stage: s.id }));
    await b.commit();
  }, { text: "6 contoh ditambah, satu per tahap" });

  const counts = Object.fromEntries(STAGES.map(s => [s.id, shown.filter(t => stageOf(t) === s.id).length]));
  const empty = status === "ready" && total === 0;

  return (
    <Sheet full wide title={editing ? (editing.id ? "Ubah script" : "Script baru") : "Script pesan"} onClose={shut} onBack={back}>
      {askSheet}
      {asking && (
        <ConfirmSheet title="Buang perubahan?" action="Buang" busyLabel="Membuang…" onConfirm={async () => { const then = asking; setAsking(null); dirty.current = false; afterBack(then); }} onClose={() => setAsking(null)}>
          Script ini belum disimpan. Kalau dibuang, hilang.
        </ConfirmSheet>
      )}
      <div ref={top} />
      <div className={`sp-sm${editing ? " is-editing" : ""}`}>
        <section className="sp-sm-list" aria-label="Daftar script">
          {/* The lifecycle: the six steps of a sales conversation, in order. */}
          <nav className="sp-life" aria-label="Tahap percakapan">
            <button type="button" data-autofocus className="sp-life-all" aria-pressed={view === "semua"} onClick={() => setView("semua")}>
              <span>Semua</span><span className="tabnum">{total}</span>
            </button>
            <ol className="sp-life-steps">
              {STAGES.map((s, i) => (
                <li key={s.id}>
                  <button type="button" aria-pressed={view === s.id} aria-label={`${i + 1}. ${s.label}, ${counts[s.id]} script`} onClick={() => setView(s.id as Stage)}>
                    <span className="sp-life-dot" aria-hidden="true">{i + 1}</span>
                    <span className="sp-life-name">{s.label}</span>
                    <span className="sp-life-n tabnum" aria-hidden="true">{counts[s.id]}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="sp-sm-tools">
            <label className="sp-ksearch" style={{ flex: 1, minWidth: 0 }}>
              <Icon name="search" size={16} />
              <span className="vh">Cari script</span>
              <input id="sm-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari script" />
            </label>
            <button type="button" className="sp-sm-tool" aria-label={filters.length ? `Filter, ${filters.length} aktif` : "Filter"} onClick={() => setFiltering(true)}>
              <Icon name="sliders" size={18} />
              <span className="sp-sm-tool-word">Filter</span>
              {filters.length > 0 && <span className="sp-sm-badge tabnum">{filters.length}</span>}
            </button>
            {canEdit && (
              <button type="button" className="sp-sm-new" aria-label="Buat script" onClick={() => open(blank(view === "semua" ? undefined : view))}>
                <Icon name="plus" size={18} /><span>Baru</span>
              </button>
            )}
          </div>
          {filters.length > 0 && (
            <div className="sp-sm-active" role="group" aria-label="Filter aktif">
              {filters.map(f => (
                <button key={f.key} type="button" aria-label={`Hapus filter ${f.word}`} onClick={f.clear}>{f.word}<Icon name="close" size={12} /></button>
              ))}
            </div>
          )}
          {err && <p role="alert" className="sp-sm-err">{err}</p>}

          {here && (
            <p className="sp-sm-when"><b>{here.when}.</b> {here.tip}</p>
          )}

          {status === "loading" && (
            <ul className="sp-sm-rows" aria-busy="true" aria-label="Memuat script">
              {[0, 1, 2].map(i => <li key={i} className="sp-sm-skel" aria-hidden="true"><span /><span /><span /></li>)}
            </ul>
          )}
          {status === "error" && <p role="alert" className="sp-sm-err">Script ga kebaca. Cek koneksi, nanti muncul sendiri.</p>}

          {empty && (
            all.length === 0 ? (
              <div className="sp-sm-empty">
                <p className="sp-sm-empty-h">Belum ada script.</p>
                <p>Script itu pesan yang tinggal kamu isi nama orangnya. Mulai dari enam contoh, satu per tahap, lalu ubah sesuai gayamu.</p>
                {canEdit && <div className="sp-sm-empty-acts"><button type="button" onClick={starters} style={{ ...btnPrimary, minHeight: 44 }}>Pakai 6 contoh</button><button type="button" onClick={() => open(blank())} style={{ ...btnMuted, minHeight: 44 }}>Tulis sendiri</button></div>}
              </div>
            ) : (needle || filters.length) ? (
              <div className="sp-sm-empty">
                <p className="sp-sm-empty-h">{needle ? `Ga ada script yang cocok sama “${q.trim()}”.` : "Ga ada script buat filter ini."}</p>
                <div className="sp-sm-empty-acts"><button type="button" onClick={clearAll} style={{ ...btnMuted, minHeight: 44 }}>Hapus pencarian & filter</button></div>
              </div>
            ) : null
          )}

          {status === "ready" && total > 0 && groups.map(g => {
            const s = STAGES.find(x => x.id === g.stage)!;
            const i = STAGES.indexOf(s);
            if (view === "semua" && !g.rows.length) return null;
            return (
              <section key={g.stage} className="sp-sm-group" aria-label={`${i + 1}. ${s.label}`}>
                {view === "semua" && (
                  <h3 className="sp-sm-group-h"><span className="sp-life-dot is-on" aria-hidden="true">{i + 1}</span>{s.label}<span className="sp-sm-group-when">{s.when}</span></h3>
                )}
                {g.rows.length === 0 ? (
                  <div className="sp-sm-empty">
                    <p className="sp-sm-empty-h">{shelf === "arsip" ? `Ga ada script ${s.label} yang diarsipkan.` : `Belum ada script ${s.label}.`}</p>
                    {canEdit && shelf === "aktif" && !needle && (
                      <div className="sp-sm-empty-acts">
                        <button type="button" onClick={() => run(() => setDoc(ref(`tpl_${Date.now()}`), { ...STARTERS[g.stage], stage: g.stage }), { text: `Contoh ${s.label} ditambah` })} style={{ ...btnMuted, minHeight: 44 }}>Pakai contoh</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="sp-sm-rows">
                    {g.rows.map(t => (
                      <li key={t.id} className={`sp-sm-row${editing?.id === t.id ? " is-on" : ""}`}>
                        <button type="button" className="sp-sm-main" aria-label={canEdit ? `Ubah ${t.title}` : t.title} aria-current={editing?.id === t.id ? "true" : undefined}
                          onClick={() => (canEdit ? open(t) : setMenu(t))}>
                          <span className="sp-sm-title">
                            <span>{t.title}</span>
                            {t.isDefault && <span className="sp-sm-pill">Default</span>}
                          </span>
                          <span className="sp-sm-meta">{[useName(workflowOf(t)), brandName(brandOf(t))].join(" · ")}</span>
                          <span className="sp-sm-preview">{fillTemplate(t.body, sample)}</span>
                        </button>
                        {canEdit && (
                          <button type="button" className="sp-sm-more" aria-label={`Lainnya: ${t.title}`} aria-haspopup="dialog" onClick={() => setMenu(t)}>
                            <span aria-hidden="true">⋯</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </section>

        {editing && (
          <section className="sp-sm-detail" aria-label={editing.id ? `Ubah ${editing.title}` : "Script baru"}>
            <ScriptEditor key={editing.id || "new"} start={editing} sample={sample} onDone={leave} onCancel={back} onDirty={d => { dirty.current = d; }} />
          </section>
        )}
      </div>

      {menu && (
        <Sheet title={menu.title} onClose={() => setMenu(null)}>
          <p className="sp-sm-meta" style={{ margin: "-8px 0 8px" }}>{[STAGES[stageIndex(menu)]?.label, useName(workflowOf(menu)), brandName(brandOf(menu))].join(" · ")}</p>
          <div className="sp-acts" role="group" aria-label={`Aksi untuk ${menu.title}`}>
            {canEdit && !menu.archived && <button type="button" onClick={() => { const t = menu; setMenu(null); open(t); }}><Icon name="pencil" size={18} />Ubah</button>}
            {canEdit && !menu.archived && <button type="button" onClick={() => duplicate(menu)}><Icon name="doc" size={18} />Duplikat</button>}
            {canEdit && !menu.archived && !menu.isDefault && <button type="button" onClick={() => run(() => makeDefault(menu), { text: `${menu.title} jadi default ${STAGES[stageIndex(menu)]?.label}` })}><Icon name="bolt" size={18} />Jadikan default<span className="sp-acts-hint">Dipakai otomatis di tahap ini</span></button>}
            {canEdit && !menu.archived && <button type="button" onClick={() => archive(menu)}><Icon name="clipboard" size={18} />Arsipkan<span className="sp-acts-hint">Disembunyiin, angkanya tetap</span></button>}
            {canEdit && menu.archived && <button type="button" onClick={() => run(() => updateDoc(ref(menu.id), { archived: deleteField() }), { text: `Dibalikin: ${menu.title}` })}><Icon name="undo" size={18} />Balikin</button>}
            {canEdit && menu.archived && <button type="button" className="is-danger" onClick={() => { const t = menu; setMenu(null); ask(`Hapus script ${t.title}?`, "Hilang permanen. Angka DM yang udah kecatat tetap ada.", () => deleteDoc(ref(t.id))); }}><Icon name="trash" size={18} />Hapus permanen</button>}
          </div>
          {!canEdit && <p className="sp-sm-preview" style={{ whiteSpace: "pre-wrap", WebkitLineClamp: "unset" }}>{fillTemplate(menu.body, sample)}</p>}
          <button type="button" onClick={() => setMenu(null)} style={{ ...btnMuted, width: "100%", minHeight: 48, marginTop: 12 }}>Batal</button>
        </Sheet>
      )}

      {filtering && (
        <Sheet title="Filter script" onClose={() => setFiltering(false)}>
          <fieldset className="sp-radios">
            <legend>Brand</legend>
            {[{ id: "", name: "Semua brand" }, ...SITES].map(s => (
              <label key={s.id || "all"}><input type="radio" name="sm-brand" checked={brand === s.id} onChange={() => setBrand(s.id)} />{s.name}</label>
            ))}
          </fieldset>
          <fieldset className="sp-radios">
            <legend>Dipakai di</legend>
            {[{ id: "", label: "Leads & Hunting" }, ...WORKFLOWS.filter(w => w.id !== "semua")].map(w => (
              <label key={w.id || "all"}><input type="radio" name="sm-use" checked={use === w.id} onChange={() => setUse(w.id as "" | Workflow)} />{w.label}</label>
            ))}
          </fieldset>
          <fieldset className="sp-radios">
            <legend>Tampilkan</legend>
            <label><input type="radio" name="sm-shelf" checked={shelf === "aktif"} onChange={() => setShelf("aktif")} />Script aktif</label>
            <label><input type="radio" name="sm-shelf" checked={shelf === "arsip"} onChange={() => setShelf("arsip")} />Arsip<span className="sp-acts-hint">{all.filter(t => t.archived).length}</span></label>
          </fieldset>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => { setBrand(""); setUse(""); setShelf("aktif"); }} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>Reset</button>
            <button type="button" onClick={() => setFiltering(false)} style={{ ...btnPrimary, flex: 1, minHeight: 48 }}>Lihat {total} script</button>
          </div>
        </Sheet>
      )}

    </Sheet>
  );
}

function ScriptEditor({ start, sample, onDone, onCancel, onDirty }: { start: PitchTemplate; sample: FillData; onDone: () => void; onCancel: () => void; onDirty: (dirty: boolean) => void }) {
  const space = useSpace();
  // Until it's set here, "Dipakai di" follows what the message says (workflowOf).
  const [t, setT] = useState(start);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const ready = !!t.title.trim() && !!t.body.trim();
  // While it saves, nothing is unsaved: tapping another script then doesn't ask to throw it away.
  useEffect(() => { onDirty(!saving && JSON.stringify(t) !== JSON.stringify(start)); }, [t, start, saving, onDirty]);

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
      toast({ text: `Script "${t.title.trim()}" disimpan` });   // GAP-SCR-1
      onDone();
    } catch { setErr("Gagal menyimpan. Cek koneksi, lalu coba lagi."); setSaving(false); }
  }

  const picked = (on: boolean): React.CSSProperties => ({ ...chip, minHeight: 44, fontWeight: 700, ...(on ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) });
  return (
    <div className="sp-script-edit" style={{ display: "grid", gap: 12, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
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
      </div>
      <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
      <div>
        <label htmlFor="tpl-body" style={label}>Isi pesan</label>
        <div role="group" aria-label="Sisipkan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {VARIABLES.map(v => <button key={v.key} type="button" onClick={() => insert(v.key)} title={v.desc} aria-label={`Sisipkan {${v.key}}: ${v.desc}`} style={{ ...chip, minHeight: 44 }}>{`{${v.key}}`}</button>)}
        </div>
        <textarea ref={body} id="tpl-body" value={t.body} onChange={e => setT({ ...t, body: e.target.value })} rows={9} placeholder="Halo {nama}, …" style={{ ...inputStyle, fontSize: 16, lineHeight: 1.5, resize: "vertical" }} />
      </div>
      {bareNeed(t.body) && (
        <p role="note" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--app-muted)" }}>
          <code>{"{kebutuhan}"}</code> diisi dari yang orangnya bilang (post atau data lead). Kalau belum ada, kalimatnya dilewati. Buat yang kamu tawarkan, pakai <code>{"{tawaran}"}</code>.
        </p>
      )}
      {t.body.trim() && (
        <div>
          <div style={label}>Pratinjau</div>
          <p style={{ margin: 0, padding: "10px 12px", borderRadius: 12, background: "var(--app-inner)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{fillTemplate(t.body, sample)}</p>
        </div>
      )}
      {err && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--hot)" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>Batal</button>
        <button type="button" disabled={!ready || saving} onClick={save} style={{ ...btnPrimary, flex: 1, minHeight: 48, opacity: ready ? 1 : 0.5 }}>{saving ? "Menyimpan…" : "Simpan"}</button>
      </div>
      </div>
    </div>
  );
}
