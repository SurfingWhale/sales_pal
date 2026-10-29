"use client";

// One person's conversation (owner, 23 Okt: "log DM bukan kaya chat WA yang
// bisa di-track"): their post, every message sent with its words, their
// replies and each change, then the next message — picked by stage, filled
// from what they wrote, sent through WhatsApp / Instagram by you, and logged.

import { useEffect, useMemo, useRef, useState } from "react";
import type { PitchTemplate } from "@/lib/hunting";
import { today } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import {
  Prospect, ProspectEvent, Strategy, archivePatch, dncPatch, dropReady, notePatch, replyPatch, resultPatch, silentDays, statusColor, statusLabel, view,
} from "@/lib/prospects";
import { saveProspect, syncHunt } from "@/lib/prospectStore";
import { FillData, STAGES, Stage, fillTemplate, stageFor, stageOf } from "@/lib/templates";
import { btnMuted, btnPrimary, chip, ink, inputStyle } from "@/components/ui";
import Icon, { MoreDots } from "@/components/Icon";
import ConvertSheet from "@/components/ConvertSheet";

export type SendHow = "copy" | "wa" | "open";
export interface SendOut { how: "wa" | "open"; label: string; url?: string }

const time = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const dayOf = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return same(d, now) ? "Hari ini" : same(d, y) ? "Kemarin" : d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
};

export default function ProspectThread({ p, strategy, templates, fill, sendOut, sessionId, onSend, onClose }: {
  p: Prospect; strategy: Strategy; templates: PitchTemplate[]; fill: FillData; sendOut: SendOut; sessionId?: string;
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
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const [askDnc, setAskDnc] = useState(false);
  const [converting, setConverting] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const forStage = useMemo(() => templates.filter(t => stageOf(t) === stage), [templates, stage]);
  const dnc = v.status === "dnc";

  function choose(t: PitchTemplate) { setTpl(t); setText(fillTemplate(t.body, fill)); }

  async function send(how: SendHow) {
    if (!text.trim() || dnc || busy) return;
    setMsg(""); setBusy(true);
    const back = await onSend(p, tpl, text, how);
    setBusy(false);
    // Logged once: the box empties, so a second tap can't log it twice.
    if (back) { setText(""); setTpl(null); setUndo(() => back); setTimeout(() => setUndo(u => (u === back ? null : u)), 10000); }
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

  // History grouped by day, oldest first, like a chat; it opens at the newest.
  const events = (p.history || []).slice().sort((a, b) => a.at - b.at);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [events.length]);
  const drop = dropReady(p, on, strategy);
  const who = p.name ? `${p.name} (${p.handle})` : p.handle;

  const [panel, setPanel] = useState<"menu" | "pick" | null>(null);
  const toggle = (k: "menu" | "pick") => { setPanel(cur => (cur === k ? null : k)); setAskDnc(false); };
  const field = useRef<HTMLTextAreaElement>(null);
  const stageLabel = STAGES.find(s => s.id === stage)?.label || "";
  // The box grows with what's in it, up to a few lines, like a chat app's.
  useEffect(() => { const el = field.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; } }, [text]);
  const initials = (p.name || p.handle).replace(/^@/, "").slice(0, 2).toUpperCase();
  const row = (label: string, onClick: () => void, o: { strong?: boolean; danger?: boolean; pressed?: boolean; disabled?: boolean } = {}) => (
    <button className="sp-thread-row" onClick={onClick} disabled={o.disabled} aria-pressed={o.pressed}
      style={{ fontWeight: o.strong ? 700 : 500, color: o.danger ? "var(--hot)" : undefined }}>{label}</button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="th-h" data-own-layout="" className="sp-thread" onClick={e => e.stopPropagation()}
        // Escape closes the open panel first, then the conversation.
        onKeyDown={e => { if (e.key === "Escape" && panel) { e.stopPropagation(); setPanel(null); } }}>
        <header className="sp-thread-bar">
          <button onClick={onClose} aria-label="Tutup" className="sp-thread-icon"><Icon name="chevronLeft" size={22} stroke={2.2} /></button>
          <span className="sp-pini" aria-hidden="true" style={{ margin: 0, background: `color-mix(in srgb, ${statusColor(p, v)} 14%, var(--app-card))`, color: ink(statusColor(p, v)) }}>{initials}</span>
          <div className="sp-thread-who">
            <b id="th-h">{who}</b>
            <span>{p.platform} · {statusLabel(p, v)}{quiet !== null && quiet > 0 ? ` · diem ${quiet} hari` : ""}{v.due && v.due <= on && !dnc ? " · follow-up hari ini" : ""}</span>
          </div>
          {!dnc && (
            <button onClick={() => toggle("menu")} aria-label="Status & aksi" aria-haspopup="true" aria-expanded={panel === "menu"} className="sp-thread-icon"
              style={panel === "menu" ? { background: "var(--app-inner)" } : undefined}><MoreDots size={22} /></button>
          )}
        </header>

        <div ref={logRef} role="log" aria-label={`Percakapan dengan ${who}`} className="sp-thread-log" onClick={() => setPanel(null)}>
          {!events.length && <div style={{ fontSize: 13, color: "var(--app-muted)", textAlign: "center", padding: 20 }}>Belum ada apa-apa. Pesan pertama kamu muncul di sini.</div>}
          {events.map((e, i) => {
            const newDay = i === 0 || dayOf(events[i - 1].at) !== dayOf(e.at);
            return (
              <div key={i} style={{ display: "contents" }}>
                {newDay && <div style={{ alignSelf: "center", fontSize: 11, color: "var(--app-muted)", padding: "4px 10px", borderRadius: 999, background: "var(--app-card)", margin: "6px 0" }}>{dayOf(e.at)}</div>}
                <Bubble e={e} />
              </div>
            );
          })}
        </div>

        {/* What happened with them: answered, interested, a note, their data, drop, do-not-contact. */}
        {panel === "menu" && !dnc && (
          <div role="group" aria-label="Status & aksi" className="sp-thread-panel">
            {askDnc ? (
              // Asks first: it wipes what was said and can't be taken back.
              <div role="group" aria-label="Jangan hubungi lagi?" style={{ padding: "6px 4px" }}>
                <div style={{ fontSize: 14, marginBottom: 10 }}>Hapus isi percakapan dan jangan hubungi {p.handle} lagi? Ga bisa dibalikin.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setAskDnc(false)} style={{ ...btnMuted, minHeight: 44, flex: 1 }}>Batal</button>
                  <button onClick={async () => { setAskDnc(false); setPanel(null); await act(dncPatch(p, "Minta ga dihubungi lagi", ctx())); }} disabled={busy}
                    style={{ ...btnPrimary, minHeight: 44, flex: 1, background: "#c62828" }}>Ya, jangan hubungi</button>
                </div>
              </div>
            ) : <>
              {row("💬 Dia bales", () => { setAnswer("reply"); setPanel(null); }, { pressed: answer === "reply" })}
              {row("✅ Tertarik", () => { setPanel(null); act(resultPatch(p, "tertarik", {}, ctx(), strategy)); }, { disabled: busy })}
              {row("❌ Nolak", () => { setPanel(null); act(resultPatch(p, "tolak", {}, ctx(), strategy)); }, { disabled: busy })}
              {row("📝 Catatan", () => { setAnswer("note"); setPanel(null); }, { pressed: answer === "note" })}
              {!p.convertedAt && row("Kasih data →", () => { setPanel(null); setConverting(true); }, { strong: true, disabled: busy })}
              {drop && row("🗑 Buang", async () => { setPanel(null); await act(archivePatch(p, `${quiet} hari ga respon`, ctx())); onClose(); }, { disabled: busy })}
              {row("🚫 Jangan hubungi", () => setAskDnc(true), { danger: true, disabled: busy })}
            </>}
          </div>
        )}

        {/* The next message: its stage, then a template for it. */}
        {panel === "pick" && !dnc && (
          <div className="sp-thread-panel">
            <div role="radiogroup" aria-label="Tahap" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {STAGES.map(s => (
                <button key={s.id} role="radio" aria-checked={stage === s.id} onClick={() => { setStage(s.id); setTpl(null); }}
                  style={{ ...chip, minHeight: 36, fontWeight: stage === s.id ? 700 : 500, ...(stage === s.id ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
                  {s.id === stageFor(p, v) ? "● " : ""}{s.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Template">
              {forStage.length ? forStage.map(t => (
                <button key={t.id} className="sp-thread-row" onClick={() => { choose(t); setPanel(null); field.current?.focus(); }} aria-pressed={tpl?.id === t.id}
                  style={{ flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, padding: "8px" }}>
                  <span style={{ fontWeight: 700 }}>{t.title}</span>
                  <span style={{ fontSize: 12, color: "var(--app-muted)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fillTemplate(t.body, fill)}</span>
                </button>
              )) : <p style={{ margin: "4px 4px 6px", fontSize: 13, color: "var(--app-muted)" }}>Belum ada template buat tahap {stageLabel}. Tulis langsung di bawah.</p>}
            </div>
          </div>
        )}

        <footer className="sp-thread-foot">
          {undo && (
            <div role="status" className="sp-thread-note">
              <span style={{ flex: 1 }}>Tercatat terkirim.</span>
              <button onClick={async () => { const u = undo; setUndo(null); await u(); }} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>Batal</button>
            </div>
          )}
          {msg && <div role="alert" className="sp-thread-note" style={{ color: "var(--hot)" }}>{msg}</div>}
          {note && <div role="status" className="sp-thread-note" style={{ color: "var(--ok)", fontWeight: 600 }}>✓ {note}</div>}
          {answer && !dnc && (
            <div className="sp-thread-note">
              <label htmlFor="th-answer" className="vh">{answer === "reply" ? "Balasan dia" : "Catatan"}</label>
              <input id="th-answer" value={answerText} onChange={e => setAnswerText(e.target.value)} autoFocus placeholder={answer === "reply" ? "Tempel balasannya (boleh kosong)" : "Catatan buat diri sendiri"}
                style={{ ...inputStyle, fontSize: 16, flex: 1, minWidth: 0 }} />
              <button onClick={() => act(answer === "reply" ? replyPatch(p, answerText, ctx()) : notePatch(p, answerText, ctx()))}
                disabled={busy || (answer === "note" && !answerText.trim())} style={{ ...btnPrimary, minHeight: 44 }}>Simpan</button>
              <button onClick={() => { setAnswer(null); setAnswerText(""); }} aria-label="Batal" className="sp-thread-icon" style={{ color: "var(--app-muted)" }}><Icon name="close" size={16} stroke={2.2} /></button>
            </div>
          )}

          {dnc ? <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--app-muted)" }}>Orang ini minta ga dihubungi lagi.</div> : <>
            <button onClick={() => toggle("pick")} aria-expanded={panel === "pick"} className="sp-thread-pick" style={!text.trim() ? { color: "var(--brand-text)", fontWeight: 700 } : undefined}>
              <Icon name="doc" size={16} />
              <span>{tpl ? tpl.title : "Template"}</span>
              <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>· {stageLabel}{forStage.length ? ` (${forStage.length})` : ""}</span>
              <Icon name="chevronDown" size={14} style={{ marginLeft: "auto", transform: panel === "pick" ? "rotate(180deg)" : undefined }} />
            </button>
            <div className="sp-thread-compose">
              <label htmlFor="th-text" className="vh">Isi pesan</label>
              <textarea id="th-text" ref={field} value={text} onChange={e => setText(e.target.value)} rows={1} placeholder="Tulis pesan…"
                onFocus={() => setPanel(null)} className="sp-thread-field" />
              <button onClick={() => send("copy")} disabled={!text.trim() || busy} aria-label="Copy" title="Copy aja" className="sp-thread-icon" style={{ color: "var(--app-ink-2)" }}><Icon name="clipboard" size={20} /></button>
              <button onClick={() => send(sendOut.how)} disabled={!text.trim() || busy} aria-label={sendOut.label} title={sendOut.label} className="sp-thread-send"><Icon name="arrowUpRight" size={20} stroke={2.2} /></button>
            </div>
          </>}
        </footer>
      </div>
      {converting && (
        // Its backdrop tap closes only itself, not the conversation under it.
        <div style={{ display: "contents" }} onClick={e => e.stopPropagation()}><ConvertSheet p={p} sessionId={sessionId} onClose={() => setConverting(false)}
          onDone={m => { setConverting(false); setMsg(""); setUndo(null); setNote(m); }} /></div>
      )}
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
