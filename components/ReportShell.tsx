"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { sharePdf } from "@/lib/pdfDoc";
import { ReportDoc, buildReportPdf } from "@/lib/reportPdf";
import { btnMuted, btnPrimary } from "@/components/ui";

// The paper around a monthly report (ReportSheet, TeamReportSheet), the way
// PrintSheet holds a quote: its name and Tutup on top, "Simpan / kirim PDF"
// (a real file, for the phone, where window.print() does nothing) and Cetak
// for a mouse. On a phone the actions sit at the bottom by the thumb
// (globals.css, .sp-pdf).

export default function ReportShell({ title, fileName, doc, onClose, children }: {
  title: string; fileName: string; doc: ReportDoc; onClose: () => void; children: ReactNode;
}) {
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [msg, setMsg] = useState("");
  const key = JSON.stringify(doc);

  // Built as the sheet opens, so the tap can go straight to the share sheet (iOS).
  useEffect(() => {
    let live = true;
    setPdf(null);
    buildReportPdf(doc).then(x => { if (live) setPdf(x); }, () => { if (live) setMsg("PDF gagal dibuat. Coba tutup lalu buka lagi."); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The browser names a printed PDF after the page title.
  function printIt() {
    const was = document.title;
    document.title = fileName.replace(/\.pdf$/, "");
    const back = () => { document.title = was; window.removeEventListener("afterprint", back); };
    window.addEventListener("afterprint", back);
    window.print();
    setTimeout(back, 60_000);
  }
  async function save() {
    if (!pdf) return;
    setMsg("");
    const r = await sharePdf(pdf, fileName);
    setMsg(r === "downloaded" ? `${fileName} tersimpan di Downloads.` : r === "shared" ? "PDF dikirim." : "");
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay print-overlay sp-pdf" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="print-frame" aria-label={`${title}, PDF`}
        style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="no-print sp-print-head">
          <div className="sp-print-title">{title}</div>
          <div className="sp-print-actions">
            <button onClick={printIt} className="pointer-only" style={btnMuted}>Cetak</button>
            <button onClick={save} disabled={!pdf} aria-busy={!pdf} className="sp-print-main" style={{ ...btnPrimary, opacity: pdf ? 1 : 0.6 }}>{pdf ? "Simpan / kirim PDF" : "Menyiapkan PDF…"}</button>
          </div>
          <button onClick={onClose} aria-label="Tutup" title="Tutup (Esc)" style={{ ...btnMuted, minHeight: 44, padding: "0 16px" }}>Tutup</button>
        </div>
        <div className="no-print sp-print-msg" role="status" style={{ fontSize: 13, color: "#fff", textAlign: "right" }}>{msg}</div>
        {children}
      </div>
    </div>,
    document.body
  );
}
