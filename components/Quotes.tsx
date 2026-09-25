"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Business, Invoice, LineItem, QUOTE_STATUS, Quote, QuoteStatus, Service,
  addDays, daysBetween, longDate, nextNumber, quoteColor, quoteText, rupiah, subtotal, today, total, waLink, waNumber,
} from "@/lib/billing";
import PrintSheet from "@/components/PrintSheet";
import { badge, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

export interface LeadRef { id: string; name: string; contact: string; phone: string }

type Draft = Omit<Quote, "id" | "number" | "status"> & { id: string; number: string; status: QuoteStatus };

function blank(lead?: LeadRef): Draft {
  const d = today();
  return {
    id: "", number: "", status: "Draft",
    leadId: lead?.id || "", leadName: lead?.name || "", contact: lead?.contact || "", phone: lead?.phone || "",
    items: [], discount: 0, dpPercent: 50, notes: "", date: d, validUntil: addDays(d, 14),
  };
}

export default function Quotes({ uid, quotes, invoices, leads, services, business, startFor, onStarted, onInvoiceCreated }: {
  uid: string;
  quotes: Quote[];
  invoices: Invoice[];
  leads: LeadRef[];
  services: Service[];
  business: Business;
  startFor: LeadRef | null;
  onStarted: () => void;
  onInvoiceCreated: () => void;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [printing, setPrinting] = useState<Quote | null>(null);
  const [copied, setCopied] = useState("");
  const [filter, setFilter] = useState<"All" | QuoteStatus>("All");

  // Opened from a lead's detail: start a quote already addressed to them.
  useEffect(() => {
    if (startFor) { setEditing(blank(startFor)); onStarted(); }
  }, [startFor, onStarted]);

  const sorted = quotes.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const shown = filter === "All" ? sorted : sorted.filter(q => q.status === filter);
  const open = quotes.filter(q => q.status === "Terkirim");
  const won = quotes.filter(q => q.status === "Disetujui");
  const decided = won.length + quotes.filter(q => q.status === "Ditolak").length;

  async function save() {
    if (!editing || !editing.leadName.trim() || editing.items.length === 0) return;
    const id = editing.id || `q_${Date.now()}`;
    const number = editing.number || nextNumber("Q", quotes.map(q => q.number));
    const { id: _id, ...rest } = editing; // eslint-disable-line @typescript-eslint/no-unused-vars
    await setDoc(doc(db, "users", uid, "quotes", id), {
      ...rest,
      number,
      leadName: rest.leadName.trim(),
      items: rest.items.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), qty: i.qty || 1, price: i.price || 0 })),
    });
    setEditing(null);
  }

  async function setStatus(q: Quote, status: QuoteStatus) {
    const patch: Partial<Quote> = { status };
    if (status === "Terkirim" && !q.sentAt) patch.sentAt = today();
    await updateDoc(doc(db, "users", uid, "quotes", q.id), patch);
    // A yes closes the lead, at the value actually agreed.
    if (status === "Disetujui" && q.leadId) {
      await updateDoc(doc(db, "users", uid, "leads", q.leadId), { status: "Closed", value: total(q), lastContact: today() }).catch(() => {});
    }
  }

  async function sendWA(q: Quote) {
    window.open(waLink(q.phone, quoteText(q, business)), "_blank");
    if (q.status === "Draft") await setStatus(q, "Terkirim");
  }

  async function copy(q: Quote) {
    await navigator.clipboard.writeText(quoteText(q, business));
    setCopied(q.id);
    setTimeout(() => setCopied(""), 1800);
  }

  async function remove(q: Quote) {
    if (!confirm(`Hapus penawaran ${q.number}?`)) return;
    await deleteDoc(doc(db, "users", uid, "quotes", q.id));
  }

  async function makeInvoice(q: Quote) {
    const id = `inv_${Date.now()}`;
    const d = today();
    const inv: Omit<Invoice, "id"> = {
      number: nextNumber("INV", invoices.map(i => i.number)),
      quoteId: q.id, leadId: q.leadId, leadName: q.leadName, contact: q.contact, phone: q.phone,
      items: q.items, discount: q.discount, dpPercent: q.dpPercent, notes: q.notes,
      date: d, dueDate: addDays(d, 7), payments: [],
    };
    await setDoc(doc(db, "users", uid, "invoices", id), inv);
    await updateDoc(doc(db, "users", uid, "quotes", q.id), { invoiceId: id });
    onInvoiceCreated();
  }

  function pickLead(id: string) {
    if (!editing) return;
    const l = leads.find(x => x.id === id);
    setEditing(l
      ? { ...editing, leadId: l.id, leadName: l.name, contact: l.contact, phone: l.phone }
      : { ...editing, leadId: "" });
  }

  function addService(id: string) {
    if (!editing) return;
    const s = services.find(x => x.id === id);
    if (!s) return;
    setEditing({ ...editing, items: [...editing.items, { name: s.name, qty: 1, price: s.price }] });
  }

  function setItem(i: number, patch: Partial<LineItem>) {
    if (!editing) return;
    setEditing({ ...editing, items: editing.items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  }

  const num = (v: string) => parseInt(v.replace(/\D/g, ""), 10) || 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={heading}>Penawaran</div>
          <div style={subheading}>Susun dari paket, kirim lewat WA, pantau sampai disetujui.</div>
        </div>
        <button onClick={() => setEditing(blank())} style={btnPrimary}>+ PENAWARAN</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Menunggu jawaban", v: open.length, s: rupiah(open.reduce((a, q) => a + total(q), 0)), c: "#005eb0" },
          { l: "Disetujui", v: won.length, s: rupiah(won.reduce((a, q) => a + total(q), 0)), c: "var(--ok)" },
          { l: "Win rate", v: decided ? `${Math.round((won.length / decided) * 100)}%` : "—", s: `${decided} sudah dijawab`, c: "#a78bfa" },
        ].map(x => (
          <div key={x.l} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: x.c, fontFamily: font }}>{x.v}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 10, color: "var(--app-muted)", marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
      </div>

      {quotes.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(["All", ...QUOTE_STATUS] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ ...chip, background: filter === s ? (s === "All" ? "#005eb0" : quoteColor[s]) : "var(--app-card)", color: filter === s ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {quotes.length === 0 ? (
        <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada penawaran</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>
            {services.length ? "Pilih lead, masukin paket, kirim." : "Isi dulu tab Paket biar penawaran tinggal pilih."}
          </div>
          <button onClick={() => setEditing(blank())} style={btnPrimary}>+ Buat penawaran</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(q => {
            const waiting = q.status === "Terkirim" && q.sentAt ? daysBetween(q.sentAt, today()) : 0;
            const expired = q.status !== "Disetujui" && q.status !== "Ditolak" && q.validUntil < today();
            return (
              <div key={q.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", fontFamily: "monospace" }}>{q.number} · {longDate(q.date)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font, marginTop: 2 }}>{q.leadName}</div>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>
                      {q.items.map(i => i.name).join(", ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ok)" }}>{rupiah(total(q))}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {expired && <span style={badge("#ff9900")}>Kedaluwarsa</span>}
                      {waiting >= 3 && <span style={badge("#ff9900")}>{waiting} hari tanpa jawaban</span>}
                      <span style={badge(quoteColor[q.status])}>{q.status}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  <button onClick={() => sendWA(q)} style={{ ...chip, background: "#25D366", color: "#fff", border: "none", fontWeight: 700 }}>
                    {q.status === "Terkirim" ? "Follow-up WA" : "Kirim WA"}
                  </button>
                  <button onClick={() => copy(q)} style={{ ...chip, color: copied === q.id ? "var(--ok)" : "var(--app-text)" }}>{copied === q.id ? "✓ Tersalin" : "Copy teks"}</button>
                  <button onClick={() => setPrinting(q)} style={chip}>Cetak / PDF</button>
                  <button onClick={() => setEditing({ ...q })} style={chip}>Edit</button>
                  {q.status === "Terkirim" && (
                    <>
                      <button onClick={() => setStatus(q, "Disetujui")} style={{ ...chip, color: "var(--ok)", borderColor: "#00a86260" }}>✓ Disetujui</button>
                      <button onClick={() => setStatus(q, "Ditolak")} style={{ ...chip, color: "#ff4444", borderColor: "#ff444440" }}>✗ Ditolak</button>
                    </>
                  )}
                  {q.status === "Draft" && <button onClick={() => setStatus(q, "Terkirim")} style={chip}>Tandai terkirim</button>}
                  {q.status === "Disetujui" && !q.invoiceId && (
                    <button onClick={() => makeInvoice(q)} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>Buat invoice →</button>
                  )}
                  {q.invoiceId && <span style={{ ...chip, cursor: "default", color: "var(--ok)" }}>Invoice dibuat</span>}
                  <button onClick={() => remove(q)} aria-label={`Hapus ${q.number}`} style={{ ...chip, marginLeft: "auto", color: "#ff4444", borderColor: "#ff444440" }}>🗑</button>
                </div>
                {!waNumber(q.phone) && <div style={{ fontSize: 11, color: "#ff9900", marginTop: 8 }}>Belum ada nomor WA — Kirim WA akan minta pilih kontak.</div>}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 620 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 20 }}>
              {editing.id ? `Edit ${editing.number}` : "+ Penawaran baru"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Lead</label>
                <select value={editing.leadId} onChange={e => pickLead(e.target.value)} style={inputStyle}>
                  <option value="">— ketik manual —</option>
                  {leads.slice().sort((a, b) => a.name.localeCompare(b.name)).map(l => <option key={l.id} value={l.id}>{l.name}{l.contact ? ` · ${l.contact}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Nama klien / bisnis</label>
                <input value={editing.leadName} onChange={e => setEditing({ ...editing, leadName: e.target.value })} style={inputStyle} placeholder="Kopi Senja" />
              </div>
              <div>
                <label style={label}>Nama kontak</label>
                <input value={editing.contact} onChange={e => setEditing({ ...editing, contact: e.target.value })} style={inputStyle} placeholder="Nama PIC" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>WhatsApp</label>
                <input inputMode="tel" value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} style={inputStyle} placeholder="0812…" />
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Item</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {services.length > 0 && (
                  <select value="" onChange={e => addService(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 12 }} aria-label="Tambah dari paket">
                    <option value="">+ dari paket…</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} · {rupiah(s.price)}</option>)}
                  </select>
                )}
                <button onClick={() => setEditing({ ...editing, items: [...editing.items, { name: "", qty: 1, price: 0 }] })} style={chip}>+ item manual</button>
              </div>
            </div>

            {editing.items.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "12px 0" }}>Belum ada item.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {editing.items.map((it, i) => (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <input value={it.name} onChange={e => setItem(i, { name: e.target.value })} style={{ ...inputStyle, padding: "8px 10px", flex: "1 1 260px", width: "auto", minWidth: 0 }} placeholder="Deskripsi" aria-label="Deskripsi item" />
                  <input inputMode="numeric" value={it.qty || ""} onChange={e => setItem(i, { qty: num(e.target.value) })} style={{ ...inputStyle, padding: "8px 6px", textAlign: "center", flex: "0 0 56px" }} aria-label="Qty" />
                  <input inputMode="numeric" value={it.price ? it.price.toLocaleString("id-ID") : ""} onChange={e => setItem(i, { price: num(e.target.value) })} style={{ ...inputStyle, padding: "8px 10px", textAlign: "right", flex: "1 1 110px", width: "auto", minWidth: 0 }} placeholder="Harga" aria-label="Harga" />
                  <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, n) => n !== i) })} aria-label="Hapus item" style={{ ...chip, padding: "8px 0", flex: "0 0 36px", color: "#ff4444", borderColor: "#ff444440" }}>×</button>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 16 }}>
              <div>
                <label style={label}>Diskon (Rp)</label>
                <input inputMode="numeric" value={editing.discount ? editing.discount.toLocaleString("id-ID") : ""} onChange={e => setEditing({ ...editing, discount: num(e.target.value) })} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={label}>DP (%)</label>
                <input inputMode="numeric" value={String(editing.dpPercent)} onChange={e => setEditing({ ...editing, dpPercent: Math.min(100, num(e.target.value)) })} style={inputStyle} />
              </div>
              <div>
                <label style={label}>Berlaku s/d</label>
                <input type="date" value={editing.validUntil} onChange={e => setEditing({ ...editing, validUntil: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={label}>Catatan untuk klien</label>
                <textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} style={{ ...inputStyle, resize: "vertical", height: 70 }} placeholder="Jadwal shoot, lokasi, jumlah revisi…" />
              </div>
            </div>

            <div style={{ background: "var(--app-inner)", borderRadius: 10, padding: 14, marginTop: 16, fontSize: 13, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--app-muted)" }}>
                Subtotal {rupiah(subtotal(editing.items))}{editing.discount ? ` · diskon ${rupiah(editing.discount)}` : ""}
              </span>
              <b style={{ color: "var(--ok)" }}>Total {rupiah(total(editing))}</b>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} disabled={!editing.leadName.trim() || editing.items.length === 0}
                style={{ ...btnPrimary, opacity: !editing.leadName.trim() || editing.items.length === 0 ? 0.5 : 1 }}>SIMPAN</button>
              <button onClick={() => setEditing(null)} style={btnMuted}>BATAL</button>
            </div>
          </div>
        </div>
      )}

      {printing && <PrintSheet kind="quote" data={printing} business={business} onClose={() => setPrinting(null)} />}
    </div>
  );
}

