"use client";

import { useMemo, useState } from "react";
import { QUADRANTS, Quadrant, SCORE_LINE, VALUE_LINE, quadrantOf } from "@/lib/score";

// Peta lead (PRD-008 §1): one dot per lead in play, skor potensi across, deal
// value up. The four quadrants say what to do; the list beside it says who.

export interface MapLead { id: string; name: string; score: number; value: number; why: string }

const jt = (n: number) => `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
const ORDER: Quadrant[] = ["kejar", "rawat", "cepat", "nanti"];

export default function LeadMap({ leads, onOpen }: { leads: MapLead[]; onOpen: (id: string) => void }) {
  const [focus, setFocus] = useState<Quadrant | "">("");
  const [sel, setSel] = useState<string>("");

  // The value axis tops out at the biggest deal (at least 2.5× the line), so
  // one huge deal doesn't flatten the rest.
  const top = useMemo(() => Math.max(VALUE_LINE * 2.5, ...leads.map(l => l.value || 0)), [leads]);
  const y = (v: number) => Math.min(100, ((v || 0) / top) * 100);
  const withQ = leads.map(l => ({ ...l, q: quadrantOf(l.score, l.value) }));
  const groups = ORDER.map(q => {
    const rows = withQ.filter(l => l.q === q);
    return { q, n: rows.length, value: rows.reduce((a, l) => a + (l.value || 0), 0) };
  });
  const chase = withQ.filter(l => l.q === "kejar").sort((a, b) => b.score - a.score || b.value - a.value);
  const picked = withQ.find(l => l.id === sel);

  if (!leads.length) {
    return (
      <section aria-labelledby="map-h" style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 24 }}>
        <h2 id="map-h" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Peta lead</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Belum ada lead yang jalan. Begitu ada, tiap lead jadi satu titik: makin kanan makin berpotensi, makin atas makin besar nilainya.</p>
      </section>
    );
  }

  return (
    <div className="sp-map-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <section aria-labelledby="map-h" style={{ flex: "999 1 520px", minWidth: 0, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 id="map-h" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Peta lead <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{leads.length} lead</span></h2>
          {focus && <button onClick={() => setFocus("")} style={{ background: "none", border: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Tampilkan semua</button>}
        </div>
        <p id="map-desc" style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--app-muted)" }}>Makin ke kanan skor potensinya makin tinggi, makin ke atas nilai deal-nya makin besar.</p>

        <div style={{ position: "relative", height: "clamp(240px, 42vw, 380px)", margin: "0 4px 22px 44px" }}>
          {/* quadrant fills + lines */}
          <div aria-hidden="true" style={{ position: "absolute", left: `${SCORE_LINE}%`, right: 0, bottom: `${y(VALUE_LINE)}%`, top: 0, background: "color-mix(in srgb, #005eb0 9%, transparent)", borderRadius: "0 10px 0 0" }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderLeft: "1px solid var(--app-border)", borderBottom: "1px solid var(--app-border)" }} />
          <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: `${SCORE_LINE}%`, borderLeft: "1px dashed var(--app-border)" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: `${y(VALUE_LINE)}%`, borderTop: "1px dashed var(--app-border)" }} />
          {([["kejar", { right: 6, top: 4 }], ["rawat", { left: 6, top: 4 }], ["cepat", { right: 6, bottom: 4 }], ["nanti", { left: 6, bottom: 4 }]] as [Quadrant, React.CSSProperties][]).map(([q, pos]) => (
            <span key={q} aria-hidden="true" style={{ position: "absolute", ...pos, fontSize: 11, fontWeight: 700, color: q === "kejar" ? "var(--brand-text)" : "var(--app-muted)", opacity: focus && focus !== q ? 0.4 : 1 }}>{QUADRANTS[q].label}</span>
          ))}
          {/* axes */}
          <span aria-hidden="true" style={{ position: "absolute", left: -44, bottom: -6, fontSize: 10, color: "var(--app-muted)" }}>Rp 0</span>
          <span aria-hidden="true" style={{ position: "absolute", left: -44, bottom: `calc(${y(VALUE_LINE)}% - 6px)`, fontSize: 10, color: "var(--app-muted)" }}>{jt(VALUE_LINE).replace("Rp ", "")}</span>
          <span aria-hidden="true" style={{ position: "absolute", left: -44, top: -6, fontSize: 10, color: "var(--app-muted)" }}>{jt(top).replace("Rp ", "")}</span>
          <span aria-hidden="true" style={{ position: "absolute", left: 0, bottom: -20, fontSize: 10, color: "var(--app-muted)" }}>0</span>
          <span aria-hidden="true" style={{ position: "absolute", left: `${SCORE_LINE}%`, bottom: -20, transform: "translateX(-50%)", fontSize: 10, color: "var(--app-muted)" }}>{SCORE_LINE}</span>
          <span aria-hidden="true" style={{ position: "absolute", right: 0, bottom: -20, fontSize: 10, color: "var(--app-muted)" }}>100 · skor</span>
          {/* dots */}
          <div role="group" aria-label="Titik lead" aria-describedby="map-desc" style={{ position: "absolute", inset: 0 }}>
            {withQ.map(l => {
              const on = sel === l.id;
              const dim = focus && focus !== l.q;
              const hot = l.q === "kejar";
              return (
                <button key={l.id} onClick={() => setSel(on ? "" : l.id)} aria-pressed={on}
                  aria-label={`${l.name}, skor ${l.score}, ${jt(l.value || 0)}, ${QUADRANTS[l.q].label}`}
                  style={{ position: "absolute", left: `${l.score}%`, bottom: `${y(l.value)}%`, transform: "translate(-50%, 50%)", width: 24, height: 24, padding: 0, border: "none", background: "transparent", cursor: "pointer", opacity: dim ? 0.18 : 1, zIndex: on ? 3 : hot ? 2 : 1 }}>
                  <span aria-hidden="true" style={{ display: "block", margin: "auto", width: on ? 16 : hot ? 12 : 10, height: on ? 16 : hot ? 12 : 10, borderRadius: "50%", background: hot ? "#005eb0" : "color-mix(in srgb, #005eb0 35%, var(--app-card))", boxShadow: on ? "0 0 0 3px var(--app-card), 0 0 0 5px #005eb0" : "0 0 0 2px var(--app-card)" }} />
                </button>
              );
            })}
          </div>
        </div>

        {picked && (
          <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--app-inner)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--app-muted)", fontWeight: 600 }}>{QUADRANTS[picked.q].label}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{picked.name}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Skor {picked.score} · {jt(picked.value || 0)}{picked.why ? ` · ${picked.why}` : ""}</div>
            </div>
            <button onClick={() => onOpen(picked.id)} style={{ minHeight: 40, padding: "0 16px", borderRadius: 999, border: "none", background: "#005eb0", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Buka lead</button>
          </div>
        )}
      </section>

      <aside style={{ flex: "1 1 280px", minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
        <section aria-labelledby="chase-h" style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 18 }}>
          <h2 id="chase-h" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Kejar sekarang <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{chase.length}</span></h2>
          <p style={{ margin: "2px 0 10px", fontSize: 12, color: "var(--app-muted)" }}>Skor {SCORE_LINE} ke atas, nilai {jt(VALUE_LINE)} ke atas.</p>
          {chase.length === 0 && <div style={{ fontSize: 12, color: "var(--app-muted)" }}>Belum ada. Naikin skor lead bernilai besar: jadwalin langkah berikutnya, tandai kalau mereka bales.</div>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {chase.slice(0, 6).map(l => (
              <li key={l.id}>
                <button onClick={() => onOpen(l.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 0", border: "none", borderTop: "1px solid var(--app-inner)", background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: "color-mix(in srgb, #005eb0 12%, var(--app-card))", color: "var(--brand-text)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{l.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[l.why, jt(l.value || 0)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{l.score}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="quad-h" style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 18 }}>
          <h2 id="quad-h" style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700 }}>Per kuadran</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {groups.map(g => (
              <button key={g.q} onClick={() => setFocus(focus === g.q ? "" : g.q)} aria-pressed={focus === g.q}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: `1px solid ${focus === g.q ? "#005eb0" : "var(--app-border)"}`, background: focus === g.q ? "color-mix(in srgb, #005eb0 8%, var(--app-card))" : "transparent", color: "inherit", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{QUADRANTS[g.q].label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--app-muted)" }}>{QUADRANTS[g.q].advice}</span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{g.n}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--app-muted)" }}>{jt(g.value)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
