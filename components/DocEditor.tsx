"use client";

import { useState, type ReactNode } from "react";
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

// Each part of the document is its own card, titled the way the PDF titles it.
function Section({ t, hint, children }: { t: string; hint?: string; children: ReactNode }) {
  return (
    <section style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: 16, marginTop: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", margin: 0, color: "var(--app-text)" }}>{t}</h3>
      {hint && <p style={{ fontSize: 12, color: "var(--app-muted)", margin: "2px 0 0", lineHeight: 1.45 }}>{hint}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

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

  const input = (id: string, l: string, v: string, on: (v: string) => void, ph = "", type = "text", col = "auto") => (
    <div style={{ gridColumn: col, minWidth: 0 }}>
      <label htmlFor={id} style={label}>{l}</label>
      <input id={id} type={type} value={v} onChange={e => on(e.target.value)} placeholder={ph} style={inputStyle} />
    </div>
  );
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 12 } as const;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} aria-label={title} data-own-layout=""
        style={{ ...modalBox, maxWidth: 640, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--app-bg)" }}>
        {/* Header: what this is, and the way out, always in view. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px 20px", background: "var(--app-card)", borderBottom: "1px solid var(--app-border)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 1 }}>Urutannya sama kayak di PDF. Yang kosong ga dicetak.</div>
          </div>
          <button onClick={onClose} aria-label="Tutup" style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--app-border)", background: "var(--app-card)", color: "var(--app-text)", fontSize: 22, lineHeight: 1, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>×</button>
        </div>

        <div style={{ padding: "4px 16px 20px", overflowY: "auto", flex: 1, minHeight: 0, overscrollBehavior: "contain" }}>
          <Section t="Untuk">
            <div style={grid}>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="doc-lead" style={label}>Ambil dari lead</label>
                <select id="doc-lead" value={d.leadId} onChange={e => pickLead(e.target.value)} style={inputStyle}>
                  <option value="">— ketik manual —</option>
                  {leads.slice().sort((a, b) => a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}{l.contact ? ` · ${l.contact}` : ""}</option>)}
                </select>
              </div>
              {input("doc-client", "Nama klien / bisnis", d.leadName, v => set({ leadName: v }), "mis. Kopi Senja")}
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
            </div>
          </Section>

          <Section t="Item & rincian" hint="Rincian = scope of work. Dari Paket, rinciannya ikut.">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {services.length > 0 && (
                <select value="" onChange={e => addService(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }} aria-label="Tambah dari paket">
                  <option value="">+ dari paket…</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} · {rupiah(s.price)}</option>)}
                </select>
              )}
              <button onClick={() => set({ items: [...d.items, { name: "", qty: 1, price: 0 }] })} style={{ ...chip, fontSize: 13, fontWeight: 700, color: "var(--brand-text)", padding: "10px 14px", flex: "0 0 auto" }}>+ item manual</button>
            </div>
            {d.items.length === 0 && <div style={{ fontSize: 13, color: "var(--app-muted)", padding: "4px 0" }}>Belum ada item.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {d.items.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 72px minmax(0, 1fr)", gap: 8, padding: 12, borderRadius: 12, background: "var(--app-inner)" }}>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--app-muted)" }}>Item {i + 1}</span>
                    <button onClick={() => set({ items: d.items.filter((_, n) => n !== i) })} aria-label={`Hapus item ${i + 1}`} style={{ marginLeft: "auto", background: "none", border: "none", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>Hapus</button>
                  </div>
                  <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Nama jasa, mis. Event photography" aria-label="Nama item" />
                  <textarea value={it.description || ""} onChange={e => setItem(i, { description: e.target.value })} aria-label="Rincian item"
                    placeholder={"Rincian, mis. 20 menu, 2 angle per menu, edit warna"} style={{ ...inputStyle, gridColumn: "1 / -1", height: 72, resize: "vertical" }} />
                  <div style={{ fontSize: 12, color: "var(--app-muted)", alignSelf: "center" }}>Harga × qty</div>
                  <input inputMode="numeric" value={it.qty || ""} onChange={e => setItem(i, { qty: num(e.target.value) })} style={{ ...inputStyle, textAlign: "center" }} aria-label="Qty" />
                  <input inputMode="numeric" value={it.price ? it.price.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { price: num(e.target.value) })} style={{ ...inputStyle, textAlign: "right" }} placeholder="Harga" aria-label="Harga" />
                </div>
              ))}
            </div>
          </Section>

          <Section t="Deliverables" hint="Yang klien terima. Satu baris satu poin.">
            <textarea id="doc-deliverables" aria-label="Deliverables" value={d.deliverables || ""} onChange={e => set({ deliverables: e.target.value })}
              placeholder={"Foto event hasil edit\n1 reel recap vertikal\nFoto produk & brand hasil edit"} style={{ ...inputStyle, resize: "vertical", height: 96 }} />
          </Section>

          <Section t="Harga & pembayaran">
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
          </Section>

          <Section t="Catatan untuk klien" hint="Opsional. Hal lain yang belum masuk di atas.">
            <textarea id="doc-notes" aria-label="Catatan untuk klien" value={d.notes} onChange={e => set({ notes: e.target.value })}
              placeholder="mis. Jadwal dan timeline pengiriman final disepakati bersama." style={{ ...inputStyle, resize: "vertical", height: 84 }} />
          </Section>
        </div>

        {/* Footer: the total and the way to save, always in view. */}
        <div style={{ padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid var(--app-border)", background: "var(--app-card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Subtotal {rupiah(subtotal(d.items))}{d.discount ? ` · diskon ${rupiah(d.discount)}` : ""}</span>
            <b style={{ fontSize: 16, color: "var(--ok)" }}>{rupiah(total(d))}</b>
          </div>
          {(missing || err) && <div role="status" style={{ fontSize: 12, marginBottom: 8, color: err ? "color-mix(in srgb, #ff4444 55%, var(--app-text))" : "var(--app-muted)" }}>{err || missing}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ ...btnMuted, flex: "0 0 auto", minHeight: 48 }}>Batal</button>
            <button onClick={save} disabled={!!missing || busy} style={{ ...btnPrimary, flex: 1, minHeight: 48, fontSize: 15, opacity: missing || busy ? 0.5 : 1 }}>{busy ? "Menyimpan…" : "Simpan"}</button>
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
