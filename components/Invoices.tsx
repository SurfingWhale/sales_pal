"use client";

import { useState } from "react";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Business, Invoice, InvoiceState, balance, daysBetween, dpAmount, invoiceColor, invoiceState, invoiceText,
  longDate, paid, rupiah, today, total, waLink,
} from "@/lib/billing";
import PrintSheet from "@/components/PrintSheet";
import { badge, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading } from "@/components/ui";

const FILTERS = ["All", "Belum bayar", "DP masuk", "Telat", "Lunas"] as const;

export default function Invoices({ uid, invoices, business }: { uid: string; invoices: Invoice[]; business: Business }) {
  const [paying, setPaying] = useState<{ inv: Invoice; amount: string; date: string; note: string } | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [copied, setCopied] = useState("");

  const now = today();
  const month = now.slice(0, 7);
  const sorted = invoices.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const shown = filter === "All" ? sorted : sorted.filter(i => invoiceState(i, now) === filter);
  const receivable = invoices.reduce((a, i) => a + balance(i), 0);
  const late = invoices.filter(i => invoiceState(i, now) === "Telat");
  const inThisMonth = invoices.flatMap(i => i.payments || []).filter(p => p.date.startsWith(month)).reduce((a, p) => a + p.amount, 0);

  function startPayment(inv: Invoice) {
    const suggested = paid(inv) === 0 && inv.dpPercent ? dpAmount(inv) : balance(inv);
    setPaying({ inv, amount: suggested.toLocaleString("id-ID"), date: now, note: paid(inv) === 0 && inv.dpPercent ? `DP ${inv.dpPercent}%` : "Pelunasan" });
  }

  async function savePayment() {
    if (!paying) return;
    const amount = parseInt(paying.amount.replace(/\D/g, ""), 10) || 0;
    if (!amount) return;
    const payments = [...(paying.inv.payments || []), { date: paying.date, amount, note: paying.note.trim() }];
    await updateDoc(doc(db, "users", uid, "invoices", paying.inv.id), { payments });
    setPaying(null);
  }

  async function undoPayment(inv: Invoice, n: number) {
    if (!confirm("Hapus catatan pembayaran ini?")) return;
    await updateDoc(doc(db, "users", uid, "invoices", inv.id), { payments: inv.payments.filter((_, i) => i !== n) });
  }

  async function setDue(inv: Invoice, dueDate: string) {
    await updateDoc(doc(db, "users", uid, "invoices", inv.id), { dueDate });
  }

  async function copy(inv: Invoice) {
    await navigator.clipboard.writeText(invoiceText(inv, business));
    setCopied(inv.id);
    setTimeout(() => setCopied(""), 1800);
  }

  async function remove(inv: Invoice) {
    if (!confirm(`Hapus invoice ${inv.number}?`)) return;
    await deleteDoc(doc(db, "users", uid, "invoices", inv.id));
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={heading}>Invoice & Pembayaran</div>
        <div style={subheading}>Invoice lahir dari penawaran yang disetujui. Catat DP & pelunasan di sini.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Belum tertagih", v: rupiah(receivable), s: `${invoices.filter(i => balance(i) > 0).length} invoice terbuka`, c: "#ff9900" },
          { l: "Telat bayar", v: late.length, s: rupiah(late.reduce((a, i) => a + balance(i), 0)), c: "#ff4444" },
          { l: "Masuk bulan ini", v: rupiah(inThisMonth), s: "semua pembayaran", c: "var(--ok)" },
        ].map(x => (
          <div key={x.l} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: x.c, fontFamily: font }}>{x.v}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 10, color: "var(--app-muted)", marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
      </div>

      {invoices.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ ...chip, background: filter === s ? (s === "All" ? "#005eb0" : invoiceColor[s as InvoiceState]) : "var(--app-card)", color: filter === s ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {invoices.length === 0 ? (
        <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada invoice</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Tandai penawaran &quot;Disetujui&quot;, lalu tekan &quot;Buat invoice&quot;.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(inv => {
            const st = invoiceState(inv, now);
            const t = total(inv);
            const p = paid(inv);
            const overdue = st === "Telat" ? daysBetween(inv.dueDate, now) : 0;
            return (
              <div key={inv.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", fontFamily: "monospace" }}>{inv.number} · {longDate(inv.date)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font, marginTop: 2 }}>{inv.leadName}</div>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      Jatuh tempo
                      <input type="date" value={inv.dueDate} onChange={e => setDue(inv, e.target.value)} aria-label="Jatuh tempo"
                        style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: 11 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{rupiah(t)}</div>
                    <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>sisa <b style={{ color: balance(inv) ? "#ff9900" : "var(--ok)" }}>{rupiah(balance(inv))}</b></div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {overdue > 0 && <span style={badge("#ff4444")}>{overdue} hari</span>}
                      <span style={badge(invoiceColor[st])}>{st}</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: "var(--app-inner)", borderRadius: 4, height: 6, marginTop: 12 }}>
                  <div style={{ width: `${t ? Math.min(100, (p / t) * 100) : 0}%`, height: "100%", borderRadius: 4, background: invoiceColor[st], transition: "width 0.4s" }} />
                </div>

                {inv.payments?.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {inv.payments.map((pm, n) => (
                      <div key={n} style={{ fontSize: 11, color: "var(--app-muted)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>{longDate(pm.date)}{pm.note ? ` · ${pm.note}` : ""}</span>
                        <span>
                          <b style={{ color: "var(--ok)" }}>+{rupiah(pm.amount)}</b>
                          <button onClick={() => undoPayment(inv, n)} aria-label="Hapus pembayaran" style={{ background: "none", border: "none", color: "var(--app-muted)", cursor: "pointer", marginLeft: 6 }}>×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                  {st !== "Lunas" && (
                    <>
                      <button onClick={() => startPayment(inv)} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>+ Catat pembayaran</button>
                      <button onClick={() => window.open(waLink(inv.phone, invoiceText(inv, business)), "_blank")} style={{ ...chip, background: "#25D366", color: "#fff", border: "none", fontWeight: 700 }}>Tagih via WA</button>
                    </>
                  )}
                  <button onClick={() => copy(inv)} style={{ ...chip, color: copied === inv.id ? "var(--ok)" : "var(--app-text)" }}>{copied === inv.id ? "✓ Tersalin" : "Copy teks"}</button>
                  <button onClick={() => setPrinting(inv)} style={chip}>Cetak / PDF</button>
                  <button onClick={() => remove(inv)} aria-label={`Hapus ${inv.number}`} style={{ ...chip, marginLeft: "auto", color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", borderColor: "#ff444440" }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paying && (
        <div className="modal-overlay" onClick={() => setPaying(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Catat pembayaran</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>{paying.inv.number} · sisa {rupiah(balance(paying.inv))}</div>
            <label style={label}>Jumlah (Rp)</label>
            <input inputMode="numeric" value={paying.amount} onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0; setPaying({ ...paying, amount: n ? n.toLocaleString("id-ID") : "" }); }} style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={label}>Tanggal</label>
            <input type="date" value={paying.date} onChange={e => setPaying({ ...paying, date: e.target.value })} style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={label}>Keterangan</label>
            <input value={paying.note} onChange={e => setPaying({ ...paying, note: e.target.value })} style={inputStyle} placeholder="DP / Pelunasan / Termin 2" />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={savePayment} style={btnPrimary}>Simpan</button>
              <button onClick={() => setPaying(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {printing && <PrintSheet kind="invoice" data={printing} business={business} onClose={() => setPrinting(null)} />}
    </div>
  );
}
