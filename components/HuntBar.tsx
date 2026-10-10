"use client";

import { useEffect, useState } from "react";
import { HuntSession, isLive } from "@/lib/prospects";
import { sendToHunting, sessionNotice } from "@/lib/prospectStore";

// The bar over every tab while a hunting session runs (docs/prd/PRD-009 §4):
// how long, how much, paste the next post, the follow-ups waiting, stop.
export const HUNT_COLOR = "#b93a06";
export const BAR_HEIGHT = 48;

function clock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function HuntBar({ session, queued, sentToday, goal, onOpen, onEnd }: {
  session: HuntSession; queued: number; sentToday: number; goal: number;
  onOpen: () => void; onEnd: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [msg, setMsg] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // The phone's status bar takes the hunting colour while the session runs.
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const before = metas.map(m => m.content);
    metas.forEach(m => { m.content = HUNT_COLOR; });
    return () => metas.forEach((m, i) => { m.content = before[i]; });
  }, []);

  const c = session.counts || { prospects: 0, intros: 0, replies: 0, converted: 0 };
  const summary = `${c.intros} intro · ${c.replies} dibales · ${c.converted} data`;
  useEffect(() => { sessionNotice(`${summary} · ketuk buat balik ke SalesPal`); }, [summary]);

  if (!isLive(session, now)) return null;

  async function paste() {
    setMsg("");
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) { setMsg("Clipboard kosong"); return; }
      sendToHunting({ kind: "link", text });
      onOpen();
    } catch {
      setMsg("Tempel manual di kolom Target");
      onOpen();
    }
  }

  const progress = Math.min(1, goal ? sentToday / goal : 0);
  const btn = { minHeight: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #ffffff60", background: "#ffffff1f", color: "#fff", font: "700 12px 'Plus Jakarta Sans', sans-serif", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0 };
  return (
    <div role="region" aria-label="Sesi hunting" style={{ position: "relative", zIndex: 2, height: BAR_HEIGHT, background: HUNT_COLOR, color: "#fff", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`@keyframes sp-hunt-pulse{0%,100%{opacity:1}50%{opacity:.35}} .sp-hunt-dot{animation:sp-hunt-pulse 1.6s ease-in-out infinite} @media (prefers-reduced-motion: reduce){.sp-hunt-dot{animation:none}} @media (max-width:520px){.sp-hunt-wide{display:none}}`}</style>
      <button onClick={onOpen} aria-label={`Buka Hunting. Sesi ${clock(now - session.startedAt)}, ${summary}`} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, background: "none", border: "none", color: "#fff", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit" }}>
        <span className="sp-hunt-dot" aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: "#fff", flexShrink: 0 }} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>Hunting {clock(now - session.startedAt)}</span>
          <span style={{ fontSize: 12, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg || summary}</span>
        </span>
      </button>
      <button onClick={paste} aria-label="Tempel link dari clipboard" style={btn}>📋<span className="sp-hunt-wide"> Tempel</span></button>
      <button onClick={() => { sendToHunting({ kind: "queue" }); onOpen(); }} aria-label={`Antrian follow-up, ${queued}`} style={btn}>Antrian {queued}</button>
      <button onClick={onEnd} aria-label="Akhiri sesi hunting" style={{ ...btn, padding: "0 12px" }}>■</button>
      <div aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${progress * 100}%`, background: "#ffffffb3" }} />
    </div>
  );
}
