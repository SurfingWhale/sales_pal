"use client";

import { useState } from "react";
import { deleteDoc, setDoc, updateDoc } from "firebase/firestore";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import {
  Business, Invoice, InvoiceState, Service, addDays, issuerOf, balance, nextNumber, daysBetween, dpAmount, invoiceColor, invoiceState, invoiceText,
  longDate, paid, rupiah, today, total, waLink,
} from "@/lib/billing";
import PrintSheet from "@/components/PrintSheet";
import DocEditor, { DocDraft, LeadRef, briefOf, cleanItems } from "@/components/DocEditor";
import ConfirmSheet from "@/components/ConfirmSheet";
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
  const [moving, setMoving] = useState<{ id: string; n: number; date: string } | null>(null);
  const [asking, setAsking] = useState<{ inv: Invoice; n?: number } | null>(null);
  const [payErr, setPayErr] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [failed, setFailed] = useState("");

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
    setPayErr("");
    setPaying({ inv, amount: suggested.toLocaleString("id-ID"), date: now, note: paid(inv) === 0 && inv.dpPercent ? `DP ${inv.dpPercent}%` : "Pelunasan" });
  }

  async function savePayment() {
    if (!paying) return;
    const amount = parseInt(paying.amount.replace(/\D/g, ""), 10) || 0;
    if (!amount) { setPayErr("Isi jumlahnya dulu."); return; }
    if (!paying.date) { setPayErr("Isi tanggal uang masuk dulu."); return; }
    const payments = [...(paying.inv.payments || []), { date: paying.date, amount, note: paying.note.trim() }];
    setPayBusy(true); setPayErr("");
    try {
      await updateDoc(spaceDoc(space, "invoices", paying.inv.id), { payments });
      setPaying(null);
    } catch { setPayErr("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    finally { setPayBusy(false); }
  }

  async function undoPayment(inv: Invoice, n: number) {
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
    try { await navigator.clipboard.writeText(invoiceText(inv, inv.issuer || business)); } catch { setFailed(inv.id); setTimeout(() => setFailed(""), 3000); return; }
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
      issuer: old?.issuer || issuerOf(business),
      ...briefOf(d),
    };
    await setDoc(spaceDoc(space, "invoices", id), stamp(space, doc, old as { ownerUid?: string; ownerName?: string } | undefined));
    setEditing(null);
  }

  async function remove(inv: Invoice) {
    await deleteDoc(spaceDoc(space, "invoices", inv.id));
  }

  // Changing when money came in: a date field with its own Simpan and Batal
  // (on a phone the field's picker has no other way back).
  const moveEditor = (inv: Invoice, n: number, name: string) => moving && (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input type="date" autoFocus value={moving.date} max={now} aria-label={`Tanggal uang masuk ${name}`} onChange={e => setMoving({ ...moving, date: e.target.value })}
        onKeyDown={e => { if (e.key === "Enter") movePayment(inv, n, moving.date); if (e.key === "Escape") { e.stopPropagation(); setMoving(null); } }}
        style={{ ...inputStyle, width: 150, padding: "6px 8px" }} />
      <button onClick={() => movePayment(inv, n, moving.date)} disabled={!moving.date} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>Simpan</button>
      <button onClick={() => setMoving(null)} style={{ ...chip, color: "var(--app-text)" }}>Batal</button>
    </span>
  );

  return (
    <div className="sp-sell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={heading}>Invoice & Pembayaran</div>
          <div style={subheading}>Dari penawaran yang disetujui, atau langsung kalau udah closing. Catat DP & pelunasan di sini.</div>
        </div>
        <button onClick={startNew} style={btnPrimary}>+ Invoice</button>
      </div>

      <div className="sp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Belum tertagih", v: rupiah(receivable), s: `${invoices.filter(i => balance(i) > 0).length} invoice terbuka`, c: "var(--warn-text)" },
          { l: "Telat bayar", v: late.length, s: rupiah(late.reduce((a, i) => a + balance(i), 0)), c: "color-mix(in srgb, #ff4444 55%, var(--app-text))" },
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
              <div style={{ minWidth: 0, fontSize: 13 }}>
                <b>{inv.leadName}</b> <span style={{ color: "var(--app-muted)" }}>· {inv.number}{p.note ? ` · ${p.note}` : ""}{inv.ownerName && space.kind === "guild" ? ` · ${inv.ownerName}` : ""}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                <b style={{ fontSize: 13, color: "var(--ok)" }}>+{rupiah(p.amount)}</b>
                {moving?.id === inv.id && moving.n === n
                  ? moveEditor(inv, n, inv.leadName)
                  : <button onClick={() => setMoving({ id: inv.id, n, date: p.date })} aria-label={`Ganti tanggal ${longDate(p.date)} ${inv.leadName}`} style={{ ...chip, minHeight: 32, color: "var(--app-text)" }}>{longDate(p.date)} ✎</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="sp-chiprow" role="group" aria-label="Saring invoice" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
              style={{ ...chip, background: filter === s ? (s === "All" ? "#005eb0" : invoiceColor[s as InvoiceState]) : "var(--app-card)", color: filter === s ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {s === "All" ? "Semua" : s}
            </button>
          ))}
        </div>
      )}

      {invoices.length > 0 && shown.length === 0 && (
        <div style={{ ...card, padding: "28px 20px", textAlign: "center", fontSize: 13, color: "var(--app-muted)" }}>
          Ga ada invoice &quot;{filter}&quot;. <button onClick={() => setFilter("All")} style={{ ...chip, marginLeft: 6, color: "var(--app-text)", fontWeight: 700 }}>Lihat semua</button>
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
                    <div className="sp-dates">
                      <div>
                        <label htmlFor={`due-${inv.id}`}>Jatuh tempo</label>
                        <input id={`due-${inv.id}`} type="date" value={inv.dueDate} onChange={e => e.target.value && setDue(inv, e.target.value)}
                          style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                      </div>
                      <div>
                        <label htmlFor={`event-${inv.id}`}>Tanggal acara</label>
                        <input id={`event-${inv.id}`} type="date" value={inv.eventDate || ""} onChange={e => setEvent(inv, e.target.value)}
                          style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                      </div>
                    </div>
                  </div>
                  <div className="sp-doc-sum" style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{rupiah(t)}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>sisa <b style={{ color: balance(inv) ? "var(--warn-text)" : "var(--ok)" }}>{rupiah(balance(inv))}</b></div>
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
                      <div key={n} style={{ fontSize: 13, color: "var(--app-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {moving?.id === inv.id && moving.n === n
                          ? moveEditor(inv, n, inv.leadName)
                          : <button onClick={() => setMoving({ id: inv.id, n, date: pm.date })} aria-label={`Ganti tanggal pembayaran ${longDate(pm.date)}`} title="Ganti tanggal"
                              style={{ background: "none", border: "none", padding: "0 4px 0 0", color: "inherit", font: "inherit", cursor: "pointer", textAlign: "left", minWidth: 0 }}>{longDate(pm.date)}{pm.note ? ` · ${pm.note}` : ""} ✎</button>}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
                          <b style={{ color: "var(--ok)" }}>+{rupiah(pm.amount)}</b>
                          <button onClick={() => setAsking({ inv, n })} aria-label={`Hapus pembayaran ${longDate(pm.date)}`} title="Hapus pembayaran" style={{ background: "none", border: "none", color: "var(--app-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 32 }}>×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sp-doc-actions">
                  {st !== "Lunas" && (
                    <div className="sp-doc-main">
                      <button onClick={() => startPayment(inv)} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>+ Catat pembayaran</button>
                      <button onClick={() => window.open(waLink(inv.phone, invoiceText(inv, inv.issuer || business)), "_blank")} style={{ ...chip, background: "#25D366", color: WA_INK, border: "none", fontWeight: 700 }}>Tagih via WA</button>
                    </div>
                  )}
                  <div className="sp-doc-tools">
                    <button onClick={() => copy(inv)} style={{ ...chip, color: copied === inv.id ? "var(--ok)" : "var(--app-text)" }}>{copied === inv.id ? "✓ Tersalin" : "Copy teks"}</button>
                    <button onClick={() => setPrinting(inv)} style={{ ...chip, color: "var(--app-text)" }}>PDF</button>
                    <button onClick={() => setEditing({ ...inv })} style={{ ...chip, color: "var(--app-text)" }}>Edit</button>
                    <button className="sp-del" onClick={() => setAsking({ inv })} aria-label={`Hapus ${inv.number}`} title="Hapus" style={{ ...chip, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", borderColor: "#ff444440" }}>🗑</button>
                  </div>
                </div>
                {failed === inv.id && <div role="alert" style={{ fontSize: 12, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Buka PDF atau Tagih via WA aja.</div>}
              </div>
            );
          })}
        </div>
      )}

      {paying && (
        <div className="modal-overlay" onClick={() => { if (!payBusy) setPaying(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: font, marginBottom: 4 }}>Catat pembayaran</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>{paying.inv.number} · sisa {rupiah(balance(paying.inv))}</div>
            <label htmlFor="pay-amount" style={label}>Jumlah (Rp)</label>
            <input id="pay-amount" inputMode="numeric" value={paying.amount} onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0; setPayErr(""); setPaying({ ...paying, amount: n ? n.toLocaleString("id-ID") : "" }); }} style={{ ...inputStyle, marginBottom: 12 }} />
            <label htmlFor="pay-date" style={label}>Tanggal uang masuk</label>
            <input id="pay-date" type="date" value={paying.date} max={now} onChange={e => setPaying({ ...paying, date: e.target.value })} style={{ ...inputStyle, marginBottom: 4 }} />
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 12 }}>Masuk hitungan bulan {new Date((paying.date || now) + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}. Bayarnya bulan lalu? Ganti tanggalnya.</div>
            <label htmlFor="pay-note" style={label}>Keterangan</label>
            <input id="pay-note" value={paying.note} onChange={e => setPaying({ ...paying, note: e.target.value })} style={inputStyle} placeholder="DP / Pelunasan / Termin 2" />
            {payErr && <div role="alert" style={{ fontSize: 12, marginTop: 10, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))" }}>{payErr}</div>}
            <div className="sp-form-foot">
              <button onClick={() => setPaying(null)} disabled={payBusy} style={btnMuted}>Batal</button>
              <button onClick={savePayment} disabled={payBusy} style={{ ...btnPrimary, opacity: payBusy ? 0.6 : 1 }}>{payBusy ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && <DocEditor kind="invoice" initial={editing} leads={leads} services={services} onSave={saveInvoice} onClose={() => setEditing(null)} />}
      {printing && <PrintSheet kind="invoice" data={printing} business={printing.issuer || business} frozen={!!printing.issuer} onClose={() => setPrinting(null)} />}
      {asking && (asking.n === undefined
        ? <ConfirmSheet title="Hapus invoice?" onConfirm={() => remove(asking.inv)} onClose={() => setAsking(null)}>
            <b>{asking.inv.number}</b> untuk {asking.inv.leadName || "klien"} hilang, bersama {asking.inv.payments?.length || 0} catatan pembayarannya. Ini ga bisa dibatalkan.
          </ConfirmSheet>
        : <ConfirmSheet title="Hapus pembayaran?" onConfirm={() => undoPayment(asking.inv, asking.n!)} onClose={() => setAsking(null)}>
            <b>+{rupiah(asking.inv.payments[asking.n]?.amount || 0)}</b> tanggal {longDate(asking.inv.payments[asking.n]?.date || now)} dihapus dari {asking.inv.number}. Sisa tagihan naik lagi.
          </ConfirmSheet>)}
    </div>
  );
}
