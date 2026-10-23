"use client";

import { useState } from "react";
import { deleteDoc, setDoc } from "firebase/firestore";
import Icon from "@/components/Icon";
import ConfirmSheet from "@/components/ConfirmSheet";
import { COMPONENT_KINDS, COMPONENT_UNITS, Component, MARGIN_TARGET, rupiah } from "@/lib/billing";
import { Space, spaceDoc } from "@/lib/space";
import { btnMuted, btnPrimary, card, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// What a price is built from (PRD-017 §2): your own time, gear, vendors, a
// studio, transport, each with what it costs you and what you charge. Internal:
// none of it is printed or sent to a client. Quotes add items from here.

type Draft = { id: string; name: string; kind: string; unit: string; cost: string; price: string; vendor: string; notes: string };
const BLANK: Draft = { id: "", name: "", kind: "Jasa sendiri", unit: "jam", cost: "", price: "", vendor: "", notes: "" };
const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;
const money = (v: string) => (num(v) ? num(v).toLocaleString("id-ID") : "");

export const marginPct = (cost: number, price: number) => (price ? Math.round(((price - cost) / price) * 100) : null);
export const marginColor = (p: number | null) => (p === null ? "var(--app-muted)" : p < 0 ? "var(--hot)" : p < MARGIN_TARGET ? "var(--warm)" : "var(--ok)");

export default function ComponentCatalog({ components, space, canEdit }: { components: Component[]; space: Space; canEdit: boolean }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Component | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const shown = components.slice().sort((a, b) => COMPONENT_KINDS.indexOf(a.kind as never) - COMPONENT_KINDS.indexOf(b.kind as never) || a.name.localeCompare(b.name));

  async function save() {
    if (!editing || !editing.name.trim()) return;
    const id = editing.id || `cmp_${Date.now()}`;
    setBusy(true); setErr("");
    try {
      await setDoc(spaceDoc(space, "components", id), {
        name: editing.name.trim(), kind: editing.kind, unit: editing.unit,
        cost: num(editing.cost), price: num(editing.price),
        ...(editing.vendor.trim() ? { vendor: editing.vendor.trim() } : {}),
        ...(editing.notes.trim() ? { notes: editing.notes.trim() } : {}),
      });
      setEditing(null);
    } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }

  const draftPct = editing ? marginPct(num(editing.cost), num(editing.price)) : null;

  return (
    <section aria-labelledby="cmp-h" style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 id="cmp-h" style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: font }}>Komponen</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--app-muted)", lineHeight: 1.5 }}>Bahan penyusun harga: jasa sendiri, alat, vendor, studio, transport. Biaya modalnya cuma buat kamu, ga pernah dicetak.</p>
        </div>
        {canEdit && <button onClick={() => { setErr(""); setEditing(BLANK); }} style={btnPrimary}>+ Komponen</button>}
      </div>

      {shown.length === 0 ? (
        <div style={{ ...card, padding: "24px 20px", fontSize: 13, color: "var(--app-muted)", lineHeight: 1.5 }}>
          Belum ada komponen. {canEdit ? "Tambah di sini, atau centang \"Simpan ke katalog\" waktu nulis item manual di penawaran." : "Komponen tim diatur Leader atau Officer guild."}
        </div>
      ) : (
        <ul aria-label="Daftar komponen" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 10 }}>
          {shown.map(c => {
            const p = marginPct(c.cost, c.price);
            return (
              <li key={c.id} style={{ ...card, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", fontWeight: 600 }}>{c.kind} · per {c.unit}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                    {c.vendor && <div style={{ fontSize: 12, color: "var(--app-sub)" }}>Vendor: {c.vendor}</div>}
                  </div>
                  {canEdit && <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setErr(""); setEditing({ id: c.id, name: c.name, kind: c.kind, unit: c.unit, cost: String(c.cost || ""), price: String(c.price || ""), vendor: c.vendor || "", notes: c.notes || "" }); }}
                      aria-label={`Edit ${c.name}`} style={{ ...chip, minWidth: 44, color: "var(--app-text)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="pencil" size={14} /></button>
                    <button onClick={() => setDeleting(c)} aria-label={`Hapus ${c.name}`} style={{ ...chip, minWidth: 44, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={16} /></button>
                  </div>}
                </div>
                <div className="tabnum" style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                  <span>Jual <b>{rupiah(c.price)}</b></span>
                  <span style={{ color: "var(--app-muted)" }}>Modal {rupiah(c.cost)}</span>
                  {p !== null && <span style={{ color: marginColor(p), fontWeight: 700 }}>Margin {p}%</span>}
                </div>
                {c.notes && <div style={{ fontSize: 12, color: "var(--app-sub)", whiteSpace: "pre-wrap" }}>{c.notes}</div>}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => { if (!busy) setEditing(null); }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editing.id ? "Edit komponen" : "Komponen baru"} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 20 }}>{editing.id ? "Edit komponen" : "+ Komponen baru"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="cmp-name" style={label}>Nama</label>
                <input id="cmp-name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} placeholder="mis. Sewa studio Kemang" />
              </div>
              <div>
                <label htmlFor="cmp-kind" style={label}>Jenis</label>
                <select id="cmp-kind" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value })} style={inputStyle}>
                  {COMPONENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cmp-unit" style={label}>Satuan</label>
                <select id="cmp-unit" value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} style={inputStyle}>
                  {COMPONENT_UNITS.map(u => <option key={u} value={u}>per {u}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cmp-cost" style={label}>Biaya modal (Rp)</label>
                <input id="cmp-cost" inputMode="numeric" value={money(editing.cost)} onChange={e => setEditing({ ...editing, cost: e.target.value })} style={inputStyle} placeholder="150.000" />
              </div>
              <div>
                <label htmlFor="cmp-price" style={label}>Harga jual (Rp)</label>
                <input id="cmp-price" inputMode="numeric" value={money(editing.price)} onChange={e => setEditing({ ...editing, price: e.target.value })} style={inputStyle} placeholder="250.000" />
              </div>
              <div role="status" className="tabnum" style={{ gridColumn: "1/-1", fontSize: 12, color: marginColor(draftPct) }}>
                {draftPct === null ? "Isi harga jual buat lihat marginnya." : `Margin ${rupiah(num(editing.price) - num(editing.cost))} per ${editing.unit} (${draftPct}%)${draftPct < MARGIN_TARGET ? ` · di bawah target ${MARGIN_TARGET}%` : ""}`}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="cmp-vendor" style={label}>Vendor (opsional)</label>
                <input id="cmp-vendor" value={editing.vendor} onChange={e => setEditing({ ...editing, vendor: e.target.value })} style={inputStyle} placeholder="mis. Studio Kemang · 0812…" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="cmp-notes" style={label}>Catatan (opsional)</label>
                <textarea id="cmp-notes" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 72 }} placeholder="mis. Minimal sewa 3 jam" />
              </div>
            </div>
            {(err || !editing.name.trim()) && <div role="status" style={{ fontSize: 12, marginTop: 12, color: err ? "color-mix(in srgb, #ff4444 55%, var(--app-text))" : "var(--app-muted)" }}>{err || "Isi nama komponennya dulu."}</div>}
            <div className="sp-form-foot">
              <button onClick={() => setEditing(null)} disabled={busy} style={btnMuted}>Batal</button>
              <button onClick={save} disabled={!editing.name.trim() || busy} style={{ ...btnPrimary, opacity: editing.name.trim() && !busy ? 1 : 0.5 }}>{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmSheet title="Hapus komponen?" onConfirm={() => deleteDoc(spaceDoc(space, "components", deleting.id))} onClose={() => setDeleting(null)}>
          <b>{deleting.name}</b> hilang dari katalog. Penawaran dan invoice yang udah dibuat ga ikut berubah.
        </ConfirmSheet>
      )}
    </section>
  );
}
