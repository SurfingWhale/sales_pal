"use client";

import { useState } from "react";
import { deleteDoc, setDoc, updateDoc } from "firebase/firestore";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import {
  Business, Invoice, InvoiceState, Service, addDays, balance, nextNumber, daysBetween, dpAmount, invoiceColor, invoiceState, invoiceText,
  longDate, paid, rupiah, today, total, waLink,
} from "@/lib/billing";
import PrintSheet from "@/components/PrintSheet";
import DocEditor, { DocDraft, LeadRef, briefOf, cleanItems } from "@/components/DocEditor";
import { badge, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading, WA_INK } from "@/components/ui";

const FILTERS = ["All", "Belum bayar", "DP masuk", "Telat", "Lunas"] as const;

export default function Invoices({ invoices, business, leads, services }: { invoices: Invoice[]; business: Business; leads: LeadRef[]; services: Service[] }) {
  const space = useSpace();
  const [editing, setEditing] = useState<DocDraft | null>(null);
  const [paying, setPaying] = useState<{ inv: Invoice; amount: string; date: string; note: string } | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [copied, setCopied] = useState("");
  const [showIn, setShowIn] = useState(false);
  const [moving, setMoving] = useState<{ id: string; n: number } | null>(null);

  const now = today();
  const month = now.slice(0, 7);
  const sorted = invoices.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const shown = filter === "All" ? sorted : sorted.filter(i => invoiceState(i, now) === filter);
  const receivable = invoices.reduce((a, i) => a + balance(i), 0);
  const late = invoices.filter(i => invoiceState(i, now) === "Telat");
  // Money counts in the month it arrived: the payment's own date, never the invoice's.
  const inRows = invoices.flatMap(i => (i.payments || []).map((p, n) => ({ inv: i, p, n }))).filter(r => r.p.date.startsWith(month))
    .sort((a, b) => b.p.date.localeCompare(a.p.date));
  const inThisMonth = inRows.reduce((a, r) => a + r.p.amount, 0);
  const monthName = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { month: "long" });

  function startPayment(inv: Invoice) {
    const suggested = paid(inv) === 0 && inv.dpPercent ? dpAmount(inv) : balance(inv);
    setPaying({ inv, amount: suggested.toLocaleString("id-ID"), date: now, note: paid(inv) === 0 && inv.dpPercent ? `DP ${inv.dpPercent}%` : "Pelunasan" });
  }

  async function savePayment() {
    if (!paying) return;
    const amount = parseInt(paying.amount.replace(/\D/g, ""), 10) || 0;
    if (!amount) return;
    const payments = [...(paying.inv.payments || []), { date: paying.date, amount, note: paying.note.trim() }];
    await updateDoc(spaceDoc(space, "invoices", paying.inv.id), { payments });
    setPaying(null);
  }

  async function undoPayment(inv: Invoice, n: number) {
    if (!confirm("Hapus catatan pembayaran ini?")) return;
    await updateDoc(spaceDoc(space, "invoices", inv.id), { payments: inv.payments.filter((_, i) => i !== n) });
  }

  async function setDue(inv: Invoice, dueDate: string) {
    await updateDoc(spaceDoc(space, "invoices", inv.id), { dueDate });
  }

  async function setEvent(inv: Invoice, eventDate: string) {
    await updateDoc(spaceDoc(space, "invoices", inv.id), { eventDate });
  }

  async function movePayment(inv: Invoice, n: number, date: string) {
    if (!date) return;
    await updateDoc(spaceDoc(space, "invoices", inv.id), { payments: inv.payments.map((p, i) => (i === n ? { ...p, date } : p)) });
    setMoving(null);
  }

  async function copy(inv: Invoice) {
    await navigator.clipboard.writeText(invoiceText(inv, business));
    setCopied(inv.id);
    setTimeout(() => setCopied(""), 1800);
  }

  // A closing without a quote gets its invoice straight away; any invoice can be fixed later.
  function startNew() {
    const d = today();
    setEditing({ id: "", number: "", leadId: "", leadName: "", contact: "", phone: "", items: [], discount: 0, dpPercent: 50, notes: "", date: d, dueDate: addDays(d, 7) });
  }

  async function saveInvoice(d: DocDraft) {
    const old = invoices.find(i => i.id === d.id);
    const id = d.id || `inv_${Date.now()}`;
    const doc: Omit<Invoice, "id"> = {
      number: d.number || nextNumber("INV", invoices.map(i => i.number)),
      quoteId: old?.quoteId || "", leadId: d.leadId, leadName: d.leadName.trim(), contact: d.contact.trim(), phone: d.phone.trim(),
      items: cleanItems(d.items), discount: d.discount, dpPercent: d.dpPercent, notes: d.notes.trim(),
      date: d.date, dueDate: d.dueDate || addDays(d.date, 7), payments: old?.payments || [],
      ...briefOf(d),
    };
    await setDoc(spaceDoc(space, "invoices", id), stamp(space, doc, old as { ownerUid?: string; ownerName?: string } | undefined));
    setEditing(null);
  }

  async function remove(inv: Invoice) {
    if (!confirm(`Hapus invoice ${inv.number}?`)) return;
    await deleteDoc(spaceDoc(space, "invoices", inv.id));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={heading}>Invoice & Pembayaran</div>
          <div style={subheading}>Dari penawaran yang disetujui, atau langsung kalau udah closing. Catat DP & pelunasan di sini.</div>
        </div>
        <button onClick={startNew} style={btnPrimary}>+ Invoice</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Belum tertagih", v: rupiah(receivable), s: `${invoices.filter(i => balance(i) > 0).length} invoice terbuka`, c: "#ff9900" },
          { l: "Telat bayar", v: late.length, s: rupiah(late.reduce((a, i) => a + balance(i), 0)), c: "#ff4444" },
        ].map(x => (
          <div key={x.l} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: x.c, fontFamily: font }}>{x.v}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
        <button onClick={() => setShowIn(!showIn)} aria-expanded={showIn} style={{ ...card, padding: 16, textAlign: "left", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ok)", fontFamily: font }}>{rupiah(inThisMonth)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>Masuk {monthName}</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{inRows.length} pembayaran · {showIn ? "tutup rincian" : "lihat rincian"}</div>
        </button>
      </div>

      {showIn && (
        <div role="region" aria-label={`Uang masuk ${monthName}`} style={{ ...card, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 8 }}>
            Dihitung dari <b>tanggal uang masuk</b>, bukan tanggal invoice. Salah bulan? Ganti tanggalnya di sini.
          </div>
          {inRows.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada pembayaran bulan ini.</div>}
          {inRows.map(({ inv, p, n }) => (
            <div key={`${inv.id}_${n}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--app-inner)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, fontSize: 12 }}>
                <b>{inv.leadName}</b> <span style={{ color: "var(--app-muted)" }}>· {inv.number}{p.note ? ` · ${p.note}` : ""}{inv.ownerName && space.kind === "guild" ? ` · ${inv.ownerName}` : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {moving?.id === inv.id && moving.n === n
                  ? <input type="date" autoFocus defaultValue={p.date} aria-label={`Tanggal uang masuk ${inv.leadName}`} onBlur={e => movePayment(inv, n, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") movePayment(inv, n, (e.target as HTMLInputElement).value); if (e.key === "Escape") setMoving(null); }}
                      style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: 12 }} />
                  : <button onClick={() => setMoving({ id: inv.id, n })} aria-label={`Ganti tanggal ${longDate(p.date)} ${inv.leadName}`} style={{ ...chip, minHeight: 32 }}>{longDate(p.date)} ✎</button>}
                <b style={{ fontSize: 12, color: "var(--ok)" }}>+{rupiah(p.amount)}</b>
              </div>
            </div>
          ))}
        </div>
      )}

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
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 16 }}>Udah closing? Bikin langsung. Atau tandai penawaran &quot;Disetujui&quot;, lalu &quot;Buat invoice&quot;.</div>
          <button onClick={startNew} style={btnPrimary}>+ Buat invoice</button>
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
                    <div style={{ fontSize: 12, color: "var(--app-muted)", fontFamily: "monospace" }}>{inv.number} · {longDate(inv.date)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font, marginTop: 2 }}>{inv.leadName}</div>
                    {inv.project && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 2 }}>{inv.project}</div>}
                    {space.kind === "guild" && inv.ownerName && <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>Sales: {inv.ownerName}</div>}
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      Jatuh tempo
                      <input type="date" value={inv.dueDate} onChange={e => setDue(inv, e.target.value)} aria-label="Jatuh tempo"
                        style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: 12 }} />
                      <span style={{ marginLeft: 6 }}>Acara</span>
                      <input type="date" value={inv.eventDate || ""} onChange={e => setEvent(inv, e.target.value)} aria-label="Tanggal acara"
                        style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: 12 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{rupiah(t)}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>sisa <b style={{ color: balance(inv) ? "#ff9900" : "var(--ok)" }}>{rupiah(balance(inv))}</b></div>
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
                      <div key={n} style={{ fontSize: 12, color: "var(--app-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        {moving?.id === inv.id && moving.n === n
                          ? <input type="date" autoFocus defaultValue={pm.date} aria-label="Tanggal uang masuk" onBlur={e => movePayment(inv, n, e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") movePayment(inv, n, (e.target as HTMLInputElement).value); if (e.key === "Escape") setMoving(null); }}
                              style={{ ...inputStyle, width: "auto", padding: "2px 6px", fontSize: 12 }} />
                          : <button onClick={() => setMoving({ id: inv.id, n })} aria-label={`Ganti tanggal pembayaran ${longDate(pm.date)}`} title="Ganti tanggal"
                              style={{ background: "none", border: "none", padding: 0, color: "inherit", font: "inherit", cursor: "pointer", textAlign: "left" }}>{longDate(pm.date)}{pm.note ? ` · ${pm.note}` : ""} ✎</button>}
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
                      <button onClick={() => window.open(waLink(inv.phone, invoiceText(inv, business)), "_blank")} style={{ ...chip, background: "#25D366", color: WA_INK, border: "none", fontWeight: 700 }}>Tagih via WA</button>
                    </>
                  )}
                  <button onClick={() => copy(inv)} style={{ ...chip, color: copied === inv.id ? "var(--ok)" : "var(--app-text)" }}>{copied === inv.id ? "✓ Tersalin" : "Copy teks"}</button>
                  <button onClick={() => setPrinting(inv)} style={chip}>PDF</button>
                  <button onClick={() => setEditing({ ...inv })} style={chip}>Edit</button>
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
            <label htmlFor="pay-date" style={label}>Tanggal uang masuk</label>
            <input id="pay-date" type="date" value={paying.date} max={now} onChange={e => setPaying({ ...paying, date: e.target.value })} style={{ ...inputStyle, marginBottom: 4 }} />
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>Masuk hitungan bulan {new Date((paying.date || now) + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}. Bayarnya bulan lalu? Ganti tanggalnya.</div>
            <label style={label}>Keterangan</label>
            <input value={paying.note} onChange={e => setPaying({ ...paying, note: e.target.value })} style={inputStyle} placeholder="DP / Pelunasan / Termin 2" />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={savePayment} style={btnPrimary}>Simpan</button>
              <button onClick={() => setPaying(null)} style={btnMuted}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {editing && <DocEditor kind="invoice" initial={editing} leads={leads} services={services} onSave={saveInvoice} onClose={() => setEditing(null)} />}
      {printing && <PrintSheet kind="invoice" data={printing} business={business} onClose={() => setPrinting(null)} />}
    </div>
  );
}
