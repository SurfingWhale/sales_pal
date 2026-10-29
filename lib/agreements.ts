"use client";

// Papers that can go out with a quote (PRD-011): a work agreement (SPK /
// Perjanjian Kerja) and an NDA. Each is the business's own template with the
// quote's details filled in, editable before sending, and frozen once sent.
// A template is not legal advice; the editor says so.

import type { jsPDF as JsPDF } from "jspdf";
import { Agreement, DocTerms, Issuer, Quote, longDate, rupiah, scheduleOf, termAmounts, total } from "@/lib/billing";
import { fullDay } from "@/lib/when";
import { mapsUrl, validGeo } from "@/lib/geo";
import { pngOf, safe } from "@/lib/pdfDoc";

export type AgreementKind = "spk" | "nda";

export const DEFAULT_SPK_TITLE = "Perjanjian Kerja";

export const DEFAULT_SPK = `1. Ruang lingkup
{bisnis} mengerjakan {project} untuk {klien}, sesuai item dan deliverables di penawaran {nomor}.

2. Waktu dan tempat
{tanggal_acara}{lokasi}.

3. Biaya dan pembayaran
Total biaya {total}. {pembayaran}

4. Revisi
{revisi}

5. Pembatalan dan jadwal ulang
{pembatalan}

6. Hak pakai hasil
Hasil boleh dipakai {klien} untuk keperluan yang disebut di penawaran. {bisnis} boleh menampilkan hasil di portofolio, kecuali disepakati lain secara tertulis.

7. Lain-lain
Hal yang belum diatur di sini dibicarakan bersama dengan itikad baik.`;

export const DEFAULT_NDA = `1. Informasi rahasia
Semua informasi yang {klien} bagikan untuk {project} dan belum dipublikasikan, termasuk konsep, materi, dan data bisnis.

2. Kewajiban
{bisnis} tidak membagikan informasi rahasia ke pihak lain dan hanya memakainya untuk mengerjakan {project}.

3. Pengecualian
Informasi yang sudah publik, sudah diketahui sebelumnya, atau wajib dibuka menurut hukum.

4. Jangka waktu
Berlaku sejak ditandatangani sampai 1 tahun setelah {project} selesai, kecuali disepakati lain.`;

// The payment schedule in plain words: "DP 50% (Rp…) saat booking, Pelunasan 50% (Rp…) H-1 acara."
export function paymentLine(q: Pick<Quote, "items" | "discount" | "dpPercent" | "taxPercent" | "schedule">, t: DocTerms = {}): string {
  const terms = scheduleOf(q, t);
  if (terms.length === 1) return `Dibayar penuh${terms[0].when ? ` ${terms[0].when}` : ""}.`;
  const amt = termAmounts(total(q), terms);
  return terms.map((x, i) => `${x.label} ${x.percent}% (${rupiah(amt[i])})${x.when ? ` ${x.when}` : ""}`).join(", ") + ".";
}

export function fillAgreement(template: string, q: Quote, issuer: Issuer, t: DocTerms = {}): string {
  const map: Record<string, string> = {
    bisnis: issuer.name || "Penyedia jasa",
    klien: q.leadName || "Klien",
    project: q.project?.trim() || q.items.map(i => i.name).join(", ") || "pekerjaan",
    nomor: q.number,
    tanggal: longDate(q.date),
    tanggal_acara: q.eventDate ? fullDay(q.eventDate) : "Tanggal menyusul",
    lokasi: (q.venue?.trim() ? `, di ${q.venue.trim()}` : "") + (validGeo(q.venueGeo) ? ` (peta: ${mapsUrl(q.venueGeo)})` : ""),
    total: rupiah(total(q)),
    pembayaran: paymentLine(q, t),
    revisi: t.revisions?.trim() || "Sesuai kesepakatan di penawaran.",
    pembatalan: t.cancellation?.trim() || "Dibicarakan bersama; DP mengikuti kesepakatan kedua pihak.",
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m));
}

export function agreementNumber(q: Quote, kind: AgreementKind): string {
  return `${kind === "spk" ? "SPK" : "NDA"}-${q.number.replace(/^Q-/, "")}`;
}

export function agreementName(q: Quote, kind: AgreementKind): string {
  const who = q.leadName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return `${agreementNumber(q, kind)}${who ? `_${who}` : ""}.pdf`;
}

// The agreement as a PDF: letterhead, title, the two parties, the filled
// text, and two signature blocks left empty (signing happens outside).
export async function buildAgreementPdf(kind: AgreementKind, q: Quote, a: Pick<Agreement, "title" | "body">, issuer: Issuer): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf: JsPDF = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 20, R = W - M;
  const INK: [number, number, number] = [20, 20, 20], SOFT: [number, number, number] = [87, 96, 106];
  let y = M;
  const text = (s: string, x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}) => {
    pdf.setFont("helvetica", o.bold ? "bold" : "normal"); pdf.setFontSize(o.size || 10); pdf.setTextColor(...(o.color || INK));
    pdf.text(safe(s), x, yy, { align: o.align || "left" });
  };
  const wrap = (s: string, width: number, size: number) => { pdf.setFontSize(size); return pdf.splitTextToSize(safe(s), width) as string[]; };
  const room = (need: number) => { if (y + need > H - M) { pdf.addPage(); y = M; } };

  // Letterhead.
  let left = M;
  const logo = issuer.logo ? await pngOf(issuer.logo) : null;
  if (logo) { const h = Math.min(16, (36 * logo.h) / logo.w), w = (h * logo.w) / logo.h; pdf.addImage(logo.url, "PNG", M, y, w, h); left = M + w + 5; }
  let ly = y + 5;
  if (issuer.name) { text(issuer.name, left, ly, { size: 13, bold: true }); ly += 5; }
  const contact = [issuer.phone, issuer.email, issuer.address].filter(Boolean).join("  ·  ");
  if (contact) wrap(contact, R - left, 8.5).forEach(l => { text(l, left, ly, { size: 8.5, color: SOFT }); ly += 4; });
  y = Math.max(ly, y + (logo ? 18 : 12)) + 8;

  // Title and number.
  text(a.title.toUpperCase(), W / 2, y, { size: 15, bold: true, align: "center" }); y += 6;
  text(`No. ${agreementNumber(q, kind)}  ·  ${longDate(q.date)}  ·  merujuk penawaran ${q.number}`, W / 2, y, { size: 9, color: SOFT, align: "center" }); y += 10;

  // The parties.
  const party = (label: string, lines: string[], x: number) => {
    text(label, x, y, { size: 7.5, color: SOFT });
    lines.filter(Boolean).forEach((l, i) => text(l, x, y + 5 + i * 4.6, { size: i === 0 ? 10.5 : 9, bold: i === 0 }));
  };
  party("PIHAK PERTAMA (PENYEDIA JASA)", [issuer.name || "—", issuer.phone, issuer.address || ""], M);
  party("PIHAK KEDUA (KLIEN)", [q.leadName || "—", q.contact && q.contact !== q.leadName ? q.contact : "", q.phone], W / 2 + 4);
  y += 22;

  // The text, paragraph by paragraph; a line starting "N." is a heading.
  a.body.split("\n").forEach(raw => {
    const l = raw.trimEnd();
    if (!l.trim()) { y += 2.5; return; }
    const head = /^\d+\.\s/.test(l);
    const lines = wrap(l, R - M, head ? 10.5 : 10);
    room(lines.length * 5 + 2);
    lines.forEach(w => { text(w, M, y, { size: head ? 10.5 : 10, bold: head }); y += 5; });
    if (head) y += 0.5;
  });

  // Signatures.
  room(44); y += 10;
  text("Disetujui oleh,", M, y, { size: 9, color: SOFT }); y += 6;
  const sign = (label: string, who: string, x: number) => {
    text(label, x, y, { size: 9 });
    pdf.setDrawColor(...INK); pdf.setLineWidth(0.3); pdf.line(x, y + 24, x + 70, y + 24);
    text(who, x, y + 29, { size: 9.5, bold: true });
    text("Nama, tanda tangan, tanggal", x, y + 33.5, { size: 7.5, color: SOFT });
  };
  sign("Pihak Pertama", issuer.name || "", M);
  sign("Pihak Kedua", q.leadName || "", W / 2 + 4);
  return pdf.output("blob");
}
