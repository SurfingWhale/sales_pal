"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { archetypes, objections } from "@/lib/salespal-data";
import { LeadProfile } from "@/lib/profile";
import { WaMessage, WaSummary, guessThem, parseWaExport, readExportFile, senders, summarize } from "@/lib/waexport";
import { parseVCards } from "@/lib/vcard";
import { downscaleImage } from "@/lib/image";
import { authFetch } from "@/lib/authFetch";
import Icon from "@/components/Icon";

// Tarik dari WhatsApp (PRD-008 §5), a bottom sheet: pick a source, see what was
// found, switch off what shouldn't be kept, save. Chats are read on the phone;
// only the summary the user keeps is written.

export interface WaPatch { profile: LeadProfile; phone?: string; contact?: string; category?: string; lastReplyAt?: string }

type Part = { key: string; label: string; preview: string };

export default function WaImport({ leadName, profile, onSave, onClose, initialFile }: {
  leadName: string; profile?: LeadProfile | null;
  onSave: (p: WaPatch) => Promise<void> | void; onClose: () => void; initialFile?: File | null;
}) {
  const [step, setStep] = useState<"choose" | "result">("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msgs, setMsgs] = useState<WaMessage[] | null>(null);
  const [them, setThem] = useState("");
  const [extra, setExtra] = useState<{ phone?: string; contact?: string; category?: string; notes?: string; source: string } | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const chatRef = useRef<HTMLInputElement>(null);
  const vcfRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function readChat(f: File) {
    setBusy(true); setError("");
    try {
      const m = parseWaExport(await readExportFile(f));
      if (m.length < 2) throw new Error("Ga ada pesan yang kebaca. Pastikan ini file ekspor chat WhatsApp (.txt atau .zip).");
      setMsgs(m); setThem(guessThem(m, leadName)); setExtra(null); setOff({}); setStep("result");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  // Opened from Android's share sheet with the export already in hand.
  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true;
      void (/\.vcf$/i.test(initialFile.name) || /vcard/.test(initialFile.type) ? readContact(initialFile) : readChat(initialFile));
    }
  }, [initialFile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function readContact(f: File) {
    setBusy(true); setError("");
    try {
      const r = parseVCards(await f.text())[0];
      if (!r || !(r.phone || r.name)) throw new Error("Kontaknya ga kebaca. Coba bagikan ulang dari WhatsApp.");
      setExtra({ phone: r.phone, contact: r.contact || r.name, source: "kontak" }); setMsgs(null); setOff({}); setStep("result");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function readShot(f: File) {
    setBusy(true); setError("");
    try {
      const res = await authFetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: await downscaleImage(f) }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Gagal baca screenshot.");
      const r = (json.rows || [])[0] || {};
      if (!r.phone && !r.category && !r.notes) throw new Error("Ga ada info bisnis yang kebaca dari screenshot ini.");
      setExtra({ phone: r.phone, contact: r.contact, category: r.category, notes: r.notes, source: "screenshot" }); setMsgs(null); setOff({}); setStep("result");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const sum: WaSummary | null = msgs && them ? summarize(msgs, them) : null;
  const arch = sum?.archetype ? archetypes.find(a => a.id === sum.archetype) : null;
  const obj = sum?.objectionType ? objections.find(o => o.id === sum.objectionType) : null;
  const parts: Part[] = sum ? [
    { key: "brief", label: "Brief", preview: sum.brief },
    ...(arch ? [{ key: "type", label: "Tipe customer", preview: `${arch.animal} ${arch.name}, dari ${sum.cues.reduce((a, c) => a + c.n, 0)} kata pemicu di chat.` }] : []),
    ...(obj ? [{ key: "obj", label: "Keberatan", preview: `${obj.icon} ${obj.label}` }] : []),
    ...(sum.questions.length ? [{ key: "ask", label: "Pertanyaan", preview: `${sum.questions.length} pertanyaan, ${sum.questions.filter(q => !q.answered).length} belum dijawab.` }] : []),
    { key: "pola", label: "Pola chat", preview: `${sum.messages} pesan${sum.avgReplyMin !== null ? `, mereka bales rata-rata ${sum.avgReplyMin} menit` : ""}.` },
    ...(sum.lastReplyAt ? [{ key: "reply", label: "Terakhir bales", preview: sum.lastReplyAt }] : []),
  ] : extra ? [
    ...(extra.contact ? [{ key: "contact", label: "Nama", preview: extra.contact }] : []),
    ...(extra.phone ? [{ key: "phone", label: "Nomor", preview: extra.phone }] : []),
    ...(extra.category ? [{ key: "category", label: "Kategori bisnis", preview: extra.category }] : []),
    ...(extra.notes ? [{ key: "notes", label: "Info lain", preview: extra.notes }] : []),
  ] : [];
  const kept = parts.filter(p => !off[p.key]);

  async function save() {
    const on = (k: string) => parts.some(p => p.key === k) && !off[k];
    const today = new Date().toISOString().slice(0, 10);
    const p: LeadProfile = { ...(profile || {}) };
    const patch: WaPatch = { profile: p };
    if (sum) {
      if (on("brief")) p.brief = sum.brief;
      if (on("type")) { p.archetype = sum.archetype || p.archetype; p.cues = sum.cues; }
      if (on("obj")) p.objectionType = sum.objectionType || p.objectionType;
      if (on("ask")) p.questions = sum.questions;
      if (on("pola")) p.chat = { messages: sum.messages, since: sum.since, until: sum.until, mine: sum.mine, theirs: sum.theirs, avgReplyMin: sum.avgReplyMin, activeHours: sum.activeHours, perWeek: sum.perWeek };
      if (on("reply") && sum.lastReplyAt) patch.lastReplyAt = sum.lastReplyAt;
      p.source = "wa-export";
    } else if (extra) {
      if (on("phone")) patch.phone = extra.phone;
      if (on("contact")) patch.contact = extra.contact;
      if (on("category")) { patch.category = extra.category; p.wa = { ...(p.wa || {}), category: extra.category }; }
      if (on("notes")) p.wa = { ...(p.wa || {}), notes: extra.notes };
    }
    p.at = today;
    setBusy(true);
    await onSave(JSON.parse(JSON.stringify(patch)));
    setBusy(false);
    onClose();
  }

  const row: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 14, border: "none", background: "transparent", color: "var(--app-text)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" };
  const icon: React.CSSProperties = { flexShrink: 0, width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "flex-end", padding: 8, background: "var(--scrim)", zIndex: 140 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="wa-h" onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "var(--app-text)", borderRadius: 36, padding: "10px 18px 22px", boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 -10px 40px rgba(0,0,0,0.18)" }} className="frost">
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 999, background: "var(--app-border)", margin: "0 auto 12px" }} />
        {step === "choose" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 id="wa-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tarik dari WhatsApp</h2>
              <button onClick={onClose} aria-label="Tutup" style={{ width: 44, height: 44, marginRight: -8, border: "none", background: "transparent", color: "var(--app-ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={13} stroke={2.4} /></span></button>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--app-muted)" }}>Pilih yang mau dibagikan dari WhatsApp. Chat diproses di HP kamu, yang disimpan cuma ringkasannya.</p>
            <div style={{ marginTop: 14, border: "1px solid var(--app-border)", borderRadius: 20, overflow: "hidden" }}>
              <button onClick={() => chatRef.current?.click()} disabled={busy} style={row}>
                <span aria-hidden="true" style={{ ...icon, background: "#005eb0", color: "#fff" }}><Icon name="chatLines" size={21} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Ekspor chat <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb, #005eb0 10%, transparent)", color: "var(--brand-text)" }}>Paling lengkap</span></span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--app-muted)", marginTop: 2 }}>Brief, pola chat, tipe customer, pertanyaan</span>
                </span>
              </button>
              <button onClick={() => vcfRef.current?.click()} disabled={busy} style={{ ...row, borderTop: "1px solid var(--app-border)" }}>
                <span aria-hidden="true" style={{ ...icon, background: "var(--app-inner)", color: "var(--app-ink-2)" }}><Icon name="person" size={21} /></span>
                <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Bagikan kontak</span><span style={{ display: "block", fontSize: 12.5, color: "var(--app-muted)", marginTop: 2 }}>Nama dan nomor (.vcf)</span></span>
              </button>
              <button onClick={() => shotRef.current?.click()} disabled={busy} style={{ ...row, borderTop: "1px solid var(--app-border)" }}>
                <span aria-hidden="true" style={{ ...icon, background: "var(--app-inner)", color: "var(--app-ink-2)" }}><Icon name="screenshot" size={21} /></span>
                <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Screenshot profil bisnis</span><span style={{ display: "block", fontSize: 12.5, color: "var(--app-muted)", marginTop: 2 }}>Kategori, nomor, info. Pakai 1 kuota scan.</span></span>
              </button>
            </div>
            <input ref={chatRef} type="file" accept=".txt,.zip,text/plain,application/zip" aria-label="File ekspor chat" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) readChat(f); e.target.value = ""; }} />
            <input ref={vcfRef} type="file" accept=".vcf,text/vcard,text/x-vcard" aria-label="File kontak" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) readContact(f); e.target.value = ""; }} />
            <input ref={shotRef} type="file" accept="image/*" aria-label="Screenshot profil bisnis" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) readShot(f); e.target.value = ""; }} />
            {busy && <p role="status" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Membaca…</p>}
            {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "color-mix(in srgb, #dc2626 80%, var(--app-text))" }}>{error}</p>}
            <h3 style={{ margin: "18px 0 8px", fontSize: 13, fontWeight: 700, color: "var(--app-muted)" }}>Cara ekspor chat</h3>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, lineHeight: 1.45 }}>
              <li>Buka chat {leadName} di WhatsApp.</li>
              <li>Ketuk nama kontaknya (iPhone) atau ⋮ › Lainnya (Android), lalu <b>Ekspor chat › Tanpa media</b>.</li>
              <li>Android: pilih SalesPal di menu bagikan, atau simpan lalu unggah di sini. iPhone: simpan ke File, lalu unggah di sini.</li>
            </ol>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setStep("choose")} aria-label="Kembali ke pilihan sumber" style={{ width: 44, height: 44, marginLeft: -10, border: "none", background: "transparent", color: "var(--app-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="chevronLeft" size={20} stroke={2} /></button>
              <div style={{ minWidth: 0 }}>
                <h2 id="wa-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{sum ? `Ketemu dari ${sum.messages} pesan` : `Ketemu dari ${extra?.source}`}</h2>
                {sum && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--app-muted)" }}>{sum.since} – {sum.until}</p>}
              </div>
            </div>
            {msgs && senders(msgs).length > 1 && (
              <div style={{ marginTop: 10 }}>
                <label htmlFor="wa-them" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Yang mana customernya?</label>
                <select id="wa-them" value={them} onChange={e => setThem(e.target.value)} style={{ width: "100%", background: "var(--app-inner)", border: "1px solid var(--app-border)", borderRadius: 10, color: "var(--app-text)", padding: "10px 12px", fontSize: 16, fontFamily: "inherit" }}>
                  {senders(msgs).map(x => <option key={x.name} value={x.name}>{x.name} · {x.n} pesan</option>)}
                </select>
              </div>
            )}
            <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--app-muted)" }}>Matikan yang nggak mau disimpan.</p>
            <div style={{ marginTop: 10, border: "1px solid var(--app-border)", borderRadius: 20, overflow: "hidden" }}>
              {parts.map((pt, i) => {
                const on = !off[pt.key];
                return (
                  <button key={pt.key} role="switch" aria-checked={on} onClick={() => setOff({ ...off, [pt.key]: on })}
                    style={{ ...row, padding: "12px 14px 12px 16px", borderTop: i ? "1px solid var(--app-border)" : "none" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{pt.label}</span>
                      <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.4, color: "var(--app-muted)", marginTop: 2 }}>{pt.preview}</span>
                    </span>
                    <span aria-hidden="true" style={{ flexShrink: 0, width: 51, height: 31, borderRadius: 999, padding: 2, background: on ? "#005eb0" : "var(--app-border)", transition: "background-color .2s" }}>
                      <span style={{ display: "block", width: 27, height: 27, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.22)", transform: `translateX(${on ? 20 : 0}px)`, transition: "transform .2s" }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={save} disabled={!kept.length || busy}
              style={{ marginTop: 16, width: "100%", minHeight: 52, borderRadius: 999, border: "none", background: kept.length ? "#005eb0" : "var(--app-border)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: kept.length ? "pointer" : "default", fontFamily: "inherit" }}>
              {kept.length ? `Simpan ${kept.length} bagian ke ${leadName}` : "Pilih minimal satu"}
            </button>
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 12, color: "var(--app-muted)" }}>{sum ? "Isi chat nggak disimpan, cuma ringkasan yang kamu pilih." : "Cuma bagian yang nyala yang disimpan."}</p>
          </>
        )}
      </section>
    </div>,
    document.body
  );
}
