"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { setDoc } from "firebase/firestore";
import {
  Brief, COMPONENT_KINDS, COMPONENT_UNITS, Component, LineItem, MARGIN_TARGET, QuoteTemplate, Service, Term,
  addDays, costOf, daysBetween, marginOf, rupiah, scheduleSum, subtotal, taxAmount, termAmounts, total,
} from "@/lib/billing";
import { canEditCatalog, spaceDoc, useSpace } from "@/lib/space";
import { marginColor } from "@/components/ComponentCatalog";
import { btnMuted, btnPrimary, chip, font, inputStyle, label, modalBox } from "@/components/ui";
import ConfirmSheet from "@/components/ConfirmSheet";

// One form for a quote and an invoice, in the order the PDF reads (QA 15 Okt:
// "tiap elementnya bisa masuk dengan bagus"): who it's for, what the job is and
// when/where, what's included, what they get, the money, then notes.
// On a wide screen it is a full page (PRD-017 §5): the form on the left, the
// money and the way to save always in view on the right, items as a table.

export interface LeadRef { id: string; name: string; contact: string; phone: string }

export interface DocDraft extends Brief {
  id: string;
  number: string;
  leadId: string;
  leadName: string;
  contact: string;
  phone: string;
  items: LineItem[];
  discount: number;
  dpPercent: number;
  notes: string;
  date: string;
  validUntil?: string;   // quote
  dueDate?: string;      // invoice
  taxPercent?: number;
  schedule?: Term[];     // quote: payment schedule
}

const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;
const pct = (it: LineItem) => (typeof it.cost === "number" && it.price > 0 ? Math.round(((it.price - it.cost) / it.price) * 100) : null);

// An item being edited: `keep` is the component kind to save a manual item as
// ("Simpan ke katalog"); it never reaches the stored document.
type EditItem = LineItem & { keep?: string };

// What stops a save, and the field to take you to.
type Missing = { text: string; at: "doc-client" | "doc-items" | "doc-schedule" } | null;

const WIDE = "(min-width: 1024px)";
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

// Each part of the document is its own card, titled the way the PDF titles it.
function Section({ t, hint, id, children }: { t: string; hint?: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: 16, marginTop: 12, outline: "none" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", margin: 0, color: "var(--app-text)" }}>{t}</h3>
      {hint && <p style={{ fontSize: 12, color: "var(--app-muted)", margin: "2px 0 0", lineHeight: 1.45 }}>{hint}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

const alertStyle = { margin: "6px 0 0", fontSize: 12, fontWeight: 600, color: "var(--hot)" } as const;
const removeStyle = { background: "none", border: "none", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } as const;

export default function DocEditor({ kind, initial, leads, services, components = [], templates = [], onSave, onClose }: {
  kind: "quote" | "invoice";
  initial: DocDraft;
  leads: LeadRef[];
  services: Service[];
  components?: Component[];
  templates?: QuoteTemplate[];
  onSave: (d: DocDraft) => Promise<void>;
  onClose: () => void;
}) {
  const space = useSpace();
  const canKeep = canEditCatalog(space);
  const wide = useWide();
  const [d, setD] = useState<DocDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [added, setAdded] = useState(-1);
  const [tplName, setTplName] = useState<string | null>(null);
  const [tplNote, setTplNote] = useState("");
  const [applied, setApplied] = useState("");
  const itemsRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  // Escape, a tap outside, back, × and Batal all come here: a form with
  // changes asks before throwing them away.
  const close = () => { if (busy) return; if (dirty) setLeaving(true); else onClose(); };
  // A new item opens where you can see it, ready to type.
  useEffect(() => {
    if (added < 0) return;
    const row = itemsRef.current?.children[added] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const name = row?.querySelector<HTMLInputElement>("input");
    if (name && !name.value) name.focus({ preventScroll: true });
    setAdded(-1);
  }, [added]);
  const set = (p: Partial<DocDraft>) => setD(cur => ({ ...cur, ...p }));
  const setItem = (i: number, p: Partial<EditItem>) => set({ items: d.items.map((it, n) => (n === i ? { ...it, ...p } : it)) });
  const margin = marginOf(d);
  const cost = costOf(d.items);
  const sched = d.schedule || [];
  const sum = scheduleSum(sched);
  const missing: Missing = !d.leadName.trim() ? { text: "Isi nama klien dulu.", at: "doc-client" }
    : d.items.length === 0 ? { text: "Tambah minimal satu item.", at: "doc-items" }
    : kind === "quote" && sched.length && sum !== 100 ? { text: `Jadwal pembayaran totalnya ${sum}%, harus 100%.`, at: "doc-schedule" } : null;
  const shout = (at: NonNullable<Missing>["at"]) => tried && missing?.at === at;
  const setTerm = (i: number, p: Partial<Term>) => set({ schedule: sched.map((t, n) => (n === i ? { ...t, ...p } : t)) });
  const title = kind === "quote" ? (d.id ? `Edit ${d.number}` : "Penawaran baru") : (d.id ? `Edit ${d.number}` : "Invoice baru");

  function pickLead(id: string) {
    const l = leads.find(x => x.id === id);
    set(l ? { leadId: l.id, leadName: l.name, contact: l.contact, phone: l.phone } : { leadId: "" });
  }
  function addService(id: string) {
    const s = services.find(x => x.id === id);
    if (s) { set({ items: [...d.items, { name: s.name, qty: 1, price: s.price, ...(s.description?.trim() ? { description: s.description.trim() } : {}), ...(typeof s.cost === "number" ? { cost: s.cost } : {}), serviceId: s.id }] }); setAdded(d.items.length); }
  }
  function addComponent(id: string) {
    const c = components.find(x => x.id === id);
    if (c) { set({ items: [...d.items, { name: c.name, qty: 1, price: c.price, unit: c.unit, cost: c.cost, componentId: c.id, ...(c.vendor ? { vendor: c.vendor } : {}) }] }); setAdded(d.items.length); }
  }
  function addManual() { set({ items: [...d.items, { name: "", qty: 1, price: 0 }] }); setAdded(d.items.length); }
  // A template fills the work and the money; who it's for and when stay.
  function applyTemplate(id: string) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    set({
      items: t.items.map(i => ({ ...i })), deliverables: t.deliverables || "", exclusions: t.exclusions || "", timeline: t.timeline || d.timeline,
      notes: t.notes || d.notes, ...(t.schedule?.length ? { schedule: t.schedule.map(s => ({ ...s })) } : {}), taxPercent: t.taxPercent,
      ...(t.validDays ? { validUntil: addDays(d.date, t.validDays) } : {}),
    });
    setApplied(`Template "${t.name}" dipakai. Klien dan acara tetap.`);
  }
  async function saveTemplate() {
    const name = (tplName || "").trim();
    if (!name) return;
    const id = `qt_${Date.now()}`;
    const doc: Omit<QuoteTemplate, "id"> = { name, items: cleanItems(d.items), createdAt: Date.now() };
    (["deliverables", "exclusions", "timeline"] as const).forEach(k => { const v = (d[k] || "").trim(); if (v) doc[k] = v; });
    if (d.notes.trim()) doc.notes = d.notes.trim();
    if (sched.length) doc.schedule = sched;
    if (d.taxPercent) doc.taxPercent = d.taxPercent;
    if (d.validUntil) { const days = daysBetween(d.date, d.validUntil); if (days > 0) doc.validDays = days; }
    try { await setDoc(spaceDoc(space, "quoteTemplates", id), doc); setTplName(null); setTplNote(`Tersimpan jadi template "${name}".`); }
    catch { setTplNote("Template gagal disimpan. Cek koneksi lalu coba lagi."); }
  }
  async function save() {
    if (busy) return;
    // Saving is always there: when something is missing it takes you to it.
    if (missing) {
      setTried(true);
      const el = document.getElementById(missing.at);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
      return;
    }
    setBusy(true); setErr("");
    try {
      // Manual items ticked "Simpan ke katalog" become components first, so the
      // document remembers which component each came from.
      const items = await Promise.all((d.items as EditItem[]).map(async ({ keep, ...it }) => {
        if (!keep || !it.name.trim() || it.componentId) return it;
        const id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setDoc(spaceDoc(space, "components", id), {
          name: it.name.trim(), kind: keep, unit: it.unit || "pcs", cost: it.cost || 0, price: it.price || 0,
          ...(it.vendor?.trim() ? { vendor: it.vendor.trim() } : {}),
        });
        return { ...it, componentId: id };
      }));
      await onSave({ ...d, items });
    } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); setBusy(false); }
  }

  const input = (id: string, l: string, v: string, on: (v: string) => void, ph = "", type = "text", col = "auto", invalid = false) => (
    <div style={{ gridColumn: col, minWidth: 0 }}>
      <label htmlFor={id} style={label}>{l}</label>
      <input id={id} type={type} value={v} onChange={e => on(e.target.value)} placeholder={ph} style={{ ...inputStyle, ...(invalid ? { borderColor: "var(--hot)" } : {}) }}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-err` : undefined} />
      {invalid && missing && <p id={`${id}-err`} role="alert" style={alertStyle}>{missing.text}</p>}
    </div>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 } as const;

  // The internal part of an item: what it costs you, who you pay, and whether
  // a hand-typed item goes into the catalog.
  const costInput = (it: LineItem, i: number, extra = {}) => (
    <input inputMode="numeric" value={typeof it.cost === "number" ? it.cost.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { cost: e.target.value.trim() ? num(e.target.value) : undefined })}
      style={{ ...inputStyle, textAlign: "right", ...extra }} placeholder="0" aria-label={`Biaya modal per satuan, item ${i + 1}`}
      onKeyDown={e => { if (wide && e.key === "Enter" && i === d.items.length - 1) { e.preventDefault(); addManual(); } }} />
  );
  const vendorInput = (it: LineItem, i: number, ph = "opsional") => (
    <input value={it.vendor || ""} onChange={e => setItem(i, { vendor: e.target.value })} style={inputStyle} placeholder={ph} aria-label={`Vendor, item ${i + 1}`} />
  );
  const keepControls = (it: LineItem, i: number, col: string) => canKeep && !it.componentId && !it.serviceId && (
    <>
      <label style={{ gridColumn: col, display: "flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={!!(it as EditItem).keep} onChange={e => setItem(i, { keep: e.target.checked ? "Vendor" : undefined })} style={{ width: 20, height: 20, accentColor: "#005eb0" }} />
        Simpan ke katalog komponen
      </label>
      {(it as EditItem).keep && <>
        <select value={(it as EditItem).keep} onChange={e => setItem(i, { keep: e.target.value })} style={{ ...inputStyle, gridColumn: wide ? "2 / 4" : "auto" }} aria-label={`Jenis komponen, item ${i + 1}`}>
          {COMPONENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={it.unit || "pcs"} onChange={e => setItem(i, { unit: e.target.value })} style={{ ...inputStyle, gridColumn: wide ? "4 / 6" : "auto" }} aria-label={`Satuan komponen, item ${i + 1}`}>
          {COMPONENT_UNITS.map(u => <option key={u} value={u}>per {u}</option>)}
        </select>
      </>}
    </>
  );

  // Phone: one card per item.
  const itemCard = (it: LineItem, i: number) => (
    <div key={i} style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: 8, padding: "8px 12px 12px", borderRadius: 12, background: "var(--app-inner)" }}>
      <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--app-muted)" }}>Item {i + 1}</span>
        <button onClick={() => set({ items: d.items.filter((_, n) => n !== i) })} aria-label={`Hapus item ${i + 1}`} style={{ ...removeStyle, marginLeft: "auto", padding: "4px 0 4px 12px", minHeight: 32 }}>Hapus</button>
      </div>
      <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Nama jasa, mis. Event photography" aria-label="Nama item" />
      <textarea value={it.description || ""} onChange={e => setItem(i, { description: e.target.value })} aria-label="Rincian item"
        placeholder={"Rincian, mis. 20 menu, 2 angle per menu, edit warna"} style={{ ...inputStyle, gridColumn: "1 / -1", height: 72, resize: "vertical" }} />
      <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--app-muted)", marginBottom: -4 }}>Qty × harga satuan</div>
      <input inputMode="numeric" value={it.qty || ""} onChange={e => setItem(i, { qty: num(e.target.value) })} style={{ ...inputStyle, textAlign: "center" }} aria-label="Qty" />
      <input inputMode="numeric" value={it.price ? it.price.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { price: num(e.target.value) })} style={{ ...inputStyle, textAlign: "right" }} placeholder="Harga" aria-label="Harga" />
      {/* Internal (PRD-017): what it costs you and who you pay. Never printed. */}
      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginTop: 2, padding: "8px 10px 10px", borderRadius: 10, border: "1px dashed var(--app-line-strong)" }}>
        <div className="tabnum" style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--app-muted)" }}>
          <span>Internal · ga dicetak</span>
          {pct(it) !== null && <b style={{ color: marginColor(pct(it)) }}>margin {pct(it)}%</b>}
        </div>
        <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 12, color: "var(--app-muted)" }}>Modal / satuan{costInput(it, i)}</label>
        <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 12, color: "var(--app-muted)" }}>Vendor{vendorInput(it, i)}</label>
        {keepControls(it, i, "1 / -1")}
      </div>
    </div>
  );

  // Wide: one row per item, columns like the PDF's table plus the internal cost.
  const COLS = "minmax(0, 1fr) 64px 124px 124px 116px 44px";
  const itemRow = (it: LineItem, i: number) => (
    <div key={i} role="group" aria-label={`Item ${i + 1}`} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "start", padding: "10px 10px 10px 12px", borderRadius: 12, background: "var(--app-inner)" }}>
      <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={inputStyle} placeholder="Nama jasa, mis. Event photography" aria-label="Nama item" />
      <input inputMode="numeric" value={it.qty || ""} onChange={e => setItem(i, { qty: num(e.target.value) })} style={{ ...inputStyle, textAlign: "center" }} aria-label="Qty" />
      <input inputMode="numeric" value={it.price ? it.price.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { price: num(e.target.value) })} style={{ ...inputStyle, textAlign: "right" }} placeholder="Harga" aria-label="Harga"
        onKeyDown={e => { if (e.key === "Enter" && i === d.items.length - 1) { e.preventDefault(); addManual(); } }} />
      {costInput(it, i, { background: "transparent", borderStyle: "dashed" })}
      <div className="tabnum" style={{ textAlign: "right", paddingTop: 9, fontSize: 13 }}>
        <b>{rupiah((it.qty || 0) * (it.price || 0))}</b>
        {pct(it) !== null && <div style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct(it)) }}>margin {pct(it)}%</div>}
      </div>
      <button onClick={() => set({ items: d.items.filter((_, n) => n !== i) })} aria-label={`Hapus item ${i + 1}`} title="Hapus" style={{ ...removeStyle, width: 44, height: 44, fontSize: 20 }}>×</button>
      <textarea value={it.description || ""} onChange={e => setItem(i, { description: e.target.value })} aria-label="Rincian item"
        placeholder="Rincian (dicetak di bawah nama)" style={{ ...inputStyle, gridColumn: "1 / 2", height: 44, minHeight: 44, resize: "vertical" }} />
      <div style={{ gridColumn: "2 / 4" }}>{vendorInput(it, i, "Vendor (internal)")}</div>
      {keepControls(it, i, "4 / 7")}
    </div>
  );

  // The money, internal margin included, and the schedule it is paid by.
  const summary = (
    <div className="tabnum" style={{ display: "grid", gap: 8, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--app-muted)" }}><span>Subtotal</span><span>{rupiah(subtotal(d.items))}</span></div>
      {d.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--app-muted)" }}><span>Diskon</span><span>−{rupiah(d.discount)}</span></div>}
      {!!d.taxPercent && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--app-muted)" }}><span>Pajak {d.taxPercent}%</span><span>{rupiah(taxAmount(d))}</span></div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8, borderTop: "1px solid var(--app-border)" }}>
        <span style={{ fontWeight: 700 }}>Total</span><b style={{ fontSize: 22, color: "var(--ok)" }}>{rupiah(total(d))}</b>
      </div>
      {margin && cost !== null && (
        <div role="status" aria-label="Margin, internal" style={{ display: "grid", gap: 2, padding: "8px 10px", borderRadius: 10, border: "1px dashed var(--app-line-strong)" }}>
          <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Internal · modal {rupiah(cost)}</span>
          <b style={{ color: marginColor(margin.percent) }}>Margin {rupiah(margin.amount)}{margin.percent !== null ? ` (${margin.percent}%)` : ""}{margin.percent !== null && margin.percent < MARGIN_TARGET ? ` · di bawah ${MARGIN_TARGET}%` : ""}</b>
        </div>
      )}
      {kind === "quote" && sched.length > 0 && (
        <ul aria-label="Jadwal pembayaran" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {sched.map((t, i) => <li key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--app-muted)" }}><span>{t.label || `Termin ${i + 1}`} {t.percent}%</span><span>{rupiah(termAmounts(total(d), sched)[i])}</span></li>)}
        </ul>
      )}
    </div>
  );
  const notice = (missing || err) && <div role="status" style={{ fontSize: 12, color: err || tried ? "var(--hot)" : "var(--app-muted)" }}>{err || missing?.text}</div>;
  const saveButton = <button onClick={save} disabled={busy} style={{ ...btnPrimary, flex: 1, minHeight: 48, fontSize: 15, opacity: busy ? 0.5 : 1 }}>{busy ? "Menyimpan…" : "Simpan"}</button>;

  const sections = (
    <>
      {kind === "quote" && !d.id && templates.length > 0 && (
        <Section t="Mulai dari template" hint="Item, deliverables, di luar scope, dan jadwal bayar ikut. Klien dan acara ga berubah.">
          <select value="" onChange={e => applyTemplate(e.target.value)} style={inputStyle} aria-label="Mulai dari template">
            <option value="">Pilih template…</option>
            {templates.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name} · {t.items.length} item · {rupiah(subtotal(t.items))}</option>)}
          </select>
          {applied && <p role="status" style={{ margin: "8px 0 0", fontSize: 12, color: "var(--app-muted)" }}>{applied}</p>}
        </Section>
      )}

      <Section t="Untuk">
        <div style={grid}>
          <div style={{ gridColumn: "1/-1" }}>
            <label htmlFor="doc-lead" style={label}>Ambil dari lead</label>
            <select id="doc-lead" value={d.leadId} onChange={e => pickLead(e.target.value)} style={inputStyle}>
              <option value="">— ketik manual —</option>
              {leads.slice().sort((a, b) => a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}{l.contact ? ` · ${l.contact}` : ""}</option>)}
            </select>
          </div>
          {input("doc-client", "Nama klien / bisnis", d.leadName, v => set({ leadName: v }), "mis. Kopi Senja", "text", "auto", shout("doc-client"))}
          {input("doc-contact", "Nama kontak (PIC)", d.contact, v => set({ contact: v }), "mis. Dina")}
          {input("doc-phone", "WhatsApp", d.phone, v => set({ phone: v }), "0812…", "tel", "1/-1")}
        </div>
      </Section>

      <Section t="Project / acara" hint="Judulnya jadi baris besar di PDF. Tanggal acara masuk kalender job.">
        <div style={grid}>
          {input("doc-project", "Judul project / acara", d.project || "", v => set({ project: v }), "mis. Foto katalog menu baru", "text", "1/-1")}
          {input("doc-event", "Tanggal acara", d.eventDate || "", v => set({ eventDate: v }), "", "date")}
          {input("doc-time", "Jam", d.eventTime || "", v => set({ eventTime: v }), "mis. 13.30–15.00 WIB")}
          {input("doc-venue", "Lokasi", d.venue || "", v => set({ venue: v }), "mis. Jl. Contoh No. 1, Jakarta", "text", "1/-1")}
          {input("doc-timeline", "Estimasi waktu pengerjaan", d.timeline || "", v => set({ timeline: v }), "mis. File final 7 hari kerja setelah acara", "text", "1/-1")}
        </div>
      </Section>

      <Section id="doc-items" t="Item & rincian" hint={wide ? "Rincian dicetak di bawah nama item. Modal dan vendor internal, ga dicetak. Enter di harga baris terakhir = item baru." : "Rincian = scope of work. Dari Paket, rinciannya ikut."}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {services.length > 0 && (
            <select value="" onChange={e => addService(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }} aria-label="Tambah dari paket">
              <option value="">+ dari paket…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} · {rupiah(s.price)}</option>)}
            </select>
          )}
          {components.length > 0 && (
            <select value="" onChange={e => addComponent(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }} aria-label="Tambah dari komponen">
              <option value="">+ dari komponen…</option>
              {components.slice().sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} · {rupiah(c.price)}/{c.unit}</option>)}
            </select>
          )}
          <button onClick={addManual} style={{ ...chip, fontSize: 13, fontWeight: 700, color: "var(--brand-text)", padding: "10px 14px", flex: "0 0 auto" }}>+ item manual</button>
        </div>
        {shout("doc-items") && <p role="alert" style={{ ...alertStyle, margin: "0 0 8px" }}>{missing?.text}</p>}
        {d.items.length === 0 && <div style={{ fontSize: 13, color: "var(--app-muted)", padding: "4px 0" }}>Belum ada item.</div>}
        {wide && d.items.length > 0 && (
          <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "0 10px 6px 12px", fontSize: 12, fontWeight: 600, color: "var(--app-muted)" }}>
            <span>Item</span><span style={{ textAlign: "center" }}>Qty</span><span style={{ textAlign: "right" }}>Harga satuan</span>
            <span style={{ textAlign: "right" }}>Modal / satuan</span><span style={{ textAlign: "right" }}>Jumlah</span><span />
          </div>
        )}
        <div ref={itemsRef} style={{ display: "flex", flexDirection: "column", gap: wide ? 8 : 10 }}>
          {d.items.map((it, i) => (wide ? itemRow(it, i) : itemCard(it, i)))}
        </div>
      </Section>

      <Section t="Deliverables" hint="Yang klien terima. Satu baris satu poin.">
        <textarea id="doc-deliverables" aria-label="Deliverables" value={d.deliverables || ""} onChange={e => set({ deliverables: e.target.value })}
          placeholder={"Foto event hasil edit\n1 reel recap vertikal\nFoto produk & brand hasil edit"} style={{ ...inputStyle, resize: "vertical", height: 96 }} />
      </Section>

      <Section t="Di luar scope" hint="Opsional. Yang ga termasuk, biar ga jadi salah paham. Satu baris satu poin.">
        <textarea id="doc-exclusions" aria-label="Di luar scope" value={d.exclusions || ""} onChange={e => set({ exclusions: e.target.value })}
          placeholder={"Biaya transport luar kota\nCetak foto\nRevisi di luar jatah"} style={{ ...inputStyle, resize: "vertical", height: 84 }} />
      </Section>

      <Section t="Harga & pembayaran">
        <div style={grid}>
          {input("doc-discount", "Diskon (Rp)", d.discount ? d.discount.toLocaleString("id-ID") : "", v => set({ discount: num(v) }), "0")}
          {input("doc-tax", "Pajak / PPN (%)", d.taxPercent ? String(d.taxPercent) : "", v => set({ taxPercent: Math.min(100, num(v)) || undefined }), "0")}
          {kind === "invoice" && input("doc-dp", "DP (%)", String(d.dpPercent), v => set({ dpPercent: Math.min(100, num(v)) }))}
          {kind === "quote"
            ? input("doc-valid", "Berlaku s/d", d.validUntil || "", v => set({ validUntil: v }), "", "date")
            : <>
                {input("doc-date", "Tanggal invoice", d.date, v => set({ date: v }), "", "date")}
                {input("doc-due", "Jatuh tempo", d.dueDate || "", v => set({ dueDate: v }), "", "date")}
              </>}
        </div>
      </Section>

      {kind === "quote" && (
        <Section id="doc-schedule" t="Jadwal pembayaran" hint="DP, termin, pelunasan. Totalnya 100%. Tiap baris nanti bisa jadi invoice sendiri.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sched.map((t, i) => {
              const amt = termAmounts(total(d), sched)[i];
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0, 1fr) 84px minmax(0, 1.4fr) auto" : "minmax(0, 1fr) 84px", gap: 8, alignItems: "center", padding: "8px 12px 12px", borderRadius: 12, background: "var(--app-inner)" }}>
                  <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--app-muted)" }}>Termin {i + 1} · {rupiah(amt)}</span>
                    {sched.length > 1 && <button onClick={() => set({ schedule: sched.filter((_, n) => n !== i) })} aria-label={`Hapus termin ${i + 1}`} style={{ ...removeStyle, marginLeft: "auto", minHeight: 32 }}>Hapus</button>}
                  </div>
                  <input value={t.label} onChange={e => setTerm(i, { label: e.target.value })} style={inputStyle} placeholder="mis. DP" aria-label={`Nama termin ${i + 1}`} />
                  <input inputMode="numeric" value={t.percent || ""} onChange={e => setTerm(i, { percent: Math.min(100, num(e.target.value)) })} style={{ ...inputStyle, textAlign: "right" }} placeholder="%" aria-label={`Persen termin ${i + 1}`} />
                  <input value={t.when || ""} onChange={e => setTerm(i, { when: e.target.value })} style={{ ...inputStyle, gridColumn: wide ? "auto" : "1 / -1" }} placeholder="Kapan, mis. saat booking" aria-label={`Kapan termin ${i + 1}`} />
                </div>
              );
            })}
            <button onClick={() => set({ schedule: [...sched, { label: "", percent: Math.max(0, 100 - sum), when: "" }] })} style={{ ...chip, alignSelf: "flex-start", fontSize: 13, fontWeight: 700, color: "var(--brand-text)", padding: "10px 14px" }}>+ Termin</button>
            <div className="tabnum" role={shout("doc-schedule") ? "alert" : undefined} style={{ fontSize: 13, color: sum === 100 ? "var(--app-muted)" : "var(--hot)" }}>Total {sum}%{sum === 100 ? "" : " — harus 100%"}</div>
          </div>
        </Section>
      )}

      <Section t="Catatan untuk klien" hint="Opsional. Hal lain yang belum masuk di atas.">
        <textarea id="doc-notes" aria-label="Catatan untuk klien" value={d.notes} onChange={e => set({ notes: e.target.value })}
          placeholder="mis. Jadwal dan timeline pengiriman final disepakati bersama." style={{ ...inputStyle, resize: "vertical", height: 84 }} />
      </Section>

      {kind === "quote" && canKeep && d.items.length > 0 && (
        <Section t="Template" hint="Simpan isi penawaran ini (item dengan modalnya, deliverables, di luar scope, jadwal bayar) buat penawaran berikutnya. Data klien ga ikut.">
          {tplName === null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => { setTplNote(""); setTplName(d.project?.trim() || ""); }} style={{ ...chip, fontSize: 13, fontWeight: 700, color: "var(--brand-text)", padding: "10px 14px" }}>Simpan sebagai template</button>
              {tplNote && <span role="status" style={{ fontSize: 12, color: "var(--app-muted)" }}>{tplNote}</span>}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={tplName} onChange={e => setTplName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveTemplate(); }} autoFocus
                aria-label="Nama template" placeholder="mis. Event 4 jam" style={{ ...inputStyle, flex: "1 1 200px", width: "auto" }} />
              <button onClick={saveTemplate} disabled={!tplName.trim()} style={{ ...btnPrimary, opacity: tplName.trim() ? 1 : 0.5 }}>Simpan template</button>
              <button onClick={() => setTplName(null)} style={btnMuted}>Batal</button>
            </div>
          )}
        </Section>
      )}
    </>
  );

  return (
    <div className="modal-overlay" onClick={close}>
      <div onClick={e => e.stopPropagation()} aria-label={title} data-own-layout=""
        style={wide
          ? { ...modalBox, maxWidth: 1200, width: "calc(100vw - 48px)", height: "calc(100dvh - 48px)", maxHeight: "none", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--app-bg)" }
          : { ...modalBox, maxWidth: 640, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--app-bg)" }}>
        {/* Header: what this is, and the way out, always in view. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 20px", background: "var(--app-card)", borderBottom: "1px solid var(--app-border)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 1 }}>Urutannya sama kayak di PDF. Yang kosong ga dicetak.</div>
          </div>
          <button onClick={close} aria-label="Tutup" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--app-border)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 22, lineHeight: 1, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>×</button>
        </div>

        {wide ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start", padding: "4px 24px 32px" }}>
              <div style={{ minWidth: 0 }}>{sections}</div>
              {/* The money and the way to save, always in view while the form scrolls. */}
              <aside aria-label="Ringkasan" style={{ position: "sticky", top: 12, marginTop: 12, display: "grid", gap: 12, padding: 16, borderRadius: 14, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>
                {summary}
                {notice}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={close} disabled={busy} style={{ ...btnMuted, flex: "0 0 auto", minHeight: 48 }}>Batal</button>
                  {saveButton}
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "4px 16px 20px", overflowY: "auto", flex: 1, minHeight: 0, overscrollBehavior: "contain" }}>{sections}</div>
            {/* Footer: the total and the way to save, always in view. */}
            <div style={{ padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid var(--app-border)", background: "var(--app-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Subtotal {rupiah(subtotal(d.items))}{d.discount ? ` · diskon ${rupiah(d.discount)}` : ""}{d.taxPercent ? ` · pajak ${rupiah(taxAmount(d))}` : ""}</span>
                <b style={{ fontSize: 16, color: "var(--ok)" }}>{rupiah(total(d))}</b>
              </div>
              {margin && cost !== null && (
                <div className="tabnum" role="status" aria-label="Margin, internal" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, marginTop: -6, marginBottom: 10, color: "var(--app-muted)" }}>
                  <span>Internal · modal {rupiah(cost)}</span>
                  <b style={{ color: marginColor(margin.percent) }}>Margin {rupiah(margin.amount)}{margin.percent !== null ? ` (${margin.percent}%)` : ""}{margin.percent !== null && margin.percent < MARGIN_TARGET ? ` · di bawah ${MARGIN_TARGET}%` : ""}</b>
                </div>
              )}
              {notice && <div style={{ marginBottom: 8 }}>{notice}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={close} disabled={busy} style={{ ...btnMuted, flex: "0 0 auto", minHeight: 48 }}>Batal</button>
                {saveButton}
              </div>
            </div>
          </>
        )}
      </div>
      {leaving && (
        <ConfirmSheet title="Buang perubahan?" action="Buang" busyLabel="Membuang…" onConfirm={async () => onClose()} onClose={() => setLeaving(false)}>
          Isian di {d.id ? <b>{d.number}</b> : kind === "quote" ? "penawaran baru ini" : "invoice baru ini"} belum disimpan. Kalau dibuang, hilang.
        </ConfirmSheet>
      )}
    </div>
  );
}

// Brief fields as stored: empty ones left out.
export function briefOf(d: Brief): Brief {
  const out: Brief = {};
  (["project", "eventDate", "eventTime", "venue", "deliverables", "timeline", "exclusions"] as const).forEach(k => { const v = (d[k] || "").trim(); if (v) out[k] = v; });
  return out;
}

export function cleanItems(items: LineItem[]): LineItem[] {
  return items.filter(i => i.name.trim()).map(i => ({
    name: i.name.trim(), qty: i.qty || 1, price: i.price || 0,
    ...(i.description?.trim() ? { description: i.description.trim() } : {}),
    // Internal (PRD-017): kept on the document, never printed.
    ...(i.unit ? { unit: i.unit } : {}),
    ...(typeof i.cost === "number" ? { cost: i.cost } : {}),
    ...(i.vendor?.trim() ? { vendor: i.vendor.trim() } : {}),
    ...(i.componentId ? { componentId: i.componentId } : {}),
    ...(i.serviceId ? { serviceId: i.serviceId } : {}),
  }));
}
