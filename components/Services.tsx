"use client";

import { useState } from "react";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Business, Service, rupiah } from "@/lib/billing";
import { btnGhost, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

const CATEGORIES = ["F&B", "Photography", "Sports", "Video", "Design", "Other"];
const UNITS = ["per project", "per sesi", "per foto", "per menu", "per bulan", "per jam"];

type Draft = Omit<Service, "price"> & { price: string };
const BLANK: Draft = { id: "", name: "", category: "F&B", price: "", unit: "per project", description: "" };

export default function Services({ uid, services, business }: { uid: string; services: Service[]; business: Business }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [profile, setProfile] = useState<Business | null>(null);
  const [filter, setFilter] = useState("All");

  const shown = (filter === "All" ? services : services.filter(s => s.category === filter))
    .slice().sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);
  const used = ["All", ...CATEGORIES.filter(c => services.some(s => s.category === c))];

  async function save() {
    if (!editing || !editing.name.trim()) return;
    const id = editing.id || `svc_${Date.now()}`;
    await setDoc(doc(db, "users", uid, "services", id), {
      name: editing.name.trim(),
      category: editing.category,
      price: parseInt(editing.price.replace(/\D/g, ""), 10) || 0,
      unit: editing.unit,
      description: editing.description.trim(),
    });
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm("Hapus paket ini? Penawaran yang udah dibuat nggak ikut berubah.")) return;
    await deleteDoc(doc(db, "users", uid, "services", id));
  }

  async function saveProfile() {
    if (!profile) return;
    await setDoc(doc(db, "users", uid, "settings", "business"), profile);
    setProfile(null);
  }

  const profileReady = business.name && business.bank && business.accountNo;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={heading}>Paket & Harga</div>
          <div style={subheading}>Daftar jasa yang lo jual. Dipakai buat nyusun penawaran.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setProfile(business)} style={btnGhost}>Info bisnis</button>
          <button onClick={() => setEditing(BLANK)} style={btnPrimary}>+ Paket</button>
        </div>
      </div>

      {!profileReady && (
        <div style={{ background: "#ff99000d", border: "1px solid #ff990040", borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span><b>Lengkapi info bisnis</b> — nama, WA, dan rekening muncul di penawaran & invoice.</span>
          <button onClick={() => setProfile(business)} style={{ ...chip, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", borderColor: "#ff990060" }}>Isi sekarang</button>
        </div>
      )}

      {services.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {used.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              style={{ ...chip, background: filter === c ? "#005eb0" : "var(--app-card)", color: filter === c ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {services.length === 0 ? (
        <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>🏷️</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada paket</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Tulis paket jasa lo sekali, pakai terus di tiap penawaran.</div>
          <button onClick={() => setEditing(BLANK)} style={btnPrimary}>+ Tambah paket pertama</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {shown.map(s => (
            <div key={s.id} style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10, color: "var(--app-muted)", letterSpacing: "1px", fontWeight: 600 }}>{s.category.toUpperCase()}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditing({ ...s, price: String(s.price) })} aria-label={`Edit ${s.name}`} style={chip}>✎</button>
                  <button onClick={() => remove(s.id)} aria-label={`Hapus ${s.name}`} style={{ ...chip, borderColor: "#ff444440", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>🗑</button>
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font }}>{s.name}</div>
              <div>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ok)" }}>{rupiah(s.price)}</span>
                <span style={{ fontSize: 11, color: "var(--app-muted)" }}> {s.unit}</span>
              </div>
              {s.description && <div style={{ fontSize: 12, color: "var(--app-sub)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.description}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 20 }}>{editing.id ? "Edit paket" : "+ Paket baru"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Nama paket</label>
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inputStyle} placeholder="mis. Foto Menu — 10 menu" />
              </div>
              <div>
                <label style={label}>Harga (Rp)</label>
                <input inputMode="numeric" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} style={inputStyle} placeholder="1500000" />
              </div>
              <div>
                <label style={label}>Satuan</label>
                <select value={editing.unit} onChange={e => setEditing({ ...editing, unit: e.target.value })} style={inputStyle}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Kategori</label>
                <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} style={inputStyle}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Yang didapat klien</label>
                <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 90 }} placeholder={"10 foto edit\n1x revisi\nFile resolusi tinggi"} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} disabled={!editing.name.trim()} style={{ ...btnPrimary, opacity: editing.name.trim() ? 1 : 0.5 }}>Simpan</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <div className="modal-overlay" onClick={() => setProfile(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 6 }}>Info bisnis</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>Muncul di kop penawaran & invoice, dan di akhir pesan WA.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                ["name", "Nama brand / bisnis", "1/-1"],
                ["phone", "WhatsApp", "auto"],
                ["email", "Email", "auto"],
                ["bank", "Bank", "auto"],
                ["accountNo", "No. rekening", "auto"],
                ["accountName", "Atas nama", "1/-1"],
              ] as [keyof Business, string, string][]).map(([k, l, col]) => (
                <div key={k} style={{ gridColumn: col }}>
                  <label style={label}>{l}</label>
                  <input value={profile[k]} onChange={e => setProfile({ ...profile, [k]: e.target.value })} style={inputStyle} placeholder={l} />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Catatan kaki (syarat & ketentuan)</label>
                <textarea value={profile.footer} onChange={e => setProfile({ ...profile, footer: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 80 }} placeholder="DP tidak dapat dikembalikan. Jadwal dikunci setelah DP masuk." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveProfile} style={btnPrimary}>Simpan</button>
              <button onClick={() => setProfile(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
