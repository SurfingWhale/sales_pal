"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Business, Invoice, Quote, balance, useBusiness, dpAmount, longDate, paid, rupiah, subtotal, total } from "@/lib/billing";
import { canEditCatalog, useSpace } from "@/lib/space";
import { fullDay } from "@/lib/when";
import BusinessEditor from "@/components/BusinessEditor";
import { Doc, buildPdf, pdfName, sharePdf } from "@/lib/pdfDoc";
import { btnMuted, btnPrimary, chip } from "@/components/ui";

// A quote or invoice as a sheet of paper. It is always black on white, whatever
// the app theme, because it is what the client receives. "Cetak / PDF" prints
// only the sheet: globals.css hides everything else under @media print.

type Props =
  | { kind: "quote"; data: Quote; business: Business; frozen?: boolean; onClose: () => void }
  | { kind: "invoice"; data: Invoice; business: Business; frozen?: boolean; onClose: () => void };

const ink = "#141414";
const soft = "#57606a";
const rule = "#d0d7de";

export default function PrintSheet(props: Props) {
  const { kind, data, business: b, onClose } = props;
  const isQuote = kind === "quote";
  const inv = !isQuote ? (props.data as Invoice) : null;
  const q = isQuote ? (props.data as Quote) : null;
  const space = useSpace();
  const [kop, setKop] = useState(false);
  // Kop & logo edits the live letterhead (for new documents), never this
  // document's frozen copy.
  const live = useBusiness(space);
  const canEdit = canEditCatalog(space);
  const doc = (isQuote ? { kind: "quote", data: q! } : { kind: "invoice", data: inv! }) as Doc;
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [pdfMsg, setPdfMsg] = useState("");

  // Built as soon as the sheet opens (and again after the letterhead changes),
  // so the tap can go straight to the share sheet.
  useEffect(() => {
    let live = true;
    setPdf(null);
    buildPdf(doc, b).then(x => { if (live) setPdf(x); }, () => { if (live) setPdfMsg("PDF gagal dibuat. Coba tutup lalu buka lagi."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, b]);

  // The browser names a printed PDF after the page title.
  function printIt() {
    const was = document.title;
    document.title = pdfName(doc).replace(/\.pdf$/, "");
    const back = () => { document.title = was; window.removeEventListener("afterprint", back); };
    window.addEventListener("afterprint", back);
    window.print();
    setTimeout(back, 60_000);
  }

  async function save() {
    if (!pdf) return;
    setPdfMsg("");
    const r = await sharePdf(pdf, pdfName(doc));
    setPdfMsg(r === "downloaded" ? `${pdfName(doc)} tersimpan di Downloads.` : r === "shared" ? "PDF dikirim." : "");
  }

  const cell: React.CSSProperties = { padding: "8px 6px", borderBottom: `1px solid ${rule}`, fontSize: 12, verticalAlign: "top" };
  const right: React.CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap" };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay print-overlay sp-pdf" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="print-frame" aria-label={`${isQuote ? "Penawaran" : "Invoice"} ${data.number}, PDF`}
        style={{ width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* What this is and the way out on top; on a phone the actions sit at
            the bottom by the thumb (globals.css, .sp-print-actions). */}
        <div className="no-print sp-print-head">
          <div className="sp-print-title">{isQuote ? "Penawaran" : "Invoice"} {data.number}<span style={{ fontWeight: 400, color: "var(--app-muted)" }}> · {data.leadName}</span></div>
          <div className="sp-print-actions">
            {canEdit && <button onClick={() => setKop(true)} style={{ ...btnMuted, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>Kop & logo</button>}
            <button onClick={printIt} className="pointer-only" style={btnMuted}>Cetak</button>
            <button onClick={save} disabled={!pdf} aria-busy={!pdf} className="sp-print-main" style={{ ...btnPrimary, opacity: pdf ? 1 : 0.6 }}>{pdf ? "Simpan / kirim PDF" : "Menyiapkan PDF…"}</button>
          </div>
          <button onClick={onClose} aria-label="Tutup" title="Tutup (Esc)" style={{ ...btnMuted, minHeight: 44, padding: "0 16px" }}>Tutup</button>
        </div>
        <div className="no-print sp-print-msg" role="status" style={{ fontSize: 13, color: "#fff", textAlign: "right" }}>{pdfMsg}</div>
        {props.frozen && (
          <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "0 0 12px" }}>
            Kop dan syarat di dokumen ini dikunci sejak {isQuote ? "dikirim" : "dibuat"}. Ubahan di Kop & logo berlaku buat dokumen baru.
          </p>
        )}
        {!b.name && (
          <div className="no-print" role="status" style={{ padding: 12, borderRadius: 10, background: "var(--app-card)", border: "1px solid #ff990060", fontSize: 13, lineHeight: 1.5, color: "var(--app-text)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 220px" }}>Kop masih kosong: nama bisnis, logo, dan syarat & ketentuan belum diisi.{canEdit ? "" : " Minta Leader/Officer guild ngisi di Paket → Kop & logo."}</span>
            {canEdit && <button onClick={() => setKop(true)} style={{ ...chip, minHeight: 44, color: "var(--app-text)", fontWeight: 700 }}>Isi kop sekarang</button>}
          </div>
        )}

        <div className="print-root" style={{ background: "#fff", color: ink, borderRadius: 8, padding: "40px 36px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div className="sp-paper-head" style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
            <div className="sp-paper-brand" style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.logo && <img src={b.logo} alt="" style={{ maxHeight: 64, maxWidth: 140, objectFit: "contain" }} />}
              <div style={{ minWidth: 0 }}>
                {b.name && <div style={{ fontSize: 20, fontWeight: 700 }}>{b.name}</div>}
                {b.tagline && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{b.tagline}</div>}
                <div style={{ fontSize: 12, color: soft, marginTop: 4, lineHeight: 1.6 }}>
                  {[b.phone, b.email].filter(Boolean).join(" · ")}
                  {b.address && <div>{b.address}</div>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "2px" }}>{isQuote ? "PENAWARAN" : "INVOICE"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{data.number}</div>
            </div>
          </div>

          <div className="sp-paper-meta" style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24, fontSize: 12, lineHeight: 1.7 }}>
            <div>
              <div style={{ color: soft, fontSize: 10, letterSpacing: "1px" }}>UNTUK</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{data.leadName}</div>
              {data.contact && data.contact !== data.leadName && <div>{data.contact}</div>}
              {data.phone && <div>{data.phone}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div><span style={{ color: soft }}>Tanggal:</span> {longDate(data.date)}</div>
              {q && <div><span style={{ color: soft }}>Berlaku s/d:</span> {longDate(q.validUntil)}</div>}
              {inv && <div><span style={{ color: soft }}>Jatuh tempo:</span> {longDate(inv.dueDate)}</div>}
            </div>
          </div>

          {data.project && <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.35 }}>{data.project}</div>}
          {(data.eventDate || data.eventTime || data.venue) && (
            <div style={{ background: "#f6f7f9", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ color: soft, fontSize: 10, letterSpacing: "1px" }}>DETAIL ACARA</div>
              {data.eventDate && <div><span style={{ color: soft, display: "inline-block", width: 64 }}>Tanggal</span><b>{fullDay(data.eventDate)}</b></div>}
              {data.eventTime && <div><span style={{ color: soft, display: "inline-block", width: 64 }}>Jam</span>{data.eventTime}</div>}
              {data.venue && <div><span style={{ color: soft, display: "inline-block", width: 64 }}>Lokasi</span>{data.venue}</div>}
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr>
                {["#", "Layanan & scope", "Qty", "Harga", "Jumlah"].map((h, i) => (
                  <th key={h} className={i === 2 || i === 3 ? "sp-paper-hide" : undefined} style={{ ...(i >= 2 ? right : cell), fontSize: 10, color: soft, letterSpacing: "1px", borderBottom: `2px solid ${ink}`, fontWeight: 600, textAlign: i >= 2 ? "right" : "left" }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...cell, width: 24, color: soft }}>{i + 1}</td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    {it.description?.trim() && <div style={{ fontSize: 11, color: soft, marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{it.description.trim()}</div>}
                    <div className="sp-paper-qp" style={{ fontSize: 11, color: soft, marginTop: 3 }}>{it.qty} × {rupiah(it.price)}</div>
                  </td>
                  <td className="sp-paper-hide" style={right}>{it.qty}</td>
                  <td className="sp-paper-hide" style={right}>{rupiah(it.price)}</td>
                  <td style={right}>{rupiah(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(data.deliverables || "").trim() && (
            <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
              <div style={{ color: soft, fontSize: 10, letterSpacing: "1px" }}>DELIVERABLES</div>
              <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                {(data.deliverables || "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          <div style={{ marginLeft: "auto", width: "100%", maxWidth: 300, fontSize: 12, lineHeight: 2 }}>
            {data.discount > 0 && (
              <>
                <Row k="Subtotal" v={rupiah(subtotal(data.items))} />
                <Row k="Diskon" v={`-${rupiah(data.discount)}`} />
              </>
            )}
            <div style={{ borderTop: `2px solid ${ink}`, marginTop: 4, paddingTop: 4 }}>
              <Row k="Total" v={rupiah(total(data))} strong />
            </div>
            {q && q.dpPercent > 0 && <Row k={`DP ${q.dpPercent}%`} v={rupiah(dpAmount(q))} />}
            {inv && paid(inv) > 0 && <Row k="Sudah dibayar" v={`-${rupiah(paid(inv))}`} />}
            {inv && <Row k={paid(inv) === 0 && inv.dpPercent ? `DP ${inv.dpPercent}% dibayar dulu` : "Sisa tagihan"} v={rupiah(paid(inv) === 0 && inv.dpPercent ? dpAmount(inv) : balance(inv))} strong />}
          </div>

          {inv && b.bank && b.accountNo && (
            <div style={{ marginTop: 28, padding: 14, border: `1px solid ${rule}`, borderRadius: 6, fontSize: 12, lineHeight: 1.7 }}>
              <div style={{ color: soft, fontSize: 10, letterSpacing: "1px" }}>PEMBAYARAN</div>
              <div><b>{b.bank}</b> {b.accountNo}{b.accountName ? ` a.n. ${b.accountName}` : ""}</div>
            </div>
          )}

          {inv && inv.payments?.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 11, color: soft, lineHeight: 1.7 }}>
              <div style={{ fontSize: 10, letterSpacing: "1px" }}>RIWAYAT PEMBAYARAN</div>
              {inv.payments.map((p, i) => <div key={i}>{longDate(p.date)} · {rupiah(p.amount)}{p.note ? ` · ${p.note}` : ""}</div>)}
            </div>
          )}

          {data.notes && (
            <div style={{ marginTop: 28, fontSize: 11, color: soft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              <div style={{ fontSize: 10, letterSpacing: "1px", marginBottom: 2 }}>CATATAN</div>
              {data.notes}
            </div>
          )}
          {b.footer && (
            <div style={{ marginTop: 20, fontSize: 11, color: soft, lineHeight: 1.7, whiteSpace: "pre-wrap", borderTop: `1px solid ${rule}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: "1px", marginBottom: 2 }}>SYARAT & KETENTUAN</div>
              {b.footer}
            </div>
          )}
        </div>
      </div>
      {kop && <div onClick={e => e.stopPropagation()}><BusinessEditor business={live} onClose={() => setKop(false)} /></div>}
    </div>,
    document.body
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: strong ? 700 : 400, fontSize: strong ? 14 : 12 }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
