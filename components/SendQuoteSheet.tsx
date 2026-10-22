"use client";

import { useMemo, useState } from "react";
import { Business, Quote, issuerOf, quoteText, termsOf } from "@/lib/billing";
import { buildPdf, pdfName } from "@/lib/pdfDoc";
import { AgreementKind, DEFAULT_NDA, DEFAULT_SPK, DEFAULT_SPK_TITLE, agreementName, buildAgreementPdf, fillAgreement } from "@/lib/agreements";
import { inputStyle, label } from "@/components/ui";
import WaSendSheet from "@/components/WaSendSheet";

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

// The quote goes through your own WhatsApp (WaSendSheet): its words first,
// then the PDFs. The first step marks it sent and freezes the letterhead and
// terms, with Batal to take that back.
export default function SendQuoteSheet({ q, business, onSent, onClose }: {
  q: Quote; business: Business; onSent: (p: SentPatch) => Promise<(() => Promise<void>) | void>; onClose: () => void;
}) {
  const issuer = useMemo(() => q.issuer || issuerOf(business), [q.issuer, business]);
  const terms = useMemo(() => q.terms || termsOf(business), [q.terms, business]);
  const d = business.docs || {};
  const spkSigned = !!q.spk?.signedAt, ndaSigned = !!q.nda?.signedAt;
  const [spkOn, setSpkOn] = useState(!!d.spkAuto || !!q.spk);
  const [ndaOn, setNdaOn] = useState(!!q.nda);
  const [spkTitle, setSpkTitle] = useState(q.spk?.title || d.spkTitle || DEFAULT_SPK_TITLE);
  const [spkBody, setSpkBody] = useState(q.spk?.body || fillAgreement(d.spkTemplate || DEFAULT_SPK, q, issuer, terms));
  const [ndaBody, setNdaBody] = useState(q.nda?.body || fillAgreement(d.ndaTemplate || DEFAULT_NDA, q, issuer, terms));

  async function makeFiles() {
    const out = [{ blob: await buildPdf({ kind: "quote", data: q }, issuer), name: pdfName({ kind: "quote", data: q }) }];
    const add = async (kind: AgreementKind, title: string, body: string) =>
      out.push({ blob: await buildAgreementPdf(kind, q, { title, body }, issuer), name: agreementName(q, kind) });
    if (spkOn) await add("spk", spkTitle, spkBody);
    if (ndaOn) await add("nda", "Perjanjian Kerahasiaan (NDA)", ndaBody);
    return out;
  }

  const patch = (): SentPatch => ({
    issuer, terms,
    ...(spkOn ? { spk: { title: spkTitle.trim() || DEFAULT_SPK_TITLE, body: spkBody } } : {}),
    ...(ndaOn ? { nda: { title: "Perjanjian Kerahasiaan (NDA)", body: ndaBody } } : {}),
  });

  const extra = [spkOn && `${spkTitle} terlampir`, ndaOn && "NDA terlampir"].filter(Boolean).join(", ");

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
    <WaSendSheet title="Kirim penawaran" who={q.leadName || "klien"} phone={q.phone}
      text={quoteText(q, issuer) + (extra ? `\n\n(${extra} dalam PDF.)` : "")}
      makeFiles={makeFiles} filesKey={JSON.stringify([spkOn, ndaOn, spkTitle, spkBody, ndaBody])}
      logged={`Penawaran ${q.number} tercatat terkirim; kop & syarat dikunci`}
      onSent={() => onSent(patch())} onClose={onClose}
      note="Template perjanjian bukan nasihat hukum: cek dan sesuaikan isinya sebelum dikirim. Perjanjian dianggap ditandatangani hanya setelah kamu menandainya.">
      <div style={{ background: "var(--app-inner)", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
        {row(true, () => {}, `Penawaran ${q.number}`, "Selalu ikut", true)}
        {row(spkOn, setSpkOn, spkTitle || DEFAULT_SPK_TITLE, spkSigned ? "Udah ditandatangani" : "Ruang lingkup, biaya & termin, revisi, pembatalan, tanda tangan", spkSigned)}
        {spkOn && editor("spk", spkTitle, setSpkTitle, spkBody, setSpkBody, spkSigned)}
        {row(ndaOn, setNdaOn, "NDA (kerahasiaan)", ndaSigned ? "Udah ditandatangani" : "Opsional, kalau project-nya rahasia", ndaSigned)}
        {ndaOn && editor("nda", "NDA", null, ndaBody, setNdaBody, ndaSigned)}
      </div>
    </WaSendSheet>
  );
}
