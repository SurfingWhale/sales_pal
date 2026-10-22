"use client";

import { useEffect, useMemo, useState } from "react";
import { Business, Quote, issuerOf, quoteText, termsOf, waLink } from "@/lib/billing";
import { buildPdf, pdfName, sharePdfs } from "@/lib/pdfDoc";
import { AgreementKind, DEFAULT_NDA, DEFAULT_SPK, DEFAULT_SPK_TITLE, agreementName, buildAgreementPdf, fillAgreement } from "@/lib/agreements";
import { btnMuted, btnPrimary, font, inputStyle, label, modalBox, WA_INK } from "@/components/ui";

// Sending a quote, with the papers that go with it (PRD-011, owner: "SPK dll
// buat lebih mudah dipakai ketika mau mengirimkan penawaran"). The quote is
// always in; the work agreement and the NDA are a tick each, already filled
// from the quote and the business's own templates, and can be read and changed
// before they go. Sending freezes the letterhead and the terms on the quote.

export interface SentPatch {
  issuer: ReturnType<typeof issuerOf>;
  terms: ReturnType<typeof termsOf>;
  spk?: { title: string; body: string };
  nda?: { title: string; body: string };
}

export default function SendQuoteSheet({ q, business, onSent, onClose }: {
  q: Quote; business: Business; onSent: (p: SentPatch) => Promise<void>; onClose: () => void;
}) {
  const issuer = useMemo(() => q.issuer || issuerOf(business), [q.issuer, business]);
  const terms = useMemo(() => q.terms || termsOf(business), [q.terms, business]);
  const d = business.docs || {};
  const spkSigned = !!q.spk?.signedAt, ndaSigned = !!q.nda?.signedAt;
  const [spkOn, setSpkOn] = useState(true);
  const [ndaOn, setNdaOn] = useState(!!q.nda);
  const [spkTitle, setSpkTitle] = useState(q.spk?.title || d.spkTitle || DEFAULT_SPK_TITLE);
  const [spkBody, setSpkBody] = useState(q.spk?.body || fillAgreement(d.spkTemplate || DEFAULT_SPK, q, issuer, terms));
  const [ndaBody, setNdaBody] = useState(q.nda?.body || fillAgreement(d.ndaTemplate || DEFAULT_NDA, q, issuer, terms));
  const [files, setFiles] = useState<{ blob: Blob; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // iOS shares only straight from a tap, so the PDFs are ready before it.
  useEffect(() => {
    let live = true;
    setFiles(null);
    const t = setTimeout(async () => {
      try {
        const out = [{ blob: await buildPdf({ kind: "quote", data: q }, issuer), name: pdfName({ kind: "quote", data: q }) }];
        const add = async (kind: AgreementKind, title: string, body: string) =>
          out.push({ blob: await buildAgreementPdf(kind, q, { title, body }, issuer), name: agreementName(q, kind) });
        if (spkOn) await add("spk", spkTitle, spkBody);
        if (ndaOn) await add("nda", "Perjanjian Kerahasiaan (NDA)", ndaBody);
        if (live) setFiles(out);
      } catch {
        if (live) setMsg("PDF gagal dibuat. Coba tutup lalu buka lagi.");
      }
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [q, issuer, spkOn, ndaOn, spkTitle, spkBody, ndaBody]);

  const patch = (): SentPatch => ({
    issuer, terms,
    ...(spkOn ? { spk: { title: spkTitle.trim() || DEFAULT_SPK_TITLE, body: spkBody } } : {}),
    ...(ndaOn ? { nda: { title: "Perjanjian Kerahasiaan (NDA)", body: ndaBody } } : {}),
  });

  async function share() {
    if (!files) return;
    setBusy(true); setMsg("");
    const r = await sharePdfs(files);
    if (r === "cancelled") { setBusy(false); return; }
    try { await onSent(patch()); onClose(); } catch { setMsg("Terkirim, tapi gagal dicatat. Cek koneksi lalu tandai terkirim."); setBusy(false); }
  }

  async function sendWa() {
    const extra = [spkOn && `${spkTitle} terlampir`, ndaOn && "NDA terlampir"].filter(Boolean).join(", ");
    window.open(waLink(q.phone, quoteText(q, issuer) + (extra ? `\n\n(${extra} dalam PDF.)` : "")), "_blank");
    setBusy(true);
    try { await onSent(patch()); onClose(); } catch { setMsg("Gagal dicatat. Cek koneksi."); setBusy(false); }
  }

  const row = (on: boolean, set: (v: boolean) => void, title: string, hint: string, locked?: boolean) => (
    <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 14px", cursor: locked ? "default" : "pointer", boxShadow: "inset 0 -1px 0 var(--app-border)" }}>
      <input type="checkbox" checked={on} disabled={locked} onChange={e => set(e.target.checked)} style={{ width: 22, height: 22, accentColor: "#005eb0", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, color: "var(--app-muted)" }}>{hint}</span>
      </span>
    </label>
  );

  const editor = (id: string, title: string, setTitle: ((v: string) => void) | null, body: string, setBody: (v: string) => void, signed: boolean) => (
    <details style={{ padding: "4px 14px 12px", boxShadow: "inset 0 -1px 0 var(--app-border)" }}>
      <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 600, color: "var(--brand-text)" }}>Lihat & ubah isi {title}</summary>
      {signed ? <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 0" }}>Udah ditandatangani, isinya ga diubah.</p> : <>
        {setTitle && <div style={{ marginBottom: 10 }}>
          <label htmlFor={`${id}-title`} style={label}>Judul dokumen</label>
          <input id={`${id}-title`} value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>}
        <label htmlFor={`${id}-body`} style={label}>Isi</label>
        <textarea id={`${id}-body`} value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, height: 220, resize: "vertical", lineHeight: 1.5 }} />
      </>}
    </details>
  );

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="send-h" onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 520 }}>
        <div id="send-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font }}>Kirim penawaran</div>
        <p style={{ fontSize: 13, color: "var(--app-muted)", margin: "4px 0 16px" }}>
          {q.number} buat {q.leadName || "klien"}. Pilih yang ikut dikirim; isinya udah keisi dari penawaran dan Kop & logo.
        </p>

        <div style={{ background: "var(--app-inner)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          {row(true, () => {}, `Penawaran ${q.number}`, "Selalu ikut", true)}
          {row(spkOn, setSpkOn, spkTitle || DEFAULT_SPK_TITLE, spkSigned ? "Udah ditandatangani" : "SPK: ruang lingkup, biaya & DP, revisi, pembatalan, tanda tangan", spkSigned)}
          {spkOn && editor("spk", spkTitle, setSpkTitle, spkBody, setSpkBody, spkSigned)}
          {row(ndaOn, setNdaOn, "NDA (kerahasiaan)", ndaSigned ? "Udah ditandatangani" : "Opsional, kalau project-nya rahasia", ndaSigned)}
          {ndaOn && editor("nda", "NDA", null, ndaBody, setNdaBody, ndaSigned)}
        </div>
        <p style={{ fontSize: 12, color: "var(--app-muted)", margin: "0 0 4px" }}>
          Template ini bukan nasihat hukum: cek dan sesuaikan isinya sebelum dikirim. Kop dan syarat dikunci ke penawaran ini saat dikirim.
          Perjanjian dianggap ditandatangani hanya setelah kamu menandainya.
        </p>
        <div role="status" style={{ fontSize: 13, color: "var(--hot)", marginTop: msg ? 8 : 0 }}>{msg}</div>

        <div className="sp-form-foot" style={{ flexWrap: "wrap" }}>
          <button onClick={onClose} disabled={busy} style={btnMuted}>Batal</button>
          <button onClick={sendWa} disabled={busy} style={{ ...btnMuted, background: "#25D366", color: WA_INK }}>Kirim teks WA</button>
          <button onClick={share} disabled={busy || !files} style={{ ...btnPrimary, flex: 1, opacity: busy || !files ? 0.6 : 1 }}>
            {!files ? "Menyiapkan PDF…" : `Bagikan PDF (${files.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
