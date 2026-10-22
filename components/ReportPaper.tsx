"use client";

import { ReportDoc, chartTop } from "@/lib/reportPdf";

// Any ReportDoc on screen, black on white like the PDF it becomes
// (buildReportPdf), so what you check is what you send. ReportShell prints
// this .print-root when "Cetak" is used.

const ink = "#141414", soft = "#57606a", rule = "#d0d7de";

export default function ReportPaper({ doc }: { doc: ReportDoc }) {
  const cell: React.CSSProperties = { padding: "6px", borderBottom: `1px solid ${rule}`, fontSize: 11.5 };
  return (
    <div className="print-root" style={{ background: "#fff", color: ink, borderRadius: 8, padding: "32px 30px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", borderBottom: `2px solid ${ink}`, paddingBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: soft, letterSpacing: "1.5px" }}>{doc.kicker}</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{doc.title}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.subtitle}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11 }}>
          {doc.meta.map((m, i) => <div key={i} style={{ color: i ? soft : ink, fontWeight: i ? 400 : 600 }}>{m}</div>)}
        </div>
      </div>
      {doc.sections.map(s => {
        const sum = s.table ? s.table.widths.reduce((a, n) => a + n, 0) : 1;
        const top = s.chart ? chartTop(Math.max(1, ...s.chart.values)) : 1;
        return (
          <section key={s.title} style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", margin: "0 0 8px" }}>{s.title.toUpperCase()}</h2>
            {s.lines?.map((l, i) => <p key={i} style={{ fontSize: 12, margin: "0 0 4px", lineHeight: 1.5 }}>{l}</p>)}
            {s.chart && (
              <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 6 }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 9, color: soft, textAlign: "right", height: 110 }}>
                  <span>{top}</span><span>{top / 2}</span><span>0</span>
                </div>
                <div>
                  <div style={{ position: "relative", height: 110, display: "flex", alignItems: "flex-end", gap: 1,
                    backgroundImage: `linear-gradient(${rule} 1px, transparent 1px)`, backgroundSize: "100% 55px", borderBottom: `1px solid ${ink}` }}>
                    {s.chart.values.map((v, i) => <span key={i} style={{ flex: 1, height: `${(v / top) * 100}%`, background: v ? ink : "transparent" }} />)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: soft, marginTop: 3 }}>
                    {s.chart.labels.map((l, i) => <span key={i}>{l}</span>)}
                  </div>
                </div>
              </div>
            )}
            {s.table && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <colgroup>{s.table.widths.map((w, i) => <col key={i} style={{ width: `${(w / sum) * 100}%` }} />)}</colgroup>
                  <thead>
                    <tr>{s.table.head.map((h, i) => (
                      <th key={h} style={{ ...cell, fontSize: 9.5, color: soft, fontWeight: 600, borderBottom: `2px solid ${ink}`, textAlign: i ? "right" : "left" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, ri) => (
                      <tr key={ri}>{r.map((c, i) => (
                        <td key={i} style={{ ...cell, textAlign: i ? "right" : "left", whiteSpace: i ? "nowrap" : "normal", fontVariantNumeric: "tabular-nums", fontWeight: s.table!.bold?.includes(i) ? 700 : 400 }}>{c}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.note && <p style={{ fontSize: 10.5, color: soft, margin: "6px 0 0", lineHeight: 1.5 }}>{s.note}</p>}
          </section>
        );
      })}
      {doc.footer && <p style={{ fontSize: 10, color: soft, borderTop: `1px solid ${rule}`, marginTop: 24, paddingTop: 10, lineHeight: 1.5 }}>{doc.footer}</p>}
    </div>
  );
}
