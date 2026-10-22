"use client";

// One person's conversation (owner, 23 Okt: "log DM bukan kaya chat WA yang
// bisa di-track"): their post, every message sent with its words, their
// replies and each change, then the next message — picked by stage, filled
// from what they wrote, sent through WhatsApp / Instagram by you, and logged.

import { useMemo, useState } from "react";
import type { PitchTemplate } from "@/lib/hunting";
import { today } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import {
  Prospect, ProspectEvent, Strategy, dncPatch, notePatch, replyPatch, resultPatch, silentDays, statusLabel, view,
} from "@/lib/prospects";
import { saveProspect, syncHunt } from "@/lib/prospectStore";
import { FillData, STAGES, Stage, fillTemplate, stageFor, stageOf } from "@/lib/templates";
import { btnMuted, btnPrimary, chip, font, inputStyle, modalBox } from "@/components/ui";

export type SendHow = "copy" | "wa" | "open";
export interface SendOut { how: "wa" | "open"; label: string; url?: string }

const time = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const dayOf = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return same(d, now) ? "Hari ini" : same(d, y) ? "Kemarin" : d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
};

export default function ProspectThread({ p, strategy, templates, fill, sendOut, onSend, onClose }: {
  p: Prospect; strategy: Strategy; templates: PitchTemplate[]; fill: FillData; sendOut: SendOut;
  onSend: (p: Prospect, t: PitchTemplate | null, text: string, how: SendHow) => Promise<(() => Promise<void>) | null>;
  onClose: () => void;
}) {
  const space = useSpace();
  const on = today();
  const v = view(p, on, strategy);
  const quiet = silentDays(p, on);
  const [stage, setStage] = useState<Stage>(stageFor(p, v));
  const [tpl, setTpl] = useState<PitchTemplate | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<"reply" | "note" | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const forStage = useMemo(() => templates.filter(t => stageOf(t) === stage), [templates, stage]);
  const dnc = v.status === "dnc";

  function choose(t: PitchTemplate) { setTpl(t); setText(fillTemplate(t.body, fill)); }

  async function send(how: SendHow) {
    if (!text.trim() || dnc) return;
    setMsg("");
    const back = await onSend(p, tpl, text, how);
    if (back) { setUndo(() => back); setTimeout(() => setUndo(u => (u === back ? null : u)), 10000); }
    else setMsg("Pesan tersalin, tapi gagal dicatat. Cek koneksi lalu coba lagi.");
  }

  async function act(patch: Partial<Prospect>) {
    setBusy(true); setMsg("");
    try {
      await saveProspect(space, p, patch);
      syncHunt(space, { ...p, ...patch } as Prospect);
      setAnswer(null); setAnswerText("");
    } catch { setMsg("Gagal nyimpen. Cek koneksi lalu coba lagi."); }
    setBusy(false);
  }
  const ctx = () => ({ on: today(), at: Date.now() });

  // History grouped by day, oldest first, like a chat.
  const events = (p.history || []).slice().sort((a, b) => a.at - b.at);
  const who = p.name ? `${p.name} (${p.handle})` : p.handle;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="th-h" onClick={e => e.stopPropagation()}
        style={{ ...modalBox, maxWidth: 560, padding: 0, display: "flex", flexDirection: "column", maxHeight: "min(92vh, calc(100dvh - 32px))" }}>
        <header style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--app-border)" }}>
          <div id="th-h" style={{ fontSize: 17, fontWeight: 700, fontFamily: font, overflowWrap: "anywhere" }}>{who}</div>
          <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 2 }}>
            {p.platform} · {statusLabel(p, v)}{quiet !== null && quiet > 0 ? ` · diem ${quiet} hari` : ""}{v.due && v.due <= on && !dnc ? " · follow-up hari ini" : ""}
          </div>
        </header>

        <div role="log" aria-label={`Percakapan dengan ${who}`} style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, background: "var(--app-bg)" }}>
          {!events.length && <div style={{ fontSize: 13, color: "var(--app-muted)", textAlign: "center", padding: 20 }}>Belum ada apa-apa. Pesan pertama kamu muncul di sini.</div>}
          {events.map((e, i) => {
            const newDay = i === 0 || dayOf(events[i - 1].at) !== dayOf(e.at);
            return (
              <div key={i} style={{ display: "contents" }}>
                {newDay && <div style={{ alignSelf: "center", fontSize: 11, color: "var(--app-muted)", padding: "4px 10px", borderRadius: 999, background: "var(--app-inner)", margin: "6px 0" }}>{dayOf(e.at)}</div>}
                <Bubble e={e} />
              </div>
            );
          })}
        </div>

        <footer style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--app-border)", background: "var(--app-card)" }}>
          {undo && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10, padding: "8px 10px", borderRadius: 10, background: "var(--app-inner)" }}>
              <span style={{ flex: 1 }}>Tercatat terkirim.</span>
              <button onClick={async () => { const u = undo; setUndo(null); await u(); }} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>Batal</button>
            </div>
          )}
          {msg && <div role="alert" style={{ fontSize: 13, color: "var(--hot)", marginBottom: 8 }}>{msg}</div>}

          {dnc ? <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Orang ini minta ga dihubungi lagi.</div> : <>
            <div role="group" aria-label="Hasil terakhir" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
              <button onClick={() => setAnswer(answer === "reply" ? null : "reply")} aria-pressed={answer === "reply"} style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: 700 }}>💬 Dia bales</button>
              <button onClick={() => act(resultPatch(p, "tertarik", {}, ctx(), strategy))} disabled={busy} style={{ ...chip, flexShrink: 0, minHeight: 36 }}>✅ Tertarik</button>
              <button onClick={() => act(resultPatch(p, "tolak", {}, ctx(), strategy))} disabled={busy} style={{ ...chip, flexShrink: 0, minHeight: 36 }}>❌ Nolak</button>
              <button onClick={() => setAnswer(answer === "note" ? null : "note")} aria-pressed={answer === "note"} style={{ ...chip, flexShrink: 0, minHeight: 36 }}>📝 Catatan</button>
              <button onClick={() => act(dncPatch(p, "Minta ga dihubungi lagi", ctx()))} disabled={busy} style={{ ...chip, flexShrink: 0, minHeight: 36 }}>🚫 Jangan hubungi</button>
            </div>
            {answer && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <label htmlFor="th-answer" className="vh">{answer === "reply" ? "Balasan dia" : "Catatan"}</label>
                <input id="th-answer" value={answerText} onChange={e => setAnswerText(e.target.value)} placeholder={answer === "reply" ? "Tempel balasannya (boleh kosong)" : "Catatan buat diri sendiri"}
                  style={{ ...inputStyle, fontSize: 16, flex: 1 }} />
                <button onClick={() => act(answer === "reply" ? replyPatch(p, answerText, ctx()) : notePatch(p, answerText, ctx()))}
                  disabled={busy || (answer === "note" && !answerText.trim())} style={{ ...btnPrimary, minHeight: 44 }}>Simpan</button>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--app-muted)", marginBottom: 6 }}>Pesan berikutnya</div>
            <div role="radiogroup" aria-label="Tahap" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
              {STAGES.map(s => (
                <button key={s.id} role="radio" aria-checked={stage === s.id} onClick={() => { setStage(s.id); setTpl(null); }}
                  style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: stage === s.id ? 700 : 500, ...(stage === s.id ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
                  {s.id === stageFor(p, v) ? "● " : ""}{s.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Template" style={{ display: "flex", gap: 6, overflowX: "auto", margin: "2px 0 8px", paddingBottom: 4 }}>
              {forStage.length ? forStage.map(t => (
                <button key={t.id} onClick={() => choose(t)} aria-pressed={tpl?.id === t.id} style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: tpl?.id === t.id ? 700 : 500, color: "var(--app-text)" }}>{t.title}</button>
              )) : <span style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada template buat tahap ini. Tulis langsung di bawah.</span>}
            </div>
            <label htmlFor="th-text" className="vh">Isi pesan</label>
            <textarea id="th-text" value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Pilih template, atau tulis pesannya"
              style={{ ...inputStyle, fontSize: 16, width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.45 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={onClose} style={{ ...btnMuted, minHeight: 44 }}>Tutup</button>
              <button onClick={() => send("copy")} disabled={!text.trim()} style={{ ...btnMuted, minHeight: 44 }}>Copy</button>
              <button onClick={() => send(sendOut.how)} disabled={!text.trim()} style={{ ...btnPrimary, minHeight: 44, flex: 1, opacity: text.trim() ? 1 : 0.6 }}>{sendOut.label}</button>
            </div>
          </>}
        </footer>
      </div>
    </div>
  );
}

function Bubble({ e }: { e: ProspectEvent }) {
  const mine = e.kind === "sent";
  const theirs = e.kind === "reply" || e.kind === "post";
  if (!mine && !theirs) {
    return <div style={{ alignSelf: "center", fontSize: 12, color: "var(--app-muted)", textAlign: "center", maxWidth: "85%" }}>{e.text || (e.kind === "convert" ? "Jadi ETB" : "Catatan")} · {time(e.at)}</div>;
  }
  return (
    <div style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%", padding: "8px 12px", borderRadius: 14,
      borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
      background: mine ? "var(--brand-tint)" : "var(--app-card)", border: `1px solid ${mine ? "color-mix(in srgb, var(--brand-text) 25%, transparent)" : "var(--app-border)"}` }}>
      {e.kind === "post" && <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 2 }}>Post</div>}
      <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {e.text?.trim() || (mine ? `(${e.template || "pesan"})` : "(bales)")}
      </div>
      <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 4, textAlign: mine ? "right" : "left" }}>
        {mine ? [e.channel === "post" ? "balas di post" : "DM", e.template, e.campaign].filter(Boolean).join(" · ") + " · " : e.kind === "reply" ? "dibales · " : ""}{time(e.at)}
        {e.kind === "post" && e.url && <> · <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-text)" }}>Buka post ↗</a></>}
      </div>
    </div>
  );
}
