"use client";

import { useState } from "react";
import { Brief, LineItem, Service, rupiah, subtotal, total } from "@/lib/billing";
import { btnMuted, btnPrimary, chip, font, inputStyle, label, modalBox } from "@/components/ui";

// One form for a quote and an invoice, in the order the PDF reads (QA 15 Okt:
// "tiap elementnya bisa masuk dengan bagus"): who it's for, what the job is and
// when/where, what's included, what they get, the money, then notes.

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
}

const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;

export default function DocEditor({ kind, initial, leads, services, onSave, onClose }: {
  kind: "quote" | "invoice";
  initial: DocDraft;
  leads: LeadRef[];
  services: Service[];
  onSave: (d: DocDraft) => Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState<DocDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p: Partial<DocDraft>) => setD(cur => ({ ...cur, ...p }));
  const setItem = (i: number, p: Partial<LineItem>) => set({ items: d.items.map((it, n) => (n === i ? { ...it, ...p } : it)) });
  const missing = !d.leadName.trim() ? "Isi nama klien dulu." : d.items.length === 0 ? "Tambah minimal satu item." : "";
  const title = kind === "quote" ? (d.id ? `Edit ${d.number}` : "Penawaran baru") : (d.id ? `Edit ${d.number}` : "Invoice baru");

  function pickLead(id: string) {
    const l = leads.find(x => x.id === id);
    set(l ? { leadId: l.id, leadName: l.name, contact: l.contact, phone: l.phone } : { leadId: "" });
  }
  function addService(id: string) {
    const s = services.find(x => x.id === id);
    if (s) set({ items: [...d.items, { name: s.name, qty: 1, price: s.price, ...(s.description?.trim() ? { description: s.description.trim() } : {}) }] });
  }
  async function save() {
    if (missing) return;
    setBusy(true); setErr("");
    try { await onSave(d); } catch { setErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); setBusy(false); }
  }

  const section = (t: string, hint?: string) => (
    <div style={{ margin: "22px 0 10px", paddingTop: 14, borderTop: "1px solid var(--app-border)" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
  const input = (id: string, l: string, v: string, on: (v: string) => void, ph = "", type = "text", col = "auto") => (
    <div style={{ gridColumn: col, minWidth: 0 }}>
      <label htmlFor={id} style={label}>{l}</label>
      <input id={id} type={type} value={v} onChange={e => on(e.target.value)} placeholder={ph} style={inputStyle} />
    </div>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 } as const;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} aria-label={title} style={{ ...modalBox, maxWidth: 640, padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 24px 0", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>Urutannya sama kayak di PDF. Yang kosong ga dicetak.</div>

          {section("Untuk")}
          <div style={grid}>
            <div style={{ gridColumn: "1/-1" }}>
              <label htmlFor="doc-lead" style={label}>Ambil dari lead</label>
              <select id="doc-lead" value={d.leadId} onChange={e => pickLead(e.target.value)} style={inputStyle}>
                <option value="">— ketik manual —</option>
                {leads.slice().sort((a, b) => a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}{l.contact ? ` · ${l.contact}` : ""}</option>)}
              </select>
            </div>
            {input("doc-client", "Nama klien / bisnis", d.leadName, v => set({ leadName: v }), "mis. Rona Mekar")}
            {input("doc-contact", "Nama kontak (PIC)", d.contact, v => set({ contact: v }), "mis. Elvira")}
            {input("doc-phone", "WhatsApp", d.phone, v => set({ phone: v }), "0812…", "tel", "1/-1")}
          </div>

          {section("Project / acara", "Judul jadi baris besar di PDF; tanggal acara juga masuk kalender job.")}
          <div style={grid}>
            {input("doc-project", "Judul project / acara", d.project || "", v => set({ project: v }), "mis. Event photography — Halloween Edition", "text", "1/-1")}
            {input("doc-event", "Tanggal acara", d.eventDate || "", v => set({ eventDate: v }), "", "date")}
            {input("doc-time", "Jam", d.eventTime || "", v => set({ eventTime: v }), "mis. 13.30–15.00 WIB")}
            {input("doc-venue", "Lokasi", d.venue || "", v => set({ venue: v }), "mis. Adaya Cafe, Cipete, Jakarta Selatan", "text", "1/-1")}
          </div>

          {section("Item & rincian", "Rincian = scope of work. Dari Paket, rinciannya ikut.")}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {services.length > 0 && (
              <select value="" onChange={e => addService(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }} aria-label="Tambah dari paket">
                <option value="">+ dari paket…</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} · {rupiah(s.price)}</option>)}
              </select>
            )}
            <button onClick={() => set({ items: [...d.items, { name: "", qty: 1, price: 0 }] })} style={chip}>+ item manual</button>
          </div>
          {d.items.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "4px 0 8px" }}>Belum ada item.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.items.map((it, i) => (
              <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: 10, borderRadius: 10, border: "1px solid var(--app-border)" }}>
                <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={{ ...inputStyle, padding: "8px 10px", flex: "1 1 240px", width: "auto", minWidth: 0 }} placeholder="Nama jasa, mis. Event photography" aria-label="Nama item" />
                <input inputMode="numeric" value={it.qty || ""} onChange={e => setItem(i, { qty: num(e.target.value) })} style={{ ...inputStyle, padding: "8px 6px", textAlign: "center", flex: "0 0 56px" }} aria-label="Qty" />
                <input inputMode="numeric" value={it.price ? it.price.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { price: num(e.target.value) })} style={{ ...inputStyle, padding: "8px 10px", textAlign: "right", flex: "1 1 110px", width: "auto", minWidth: 0 }} placeholder="Harga" aria-label="Harga" />
                <button onClick={() => set({ items: d.items.filter((_, n) => n !== i) })} aria-label="Hapus item" style={{ ...chip, padding: "8px 0", flex: "0 0 36px", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", borderColor: "#ff444440" }}>×</button>
                <textarea value={it.description || ""} onChange={e => setItem(i, { description: e.target.value })} aria-label="Rincian item"
                  placeholder={"Rincian, mis.\nFlower workshop, interaksi peserta, candid, suasana acara"} style={{ ...inputStyle, padding: "8px 10px", fontSize: 13, height: 64, resize: "vertical", flex: "1 1 100%" }} />
              </div>
            ))}
          </div>

          {section("Deliverables", "Yang klien terima. Satu baris satu poin.")}
          <textarea id="doc-deliverables" aria-label="Deliverables" value={d.deliverables || ""} onChange={e => set({ deliverables: e.target.value })}
            placeholder={"Foto event hasil edit\n1 reel recap vertikal\nFoto produk & brand hasil edit"} style={{ ...inputStyle, resize: "vertical", height: 84 }} />

          {section("Harga & pembayaran")}
          <div style={grid}>
            {input("doc-discount", "Diskon (Rp)", d.discount ? d.discount.toLocaleString("id-ID") : "", v => set({ discount: num(v) }), "0")}
            {input("doc-dp", "DP (%)", String(d.dpPercent), v => set({ dpPercent: Math.min(100, num(v)) }))}
            {kind === "quote"
              ? input("doc-valid", "Berlaku s/d", d.validUntil || "", v => set({ validUntil: v }), "", "date")
              : <>
                  {input("doc-date", "Tanggal invoice", d.date, v => set({ date: v }), "", "date")}
                  {input("doc-due", "Jatuh tempo", d.dueDate || "", v => set({ dueDate: v }), "", "date")}
                </>}
          </div>

          {section("Catatan untuk klien", "Opsional. Hal lain yang belum masuk di atas.")}
          <textarea id="doc-notes" aria-label="Catatan untuk klien" value={d.notes} onChange={e => set({ notes: e.target.value })}
            placeholder="mis. Jadwal dan timeline pengiriman final disepakati bersama." style={{ ...inputStyle, resize: "vertical", height: 70, marginBottom: 16 }} />
        </div>

        {/* Always in view: the total and the way to save or leave. */}
        <div style={{ padding: "12px 24px 16px", borderTop: "1px solid var(--app-border)", background: "var(--app-card)", borderRadius: "0 0 16px 16px" }}>
          <div style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ color: "var(--app-muted)" }}>Subtotal {rupiah(subtotal(d.items))}{d.discount ? ` · diskon ${rupiah(d.discount)}` : ""}</span>
            <b style={{ color: "var(--ok)" }}>Total {rupiah(total(d))}</b>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={!!missing || busy} style={{ ...btnPrimary, opacity: missing || busy ? 0.5 : 1 }}>Simpan</button>
            <button onClick={onClose} style={btnMuted}>Batal</button>
            <span role="status" style={{ fontSize: 12, color: err ? "color-mix(in srgb, #ff4444 55%, var(--app-text))" : "var(--app-muted)" }}>{err || missing}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Brief fields as stored: empty ones left out.
export function briefOf(d: Brief): Brief {
  const out: Brief = {};
  (["project", "eventDate", "eventTime", "venue", "deliverables"] as const).forEach(k => { const v = (d[k] || "").trim(); if (v) out[k] = v; });
  return out;
}

export function cleanItems(items: LineItem[]): LineItem[] {
  return items.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), qty: i.qty || 1, price: i.price || 0, ...(i.description?.trim() ? { description: i.description.trim() } : {}) }));
}
