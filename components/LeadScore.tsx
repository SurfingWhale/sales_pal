"use client";

import { LEVEL_COLOR, Score } from "@/lib/score";

// A lead's skor potensi with its reasons (PRD-008 §2): the number, one bar per
// signal, and the one move that would raise it most.
export default function LeadScore({ score, onReplied }: { score: Score; onReplied?: () => void }) {
  const c = LEVEL_COLOR[score.level];
  return (
    <section aria-label="Skor potensi" style={{ marginTop: 16, background: "var(--app-inner)", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 10, color: "var(--app-muted)", letterSpacing: "1px", fontWeight: 600 }}>SKOR POTENSI</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: `color-mix(in srgb, ${c} 70%, var(--app-text))` }}>Potensi {score.level}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{score.total}</span>
        <span style={{ fontSize: 13, color: "var(--app-muted)" }}>/ 100</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, margin: "12px 0 6px" }}>Kenapa {score.total}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {score.signals.map(s => (
          <li key={s.key} style={{ fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span><b>{s.label}</b> <span style={{ color: "var(--app-muted)" }}>· {s.detail}</span></span>
              <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{s.pts} <span style={{ color: "var(--app-muted)" }}>/ {s.max}</span></span>
            </div>
            <div aria-hidden="true" style={{ height: 4, background: "var(--app-border)", borderRadius: 2, marginTop: 4 }}>
              <div style={{ width: `${(s.pts / s.max) * 100}%`, height: "100%", background: "#005eb0", borderRadius: 2 }} />
            </div>
          </li>
        ))}
      </ul>
      {score.tip && <div style={{ fontSize: 12, marginTop: 10 }}><b>Biar naik:</b> {score.tip}.</div>}
      {onReplied && (
        <button onClick={onReplied} style={{ marginTop: 10, minHeight: 36, background: "transparent", border: "1px solid #005eb0", color: "var(--brand-text)", borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          💬 Mereka bales hari ini
        </button>
      )}
    </section>
  );
}
