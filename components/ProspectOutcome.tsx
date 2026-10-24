"use client";

import { useState } from "react";
import { addDays, today } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { objections } from "@/lib/salespal-data";
import { Prospect, Result, Strategy, dncPatch, notePatch, replyPatch, resultPatch } from "@/lib/prospects";
import { Counter, bump, ctx, saveProspect, syncHunt } from "@/lib/prospectStore";
import { btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";
import ConvertSheet from "@/components/ConvertSheet";

// What came of the messages, in one tap: the same buttons and editors on the
// journey card and on the person's page (owner, 23 Okt: a Follow-up opened for
// someone who had already said no left no way to mark it from there).

export type EditKind = "reply" | "nanti" | "tolak" | "dnc" | "note";
type Editing = { id: string; kind: EditKind; text: string; date: string };

export function useOutcome({ strategy, sessionId, onMsg, onLocked }: {
  strategy: Strategy; sessionId?: string;
  onMsg: (m: string) => void;
  onLocked?: (p: Prospect) => void;   // after Menolak dihubungi
}) {
  const space = useSpace();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [converting, setConverting] = useState<Prospect | null>(null);
  const [busy, setBusy] = useState(false);
  const on = today();

  async function act(p: Prospect, patch: Partial<Prospect>, counters: Counter[] = []) {
    setBusy(true);
    try {
      await saveProspect(space, p, patch);
      syncHunt(space, { ...p, ...patch } as Prospect);
      counters.forEach(c => bump(space, sessionId, c));
      setEditing(null);
    } catch {
      onMsg("Gagal nyimpen. Cek koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  const firstAnswer = (p: Prospect): Counter[] => (p.contact === "terhubung" ? [] : ["replies"]);
  const mark = (p: Prospect, r: Exclude<Result, "data">, extra: { remark?: string; nextAt?: string } = {}) =>
    act(p, resultPatch(p, r, extra, ctx(sessionId), strategy), firstAnswer(p));
  const edit = (p: Prospect, kind: EditKind, text = "", date = "") => setEditing({ id: p.id, kind, text, date });

  // Tertarik … Menolak dihubungi, as a grid of equal buttons.
  function results(p: Prospect, who: string) {
    return (
      <div role="group" aria-label={`Hasil untuk ${who}`} className="sp-choice-grid">
        <button disabled={busy} onClick={() => mark(p, "tertarik")} aria-pressed={p.result === "tertarik"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>✅ Tertarik</button>
        <button disabled={busy} onClick={() => mark(p, "pikir")} aria-pressed={p.result === "pikir"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>🤔 Pikir-pikir</button>
        <button disabled={busy} onClick={() => edit(p, "nanti", "", addDays(on, 7))} aria-pressed={p.result === "nanti"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>⏳ Hubungi nanti</button>
        <button disabled={busy} onClick={() => edit(p, "tolak", p.result === "tolak" ? p.remark || "" : "")} aria-pressed={p.result === "tolak"} style={{ ...chip, minHeight: 36, fontWeight: 700 }}>❌ Tidak tertarik</button>
        <button disabled={busy} onClick={() => setConverting(p)} style={{ ...chip, minHeight: 36, fontWeight: 700, background: "#00a862", color: "#1c2128", border: "none" }}>Kasih data →</button>
        <button disabled={busy} onClick={() => edit(p, "dnc")} style={{ ...chip, minHeight: 36, color: "color-mix(in srgb, #ff4444 55%, var(--app-text))", border: "1px solid #ff444440" }}>🚫 Menolak dihubungi</button>
      </div>
    );
  }

  // The open editor for this person (balasan, catatan, tanggal, alasan), or nothing.
  function editor(p: Prospect) {
    const ed = editing?.id === p.id ? editing : null;
    if (!ed) return null;
    const save = () => {
      const c = ctx(sessionId);
      if (ed.kind === "reply") return act(p, replyPatch(p, ed.text, c), firstAnswer(p));
      if (ed.kind === "note") return ed.text.trim() ? act(p, notePatch(p, ed.text, c)) : setEditing(null);
      if (ed.kind === "nanti") return mark(p, "nanti", { nextAt: ed.date || addDays(on, 7) });
      if (ed.kind === "tolak") return mark(p, "tolak", { remark: ed.text });
      return act(p, dncPatch(p, ed.text, c), firstAnswer(p)).then(() => onLocked?.(p));
    };
    return (
      <div onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setEditing(null); } }}
        style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "var(--app-inner)", border: "1px solid var(--app-border)" }}>
        {ed.kind === "reply" && <>
          <label htmlFor={`reply-${p.id}`} style={label}>Tempel balasannya (opsional)</label>
          <textarea id={`reply-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} placeholder="mis. Boleh kak, pricelist-nya berapa?" style={{ ...inputStyle, fontSize: 16, height: 72, resize: "vertical" }} />
        </>}
        {ed.kind === "note" && <>
          <label htmlFor={`note-${p.id}`} style={label}>Catatan</label>
          <input id={`note-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} placeholder="mis. minta dihubungi lagi habis lebaran" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
        </>}
        {ed.kind === "nanti" && <>
          <label htmlFor={`nanti-${p.id}`} style={label}>Hubungi lagi tanggal</label>
          <input id={`nanti-${p.id}`} type="date" value={ed.date} min={on} onChange={e => setEditing({ ...ed, date: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44, maxWidth: 240 }} />
        </>}
        {(ed.kind === "tolak" || ed.kind === "dnc") && <>
          {ed.kind === "tolak" && (
            <div role="group" aria-label="Alasan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {objections.filter(o => o.id !== "ghosting").map(o => (
                <button key={o.id} onClick={() => setEditing({ ...ed, text: o.label })} aria-pressed={ed.text === o.label} style={{ ...chip, minHeight: 32, ...(ed.text === o.label ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{o.icon} {o.label}</button>
              ))}
            </div>
          )}
          {ed.kind === "dnc" && <div style={{ fontSize: 12, color: "var(--app-sub)", marginBottom: 8 }}>Dikunci selamanya: ga muncul di antrian & kampanye. Riwayat percakapannya dihapus, yang disimpan cuma username + tanggal.</div>}
          <label htmlFor={`why-${p.id}`} style={label}>{ed.kind === "tolak" ? "Alasan (bebas)" : "Alasan (opsional)"}</label>
          <input id={`why-${p.id}`} autoFocus value={ed.text} onChange={e => setEditing({ ...ed, text: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
        </>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button onClick={() => setEditing(null)} style={{ ...btnMuted, minHeight: 44, padding: "8px 16px" }}>Batal</button>
          <button disabled={busy} onClick={save} style={{ ...btnPrimary, minHeight: 44, padding: "8px 16px", opacity: busy ? 0.7 : 1, ...(ed.kind === "dnc" ? { background: "#c62828" } : {}) }}>{busy ? "Menyimpan…" : ed.kind === "dnc" ? "Kunci" : "Simpan"}</button>
        </div>
      </div>
    );
  }

  const sheet = converting && (
    <ConvertSheet p={converting} sessionId={sessionId} onClose={() => setConverting(null)}
      onDone={m => { setConverting(null); onMsg(m); }} />
  );

  return { busy, editing, edit, stop: () => setEditing(null), results, editor, sheet };
}
