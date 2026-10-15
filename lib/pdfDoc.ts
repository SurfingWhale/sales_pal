"use client";

// A quote or invoice as a real PDF file, written on the phone (QA 15 Okt: in
// the installed iPhone app window.print() does nothing, so there was no way to
// save an invoice and send it). Text stays text: sharp, small, searchable.

import type { jsPDF as JsPDF } from "jspdf";
import { Business, Invoice, Quote, balance, dpAmount, longDate, paid, rupiah, subtotal, total } from "@/lib/billing";
import { fullDay } from "@/lib/when";

export type Doc = { kind: "quote"; data: Quote } | { kind: "invoice"; data: Invoice };

const INK: [number, number, number] = [20, 20, 20];
const SOFT: [number, number, number] = [87, 96, 106];
const RULE: [number, number, number] = [208, 215, 222];

// The standard PDF fonts only know Latin-1 plus a few marks; swap the rest.
export function safe(s: string): string {
  return (s || "")
    .replace(/[→⟶➜]/g, "->").replace(/[✓✔]/g, "v").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—•…€]/g, "");
}

// Any logo (PNG, WEBP, SVG data URL) as a PNG the PDF can hold, with its size.
async function pngOf(src: string): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 300;
    c.height = img.naturalHeight || 100;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL("image/png"), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

export function pdfName(d: Doc): string {
  const who = d.data.leadName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return `${d.data.number}${who ? `_${who}` : ""}.pdf`;
}

export async function buildPdf(d: Doc, b: Business): Promise<Blob> {
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
  const wrap = (s: string, width: number, size: number) => { pdf.setFontSize(size); return pdf.splitTextToSize(safe(s), width) as string[]; };
  const room = (need: number) => { if (y + need > H - M) { pdf.addPage(); y = M; } };
  const line = (x1: number, yy: number, x2: number, width = 0.2, color = RULE) => { pdf.setDrawColor(...color); pdf.setLineWidth(width); pdf.line(x1, yy, x2, yy); };

  // Letterhead: logo and who you are on the left, what this is on the right.
  let left = M;
  const logo = b.logo ? await pngOf(b.logo) : null;
  if (logo) {
    const h = Math.min(18, (40 * logo.h) / logo.w), w = (h * logo.w) / logo.h;
    pdf.addImage(logo.url, "PNG", M, y, w, h);
    left = M + w + 5;
  }
  let ly = y + 5;
  if (b.name) { text(b.name, left, ly, { size: 14, bold: true }); ly += 5.5; }
  if (b.tagline) { text(b.tagline, left, ly, { size: 9, bold: true }); ly += 4.5; }
  const contact = [b.phone, b.email].filter(Boolean).join("  ·  ");
  if (contact) { text(contact, left, ly, { size: 8.5, color: SOFT }); ly += 4; }
  if (b.address) { text(b.address, left, ly, { size: 8.5, color: SOFT }); ly += 4; }
  text(d.kind === "quote" ? "PENAWARAN" : "INVOICE", R, y + 7, { size: 20, bold: true, align: "right" });
  text(d.data.number, R, y + 13, { size: 10, bold: true, align: "right" });
  y = Math.max(ly, y + (logo ? 20 : 16)) + 8;

  // To whom, and the dates.
  text("UNTUK", M, y, { size: 7.5, color: SOFT });
  const dates: [string, string][] = [["Tanggal", longDate(d.data.date)]];
  if (d.kind === "quote") dates.push(["Berlaku s/d", longDate(d.data.validUntil)]);
  else dates.push(["Jatuh tempo", longDate(d.data.dueDate)]);
  dates.forEach(([k, v], i) => text(`${k}: ${v}`, R, y + i * 4.5, { size: 9, align: "right" }));
  let ty = y + 5;
  text(d.data.leadName, M, ty, { size: 11, bold: true }); ty += 5;
  if (d.data.contact && d.data.contact !== d.data.leadName) { text(d.data.contact, M, ty, { size: 9 }); ty += 4.5; }
  if (d.data.phone) { text(d.data.phone, M, ty, { size: 9 }); ty += 4.5; }
  y = Math.max(ty, y + dates.length * 4.5) + 6;

  // The job: its title, then when and where.
  const x = d.data;
  if (x.project?.trim()) {
    const t = wrap(x.project.trim(), R - M, 13);
    t.forEach(l => { text(l, M, y, { size: 13, bold: true }); y += 5.8; });
    y += 1;
  }
  const facts: [string, string][] = ([
    ["Tanggal", x.eventDate ? fullDay(x.eventDate) : ""], ["Jam", x.eventTime || ""], ["Lokasi", x.venue || ""],
  ] as [string, string][]).filter(([, v]) => v.trim());
  if (facts.length) {
    const rows = facts.map(([k, v]) => [k, wrap(v, R - M - 30, 9.5)] as [string, string[]]);
    const h = rows.reduce((a, [, ls]) => a + ls.length * 4.6, 0) + 9;
    room(h + 4);
    pdf.setFillColor(246, 247, 249); pdf.roundedRect(M, y, R - M, h, 1.5, 1.5, "F");
    text("DETAIL ACARA", M + 4, y + 5, { size: 7.5, color: SOFT });
    let fy = y + 10;
    rows.forEach(([k, ls]) => { text(k, M + 4, fy, { size: 9, color: SOFT }); ls.forEach((l, i) => text(l, M + 26, fy + i * 4.6, { size: 9.5, bold: i === 0 && k === "Tanggal" })); fy += ls.length * 4.6; });
    y += h + 7;
  } else if (x.project?.trim()) y += 3;

  // Items: name, then what's included, under it.
  const cQty = 128, cPrice = 158;
  const head = () => {
    text("#", M, y, { size: 7.5, color: SOFT }); text("LAYANAN & SCOPE", M + 7, y, { size: 7.5, color: SOFT });
    text("QTY", cQty, y, { size: 7.5, color: SOFT, align: "right" }); text("HARGA", cPrice, y, { size: 7.5, color: SOFT, align: "right" });
    text("JUMLAH", R, y, { size: 7.5, color: SOFT, align: "right" });
    y += 2; line(M, y, R, 0.5, INK); y += 5;
  };
  head();
  d.data.items.forEach((it, i) => {
    const name = wrap(it.name, cQty - 14 - M - 7, 9.5);
    const desc = it.description?.trim() ? wrap(it.description.trim(), cQty - 14 - M - 7, 8.5) : [];
    room(name.length * 4.5 + desc.length * 4 + 6);
    text(String(i + 1), M, y, { size: 9, color: SOFT });
    name.forEach((l, k) => text(l, M + 7, y + k * 4.5, { size: 9.5, bold: true }));
    text(String(it.qty), cQty, y, { size: 9.5, align: "right" });
    text(rupiah(it.price), cPrice, y, { size: 9.5, align: "right" });
    text(rupiah(it.qty * it.price), R, y, { size: 9.5, align: "right" });
    y += name.length * 4.5;
    desc.forEach(l => { text(l, M + 7, y, { size: 8.5, color: SOFT }); y += 4; });
    y += 1.5; line(M, y, R); y += 5;
  });

  // What the client gets.
  const del = (x.deliverables || "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (del.length) {
    room(10);
    text("DELIVERABLES", M, y, { size: 7.5, color: SOFT }); y += 5;
    del.forEach(l => wrap(l, R - M - 6, 9.5).forEach((w, i) => { room(5); if (i === 0) text("•", M + 1, y, { size: 9.5 }); text(w, M + 6, y, { size: 9.5 }); y += 4.6; }));
    y += 5;
  }

  // Totals on the right.
  room(40);
  const tx = 120;
  const row = (k: string, v: string, strong = false) => { text(k, tx, y, { size: strong ? 11 : 9.5, bold: strong }); text(v, R, y, { size: strong ? 11 : 9.5, bold: strong, align: "right" }); y += strong ? 6 : 5; };
  if (d.data.discount > 0) { row("Subtotal", rupiah(subtotal(d.data.items))); row("Diskon", `-${rupiah(d.data.discount)}`); }
  line(tx, y - 3, R, 0.5, INK); y += 1.5;
  row("Total", rupiah(total(d.data)), true);
  if (d.kind === "quote" && d.data.dpPercent > 0) row(`DP ${d.data.dpPercent}%`, rupiah(dpAmount(d.data)));
  if (d.kind === "invoice") {
    const inv = d.data, p = paid(inv);
    if (p > 0) row("Sudah dibayar", `-${rupiah(p)}`);
    row(p === 0 && inv.dpPercent ? `DP ${inv.dpPercent}% dibayar dulu` : "Sisa tagihan", rupiah(p === 0 && inv.dpPercent ? dpAmount(inv) : balance(inv)), true);
  }
  y += 4;

  // Where to pay, what's been paid.
  if (d.kind === "invoice" && b.bank && b.accountNo) {
    room(18);
    pdf.setDrawColor(...RULE); pdf.setLineWidth(0.3); pdf.roundedRect(M, y, R - M, 13, 1.5, 1.5);
    text("PEMBAYARAN", M + 4, y + 5, { size: 7.5, color: SOFT });
    text(`${b.bank} ${b.accountNo}${b.accountName ? ` a.n. ${b.accountName}` : ""}`, M + 4, y + 10, { size: 10, bold: true });
    y += 19;
  }
  if (d.kind === "invoice" && d.data.payments?.length) {
    room(8 + d.data.payments.length * 4.5);
    text("RIWAYAT PEMBAYARAN", M, y, { size: 7.5, color: SOFT }); y += 4.5;
    d.data.payments.forEach(p => { text(`${longDate(p.date)}  ·  ${rupiah(p.amount)}${p.note ? `  ·  ${p.note}` : ""}`, M, y, { size: 8.5, color: SOFT }); y += 4.5; });
    y += 3;
  }

  // Notes, then the terms.
  const block = (title: string, body: string) => {
    const lines = wrap(body, R - M, 8.5);
    room(10);
    text(title, M, y, { size: 7.5, color: SOFT }); y += 4.5;
    lines.forEach(l => { room(4.5); text(l, M, y, { size: 8.5, color: SOFT }); y += 4; });
    y += 4;
  };
  if (d.data.notes?.trim()) block("CATATAN", d.data.notes.trim());
  if (b.footer?.trim()) { room(12); line(M, y - 2, R); y += 3; block("SYARAT & KETENTUAN", b.footer.trim()); }

  return pdf.output("blob");
}

// Save or send it: the share sheet on phones (WhatsApp, Files, Mail), a
// download everywhere else. iOS only shares straight from a tap, so the PDF
// is built beforehand (buildPdf) and this does no waiting before share().
export async function sharePdf(blob: Blob, name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], name, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (x: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
