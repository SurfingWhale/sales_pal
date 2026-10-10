"use client";

import { createPortal } from "react-dom";
import { Business } from "@/lib/billing";
import { Baseline, MonthNumbers, delta, juta, monthName, wilson } from "@/lib/funnel";
import { btnMuted, btnPrimary } from "@/components/ui";

// The monthly client report as paper (PRD-005): the same numbers as the Report
// tab, laid out for A4 and printed or saved as PDF. Black on white whatever the
// app theme, since it goes to the client. Uses PrintSheet's print classes, so
// globals.css prints only this sheet.

const ink = "#141414";
const soft = "#57606a";
const rule = "#d0d7de";
const fmt = (n: number) => Math.round(n).toLocaleString("id-ID");
const pct = (r: number) => `${(r * 100).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

function conv(k: number, n: number): string {
  if (!n) return "—";
  if (n < 10) return `${k} dari ${n}`;
  const [lo, hi] = wilson(k, n);
  return `${Math.round((k / n) * 100)}% (${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

interface Props {
  clientName: string;
  business: Business;
  m: MonthNumbers;
  b: Baseline;
  narrative: string;
  threshold: number;
  frozenAt?: number;
  onClose: () => void;
}

export default function ReportSheet({ clientName, business, m, b, narrative, threshold, frozenAt, onClose }: Props) {
  if (typeof document === "undefined") return null;
  const cell: React.CSSProperties = { padding: "6px 6px", borderBottom: `1px solid ${rule}`, fontSize: 11.5, verticalAlign: "top" };
  const num: React.CSSProperties = { ...cell, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const th = (right?: boolean): React.CSSProperties => ({ ...cell, fontSize: 9.5, color: soft, letterSpacing: "1px", fontWeight: 600, borderBottom: `2px solid ${ink}`, textAlign: right ? "right" : "left" });
  const section: React.CSSProperties = { marginTop: 22, breakInside: "avoid", pageBreakInside: "avoid" };
  const h: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 };
  const lines = narrative.split("\n").filter(l => l.trim() && !/^Report .+ · /.test(l));
  const sources = m.bySource.filter(s => s.count || s.channel === "Ga tau");

  const kpis: [string, string, string][] = [
    ["Omzet lunas", juta(m.revenue), delta(m.revenue, b.revenue, "money").text],
    ["Deal lunas", fmt(m.paidCount), delta(m.paidCount, b.paidCount, "count").text],
    ["Chat masuk", fmt(m.leads), delta(m.leads, b.leads, "count").text],
    ["Chat per 1.000 views", m.leadsPer1kViews == null ? "—" : m.leadsPer1kViews.toLocaleString("id-ID", { maximumFractionDigits: 1 }), m.leadsPer1kViews == null ? "angka konten belum diisi" : delta(m.leadsPer1kViews, b.leadsPer1kViews, "ratio").text],
    ["ER (engagement ÷ views)", m.views ? pct(m.erViews) : "—", m.views ? delta(m.erViews, b.erViews, "rate").text : "angka konten belum diisi"],
  ];

  return createPortal(
    <div className="modal-overlay print-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="print-frame" style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={() => window.print()} style={btnPrimary}>Cetak / PDF</button>
          <button onClick={onClose} style={btnMuted}>Tutup</button>
        </div>

        <div className="print-root" style={{ background: "#fff", color: ink, borderRadius: 8, padding: "36px 34px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", borderBottom: `2px solid ${ink}`, paddingBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: soft, letterSpacing: "1.5px" }}>LAPORAN BULANAN</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{clientName}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{monthName(m.month)}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: soft, lineHeight: 1.6 }}>
              {business.name && <div style={{ fontWeight: 700, color: ink, fontSize: 12 }}>{business.name}</div>}
              {[business.phone, business.email].filter(Boolean).map(x => <div key={x}>{x}</div>)}
              <div>{frozenAt ? `Final per ${new Date(frozenAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : "Draft — angka masih bisa berubah"}</div>
            </div>
          </div>

          <div style={section}>
            <div style={h}>RINGKASAN</div>
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>

          <div style={section}>
            <div style={h}>ANGKA UTAMA</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th()}>METRIK</th><th style={th(true)}>BULAN INI</th><th style={th(true)}>DIBANDING RATA-RATA 3 BULAN</th></tr></thead>
              <tbody>{kpis.map(([k, v, d]) => <tr key={k}><td style={cell}>{k}</td><td style={{ ...num, fontWeight: 700 }}>{v}</td><td style={{ ...num, color: soft }}>{d}</td></tr>)}</tbody>
            </table>
            {m.paidCount > 0 && (
              <div style={{ fontSize: 11, color: soft, marginTop: 8, lineHeight: 1.6 }}>
                Omzet = {m.paidCount} deal × rata-rata {juta(m.avgDeal)} (median {juta(m.medianDeal)}). Deal ≥ {juta(threshold)}: {m.bigCount} deal, {juta(m.bigRevenue)}; di bawahnya: {m.smallCount} deal, {juta(m.smallRevenue)}.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ ...section, flex: "1 1 280px", minWidth: 0 }}>
              <div style={h}>FUNNEL</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th()}>TAHAP</th><th style={th(true)}>JUMLAH</th><th style={th(true)}>DARI CHAT</th></tr></thead>
                <tbody>
                  {m.views > 0 && <>
                    <tr><td style={cell}>Views</td><td style={num}>{fmt(m.views)}</td><td style={num}>—</td></tr>
                    <tr><td style={cell}>Engagement</td><td style={num}>{fmt(m.engagement)}</td><td style={num}>—</td></tr>
                  </>}
                  {([["Chat / lead", m.leads], ["Qualified", m.qualified], ["Penawaran", m.quoted], ["Won", m.won], ["Lunas", m.paidFromCohort]] as [string, number][]).map(([k, v], i) => (
                    <tr key={k}><td style={cell}>{k}</td><td style={num}>{fmt(v)}</td><td style={num}>{i === 0 ? "—" : conv(v, m.leads)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10, color: soft, marginTop: 6 }}>Funnel dihitung dari chat yang masuk bulan ini.{!m.cohortMature && " Sebagian masih berjalan."}</div>
            </div>

            <div style={{ ...section, flex: "1 1 240px", minWidth: 0 }}>
              <div style={h}>OMZET PER SUMBER</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th()}>SUMBER PERTAMA</th><th style={th(true)}>DEAL</th><th style={th(true)}>OMZET</th></tr></thead>
                <tbody>{sources.map(s => (
                  <tr key={s.channel}><td style={cell}>{s.channel === "Ga tau" ? "Belum ketahuan" : s.channel}</td><td style={num}>{s.count}</td><td style={num}>{juta(s.revenue)}</td></tr>
                ))}</tbody>
              </table>
              {m.paidCount > 0 && <div style={{ fontSize: 10, color: soft, marginTop: 6 }}>{Math.round(m.unknownPaidShare * 100)}% deal lunas belum ketahuan sumbernya.</div>}
            </div>
          </div>

          {m.platforms.length > 0 && (
            <div style={section}>
              <div style={h}>KONTEN PER PLATFORM</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["PLATFORM", "POST", "VIEWS", "ER", "SAVE/VIEW", "SHARE/VIEW", "CHAT", "OMZET"].map((x, i) => <th key={x} style={th(i > 0)}>{x}</th>)}</tr></thead>
                <tbody>{m.platforms.map(p => (
                  <tr key={p.platform}>
                    <td style={{ ...cell, fontWeight: 700 }}>{p.platform}</td><td style={num}>{p.posts}</td><td style={num}>{fmt(p.views)}</td>
                    <td style={num}>{p.views ? pct(p.erViews) : "—"}</td><td style={num}>{p.views ? pct(p.savesPerView) : "—"}</td><td style={num}>{p.views ? pct(p.sharesPerView) : "—"}</td>
                    <td style={num}>{p.leads}</td><td style={num}>{juta(p.revenue)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {m.top.length > 0 && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {([["KONTEN TERBAIK", m.top], ["KONTEN TERLEMAH", m.bottom]] as const).filter(([, l]) => l.length).map(([t, l]) => (
                <div key={t} style={{ ...section, flex: "1 1 260px", minWidth: 0 }}>
                  <div style={h}>{t}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>{l.map(p => (
                      <tr key={p.id}><td style={cell}>{p.title}<span style={{ color: soft }}> · {p.platform}</span></td><td style={num}>{fmt(p.views)} views</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          <div style={{ ...section, fontSize: 9.5, color: soft, lineHeight: 1.6, borderTop: `1px solid ${rule}`, paddingTop: 10 }}>
            Pembanding = rata-rata 3 bulan sebelumnya yang punya data; bulan pertama ditulis &quot;bulan dasar&quot;. Angka di bawah 10 ditampilkan tanpa persen; konversi berisi rentang 95%.
            ER = (like + komentar + share + save) ÷ views. Omzet dihitung dari tanggal lunas, funnel dari tanggal chat masuk. Reach tidak dijumlah antar post atau platform.
            Sumber = sumber pertama customer, dicatat saat chat pertama.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
