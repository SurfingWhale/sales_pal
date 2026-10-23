"use client";

import Icon from "@/components/Icon";
import { useState } from "react";
import { setDoc, deleteDoc } from "firebase/firestore";
import { canEditCatalog, spaceDoc, useSpace } from "@/lib/space";
import { Business, Component, MARGIN_TARGET, QuoteTemplate, Service, rupiah } from "@/lib/billing";
import BusinessEditor from "@/components/BusinessEditor";
import ComponentCatalog, { marginColor, marginPct } from "@/components/ComponentCatalog";
import ConfirmSheet from "@/components/ConfirmSheet";
import QuoteTemplateList from "@/components/QuoteTemplateList";
import { btnGhost, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

const CATEGORIES = ["F&B", "Photography", "Sports", "Video", "Design", "Other"];
const UNITS = ["per project", "per sesi", "per foto", "per menu", "per bulan", "per jam"];

type Draft = Omit<Service, "price" | "cost"> & { price: string; cost: string };
const BLANK: Draft = { id: "", name: "", category: "F&B", price: "", cost: "", unit: "per project", description: "" };
const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;

export default function Services({ services, components, templates, business }: { services: Service[]; components: Component[]; templates: QuoteTemplate[]; business: Business }) {
  const space = useSpace();
  // In a guild the catalog is the team's: Leader and Officer keep it.
  const canEdit = canEditCatalog(space);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<Business | null>(null);
  const [filter, setFilter] = useState("All");
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const shown = (filter === "All" ? services : services.filter(s => s.category === filter))
    .slice().sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);
  const used = ["All", ...CATEGORIES.filter(c => services.some(s => s.category === c))];

  async function save() {
    if (!editing || !editing.name.trim()) return;
    const id = editing.id || `svc_${Date.now()}`;
    setBusy(true); setErr("");
    try {
      await setDoc(spaceDoc(space, "services", id), {
        name: editing.name.trim(),
        category: editing.category,
        price: num(editing.price),
        unit: editing.unit,
        description: editing.description.trim(),
        // Internal: what one unit costs you. Left out until it is known.
        ...(editing.cost.trim() ? { cost: num(editing.cost) } : {}),
      });
      setEditing(null);
    } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    finally { setBusy(false); }
  }
  function edit(d: Draft) { setErr(""); setEditing(d); }

  async function remove(id: string) {
    await deleteDoc(spaceDoc(space, "services", id));
  }

  const profileReady = business.name && business.bank && business.accountNo;

  return (
    <div className="sp-sell">
      <div className="sp-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={heading}>Paket & Harga</div>
          <div style={subheading}>Daftar jasa yang kamu jual. Dipakai buat nyusun penawaran.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canEdit && <button onClick={() => setProfile(business)} style={btnGhost}>Kop & logo</button>}
          {canEdit && <button onClick={() => edit(BLANK)} style={btnPrimary}>+ Paket</button>}
        </div>
      </div>

      {!profileReady && (
        <div style={{ background: "#ff99000d", border: "1px solid #ff990040", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span><b>Lengkapi info bisnis</b> — nama, WA, dan rekening muncul di penawaran & invoice.</span>
          {canEdit && <button onClick={() => setProfile(business)} style={{ ...chip, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", borderColor: "#ff990060" }}>Isi sekarang</button>}
        </div>
      )}

      {services.length > 0 && (
        <div className="sp-chiprow" role="group" aria-label="Saring kategori" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {used.map(c => (
            <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c}
              style={{ ...chip, background: filter === c ? "#005eb0" : "var(--app-card)", color: filter === c ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {c === "All" ? "Semua" : c}
            </button>
          ))}
        </div>
      )}

      {services.length === 0 ? (
        <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
          <div aria-hidden="true" style={{ width: 52, height: 52, margin: "0 auto 12px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, #005eb0 10%, transparent)", color: "var(--brand-text)" }}><Icon name="receipt" size={26} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada paket</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>{canEdit ? "Tulis paket jasa kamu sekali, pakai terus di tiap penawaran." : "Paket tim diatur Leader atau Officer guild."}</div>
          {canEdit && <button onClick={() => edit(BLANK)} style={btnPrimary}>+ Tambah paket pertama</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {shown.map(s => (
            <div key={s.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--app-muted)", letterSpacing: "1px", fontWeight: 600 }}>{s.category.toUpperCase()}</span>
                {canEdit && <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => edit({ ...s, price: String(s.price), cost: typeof s.cost === "number" ? String(s.cost) : "" })} aria-label={`Edit ${s.name}`} style={{ ...chip, color: "var(--app-text)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="pencil" size={14} />Edit</button>
                  <button onClick={() => setDeleting(s)} aria-label={`Hapus ${s.name}`} title="Hapus" style={{ ...chip, minWidth: 44, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={16} /></button>
                </div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font }}>{s.name}</div>
              <div>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ok)" }}>{rupiah(s.price)}</span>
                <span style={{ fontSize: 12, color: "var(--app-muted)" }}> {s.unit}</span>
              </div>
              {typeof s.cost === "number" && (
                <div className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)" }}>
                  Modal {rupiah(s.cost)} · <b style={{ color: marginColor(marginPct(s.cost, s.price)) }}>margin {marginPct(s.cost, s.price) ?? 0}%</b>
                </div>
              )}
              {s.description && <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.description}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => { if (!busy) setEditing(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 20 }}>{editing.id ? "Edit paket" : "+ Paket baru"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="svc-name" style={label}>Nama paket</label>
                <input id="svc-name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} placeholder="mis. Foto Menu — 10 menu" />
              </div>
              <div>
                <label htmlFor="svc-price" style={label}>Harga (Rp)</label>
                <input id="svc-price" inputMode="numeric" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} style={inputStyle} placeholder="1500000" />
              </div>
              <div>
                <label htmlFor="svc-unit" style={label}>Satuan</label>
                <select id="svc-unit" value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} style={inputStyle}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="svc-cost" style={label}>Biaya modal (Rp)</label>
                <input id="svc-cost" inputMode="numeric" value={editing.cost} onChange={e => setEditing({ ...editing, cost: e.target.value })} style={inputStyle} placeholder="mis. 900000" aria-describedby="svc-cost-hint" />
              </div>
              <div id="svc-cost-hint" role="status" className="tabnum" style={{ alignSelf: "end", fontSize: 12, lineHeight: 1.4, paddingBottom: 10, color: editing.cost.trim() ? marginColor(marginPct(num(editing.cost), num(editing.price))) : "var(--app-muted)" }}>
                {editing.cost.trim() && num(editing.price)
                  ? `Margin ${rupiah(num(editing.price) - num(editing.cost))} (${marginPct(num(editing.cost), num(editing.price))}%)${(marginPct(num(editing.cost), num(editing.price)) ?? 0) < MARGIN_TARGET ? ` · di bawah ${MARGIN_TARGET}%` : ""}`
                  : "Internal, ga dicetak. Kosongin kalau belum tahu."}
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="svc-cat" style={label}>Kategori</label>
                <select id="svc-cat" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="svc-desc" style={label}>Yang didapat klien</label>
                <textarea id="svc-desc" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 90 }} placeholder={"10 foto edit\n1x revisi\nFile resolusi tinggi"} />
              </div>
            </div>
            {(err || !editing.name.trim()) && <div role="status" style={{ fontSize: 12, marginTop: 12, color: err ? "color-mix(in srgb, #ff4444 55%, var(--app-text))" : "var(--app-muted)" }}>{err || "Isi nama paketnya dulu."}</div>}
            <div className="sp-form-foot">
              <button onClick={() => setEditing(null)} disabled={busy} style={btnMuted}>Batal</button>
              <button onClick={save} disabled={!editing.name.trim() || busy} style={{ ...btnPrimary, opacity: editing.name.trim() && !busy ? 1 : 0.5 }}>{busy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      <ComponentCatalog components={components} space={space} canEdit={canEdit} />
      <QuoteTemplateList templates={templates} space={space} canEdit={canEdit} />

      {profile && <BusinessEditor business={profile} onClose={() => setProfile(null)} />}

      {deleting && (
        <ConfirmSheet title="Hapus paket?" onConfirm={() => remove(deleting.id)} onClose={() => setDeleting(null)}>
          <b>{deleting.name}</b> hilang dari daftar paket. Penawaran dan invoice yang udah dibuat ga ikut berubah.
        </ConfirmSheet>
      )}
    </div>
  );
}
