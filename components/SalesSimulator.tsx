"use client";

import { useState } from "react";
import { archetypes, objections, scriptMatrix } from "@/lib/salespal-data";

type Step = "archetype" | "objection" | "result";

export default function SalesSimulator() {
  const [step, setStep] = useState<Step>("archetype");
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedObjection, setSelectedObjection] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copyScript(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function reset() {
    setStep("archetype");
    setSelectedArchetype(null);
    setSelectedObjection(null);
    setCopiedIdx(null);
  }

  const archetype = archetypes.find(a => a.id === selectedArchetype);
  const objection = objections.find(o => o.id === selectedObjection);
  const scripts = selectedArchetype && selectedObjection
    ? (scriptMatrix[selectedArchetype]?.[selectedObjection] ?? [])
    : [];

  const stepOrder: Step[] = ["archetype", "objection", "result"];
  const stepIdx = stepOrder.indexOf(step);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Sales Simulator</div>
        <div style={{ color: "#7d8590", fontSize: 12, marginTop: 4 }}>Pilih tipe nasabah + skenario → dapat script terbaik siap pakai</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
        {(["Tipe Nasabah", "Skenario", "Script"] as const).map((label, i) => {
          const isActive = stepIdx === i;
          const isDone = stepIdx > i;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: isActive ? "#00ff88" : isDone ? "#00ff8830" : "#161b22",
                  border: `2px solid ${isActive || isDone ? "#00ff88" : "#21262d"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: isActive ? "#000" : isDone ? "#00ff88" : "#7d8590",
                }}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 11, color: isActive ? "#e6edf3" : isDone ? "#7d8590" : "#7d8590", fontWeight: isActive ? 700 : 400 }}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div style={{ flex: 1, height: 1, background: isDone ? "#00ff8850" : "#21262d", margin: "0 12px" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Choose Archetype */}
      {step === "archetype" && (
        <div>
          <div style={{ fontSize: 13, color: "#7d8590", marginBottom: 20 }}>Nasabah lo lebih mirip yang mana?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {archetypes.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedArchetype(a.id); setStep("objection"); }}
                style={{
                  background: "#0d1117", border: `2px solid ${a.color}25`,
                  borderRadius: 16, padding: 24, textAlign: "left",
                  cursor: "pointer", color: "inherit", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = a.color;
                  (e.currentTarget as HTMLElement).style.background = `${a.color}0d`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${a.color}25`;
                  (e.currentTarget as HTMLElement).style.background = "#0d1117";
                }}
              >
                <div style={{ fontSize: 38, marginBottom: 12 }}>{a.animal}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: a.color, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#7d8590", lineHeight: 1.6, marginBottom: 14 }}>{a.comStyle}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {a.traits.map(t => (
                    <span key={t} style={{ fontSize: 10, background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30`, borderRadius: 20, padding: "2px 8px" }}>{t}</span>
                  ))}
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: "#7d8590", borderTop: "1px solid #161b22", paddingTop: 12 }}>
                  <span style={{ color: "#5a6270" }}>Kata kunci: </span>
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
            <span style={{ fontSize: 28 }}>{archetype.animal}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: archetype.color }}>{archetype.name}</div>
              <div style={{ fontSize: 11, color: "#7d8590", marginTop: 2 }}>{archetype.strategy}</div>
            </div>
            <button
              onClick={() => setStep("archetype")}
              style={{ background: "transparent", border: "1px solid #21262d", color: "#7d8590", borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >
              Ganti
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#7d8590", marginBottom: 16 }}>Apa yang nasabah bilang / lakukan?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            {objections.map(o => (
              <button
                key={o.id}
                onClick={() => { setSelectedObjection(o.id); setStep("result"); }}
                style={{
                  background: "#0d1117", border: "1px solid #21262d", borderRadius: 12,
                  padding: "18px 16px", textAlign: "left", cursor: "pointer",
                  color: "inherit", fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#00ff88"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#21262d"; }}
              >
                <div style={{ fontSize: 26, marginBottom: 10 }}>{o.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: "#5a6270", fontStyle: "italic", lineHeight: 1.5 }}>{o.example}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Results */}
      {step === "result" && archetype && objection && (
        <div>
          {/* Context chips */}
          <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
            <button
              onClick={() => setStep("archetype")}
              style={{ display: "flex", alignItems: "center", gap: 8, background: `${archetype.color}0d`, border: `1px solid ${archetype.color}30`, borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
            >
              <span>{archetype.animal}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: archetype.color }}>{archetype.name}</span>
              <span style={{ fontSize: 10, color: "#5a6270" }}>✕</span>
            </button>
            <button
              onClick={() => setStep("objection")}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "#00ff881a", border: "1px solid #00ff8830", borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
            >
              <span>{objection.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00ff88" }}>{objection.label}</span>
              <span style={{ fontSize: 10, color: "#5a6270" }}>✕</span>
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#7d8590", marginBottom: 20 }}>✨ Script yang direkomendasikan:</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {scripts.map((s, i) => (
              <div key={i} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "1px",
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
                      background: copiedIdx === i ? "#00ff8820" : "transparent",
                      border: `1px solid ${copiedIdx === i ? "#00ff88" : "#21262d"}`,
                      color: copiedIdx === i ? "#00ff88" : "#7d8590",
                      borderRadius: 6, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {copiedIdx === i ? "✓ Tersalin!" : "Copy Script"}
                  </button>
                </div>
                <div style={{
                  background: "#161b22", borderRadius: 10, padding: "16px 20px",
                  fontSize: 13, lineHeight: 1.8, fontStyle: "italic", color: "#e6edf3",
                  marginBottom: 14, borderLeft: `3px solid ${archetype.color}`,
                }}>
                  &ldquo;{s.script}&rdquo;
                </div>
                <div style={{ background: "#00ff881a", borderRadius: 8, padding: "10px 14px", border: "1px solid #00ff8815" }}>
                  <span style={{ fontSize: 10, color: "#00ff88", fontWeight: 700, letterSpacing: "1px" }}>💡 WHY IT WORKS&nbsp;&nbsp;</span>
                  <span style={{ fontSize: 12, color: "#8b949e" }}>{s.tips}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            style={{
              marginTop: 28, background: "linear-gradient(135deg, #00ff88, #00cc6a)",
              color: "#000", border: "none", borderRadius: 8, padding: "12px 28px",
              fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            ↺ Simulasi Baru
          </button>
        </div>
      )}
    </div>
  );
}
