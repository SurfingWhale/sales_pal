"use client";

import { useRef, useState } from "react";
import { archetypes, objections, scriptMatrix } from "@/lib/salespal-data";

type Step = "archetype" | "objection" | "result";

export default function SalesSimulator() {
  const [step, setStep] = useState<Step>("archetype");
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedObjection, setSelectedObjection] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copyFail, setCopyFail] = useState<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  async function copyScript(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFail(null); setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(i => (i === idx ? null : i)), 2000);
    } catch {
      setCopiedIdx(null); setCopyFail(idx);
    }
  }

  // Each step starts at its top: the card tapped was often far down a phone's page.
  function goStep(next: Step) {
    setStep(next); setCopyFail(null);
    requestAnimationFrame(() => {
      const el = top.current;
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
    });
  }

  function reset() {
    setSelectedArchetype(null);
    setSelectedObjection(null);
    setCopiedIdx(null);
    goStep("archetype");
  }

  const archetype = archetypes.find(a => a.id === selectedArchetype);
  const objection = objections.find(o => o.id === selectedObjection);
  const scripts = selectedArchetype && selectedObjection
    ? (scriptMatrix[selectedArchetype]?.[selectedObjection] ?? [])
    : [];

  const stepOrder: Step[] = ["archetype", "objection", "result"];
  const stepIdx = stepOrder.indexOf(step);

  return (
    <div className="sp-learn sp-sim" ref={top} style={{ scrollMarginTop: 120 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sales Simulator</div>
        <div style={{ color: "var(--app-muted)", fontSize: 13, marginTop: 4 }}>Latihan jawab customer sebelum ketemu beneran: pilih tipenya dan apa yang dia bilang, dapat script siap pakai.</div>
      </div>

      {/* Step indicator */}
      <ol aria-label="Langkah" style={{ display: "flex", alignItems: "center", gap: 0, margin: "0 0 28px", padding: 0, listStyle: "none" }}>
        {(["Tipe customer", "Skenario", "Script"] as const).map((label, i) => {
          const isActive = stepIdx === i;
          const isDone = stepIdx > i;
          return (
            <li key={label} aria-current={isActive ? "step" : undefined} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: isActive ? "#005eb0" : isDone ? "#005eb030" : "var(--app-inner)",
                  border: `2px solid ${isActive || isDone ? "#005eb0" : "var(--app-border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: isActive ? "#fff" : isDone ? "var(--brand-text)" : "var(--app-muted)",
                }}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span className={isActive ? undefined : "sp-step-label"} style={{ fontSize: 13, color: isActive ? "var(--app-text)" : "var(--app-muted)", fontWeight: isActive ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div aria-hidden="true" style={{ flex: 1, minWidth: 12, height: 1, background: isDone ? "#005eb050" : "var(--app-border)", margin: "0 10px" }} />
              )}
            </li>
          );
        })}
      </ol>

      {/* STEP 1: Choose Archetype */}
      {step === "archetype" && (
        <div>
          <div style={{ fontSize: 14, color: "var(--app-muted)", marginBottom: 16 }}>Customer kamu lebih mirip yang mana?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {archetypes.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedArchetype(a.id); goStep("objection"); }}
                style={{
                  background: "var(--app-card)", border: `2px solid ${a.color}25`,
                  borderRadius: 16, padding: "clamp(16px, 4vw, 24px)", textAlign: "left",
                  cursor: "pointer", color: "inherit", fontFamily: "inherit",
                  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = a.color;
                  (e.currentTarget as HTMLElement).style.background = `${a.color}0d`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`;
                  (e.currentTarget as HTMLElement).style.background = "var(--app-card)";
                }}
              >
                <div aria-hidden="true" style={{ fontSize: 34, marginBottom: 10 }}>{a.animal}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: a.color, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--app-muted)", lineHeight: 1.6, marginBottom: 14 }}>{a.comStyle}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {a.traits.map(t => (
                    <span key={t} style={{ fontSize: 12, background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30`, borderRadius: 20, padding: "2px 8px" }}>{t}</span>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 12, color: "var(--app-muted)", borderTop: "1px solid var(--app-border)", paddingTop: 12 }}>
                  <span style={{ color: "var(--app-dim)" }}>Kata kunci: </span>
                  {a.triggerWords.slice(0, 3).join(", ")}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Choose Objection */}
      {step === "objection" && archetype && (
        <div>
          {/* Selected archetype chip */}
          <div style={{
            background: `${archetype.color}0d`, border: `1px solid ${archetype.color}30`,
            borderRadius: 12, padding: "14px 20px", marginBottom: 28,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span aria-hidden="true" style={{ fontSize: 28 }}>{archetype.animal}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: archetype.color }}>{archetype.name}</div>
              <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{archetype.strategy}</div>
            </div>
            <button
              onClick={() => goStep("archetype")}
              aria-label={`Ganti tipe customer (sekarang ${archetype.name})`}
              style={{ flexShrink: 0, background: "var(--app-card)", border: "1px solid var(--app-border)", color: "var(--app-text)", borderRadius: 999, padding: "0 16px", minHeight: 40, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Ganti
            </button>
          </div>

          <div style={{ fontSize: 14, color: "var(--app-muted)", marginBottom: 16 }}>Apa yang customer bilang atau lakukan?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            {objections.map(o => (
              <button
                key={o.id}
                onClick={() => { setSelectedObjection(o.id); goStep("result"); }}
                style={{
                  background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12,
                  padding: "18px 16px", textAlign: "left", cursor: "pointer",
                  color: "inherit", fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#005eb0"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--app-border)"; }}
              >
                <div aria-hidden="true" style={{ fontSize: 26, marginBottom: 10 }}>{o.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6 }}>{o.label}</div>
                <div style={{ fontSize: 12, color: "var(--app-dim)", fontStyle: "italic", lineHeight: 1.5 }}>{o.example}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Results */}
      {step === "result" && archetype && objection && (
        <div>
          {/* Context chips */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <button
              onClick={() => goStep("archetype")}
              aria-label={`Ganti tipe customer (sekarang ${archetype.name})`}
              style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, background: `${archetype.color}0d`, border: `1px solid ${archetype.color}30`, borderRadius: 20, padding: "0 14px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
            >
              <span aria-hidden="true">{archetype.animal}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: archetype.color }}>{archetype.name}</span>
              <span style={{ fontSize: 12, color: "var(--app-muted)" }}>· ganti</span>
            </button>
            <button
              onClick={() => goStep("objection")}
              aria-label={`Ganti skenario (sekarang ${objection.label})`}
              style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, background: "#005eb01a", border: "1px solid #005eb030", borderRadius: 20, padding: "0 14px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
            >
              <span aria-hidden="true">{objection.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-text)" }}>{objection.label}</span>
              <span style={{ fontSize: 12, color: "var(--app-muted)" }}>· ganti</span>
            </button>
          </div>

          <div style={{ fontSize: 14, color: "var(--app-muted)", marginBottom: 16 }}>✨ Script yang direkomendasikan:</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {scripts.map((s, i) => (
              <div key={i} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: "clamp(14px, 4vw, 24px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: "1px",
                    background: s.tone === "formal" ? "#a78bfa20" : "#00ccff20",
                    color: s.tone === "formal" ? "#a78bfa" : "#00ccff",
                    border: `1px solid ${s.tone === "formal" ? "#a78bfa40" : "#00ccff40"}`,
                    borderRadius: 20, padding: "3px 10px",
                  }}>
                    {s.tone === "formal" ? "FORMAL" : "SANTAI"}
                  </span>
                  <button
                    onClick={() => copyScript(s.script, i)}
                    style={{
                      background: copiedIdx === i ? "#00a8621a" : "transparent",
                      border: `1px solid ${copiedIdx === i ? "var(--ok)" : "var(--app-border)"}`,
                      color: copiedIdx === i ? "var(--ok)" : "var(--app-text)",
                      borderRadius: 8, padding: "0 16px", minHeight: 44, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {copiedIdx === i ? "✓ Tersalin" : "Copy"}
                  </button>
                </div>
                {copyFail === i && <p role="alert" style={{ margin: "0 0 10px", fontSize: 13, color: "var(--hot)" }}>Gagal nyalin otomatis. Tekan lama teks script-nya, lalu salin manual.</p>}
                <div style={{
                  background: "var(--app-inner)", borderRadius: 10, padding: "12px 16px",
                  fontSize: 15, lineHeight: 1.6, fontStyle: "italic", color: "var(--app-text)",
                  marginBottom: 14, borderLeft: `3px solid ${archetype.color}`,
                }}>
                  &ldquo;{s.script}&rdquo;
                </div>
                <div style={{ background: "#005eb01a", borderRadius: 8, padding: "10px 14px", border: "1px solid #005eb015" }}>
                  <span style={{ fontSize: 12, color: "var(--ok)", fontWeight: 700, letterSpacing: "1px" }}>💡 KENAPA AMPUH&nbsp;&nbsp;</span>
                  <span style={{ fontSize: 13, color: "var(--app-sub)" }}>{s.tips}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            style={{
              marginTop: 28, background: "#005eb0",
              color: "#fff", border: "none", borderRadius: 999, padding: "0 24px", minHeight: 48,
              fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            ↺ Simulasi baru
          </button>
        </div>
      )}
    </div>
  );
}
