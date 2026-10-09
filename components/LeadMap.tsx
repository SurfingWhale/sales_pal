"use client";

import { useMemo, useState } from "react";
import { QUADRANTS, Quadrant, SCORE_LINE, VALUE_LINE, levelOf, quadrantOf } from "@/lib/score";
import Icon from "@/components/Icon";
import HeatDots from "@/components/HeatDots";
import { waLink } from "@/lib/billing";

// Peta lead (PRD-008 §1, canvas "Beranda"): one dot per lead in play, skor
// potensi across, deal value up; a glow where the leads worth chasing gather.
// Beside it the "Kejar sekarang" list; below it one folder per quadrant.

export interface MapLead { id: string; name: string; score: number; value: number; why: string; phone?: string }

const jt = (n: number) => `Rp ${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
const ORDER: Quadrant[] = ["kejar", "rawat", "cepat", "nanti"];
const BAND: Record<Quadrant, string> = { kejar: "#005eb0", cepat: "#3b8ad6", rawat: "#7d93ad", nanti: "#aab4c0" };
const ADVICE: Record<Quadrant, string> = { kejar: "Hubungi minggu ini.", rawat: "Nilai besar, belum responsif.", cepat: "Responsif, tutup cepat.", nanti: "Biarkan dulu." };
const initials = (n: string) => n.replace(/[^A-Za-z0-9À-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

const css = `
.sp-dot { z-index: 1; }
.sp-dot.on { z-index: 4; }
.sp-dot:hover, .sp-dot:focus-visible { z-index: 6; }
.sp-dot .tip { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--glass-strong); color: var(--app-text); font-size: 12px; font-weight: 500; padding: 7px 11px; border-radius: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s ease; box-shadow: var(--glass-shadow); }
.sp-dot:hover .tip, .sp-dot:focus-visible .tip { opacity: 1; }
.sp-maplabel { text-shadow: 0 0 3px var(--map-bg), 0 0 6px var(--map-bg); }
.sp-folder { transition: transform .15s ease; }
.sp-folder:active { transform: scale(0.97); }
.sp-flap { transform-origin: 50% 100%; transform: rotateX(0deg); transition: transform .5s cubic-bezier(.2,0,0,1); }
.sp-folder:focus-visible .sp-flap { transform: rotateX(-28deg); }
.sp-sheet { position: absolute; top: 17%; left: 50%; width: 44%; aspect-ratio: 4/5; border-radius: 8px; overflow: hidden; background: var(--sheet); box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.09); transform-origin: 50% 100%; transition: transform .5s cubic-bezier(.2,0,0,1); }
.sp-sheet.s1 { transform: translateX(calc(-50% - 11%)) rotate(-4deg); transition-delay: 30ms; }
.sp-sheet.s2 { transform: translateX(-50%); }
.sp-sheet.s3 { transform: translateX(calc(-50% + 11%)) rotate(4deg); transition-delay: 30ms; }
.sp-folder:focus-visible .s1 { transform: translateX(-100%) translateY(-30%) rotate(-9deg); }
.sp-folder:focus-visible .s2 { transform: translateX(-50%) translateY(-30%); }
.sp-folder:focus-visible .s3 { transform: translateX(0%) translateY(-30%) rotate(9deg); }
.sp-folder .arrow { color: var(--app-muted); transition: transform .3s ease, color .3s ease; }
@media (hover: hover) {
  .sp-folder:hover .sp-flap { transform: rotateX(-28deg); }
  .sp-folder:hover .s1 { transform: translateX(-100%) translateY(-30%) rotate(-9deg); }
  .sp-folder:hover .s2 { transform: translateX(-50%) translateY(-30%); }
  .sp-folder:hover .s3 { transform: translateX(0%) translateY(-30%) rotate(9deg); }
  .sp-folder:hover .arrow { transform: translate(1px, -1px); color: var(--app-text); }
}
@media (prefers-reduced-motion: reduce) { .sp-flap, .sp-sheet, .sp-folder, .sp-folder .arrow { transition: none; } }
.sp-only-phone { display: none; }
@media (max-width: 767px) { .sp-only-desk { display: none !important; } .sp-only-phone { display: block; } }
`;

function Blur({ edge, height, z = 2 }: { edge: "t" | "b"; height: number; z?: number }) {
  return <div className={`pb ${edge}`} aria-hidden="true" style={{ [edge === "t" ? "top" : "bottom"]: 0, height, zIndex: z }}><span /><span /><span /><span /><span /><span /></div>;
}

export default function LeadMap({ leads, onOpen, onAll }: { leads: MapLead[]; onOpen: (id: string) => void; onAll: () => void }) {
  const [focus, setFocus] = useState<Quadrant | "">("");
  const withQ = useMemo(() => leads.map(l => ({ ...l, q: quadrantOf(l.score, l.value) })), [leads]);
  const chase = withQ.filter(l => l.q === "kejar").sort((a, b) => b.score - a.score || b.value - a.value);
  const [selId, setSel] = useState<string | null | undefined>(undefined);
  const sel = withQ.find(l => l.id === (selId === undefined ? chase[0]?.id : selId));

  // The value axis runs to 2.5× the line (Rp 25 jt) or the biggest deal.
  const top = Math.max(VALUE_LINE * 2.5, ...leads.map(l => l.value || 0));
  const y = (v: number) => Math.min(100, ((v || 0) / top) * 100);
  const line = y(VALUE_LINE);
  const count = (q: Quadrant) => withQ.filter(l => l.q === q).length;
  const labelled = new Set(chase.slice(0, 2).map(l => l.id));

  if (!leads.length) {
    return (
      <section aria-labelledby="map-h" style={{ background: "var(--map-bg)", border: "1px solid var(--app-border)", borderRadius: 28, padding: 24 }}>
        <h2 id="map-h" style={{ margin: 0, fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><Icon name="map" style={{ color: "var(--brand-text)" }} /> Peta lead</h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--app-muted)" }}>Belum ada lead yang jalan. Begitu ada, tiap lead jadi satu titik: makin kanan makin berpotensi, makin atas makin besar nilainya.</p>
      </section>
    );
  }

  const chip = (q: Quadrant, pos: React.CSSProperties) => (
    <span className="glass" style={{ position: "absolute", zIndex: 3, ...pos, height: 30, padding: "0 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: q === "kejar" ? "var(--brand-text)" : "var(--app-ink-2)", opacity: focus && focus !== q ? 0.5 : 1 }}>
      {q === "kejar" && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "#005eb0" }} />}
      {QUADRANTS[q].label} <span className="tabnum" style={{ color: "var(--app-muted)", fontWeight: 500 }}>{count(q)}</span>
    </span>
  );
  const axis = (text: string, pos: React.CSSProperties) => (
    <span className="tabnum sp-maplabel" aria-hidden="true" style={{ position: "absolute", zIndex: 3, ...pos, fontSize: 12, fontWeight: 500, color: "var(--app-muted)", whiteSpace: "nowrap" }}>{text}</span>
  );

  return (
    <>
      <style>{css}</style>
      {/* ---- desktop: the big map + Kejar sekarang ---- */}
      <div className="sp-only-desk" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <section aria-labelledby="map-h" style={{ flex: "999 1 560px", minWidth: 0, position: "relative", height: 560, borderRadius: 28, overflow: "hidden", isolation: "isolate", background: "var(--map-bg)", border: "1px solid var(--app-border)" }}>
          <p id="map-desc" className="vh">Makin ke kanan, skor potensinya makin tinggi. Makin ke atas, nilai deal-nya makin besar. Satu titik satu lead. Warna biru pekat menandai kumpulan lead yang layak dikejar.</p>
          <div role="group" aria-label="Titik lead" aria-describedby="map-desc" style={{ position: "absolute", top: 100, right: 32, bottom: 76, left: 76 }}>
            {withQ.map(l => (
              <span key={`b${l.id}`} aria-hidden="true" style={{ position: "absolute", left: `${l.score}%`, bottom: `${y(l.value)}%`, width: 210, height: 210, transform: "translate(-50%, 50%)", borderRadius: "50%", background: `radial-gradient(circle, ${l.q === "kejar" ? "var(--blob-hot)" : "var(--blob)"} 0%, transparent 68%)`, pointerEvents: "none" }} />
            ))}
            <div aria-hidden="true" style={{ position: "absolute", left: `${SCORE_LINE}%`, right: 0, top: 0, bottom: `${line}%`, background: "var(--brand-tint)", borderRadius: "0 14px 0 0" }} />
            <div aria-hidden="true" style={{ position: "absolute", left: `${SCORE_LINE}%`, top: -100, bottom: -76, borderLeft: "1px dashed var(--map-line)" }} />
            <div aria-hidden="true" style={{ position: "absolute", left: -76, right: -32, bottom: `${line}%`, borderTop: "1px dashed var(--map-line)" }} />
            {chip("kejar", { left: `calc(${SCORE_LINE}% + 10px)`, top: 10 })}
            {chip("rawat", { left: 10, top: 10 })}
            {chip("cepat", { right: 10, bottom: 10 })}
            {chip("nanti", { left: 10, bottom: `calc(${line}% - 40px)` })}
            {axis(jt(top), { right: "calc(100% + 10px)", top: 0, transform: "translateY(-50%)" })}
            {axis(jt(VALUE_LINE), { right: "calc(100% + 10px)", bottom: `${line}%`, transform: "translateY(50%)" })}
            {axis("Rp 0", { right: "calc(100% + 10px)", bottom: 0, transform: "translateY(50%)" })}
            {axis(String(SCORE_LINE), { top: "calc(100% + 10px)", left: `${SCORE_LINE}%`, transform: "translateX(-50%)" })}
            {axis("100 · skor", { top: "calc(100% + 10px)", right: 0 })}
            {withQ.map(l => {
              const on = sel?.id === l.id;
              const shown = !focus || focus === l.q;
              const hot = l.q === "kejar";
              return (
                <button key={l.id} className={`sp-dot${on ? " on" : ""}`} aria-pressed={on} onClick={() => setSel(on ? null : l.id)}
                  aria-label={`${l.name}, skor ${l.score}, ${jt(l.value || 0)}, ${QUADRANTS[l.q].label}`}
                  style={{ position: "absolute", left: `${l.score}%`, bottom: `${y(l.value)}%`, transform: "translate(-50%, 50%)", width: 28, height: 28, padding: 0, border: 0, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: shown ? 1 : 0.18, transition: "opacity .2s ease" }}>
                  <span style={{ display: "block", width: on ? 16 : 11, height: on ? 16 : 11, borderRadius: "50%", background: hot ? "#005eb0" : focus === l.q ? "var(--app-ink-2)" : "var(--pin)", boxShadow: on ? "0 0 0 3px var(--ring), 0 0 0 11px var(--halo), 0 2px 10px rgba(0,0,0,0.3)" : "0 0 0 2px var(--ring), 0 1px 4px rgba(0,0,0,0.28)", transition: "width .2s ease, height .2s ease, box-shadow .2s ease" }} />
                  {labelled.has(l.id) && <span className="sp-maplabel" style={{ position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)", fontSize: 12, fontWeight: 600, color: "var(--app-ink-2)", whiteSpace: "nowrap", pointerEvents: "none" }}>{l.name}</span>}
                  <span className="tip" aria-hidden="true">{l.name} · skor {l.score} · {jt(l.value || 0)}</span>
                </button>
              );
            })}
          </div>
          <Blur edge="t" height={124} />
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 124, zIndex: 2, background: "linear-gradient(to bottom, var(--map-fade), transparent)", pointerEvents: "none" }} />
          <Blur edge="b" height={68} />
          <div style={{ position: "absolute", zIndex: 5, top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="glass" style={{ height: 44, padding: "0 18px 0 14px", borderRadius: 999, display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="map" style={{ color: "var(--brand-text)" }} />
                <h2 id="map-h" style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Peta lead</h2>
                <span className="tabnum" style={{ fontSize: 13, color: "var(--app-muted)" }}>{leads.length} lead</span>
              </div>
              <button className="glass" onClick={onAll} aria-label="Lihat sebagai daftar di Leads" style={{ width: 44, height: 44, border: 0, borderRadius: 999, color: "var(--app-ink-2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="list" /></button>
            </div>
            {focus && (
              <button className="glass" onClick={() => setFocus("")} aria-label={`Hapus saring: ${QUADRANTS[focus].label}`} style={{ height: 44, padding: "0 8px 0 16px", border: 0, borderRadius: 999, display: "flex", alignItems: "center", gap: 10, color: "var(--app-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {QUADRANTS[focus].label}
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--glass-btn)", color: "var(--app-ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={12} stroke={2.4} /></span>
              </button>
            )}
          </div>
          {sel && (
            <div className="frost" role="region" aria-label="Lead terpilih" style={{ position: "absolute", zIndex: 5, left: 16, bottom: 16, width: 304, maxWidth: "calc(100% - 32px)", borderRadius: 24, padding: "16px 16px 16px 18px", boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 12px 32px var(--frost-float)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: sel.q === "kejar" ? "var(--brand-text)" : "var(--app-muted)" }}>{QUADRANTS[sel.q].label}</p>
                  <h3 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.name}</h3>
                </div>
                <button onClick={() => setSel(null)} aria-label="Tutup" style={{ flexShrink: 0, width: 44, height: 44, margin: "-8px -8px 0 0", border: 0, padding: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--app-ink-2)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--glass-btn)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={13} stroke={2.4} /></span>
                </button>
              </div>
              <p className="tabnum" style={{ margin: "10px 0 0", display: "flex", alignItems: "baseline", gap: 10, fontSize: 13, color: "var(--app-muted)" }}>
                <span><span style={{ fontSize: 15, fontWeight: 600, color: "var(--app-text)" }}>{sel.score}</span> skor</span><span aria-hidden="true">·</span><span style={{ fontWeight: 600, color: "var(--app-text)" }}>{jt(sel.value || 0)}</span>
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.45, color: "var(--app-muted)" }}>{sel.why || QUADRANTS[sel.q].advice}</p>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <button onClick={() => onOpen(sel.id)} style={{ flex: 1, height: 42, border: 0, borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Buka lead</button>
                {sel.phone
                  ? <a href={waLink(sel.phone, "")} target="_blank" rel="noreferrer" style={{ flex: 1, height: 42, borderRadius: 999, background: "var(--glass-btn)", color: "var(--app-text)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>Chat</a>
                  : <button disabled title="Belum ada nomor" style={{ flex: 1, height: 42, border: 0, borderRadius: 999, background: "var(--glass-btn)", color: "var(--app-muted)", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>Chat</button>}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="top-h" style={{ flex: "1 1 340px", minWidth: 0, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 28, padding: "24px 16px 12px" }}>
          <h2 id="top-h" style={{ margin: "0 8px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Kejar sekarang</h2>
          <p style={{ margin: "6px 8px 12px", fontSize: 14, color: "var(--app-muted)" }}>Skor {SCORE_LINE} ke atas, nilai {jt(VALUE_LINE)} ke atas. Pilih buat lihat di peta.</p>
          {chase.length === 0 && <p style={{ margin: "0 8px 12px", fontSize: 13, color: "var(--app-muted)" }}>Belum ada. Naikin skor lead bernilai besar: jadwalin langkah berikutnya, tandai kalau mereka bales.</p>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {chase.slice(0, 5).map(l => {
              const on = sel?.id === l.id;
              return (
                <li key={l.id} style={{ borderTop: "1px solid var(--app-border)" }}>
                  <button className="rowhover" aria-pressed={on} onClick={() => { setFocus(""); setSel(l.id); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", margin: "2px 0", border: 0, borderRadius: 14, background: on ? "var(--app-inner)" : "transparent", color: "var(--app-text)", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(l.name)}</span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                      <span style={{ marginTop: 3, fontSize: 13, color: "var(--app-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[l.why, jt(l.value || 0)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span className="tabnum" style={{ fontSize: 15, fontWeight: 600 }}>{l.score}</span>
                      <HeatDots level={levelOf(l.score)} size={6} labelled />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={onAll} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 8px", fontSize: 14, fontWeight: 500, color: "var(--brand-text)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Buka semua di Leads <Icon name="arrowRight" size={16} />
          </button>
        </section>
      </div>

      {/* ---- desktop: one folder per quadrant ---- */}
      <section aria-labelledby="fold-h" className="sp-only-desk" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <h2 id="fold-h" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Per kuadran</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--app-muted)" }}>Arahkan kursor buat ngintip isinya. Klik buat nampilin di peta.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 24 }}>
          {ORDER.map(q => {
            const rows = withQ.filter(l => l.q === q).sort((a, b) => b.score - a.score);
            const total = rows.reduce((a, l) => a + (l.value || 0), 0);
            const on = focus === q;
            return (
              <button key={q} className="sp-folder" aria-pressed={on} onClick={() => { setFocus(on ? "" : q); setSel(null); }}
                aria-label={`${QUADRANTS[q].label}: ${rows.length} lead, ${jt(total)}. ${on ? "Sedang ditampilkan di peta." : "Tampilkan di peta."}`}
                style={{ position: "relative", display: "block", width: "100%", aspectRatio: "20 / 17", padding: 0, border: 0, background: "transparent", color: "var(--app-text)", textAlign: "left", cursor: "pointer", perspective: 1000, fontFamily: "inherit" }}>
                <svg viewBox="0 0 400 340" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", filter: "var(--folder-shadow)" }}>
                  <path d="M0 30a30 30 0 0 1 30-30h124a30 30 0 0 1 30 30 32 32 0 0 0 32 32h154a30 30 0 0 1 30 30v218a30 30 0 0 1-30 30H30a30 30 0 0 1-30-30Z" style={{ fill: "var(--folder)", stroke: on ? "#005eb0" : "var(--folder-edge)", strokeWidth: on ? 3 : 1 }} />
                </svg>
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1 }}>
                  {rows.slice(0, 3).map((l, i) => (
                    <span key={l.id} className={`sp-sheet s${i + 1}`}>
                      <span style={{ display: "block", height: "40%", background: BAND[q] }} />
                      <span style={{ display: "block", padding: "8px 9px" }}>
                        <span style={{ display: "block", fontSize: 10, fontWeight: 600, lineHeight: 1.3, color: "var(--app-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                        <span className="tabnum" style={{ display: "block", marginTop: 3, fontSize: 9, color: "var(--app-muted)" }}>Skor {l.score}</span>
                      </span>
                    </span>
                  ))}
                </span>
                <span className="sp-flap frost" style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "24%", zIndex: 2, borderRadius: 20, boxShadow: "inset 0 0 0 1px var(--frost-ring), 0 -2px 7px -2px var(--frost-drop)" }}>
                  {on && <span style={{ position: "absolute", top: 12, right: 12, height: 24, padding: "0 10px", borderRadius: 999, background: "#005eb0", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center" }}>Di peta</span>}
                  <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 16px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: q === "kejar" ? "var(--brand-text)" : "var(--app-text)" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: BAND[q] }} />{QUADRANTS[q].label}</span>
                      <span className="tabnum" style={{ marginTop: 4, fontSize: 13, color: "var(--app-ink-2)" }}>{rows.length} lead · {jt(total)}</span>
                      <span style={{ marginTop: 2, fontSize: 12, color: "var(--app-muted)" }}>{ADVICE[q]}</span>
                    </span>
                    <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M5 11 11 5M6 5h5v5" /></svg>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- phone: a small map, then the list ---- */}
      <section aria-labelledby="ph-map" className="sp-only-phone" style={{ position: "relative", height: 250, borderRadius: 26, overflow: "hidden", isolation: "isolate", background: "var(--map-bg)", border: "1px solid var(--app-border)" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: 58, right: 18, bottom: 22, left: 18 }}>
          {withQ.map(l => <span key={`pb${l.id}`} style={{ position: "absolute", left: `${l.score}%`, bottom: `${y(l.value)}%`, width: 140, height: 140, transform: "translate(-50%, 50%)", borderRadius: "50%", background: `radial-gradient(circle, ${l.q === "kejar" ? "var(--blob-hot)" : "var(--blob)"} 0%, transparent 68%)` }} />)}
          <div style={{ position: "absolute", left: `${SCORE_LINE}%`, right: 0, top: 0, bottom: `${line}%`, background: "var(--brand-tint)", borderRadius: "0 10px 0 0" }} />
          <div style={{ position: "absolute", left: `${SCORE_LINE}%`, top: -58, bottom: -22, borderLeft: "1px dashed var(--map-line)" }} />
          <div style={{ position: "absolute", left: -18, right: -18, bottom: `${line}%`, borderTop: "1px dashed var(--map-line)" }} />
          {withQ.map(l => <span key={`pd${l.id}`} style={{ position: "absolute", left: `${l.score}%`, bottom: `${y(l.value)}%`, width: l.q === "kejar" ? 10 : 8, height: l.q === "kejar" ? 10 : 8, transform: "translate(-50%, 50%)", borderRadius: "50%", background: l.q === "kejar" ? "#005eb0" : "var(--pin)", boxShadow: "0 0 0 2px var(--ring), 0 1px 3px rgba(0,0,0,0.28)" }} />)}
        </div>
        <Blur edge="t" height={80} />
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 80, zIndex: 2, background: "linear-gradient(to bottom, var(--map-fade), transparent)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", zIndex: 3, top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div className="glass" style={{ height: 36, padding: "0 14px 0 11px", borderRadius: 999, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="map" size={16} style={{ color: "var(--brand-text)" }} />
            <h2 id="ph-map" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Peta lead</h2>
          </div>
          <div className="glass" style={{ height: 36, padding: "0 12px", borderRadius: 999, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--brand-text)" }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "#005eb0" }} /><span className="tabnum">{chase.length}</span> kejar sekarang
          </div>
        </div>
      </section>
      <section aria-labelledby="ph-top" className="sp-only-phone">
        <h2 id="ph-top" style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>Kejar sekarang</h2>
        {chase.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>Belum ada lead dengan skor {SCORE_LINE}+ dan nilai {jt(VALUE_LINE)}+.</p>}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {chase.slice(0, 5).map(l => (
            <li key={l.id}>
              <button onClick={() => onOpen(l.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 0", border: "none", borderBottom: "1px solid var(--app-border)", background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(l.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--app-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[l.why, jt(l.value || 0)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="tabnum" style={{ fontSize: 14, fontWeight: 600 }}>{l.score}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
