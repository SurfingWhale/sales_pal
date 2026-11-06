"use client";

import { useEffect, useRef, useState } from "react";
import { deleteField, updateDoc } from "firebase/firestore";
import { addDays, today } from "@/lib/billing";
import { spaceDoc, useSpace } from "@/lib/space";
import { objections } from "@/lib/salespal-data";
import { Prospect, Result, Strategy, dncPatch, huntStatusFor, lastHuntId, notePatch, replyPatch, resultPatch } from "@/lib/prospects";
import { Counter, bump, ctx, saveProspect, syncHunt } from "@/lib/prospectStore";
import { btnMuted, btnPrimary, chip, inputStyle, label } from "@/components/ui";
import ConvertSheet from "@/components/ConvertSheet";
import Sheet from "@/components/Sheet";
import Icon from "@/components/Icon";

// What came of the messages: one sheet, "Dia jawab apa?", the same on the
// contact page and on the send page (owner, 23 Okt: a Follow-up opened for
// someone who had already said no left no way to mark it from there).
//
// Interaction review (docs/interaction, peta tombol 6 Nov): the answers used to
// be six equal chips beside Kirim, Catatan and Hapus, with Menolak dihubungi
// among them and no undo. Now the page has one way in ("Dia jawab…"), every
// answer that can be taken back says what happened with Batal for 10 s, and
// the one that can't (Menolak dihubungi) asks first, in red, from ⋯.

export type EditKind = "reply" | "nanti" | "tolak" | "dnc" | "note";
type Editing = { id: string; kind: EditKind; text: string; date: string; fromList?: boolean };
type Done = { text: string; undo?: () => Promise<void> };

const TITLE: Record<EditKind, string> = {
  reply: "Dia bales", note: "Catatan", nanti: "Hubungi nanti", tolak: "Tidak tertarik", dnc: "Menolak dihubungi?",
};

export function useOutcome({ strategy, sessionId, onMsg, onLocked, onOpenLead }: {
  strategy: Strategy; sessionId?: string;
  onMsg: (m: string) => void;
  onOpenLead?: (leadId: string) => void;
  onLocked?: (p: Prospect) => void;   // after Menolak dihubungi
}) {
  const space = useSpace();
  const [asking, setAsking] = useState<Prospect | null>(null);   // the "Dia jawab apa?" sheet
  const [editing, setEditing] = useState<Editing | null>(null);
  const [converting, setConverting] = useState<Prospect | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const on = today();

  useEffect(() => () => clearTimeout(timer.current), []);
  const tell = (d: Done) => {
    clearTimeout(timer.current);
    setDone(d);
    timer.current = setTimeout(() => setDone(null), 10000);
  };

  const close = () => { setEditing(null); setAsking(null); };

  // Saves, then says so. Undo puts back exactly the fields that changed.
  async function act(p: Prospect, patch: Partial<Prospect>, counters: Counter[], said: string, undoable = true): Promise<boolean> {
    setBusy(true);
    try {
      await saveProspect(space, p, patch);
      syncHunt(space, { ...p, ...patch } as Prospect);
      counters.forEach(c => bump(space, sessionId, c));
      close();
      const before = Object.fromEntries(Object.keys(patch).map(k => {
        const v = (p as unknown as Record<string, unknown>)[k];
        return [k, v === undefined ? deleteField() : v];
      })) as Partial<Prospect>;
      tell({
        text: said,
        undo: undoable ? async () => {
          await saveProspect(space, p, before);
          // syncHunt writes nothing for someone who hadn't answered: put their last DM back to Terkirim.
          if (huntStatusFor(p)) syncHunt(space, p);
          else { const h = lastHuntId(p); if (h) updateDoc(spaceDoc(space, "hunts", h), { status: "Terkirim" }).catch(() => undefined); }
          counters.forEach(c => bump(space, sessionId, c, -1));
        } : undefined,
      });
      return true;
    } catch {
      onMsg("Gagal nyimpen. Cek koneksi lalu coba lagi.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const firstAnswer = (p: Prospect): Counter[] => (p.contact === "terhubung" ? [] : ["replies"]);
  const whoOf = (p: Prospect) => p.name || p.handle;
  const mark = (p: Prospect, r: Exclude<Result, "data">, extra: { remark?: string; nextAt?: string } = {}) => {
    const patch = resultPatch(p, r, extra, ctx(sessionId), strategy);
    const when = patch.nextAt ? ` · follow-up ${new Date(`${patch.nextAt}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}` : "";
    const what = r === "tertarik" ? "Tertarik" : r === "pikir" ? "Pikir-pikir" : r === "nanti" ? "Hubungi nanti" : "Tidak tertarik";
    return act(p, patch, firstAnswer(p), `${whoOf(p)}: ${what}${when}`);
  };
  /** Open an editor straight away (Catatan, Menolak dihubungi from ⋯). */
  const edit = (p: Prospect, kind: EditKind, text = "", date = "") => { setEditing({ id: p.id, kind, text, date }); setAsking(p); };
  /** "Dia jawab…": the answers, in a sheet. */
  const ask = (p: Prospect) => { setEditing(null); setAsking(p); };

  function choices(p: Prospect) {
    const row = (t: string, sub: string, onClick: () => void, pressed = false) => (
      <button type="button" disabled={busy} onClick={onClick} aria-pressed={pressed || undefined} className="sp-answer">
        <span className="sp-answer-t">{t}</span>
        <span className="sp-answer-s">{sub}</span>
      </button>
    );
    return (
      <>
        <div role="group" aria-label={`Hasil untuk ${whoOf(p)}`} className="sp-answers">
          {row("Tertarik", "Follow-up besok", () => mark(p, "tertarik"), p.result === "tertarik")}
          {row("Pikir-pikir", `Follow-up ${strategy.thinkDays} hari lagi`, () => mark(p, "pikir"), p.result === "pikir")}
          {row("Hubungi nanti…", "Pilih tanggalnya", () => setEditing({ id: p.id, kind: "nanti", text: "", date: addDays(on, 7), fromList: true }), p.result === "nanti")}
          {row("Tidak tertarik…", `Pilih alasan · diparkir ${strategy.declinedParkDays} hari`, () => setEditing({ id: p.id, kind: "tolak", text: p.result === "tolak" ? p.remark || "" : "", date: "", fromList: true }), p.result === "tolak")}
          {row("Cuma bales, belum mutusin…", "Tempel balasannya", () => setEditing({ id: p.id, kind: "reply", text: "", date: "", fromList: true }))}
        </div>
        <button type="button" disabled={busy} onClick={() => { close(); setConverting(p); }} style={{ ...btnPrimary, width: "100%", minHeight: 48, marginTop: 12, background: "#00a862", color: "#1c2128" }}>
          Dia kasih nomor → Kasih data
        </button>
      </>
    );
  }

  // One editor (balasan, catatan, tanggal, alasan), inside the sheet.
  function form(p: Prospect, ed: Editing) {
    const save = () => {
      const c = ctx(sessionId);
      if (ed.kind === "reply") return act(p, replyPatch(p, ed.text, c), firstAnswer(p), `Balasan ${whoOf(p)} dicatat`);
      if (ed.kind === "note") return ed.text.trim() ? act(p, notePatch(p, ed.text, c), [], "Catatan disimpan") : close();
      if (ed.kind === "nanti") return mark(p, "nanti", { nextAt: ed.date || addDays(on, 7) });
      if (ed.kind === "tolak") return mark(p, "tolak", { remark: ed.text });
      // Menolak dihubungi deletes the conversation: asked here, not undoable.
      return act(p, dncPatch(p, ed.text, c), firstAnswer(p), `${whoOf(p)} dikunci: ga akan dihubungi lagi`, false).then(ok => { if (ok) onLocked?.(p); });
    };
    const set = (x: Partial<Editing>) => setEditing({ ...ed, ...x });
    return (
      <form onSubmit={e => { e.preventDefault(); save(); }}>
        {ed.kind === "reply" && <>
          <label htmlFor={`reply-${p.id}`} style={label}>Tempel balasannya (opsional)</label>
          <textarea id={`reply-${p.id}`} data-autofocus value={ed.text} onChange={e => set({ text: e.target.value })} placeholder="mis. Boleh kak, pricelist-nya berapa?" style={{ ...inputStyle, fontSize: 16, height: 96, resize: "vertical" }} />
        </>}
        {ed.kind === "note" && <>
          <label htmlFor={`note-${p.id}`} style={label}>Catatan buat diri sendiri</label>
          <input id={`note-${p.id}`} data-autofocus value={ed.text} onChange={e => set({ text: e.target.value })} placeholder="mis. minta dihubungi lagi habis lebaran" style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
        </>}
        {ed.kind === "nanti" && <>
          <label htmlFor={`nanti-${p.id}`} style={label}>Hubungi lagi tanggal</label>
          <input id={`nanti-${p.id}`} type="date" value={ed.date} min={on} onChange={e => set({ date: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
        </>}
        {ed.kind === "tolak" && (
          <div role="group" aria-label="Alasan" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {objections.filter(o => o.id !== "ghosting").map(o => (
              <button type="button" key={o.id} onClick={() => set({ text: o.label })} aria-pressed={ed.text === o.label} style={{ ...chip, minHeight: 44, ...(ed.text === o.label ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{o.label}</button>
            ))}
          </div>
        )}
        {ed.kind === "dnc" && (
          <p style={{ margin: "0 0 12px", fontSize: "var(--fs-meta)", lineHeight: 1.5, color: "var(--app-sub)" }}>
            Dikunci selamanya: ga muncul di antrian & kampanye. <b>Riwayat percakapannya dihapus</b>, yang disimpan cuma username + tanggal. Ini ga bisa dibatalin.
          </p>
        )}
        {(ed.kind === "tolak" || ed.kind === "dnc") && <>
          <label htmlFor={`why-${p.id}`} style={label}>{ed.kind === "tolak" ? "Alasan (bebas)" : "Alasan (opsional)"}</label>
          <input id={`why-${p.id}`} value={ed.text} onChange={e => set({ text: e.target.value })} style={{ ...inputStyle, fontSize: 16, minHeight: 44 }} />
        </>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => (ed.fromList ? setEditing(null) : close())} style={{ ...btnMuted, flex: 1, minHeight: 48 }}>{ed.fromList ? "Kembali" : "Batal"}</button>
          <button type="submit" disabled={busy} style={{ ...btnPrimary, flex: 1, minHeight: 48, opacity: busy ? 0.7 : 1, ...(ed.kind === "dnc" ? { background: "#c62828" } : {}) }}>{busy ? "Menyimpan…" : ed.kind === "dnc" ? "Kunci" : "Simpan"}</button>
        </div>
      </form>
    );
  }

  // An editor opened from the list of answers steps Back to the list; one opened on its own (⋯) closes.
  const ed = asking && editing?.id === asking.id ? editing : null;

  const sheet = (
    <>
      {asking && (
        <Sheet title={ed ? TITLE[ed.kind] : `${whoOf(asking)} jawab apa?`} onClose={() => { if (!busy) close(); }}
          onBack={ed?.fromList ? () => setEditing(null) : undefined}>
          {ed ? form(asking, ed) : choices(asking)}
        </Sheet>
      )}
      {converting && (
        <ConvertSheet p={converting} sessionId={sessionId} onClose={() => setConverting(null)}
          onDone={m => { setConverting(null); onMsg(m); }} onOpenLead={onOpenLead} />
      )}
      {done && (
        <div className="sp-toast" role="status" style={{ zIndex: 140 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-meta)" }}>✓ {done.text}</span>
          {done.undo && (
            <button type="button" onClick={async () => {
              const u = done.undo!; setDone(null); clearTimeout(timer.current);
              try { await u(); tell({ text: "Dibatalin" }); } catch { onMsg("Gagal batalin. Cek koneksi lalu coba lagi."); }
            }} style={{ minHeight: 44, padding: "0 14px", border: 0, borderRadius: 12, background: "rgba(255,255,255,.14)", color: "#fff", font: "600 var(--fs-meta) 'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>Batal</button>
          )}
          <button type="button" onClick={() => setDone(null)} aria-label="Tutup" style={{ minHeight: 44, minWidth: 44, border: 0, background: "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={13} stroke={2.4} /></button>
        </div>
      )}
    </>
  );

  return { busy, editing, ask, edit, stop: close, sheet };
}
