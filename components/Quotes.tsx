"use client";

import Icon from "@/components/Icon";
import { useEffect, useState } from "react";
import { setDoc, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { spaceDoc, stamp, useSpace } from "@/lib/space";
import {
  Business, Invoice, LineItem, QUOTE_STATUS, Quote, QuoteStatus, Service,
  addDays, issuerOf, isIssued, paid, scheduleOf, termAmounts, termsOf, daysBetween, longDate, nextNumber, quoteColor, quoteText, rupiah, rupiahShort, subtotal, today, total, waLink, waNumber,
} from "@/lib/billing";
import PrintSheet from "@/components/PrintSheet";
import DocEditor, { DocDraft, LeadRef, briefOf, cleanItems } from "@/components/DocEditor";
import ConfirmSheet from "@/components/ConfirmSheet";
import SendQuoteSheet, { SentPatch } from "@/components/SendQuoteSheet";
import { badge, btnMuted, btnPrimary, card, chip, font, heading, inputStyle, label, modalBox, subheading, WA_INK } from "@/components/ui";

export type { LeadRef };

// A new quote takes the business's defaults (Kop & logo → Default dokumen).
function blank(b: Business, lead?: LeadRef): DocDraft {
  const d = today();
  const docs = b.docs || {};
  const dp = docs.dpPercent ?? 50;
  return {
    id: "", number: "",
    leadId: lead?.id || "", leadName: lead?.name || "", contact: lead?.contact || "", phone: lead?.phone || "",
    items: [], discount: 0, dpPercent: dp, notes: "", date: d, validUntil: addDays(d, docs.validDays || 14),
    schedule: docs.schedule?.length ? docs.schedule : scheduleOf({ dpPercent: dp }, docs),
    ...(docs.taxPercent ? { taxPercent: docs.taxPercent } : {}),
  };
}

export default function Quotes({ quotes, invoices, leads, services, business, startFor, onStarted, onInvoiceCreated }: {
  quotes: Quote[];
  invoices: Invoice[];
  leads: LeadRef[];
  services: Service[];
  business: Business;
  startFor: LeadRef | null;
  onStarted: () => void;
  onInvoiceCreated: () => void;
}) {
  const space = useSpace();
  const [editing, setEditing] = useState<DocDraft | null>(null);
  const [printing, setPrinting] = useState<Quote | null>(null);
  const [copied, setCopied] = useState("");
  const [filter, setFilter] = useState<"All" | QuoteStatus>("All");
  // Ten at a time: the list ends, and the rest is one tap away.
  const [limit, setLimit] = useState(10);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [failed, setFailed] = useState("");
  const [sending, setSending] = useState<Quote | null>(null);

  // Sent: the letterhead and terms are frozen on it, with the papers that went along.
  async function markSent(q: Quote, p: SentPatch) {
    const on = today();
    const keep = (a: Quote["spk"], n?: { title: string; body: string }) =>
      a?.signedAt ? a : n ? { ...n, sentAt: on } : undefined;
    const spk = keep(q.spk, p.spk), nda = keep(q.nda, p.nda);
    await updateDoc(spaceDoc(space, "quotes", q.id), {
      issuer: q.issuer || p.issuer, terms: q.terms || p.terms,
      ...(spk ? { spk } : {}), ...(nda ? { nda } : {}),
      ...(q.status === "Draft" ? { status: "Terkirim" } : {}), ...(q.sentAt ? {} : { sentAt: on }),
    });
  }

  async function markSigned(q: Quote, kind: "spk" | "nda") {
    const a = q[kind];
    if (!a) return;
    await updateDoc(spaceDoc(space, "quotes", q.id), { [kind]: { ...a, signedAt: today() } });
  }

  // Opened from a lead's detail: start a quote already addressed to them.
  useEffect(() => {
    if (startFor) { setEditing(blank(business, startFor)); onStarted(); }
  }, [startFor, onStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = quotes.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const shown = filter === "All" ? sorted : sorted.filter(q => q.status === filter);
  const open = quotes.filter(q => q.status === "Terkirim");
  const won = quotes.filter(q => q.status === "Disetujui");
  const decided = won.length + quotes.filter(q => q.status === "Ditolak").length;

  // An accepted quote is never rewritten: editing it makes a revision
  // (Q-…-r2) that takes over only once it is accepted (PRD-011 §4).
  const [revising, setRevising] = useState<Quote | null>(null);

  async function save(d: DocDraft) {
    const base = revising;
    const old = base ? undefined : quotes.find(q => q.id === d.id);
    const id = base ? `q_${Date.now()}` : d.id || `q_${Date.now()}`;
    const root = (base?.number || "").replace(/-r\d+$/, "");
    const rev = base ? quotes.filter(q => q.number.startsWith(`${root}-r`)).length + 1 : 0;
    const sched = d.schedule?.length ? d.schedule.map(t => ({ label: t.label.trim() || "Termin", percent: t.percent || 0, ...(t.when?.trim() ? { when: t.when.trim() } : {}) })) : undefined;
    const doc: Omit<Quote, "id"> = {
      number: base ? `${root}-r${rev}` : d.number || nextNumber("Q", quotes.map(q => q.number)),
      leadId: d.leadId, leadName: d.leadName.trim(), contact: d.contact.trim(), phone: d.phone.trim(),
      items: cleanItems(d.items), discount: d.discount, notes: d.notes.trim(),
      // The old single DP stays in step with the schedule for older readers.
      dpPercent: sched && sched.length > 1 ? sched[0].percent : sched ? 0 : d.dpPercent,
      ...(sched ? { schedule: sched } : {}), ...(d.taxPercent ? { taxPercent: d.taxPercent } : {}),
      date: base ? today() : d.date, validUntil: d.validUntil || addDays(d.date, 14), status: old?.status || "Draft",
      ...(old?.sentAt ? { sentAt: old.sentAt } : {}), ...(old?.invoiceId ? { invoiceId: old.invoiceId } : {}),
      ...(old?.acceptedAt ? { acceptedAt: old.acceptedAt } : {}), ...(old?.supersedes ? { supersedes: old.supersedes } : {}),
      ...(base ? { supersedes: base.id } : {}),
      ...briefOf(d),
    };
    await setDoc(spaceDoc(space, "quotes", id), JSON.parse(JSON.stringify(stamp(space, doc, (old || base) as { ownerUid?: string; ownerName?: string } | undefined))));
    setEditing(null); setRevising(null);
  }

  const draftOf = (q: Quote): DocDraft => ({ ...q, validUntil: q.validUntil, schedule: scheduleOf(q, q.terms || termsOf(business)) });

  async function setStatus(q: Quote, status: QuoteStatus) {
    const patch: Partial<Quote> = { status };
    if (status === "Terkirim" && !q.sentAt) patch.sentAt = today();
    if (status === "Disetujui") patch.acceptedAt = today();
    await updateDoc(spaceDoc(space, "quotes", q.id), patch);
    // An accepted revision takes over from the quote it revises.
    if (status === "Disetujui" && q.supersedes && quotes.some(x => x.id === q.supersedes)) {
      await updateDoc(spaceDoc(space, "quotes", q.supersedes), { status: "Digantikan", supersededBy: q.id });
    }
    // A yes closes the lead, at the value actually agreed.
    if (status === "Disetujui" && q.leadId) {
      await updateDoc(spaceDoc(space, "leads", q.leadId), { status: "Closed", value: total(q), lastContact: today() }).catch(() => {});
    }
  }

  async function sendWA(q: Quote) {
    window.open(waLink(q.phone, quoteText(q, q.issuer || business)), "_blank");
    if (q.status === "Draft") await setStatus(q, "Terkirim");
  }

  async function copy(q: Quote) {
    try { await navigator.clipboard.writeText(quoteText(q, q.issuer || business)); } catch { setFailed(q.id); setTimeout(() => setFailed(""), 3000); return; }
    setCopied(q.id);
    setTimeout(() => setCopied(""), 1800);
  }

  async function remove(q: Quote) {
    await deleteDoc(spaceDoc(space, "quotes", q.id));
  }

  // One invoice per schedule row, made as a draft: issuing it is its own step.
  async function makeInvoice(q: Quote, index: number) {
    const id = `inv_${Date.now()}`;
    const d = today();
    const terms = scheduleOf(q, q.terms || termsOf(business));
    const t = terms[index];
    const whole = terms.length === 1;
    const amount = termAmounts(total(q), terms)[index];
    const inv: Omit<Invoice, "id"> = {
      number: nextNumber("INV", invoices.map(i => i.number)),
      quoteId: q.id, leadId: q.leadId, leadName: q.leadName, contact: q.contact, phone: q.phone,
      items: whole ? q.items : [{ name: `${t.label} ${t.percent}% — ${q.project || q.number}`, qty: 1, price: amount, description: `Termin ${index + 1} dari ${terms.length} · penawaran ${q.number}${t.when ? ` · ${t.when}` : ""}` }],
      discount: whole ? q.discount : 0, dpPercent: 0, notes: q.notes,
      ...(whole && q.taxPercent ? { taxPercent: q.taxPercent } : {}),
      date: d, dueDate: addDays(d, 7), payments: [],
      issuer: q.issuer || issuerOf(business), issue: "Draft",
      ...(whole ? {} : { term: { index, label: t.label, percent: t.percent } }),
      ...briefOf(q),
    };
    await setDoc(spaceDoc(space, "invoices", id), stamp(space, JSON.parse(JSON.stringify(inv)), q as { ownerUid?: string; ownerName?: string }));
    await updateDoc(spaceDoc(space, "quotes", q.id), { ...(q.invoiceId ? {} : { invoiceId: id }), invoiceIds: arrayUnion(id) });
    onInvoiceCreated();
  }

  // The money on an accepted quote: agreed, billed, received, left. A revision
  // carries what was billed on the versions before it, so a term isn't billed twice.
  function money(q: Quote) {
    const chain = new Set<string>();
    for (let x: Quote | undefined = q; x && !chain.has(x.id); x = quotes.find(o => o.id === x!.supersedes)) chain.add(x.id);
    const linked = invoices.filter(i => chain.has(i.quoteId) && i.issue !== "Dibatalkan");
    const terms = scheduleOf(q, q.terms || termsOf(business));
    const billedIdx = new Set<number>();
    linked.forEach(i => { if (i.term) billedIdx.add(i.term.index); else terms.forEach((_, n) => billedIdx.add(n)); });
    const next = terms.findIndex((_, n) => !billedIdx.has(n));
    const agreed = total(q);
    const billed = linked.filter(isIssued).reduce((a, i) => a + total(i), 0);
    const received = linked.reduce((a, i) => a + paid(i), 0);
    return { terms, next, agreed, billed, received, left: Math.max(0, agreed - received), drafts: linked.filter(i => i.issue === "Draft").length };
  }

  return (
    <div className="sp-sell">
      <div className="sp-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={heading}>Penawaran</div>
          <div style={subheading}>Susun dari paket, kirim lewat WA, pantau sampai disetujui.</div>
        </div>
        <button onClick={() => setEditing(blank(business))} style={btnPrimary}>+ Penawaran</button>
      </div>

      <div className="sp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Menunggu jawaban", v: open.length, s: rupiahShort(open.reduce((a, q) => a + total(q), 0)), c: "var(--brand-text)" },
          { l: "Disetujui", v: won.length, s: rupiahShort(won.reduce((a, q) => a + total(q), 0)), c: "var(--ok)" },
          { l: "Win rate", v: decided ? `${Math.round((won.length / decided) * 100)}%` : "—", s: `${decided} sudah dijawab`, c: "var(--violet-text)" },
        ].map(x => (
          <div key={x.l} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: x.c, fontFamily: font }}>{x.v}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
      </div>

      {quotes.length > 0 && (
        <div className="sp-chiprow" role="group" aria-label="Saring penawaran" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {(["All", ...QUOTE_STATUS] as const).map(s => (
            <button key={s} onClick={() => { setFilter(s); setLimit(10); }} aria-pressed={filter === s}
              style={{ ...chip, background: filter === s ? (s === "All" ? "#005eb0" : quoteColor[s]) : "var(--app-card)", color: filter === s ? "#fff" : "var(--app-muted)", fontWeight: 600 }}>
              {s === "All" ? "Semua" : s}
            </button>
          ))}
        </div>
      )}

      {quotes.length > 0 && shown.length === 0 && (
        <div style={{ ...card, padding: "28px 20px", textAlign: "center", fontSize: 13, color: "var(--app-muted)" }}>
          Belum ada penawaran {filter}. <button onClick={() => setFilter("All")} style={{ ...chip, marginLeft: 6, color: "var(--app-text)", fontWeight: 700 }}>Lihat semua</button>
        </div>
      )}

      {quotes.length === 0 ? (
        <div style={{ ...card, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada penawaran</div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 20 }}>
            {services.length ? "Pilih lead, masukin paket, kirim." : "Isi dulu tab Paket biar penawaran tinggal pilih."}
          </div>
          <button onClick={() => setEditing(blank(business))} style={btnPrimary}>+ Buat penawaran</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.slice(0, limit).map(q => {
            const waiting = q.status === "Terkirim" && q.sentAt ? daysBetween(q.sentAt, today()) : 0;
            const expired = q.status !== "Disetujui" && q.status !== "Ditolak" && q.validUntil < today();
            return (
              <div key={q.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", fontFamily: "monospace" }}>{q.number} · {longDate(q.date)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: font, marginTop: 2 }}>{q.leadName}</div>
                    <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>
                      {q.project || q.items.map(i => i.name).join(", ")}{q.eventDate ? ` · acara ${longDate(q.eventDate)}` : ""}
                    </div>
                    {q.supersedes && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 2 }}>Revisi dari {quotes.find(x => x.id === q.supersedes)?.number || "penawaran sebelumnya"}</div>}
                    {q.supersededBy && <div style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 2 }}>Digantikan {quotes.find(x => x.id === q.supersededBy)?.number || "revisi"} (yang berlaku)</div>}
                  </div>
                  <div className="sp-doc-sum" style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ok)" }}>{rupiah(total(q))}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {expired && <span style={badge("#ff9900")}>Kedaluwarsa</span>}
                      {waiting >= 3 && <span style={badge("#ff9900")}>{waiting} hari tanpa jawaban</span>}
                      <span style={badge(quoteColor[q.status])}>{q.status}</span>
                    </div>
                  </div>
                </div>
                <div className="sp-doc-actions">
                  <div className="sp-doc-main">
                    {q.status === "Draft"
                      ? <button onClick={() => setSending(q)} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>Kirim penawaran</button>
                      : <button onClick={() => sendWA(q)} style={{ ...chip, background: "#25D366", color: WA_INK, border: "none", fontWeight: 700 }}>
                          {q.status === "Terkirim" ? "Follow-up WA" : "Kirim WA"}
                        </button>}
                    {q.status === "Terkirim" && (
                      <>
                        <button onClick={() => setStatus(q, "Disetujui")} style={{ ...chip, color: "var(--ok)", borderColor: "#00a86260", fontWeight: 700 }}>✓ Disetujui</button>
                        <button onClick={() => setStatus(q, "Ditolak")} style={{ ...chip, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", borderColor: "#ff444440", fontWeight: 700 }}>✗ Ditolak</button>
                      </>
                    )}
                    {q.status === "Draft" && <button onClick={() => setStatus(q, "Terkirim")} style={{ ...chip, color: "var(--app-text)", fontWeight: 700 }}>Tandai terkirim</button>}
                    {q.status === "Disetujui" && (() => {
                      const m = money(q);
                      if (m.next < 0) return <span style={{ ...chip, cursor: "default", color: "var(--ok)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✓ Semua termin ditagih</span>;
                      const t = m.terms[m.next];
                      return <button onClick={() => makeInvoice(q, m.next)} style={{ ...chip, background: "#005eb0", color: "#fff", border: "none", fontWeight: 700 }}>
                        {m.terms.length === 1 ? "Buat invoice →" : `Buat invoice ${t.label} ${t.percent}% →`}
                      </button>;
                    })()}
                  </div>
                  <div className="sp-doc-tools">
                    <button onClick={() => copy(q)} style={{ ...chip, color: copied === q.id ? "var(--ok)" : "var(--app-text)" }}>{copied === q.id ? "✓ Tersalin" : "Copy teks"}</button>
                    <button onClick={() => setPrinting(q)} style={{ ...chip, color: "var(--app-text)" }}>PDF</button>
                    {q.status === "Disetujui"
                      ? <button onClick={() => { setRevising(q); setEditing({ ...draftOf(q), id: "", number: "" }); }} title="Yang disetujui tetap tersimpan; revisi berlaku setelah disetujui" style={{ ...chip, color: "var(--app-text)" }}>Revisi</button>
                      : q.status !== "Digantikan" && <button onClick={() => { setRevising(null); setEditing(draftOf(q)); }} style={{ ...chip, color: "var(--app-text)" }}>Edit</button>}
                    <button className="sp-del" onClick={() => setDeleting(q)} aria-label={`Hapus ${q.number}`} title="Hapus" style={{ ...chip, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", borderColor: "#ff444440" }}><Icon name="trash" size={16} /></button>
                  </div>
                </div>
                {(q.status === "Disetujui" || q.status === "Digantikan") && (() => {
                  const m = money(q);
                  const cell = (k: string, v: number, c?: string) => <span key={k}><span style={{ color: "var(--app-muted)" }}>{k} </span><b className="tabnum" style={{ color: c }}>{rupiah(v)}</b></span>;
                  return (
                    <div role="group" aria-label="Uang penawaran ini" style={{ display: "flex", gap: "4px 16px", flexWrap: "wrap", marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--app-inner)", fontSize: 13 }}>
                      {cell("Disepakati", m.agreed)}{cell("Ditagih", m.billed)}{cell("Diterima", m.received, "var(--ok)")}{cell("Sisa", m.left)}
                      {m.drafts > 0 && <span style={{ color: "var(--app-sub)" }}>{m.drafts} invoice masih draft</span>}
                    </div>
                  );
                })()}
                {(q.spk || q.nda) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10, fontSize: 13 }}>
                    {(["spk", "nda"] as const).map(k => q[k] && (
                      <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={badge(q[k]!.signedAt ? "#00a862" : "#64748b")}>
                          {k === "spk" ? q[k]!.title : "NDA"} · {q[k]!.signedAt ? `ditandatangani ${longDate(q[k]!.signedAt!)}` : "dikirim, belum ditandatangani"}
                        </span>
                        {!q[k]!.signedAt && <button onClick={() => markSigned(q, k)} style={{ ...chip, color: "var(--app-text)", fontWeight: 600 }}>Tandai {k === "spk" ? "SPK" : "NDA"} ditandatangani</button>}
                      </span>
                    ))}
                  </div>
                )}
                {failed === q.id && <div role="alert" style={{ fontSize: 12, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", marginTop: 8 }}>Gagal menyalin. Buka PDF atau Kirim WA aja.</div>}
                {!waNumber(q.phone) && <div style={{ fontSize: 12, color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", marginTop: 8 }}>Belum ada nomor WA — Kirim WA akan minta pilih kontak.</div>}
              </div>
            );
          })}
          {shown.length > limit && (
            <button onClick={() => setLimit(limit + 10)} style={{ ...chip, alignSelf: "center", minHeight: 44, padding: "0 18px", color: "var(--brand-text)", fontWeight: 600 }}>
              Tampilkan 10 lagi · {shown.length - limit} tersisa
            </button>
          )}
        </div>
      )}

      {editing && <DocEditor kind="quote" initial={editing} leads={leads} services={services} onSave={save} onClose={() => { setEditing(null); setRevising(null); }} />}

      {printing && <PrintSheet kind="quote" data={printing} business={printing.issuer || business} frozen={!!printing.issuer} onClose={() => setPrinting(null)} />}
      {sending && <SendQuoteSheet q={sending} business={business} onSent={p => markSent(sending, p)} onClose={() => setSending(null)} />}

      {deleting && (
        <ConfirmSheet title="Hapus penawaran?" onConfirm={() => remove(deleting)} onClose={() => setDeleting(null)}>
          <b>{deleting.number}</b> untuk {deleting.leadName || "klien"} hilang dari daftar.{deleting.invoiceId ? " Invoice-nya tetap ada." : ""} Ini ga bisa dibatalkan.
        </ConfirmSheet>
      )}
    </div>
  );
}

