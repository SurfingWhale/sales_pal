"use client";

import { createPortal } from "react-dom";
import { Business, Invoice, Quote, balance, dpAmount, longDate, paid, rupiah, subtotal, total } from "@/lib/billing";
import { btnMuted, btnPrimary } from "@/components/ui";

// A quote or invoice as a sheet of paper. It is always black on white, whatever
// the app theme, because it is what the client receives. "Cetak / PDF" prints
// only the sheet: globals.css hides everything else under @media print.

type Props =
  | { kind: "quote"; data: Quote; business: Business; onClose: () => void }
  | { kind: "invoice"; data: Invoice; business: Business; onClose: () => void };

const ink = "#141414";
const soft = "#57606a";
const rule = "#d0d7de";

export default function PrintSheet(props: Props) {
  const { kind, data, business: b, onClose } = props;
  const isQuote = kind === "quote";
  const inv = !isQuote ? (props.data as Invoice) : null;
  const q = isQuote ? (props.data as Quote) : null;

  const cell: React.CSSProperties = { padding: "8px 6px", borderBottom: `1px solid ${rule}`, fontSize: 12, verticalAlign: "top" };
  const right: React.CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap" };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay print-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="print-frame" style={{ width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => window.print()} style={btnPrimary}>CETAK / PDF</button>
          <button onClick={onClose} style={btnMuted}>TUTUP</button>
        </div>

        <div className="print-root" style={{ background: "#fff", color: ink, borderRadius: 8, padding: "40px 36px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{b.name || "—"}</div>
              <div style={{ fontSize: 12, color: soft, marginTop: 4, lineHeight: 1.6 }}>
                {[b.phone, b.email].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "2px" }}>{isQuote ? "PENAWARAN" : "INVOICE"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{data.number}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24, fontSize: 12, lineHeight: 1.7 }}>
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

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr>
                {["#", "Deskripsi", "Qty", "Harga", "Jumlah"].map((h, i) => (
                  <th key={h} style={{ ...(i >= 2 ? right : cell), fontSize: 10, color: soft, letterSpacing: "1px", borderBottom: `2px solid ${ink}`, fontWeight: 600, textAlign: i >= 2 ? "right" : "left" }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...cell, width: 24, color: soft }}>{i + 1}</td>
                  <td style={cell}>{it.name}</td>
                  <td style={right}>{it.qty}</td>
                  <td style={right}>{rupiah(it.price)}</td>
                  <td style={right}>{rupiah(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

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

          {(data.notes || b.footer) && (
            <div style={{ marginTop: 28, fontSize: 11, color: soft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {[data.notes, b.footer].filter(Boolean).join("\n\n")}
            </div>
          )}
        </div>
      </div>
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
