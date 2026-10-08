"use client";

import { createPortal } from "react-dom";
import { juta, monthName } from "@/lib/funnel";
import type { SellerRow } from "@/lib/guild";
import { btnMuted, btnPrimary } from "@/components/ui";

// The guild's team report on paper (PRD-007 §2.3): totals, one row per seller
// with target and progress. Black on white for printing; uses PrintSheet's
// print classes so globals.css prints only this sheet.

const ink = "#141414";
const soft = "#57606a";
const rule = "#d0d7de";
const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");

interface Props {
  guildName: string;
  month: string;
  rows: SellerRow[];
  revenue: number;
  paidCount: number;
  leads: number;
  compare?: { revenue: string; paidCount: string; leads: string };
  frozenAt?: number;
  scope: "team" | "self";
  onClose: () => void;
}

export default function TeamReportSheet({ guildName, month, rows, revenue, paidCount, leads, compare, frozenAt, scope, onClose }: Props) {
  if (typeof document === "undefined") return null;
  const cell: React.CSSProperties = { padding: "6px", borderBottom: `1px solid ${rule}`, fontSize: 11.5 };
  const num: React.CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const th = (right?: boolean): React.CSSProperties => ({ ...cell, fontSize: 9.5, color: soft, letterSpacing: "1px", fontWeight: 600, borderBottom: `2px solid ${ink}`, textAlign: right ? "right" : "left" });
  const target = rows.reduce((a, r) => a + r.targetRevenue, 0);

  return createPortal(
    <div className="modal-overlay print-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="print-frame" style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => window.print()} style={btnPrimary}>CETAK / PDF</button>
          <button onClick={onClose} style={btnMuted}>TUTUP</button>
        </div>
        <div className="print-root" style={{ background: "#fff", color: ink, borderRadius: 8, padding: "36px 34px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", borderBottom: `2px solid ${ink}`, paddingBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: soft, letterSpacing: "1.5px" }}>{scope === "team" ? "REPORT SALES TIM" : "REPORT SALES PRIBADI"}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{guildName}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{monthName(month)}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: soft }}>
              {frozenAt ? `Final per ${new Date(frozenAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : "Draft — angka masih bisa berubah"}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>ANGKA UTAMA</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th()}>METRIK</th><th style={th(true)}>BULAN INI</th>{compare && <th style={th(true)}>DIBANDING RATA-RATA 3 BULAN</th>}</tr></thead>
              <tbody>
                <tr><td style={cell}>Omzet lunas</td><td style={{ ...num, fontWeight: 700 }}>{juta(revenue)}</td>{compare && <td style={{ ...num, color: soft }}>{compare.revenue}</td>}</tr>
                <tr><td style={cell}>Deal lunas</td><td style={{ ...num, fontWeight: 700 }}>{fmt(paidCount)}</td>{compare && <td style={{ ...num, color: soft }}>{compare.paidCount}</td>}</tr>
                <tr><td style={cell}>Chat masuk</td><td style={{ ...num, fontWeight: 700 }}>{fmt(leads)}</td>{compare && <td style={{ ...num, color: soft }}>{compare.leads}</td>}</tr>
                {target > 0 && <tr><td style={cell}>Capaian target tim</td><td style={{ ...num, fontWeight: 700 }}>{Math.round((revenue / target) * 100)}%</td>{compare && <td style={{ ...num, color: soft }}>target {juta(target)}</td>}</tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 22, breakInside: "avoid" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>PER SALES</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["#", "SALES", "CHAT", "PENAWARAN", "LUNAS", "OMZET", "TARGET", "CAPAIAN"].map((h, i) => <th key={h} style={th(i > 1)}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.uid}>
                  <td style={{ ...cell, color: soft }}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{r.name}</td>
                  <td style={num}>{r.leads}</td><td style={num}>{r.quoted}</td><td style={num}>{r.paid}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{juta(r.revenue)}</td>
                  <td style={num}>{r.targetRevenue ? juta(r.targetRevenue) : "—"}</td>
                  <td style={num}>{r.targetRevenue ? `${Math.round((r.revenue / r.targetRevenue) * 100)}%` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div style={{ marginTop: 22, fontSize: 9.5, color: soft, lineHeight: 1.6, borderTop: `1px solid ${rule}`, paddingTop: 10 }}>
            Omzet & deal lunas dihitung dari tanggal lunas; chat & penawaran dari chat yang masuk bulan ini. Capaian = omzet lunas ÷ target omzet.
            Pembanding = rata-rata 3 bulan sebelumnya yang punya data; bulan pertama ditulis &quot;bulan dasar&quot;; di bawah 10 kejadian ditulis tanpa persen.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
