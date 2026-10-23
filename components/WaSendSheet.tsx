"use client";

// Sending through your own WhatsApp (owner, 23 Okt: "button buat open ke WA,
// semi manual, ga pakai API"): SalesPal readies the message and the PDF, you
// press send in WhatsApp (Business). Two steps, in this order — open the chat
// with the words filled in, then attach the PDF from the share sheet (WhatsApp
// on iPhone drops words sent along with a file, so they go first). The first
// step is the send: it's logged at once, with Batal to take it back.

import { useEffect, useState, type ReactNode } from "react";
import { waLink, waNumber } from "@/lib/billing";
import { sharePdfs } from "@/lib/pdfDoc";
import { btnMuted, btnPrimary, chip, font, inputStyle, modalBox, WA_INK } from "@/components/ui";

export type PdfFile = { blob: Blob; name: string };

export default function WaSendSheet({ title, who, phone, text: first, makeFiles, filesKey = "", logged: loggedLabel, onSent, onClose, children, note }: {
  title: string; who: string; phone: string; text: string;
  makeFiles?: () => Promise<PdfFile[]>; filesKey?: string;   // rebuilt when filesKey changes
  logged: string;                                            // "Penawaran Q-012 ditandai terkirim"
  onSent: () => Promise<(() => Promise<void>) | void>;
  onClose: () => void;
  children?: ReactNode;                                      // what goes along (SPK, NDA)
  note?: ReactNode;
}) {
  const [text, setText] = useState(first);
  const [files, setFiles] = useState<PdfFile[] | null>(null);
  const [fileErr, setFileErr] = useState("");
  const [done, setDone] = useState<{ wa: boolean; pdf: boolean }>({ wa: false, pdf: false });
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [isLogged, setIsLogged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const hasPhone = !!waNumber(phone);

  // iOS shares only straight from a tap, so the PDFs are ready before it.
  useEffect(() => {
    if (!makeFiles) return;
    let live = true;
    setFiles(null); setFileErr("");
    const t = setTimeout(() => makeFiles().then(f => { if (live) setFiles(f); }, () => { if (live) setFileErr("PDF gagal dibuat. Tutup lalu buka lagi."); }), 300);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesKey]);

  async function log() {
    if (isLogged) return;
    setIsLogged(true); setMsg("");
    try { const u = await onSent(); setUndo(() => (u || null)); }
    catch { setIsLogged(false); setMsg("Gagal dicatat. Cek koneksi lalu coba lagi."); }
  }

  async function openWa() {
    try { await navigator.clipboard?.writeText(text); } catch { /* the link carries the words anyway */ }
    window.open(waLink(phone, text), "_blank");
    setDone(d => ({ ...d, wa: true }));
    await log();
  }

  async function copyText() {
    try { await navigator.clipboard.writeText(text); setMsg("Pesan disalin. Tempel di chat-nya."); await log(); }
    catch { setMsg("Gagal nyalin. Tekan lama teksnya, lalu salin manual."); }
  }

  async function attach() {
    if (!files) return;
    setMsg("");
    try { await navigator.clipboard?.writeText(text); } catch { /* fine */ }
    const r = await sharePdfs(files);
    if (r === "cancelled") return;
    setDone(d => ({ ...d, pdf: true }));
    if (r === "downloaded") setMsg(`PDF tersimpan di perangkat ini (${files.map(f => f.name).join(", ")}). Lampirkan di chat-nya.`);
    await log();
  }

  async function takeBack() {
    if (!undo) return;
    setBusy(true);
    try { await undo(); setUndo(null); setIsLogged(false); setDone({ wa: false, pdf: false }); setMsg("Dibatalin, belum tercatat terkirim."); }
    catch { setMsg("Gagal batalin. Cek koneksi lalu coba lagi."); }
    setBusy(false);
  }

  const step = (n: number, label: string, hint: string, ok: boolean, action: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", boxShadow: "inset 0 -1px 0 var(--app-border)" }}>
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
        background: ok ? "#00a862" : "var(--app-card)", color: ok ? "#fff" : "var(--app-text)", border: ok ? 0 : "1px solid var(--app-line-strong)" }}>{ok ? "✓" : n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 13, color: "var(--app-muted)", lineHeight: 1.4 }}>{hint}</span>
      </span>
      {action}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wa-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 520 }}>
        <div id="wa-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>{title}</div>
        <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 14px" }}>
          Ke {who}{hasPhone ? ` · +${waNumber(phone)}` : ""}. Kirimnya dari WhatsApp kamu sendiri; SalesPal nyiapin isinya dan nyatet.
        </p>

        {children}

        <label htmlFor="wa-text" style={{ display: "block", fontSize: 12, color: "var(--app-muted)", marginBottom: 6 }}>Pesan</label>
        <textarea id="wa-text" value={text} onChange={e => setText(e.target.value)} rows={6}
          style={{ ...inputStyle, fontSize: 16, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.45, marginBottom: 12 }} />

        <div style={{ background: "var(--app-inner)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          {step(1, "Buka chat di WhatsApp", hasPhone ? "Pesannya udah keisi (dan disalin). Kirim di sana, lalu balik ke sini." : "Nomor WA-nya belum ada. Salin pesannya, kirim manual.", done.wa,
            hasPhone
              ? <button onClick={openWa} style={{ ...btnPrimary, minHeight: 44, background: "#25D366", color: WA_INK, flexShrink: 0 }}>Buka WA</button>
              : <button onClick={copyText} style={{ ...chip, minHeight: 44, fontWeight: 700, flexShrink: 0, color: "var(--app-text)" }}>Salin</button>)}
          {makeFiles && step(2, files ? `Lampirkan PDF (${files.length})` : "Lampirkan PDF", fileErr || (files ? "Pilih WhatsApp di share sheet, lalu chat yang sama." : "Menyiapkan PDF…"), done.pdf,
            <button onClick={attach} disabled={!files} aria-busy={!files} style={{ ...chip, minHeight: 44, fontWeight: 700, flexShrink: 0, color: "var(--app-text)", opacity: files ? 1 : 0.6 }}>Bagikan PDF</button>)}
        </div>

        {isLogged && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "10px 12px", borderRadius: 10, background: "#00a8621a", border: "1px solid #00a86240", marginBottom: 10 }}>
            <span style={{ flex: 1 }}>✓ {loggedLabel}.</span>
            {undo && <button onClick={takeBack} disabled={busy} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>Batal</button>}
          </div>
        )}
        {msg && <div role="alert" style={{ fontSize: 13, color: "var(--app-sub)", marginBottom: 10 }}>{msg}</div>}
        {note && <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10, lineHeight: 1.5 }}>{note}</div>}

        <div className="sp-form-foot">
          <button onClick={onClose} disabled={busy} style={{ ...btnMuted, flex: 1 }}>{isLogged ? "Selesai" : "Tutup"}</button>
        </div>
      </div>
    </div>
  );
}
