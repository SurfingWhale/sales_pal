"use client";

// A monthly report (Report Klien, Report Tim) as a real PDF file, for the
// phone: in the installed iPhone app window.print() does nothing (QA 15 Okt).
// Plain text and simple tables on A4, the same numbers as the paper on screen.

import type { jsPDF as JsPDF } from "jspdf";
import { safe } from "@/lib/pdfDoc";

const INK: [number, number, number] = [20, 20, 20];
const SOFT: [number, number, number] = [87, 96, 106];
const RULE: [number, number, number] = [208, 215, 222];

export interface ReportTable {
  head: string[];
  rows: string[][];
  // Relative column widths; numbers (every column but the first) sit right.
  widths: number[];
  bold?: number[];
}
// A count per day as bars (Laporan tim, PRD-014): labels under the first,
// middle and last bar.
export interface ReportChart { values: number[]; labels: string[] }
export interface ReportSection { title: string; lines?: string[]; table?: ReportTable; chart?: ReportChart; note?: string }

// Gridline steps for a bar chart: 0, half, top (top a round number ≥ the max).
export function chartTop(max: number): number {
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find(s => s * 2 >= max) || Math.ceil(max / 2);
  return step * 2;
}
export interface ReportDoc { kicker: string; title: string; subtitle: string; meta: string[]; sections: ReportSection[]; footer?: string }

// "Kopi Senja", "2026-10" → Report_Kopi_Senja_2026-10.pdf
export function reportName(what: string, month: string): string {
  const who = what.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return `Report${who ? `_${who}` : ""}_${month}.pdf`;
}

export async function buildReportPdf(r: ReportDoc): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf: JsPDF = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 18, R = W - M;
  let y = M;
  const text = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" } = {}) => {
    pdf.setFont("helvetica", o.bold ? "bold" : "normal");
    pdf.setFontSize(o.size || 9.5);
    pdf.setTextColor(...(o.color || INK));
    pdf.text(safe(s), x, yy, { align: o.align || "left" });
  };
  const wrap = (s: string, width: number, size: number, bold = false) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); return pdf.splitTextToSize(safe(s), width) as string[]; };
  const room = (need: number) => { if (y + need > H - M) { pdf.addPage(); y = M; } };
  const line = (yy: number, width = 0.2, color = RULE) => { pdf.setDrawColor(...color); pdf.setLineWidth(width); pdf.line(M, yy, R, yy); };

  // Head: what this is on the left, its status on the right.
  text(r.kicker, M, y + 2, { size: 7.5, color: SOFT });
  wrap(r.title, R - M - 60, 18, true).forEach((l, i) => text(l, M, y + 10 + i * 7, { size: 18, bold: true }));
  const tl = wrap(r.title, R - M - 60, 18, true).length;
  text(r.subtitle, M, y + 10 + tl * 7, { size: 11, bold: true });
  r.meta.forEach((m, i) => text(m, R, y + 2 + i * 4.5, { size: 8.5, color: i === 0 ? INK : SOFT, bold: i === 0 && r.meta.length > 1, align: "right" }));
  y = Math.max(y + 12 + tl * 7, y + 4 + r.meta.length * 4.5) + 3;
  line(y, 0.6, INK);
  y += 9;

  for (const s of r.sections) {
    room(16);
    text(s.title.toUpperCase(), M, y, { size: 9, bold: true });
    y += 6;
    s.lines?.forEach(l => wrap(l, R - M, 9.5).forEach(w => { room(5); text(w, M, y, { size: 9.5 }); y += 4.6; }));
    if (s.lines?.length) y += 2;
    if (s.table) {
      const t = s.table;
      const sum = t.widths.reduce((a, n) => a + n, 0);
      const xs: number[] = [];
      let acc = M;
      t.widths.forEach(w => { xs.push(acc); acc += ((R - M) * w) / sum; });
      const right = (i: number) => (i === t.widths.length - 1 ? R : xs[i + 1] - 2);
      const head = () => {
        let hh = 0;
        t.head.forEach((h, i) => { const ls = wrap(h, (i ? right(i) - xs[i] : xs[1] - xs[0] - 2), 7); hh = Math.max(hh, ls.length); ls.forEach((l, k) => text(l, i ? right(i) : xs[0], y + k * 3.2, { size: 7, color: SOFT, align: i ? "right" : "left" })); });
        y += (hh - 1) * 3.2 + 2; line(y, 0.5, INK); y += 4.6;
      };
      room(14); head();
      t.rows.forEach(row => {
        const first = wrap(row[0], xs[1] - xs[0] - 2, 9.5, t.bold?.includes(0));
        const h = first.length * 4.4 + 2.6;
        if (y + h > H - M) { pdf.addPage(); y = M; head(); }
        first.forEach((l, k) => text(l, xs[0], y + k * 4.4, { size: 9.5, bold: t.bold?.includes(0) }));
        row.slice(1).forEach((c, j) => text(c, right(j + 1), y, { size: 9.5, bold: t.bold?.includes(j + 1), align: "right" }));
        y += h - 4.4 + 1.2; line(y); y += 4.6;
      });
    }
    if (s.chart && s.chart.values.length) {
      const c = s.chart, CH = 34, L = M + 8, n = c.values.length;
      room(CH + 12);
      const top = chartTop(Math.max(1, ...c.values));
      const yAt = (v: number) => y + CH - (CH * v) / top;
      [0, top / 2, top].forEach(v => {
        pdf.setDrawColor(...RULE); pdf.setLineWidth(v ? 0.15 : 0.4); pdf.line(L, yAt(v), R, yAt(v));
        text(String(v), L - 2, yAt(v) + 1, { size: 7, color: SOFT, align: "right" });
      });
      const slot = (R - L) / n, bw = Math.max(0.6, slot * 0.7);
      pdf.setFillColor(...INK);
      c.values.forEach((v, i) => { if (v > 0) pdf.rect(L + i * slot + (slot - bw) / 2, yAt(v), bw, (CH * v) / top, "F"); });
      const at = [0, Math.floor((n - 1) / 2), n - 1];
      c.labels.forEach((lab, k) => { if (lab && at[k] !== undefined) text(lab, L + at[k] * slot + slot / 2, y + CH + 4.5, { size: 7, color: SOFT, align: k === 0 ? "left" : k === 2 ? "right" : "left" }); });
      y += CH + 9;
    }
    if (s.note) wrap(s.note, R - M, 8).forEach(w => { room(4.5); text(w, M, y, { size: 8, color: SOFT }); y += 3.8; });
    y += 6;
  }

  if (r.footer) {
    room(14); line(y - 3);
    y += 2;
    wrap(r.footer, R - M, 7.5).forEach(w => { room(4); text(w, M, y, { size: 7.5, color: SOFT }); y += 3.5; });
  }
  return pdf.output("blob");
}
