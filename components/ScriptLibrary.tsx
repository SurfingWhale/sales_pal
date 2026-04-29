"use client";

import { useState } from "react";
import { archetypes, objections, scriptMatrix } from "@/lib/salespal-data";

interface FlatScript {
  archetypeId: string;
  objectionId: string;
  script: string;
  tips: string;
  tone: "formal" | "santai";
  key: string;
}

function buildFlatScripts(): FlatScript[] {
  const result: FlatScript[] = [];
  for (const [archetypeId, objMap] of Object.entries(scriptMatrix)) {
    for (const [objectionId, scripts] of Object.entries(objMap)) {
      scripts.forEach((s, i) => {
        result.push({ archetypeId, objectionId, ...s, key: `${archetypeId}_${objectionId}_${i}` });
      });
    }
  }
  return result;
}

const ALL_SCRIPTS = buildFlatScripts();

export default function ScriptLibrary() {
  const [filterArchetype, setFilterArchetype] = useState("all");
  const [filterObjection, setFilterObjection] = useState("all");
  const [filterTone, setFilterTone] = useState<"all" | "formal" | "santai">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copyScript(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const filtered = ALL_SCRIPTS.filter(s => {
    if (filterArchetype !== "all" && s.archetypeId !== filterArchetype) return false;
    if (filterObjection !== "all" && s.objectionId !== filterObjection) return false;
    if (filterTone !== "all" && s.tone !== filterTone) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.script.toLowerCase().includes(q) || s.tips.toLowerCase().includes(q);
    }
    return true;
  });

  const inputBase = {
    background: "#0d1117", border: "1px solid #21262d", borderRadius: 8,
    color: "#e6edf3", padding: "10px 14px", fontSize: 12,
    outline: "none", fontFamily: "'IBM Plex Mono', monospace",
  } as React.CSSProperties;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Script Library</div>
        <div style={{ color: "#7d8590", fontSize: 12, marginTop: 4 }}>
          {filtered.length} script tersedia · Filter dan copy langsung ke chat
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍  Cari script atau kata kunci..."
          style={{ ...inputBase, flex: 1, minWidth: 200 }}
        />
        <select
          value={filterArchetype}
          onChange={e => setFilterArchetype(e.target.value)}
          style={inputBase}
        >
          <option value="all">Semua Tipe</option>
          {archetypes.map(a => (
            <option key={a.id} value={a.id}>{a.animal} {a.name}</option>
          ))}
        </select>
        <select
          value={filterObjection}
          onChange={e => setFilterObjection(e.target.value)}
          style={inputBase}
        >
          <option value="all">Semua Skenario</option>
          {objections.map(o => (
            <option key={o.id} value={o.id}>{o.icon} {o.label}</option>
          ))}
        </select>
        <div style={{ display: "flex", background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" }}>
          {(["all", "formal", "santai"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterTone(t)}
              style={{
                background: filterTone === t ? "#21262d" : "transparent",
                border: "none", color: filterTone === t ? "#e6edf3" : "#7d8590",
                padding: "10px 14px", fontSize: 12, cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", transition: "all 0.15s",
              }}
            >
              {t === "all" ? "Semua" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Archetype quick-filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => setFilterArchetype("all")}
          style={{
            background: filterArchetype === "all" ? "#21262d" : "transparent",
            border: "1px solid #21262d", borderRadius: 20, color: filterArchetype === "all" ? "#e6edf3" : "#7d8590",
            padding: "4px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Semua
        </button>
        {archetypes.map(a => (
          <button
            key={a.id}
            onClick={() => setFilterArchetype(filterArchetype === a.id ? "all" : a.id)}
            style={{
              background: filterArchetype === a.id ? `${a.color}20` : "transparent",
              border: `1px solid ${filterArchetype === a.id ? a.color : "#21262d"}`,
              borderRadius: 20, color: filterArchetype === a.id ? a.color : "#7d8590",
              padding: "4px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {a.animal} {a.name}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "#7d8590", fontSize: 13, background: "#0d1117", border: "1px solid #21262d", borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          Tidak ada script yang cocok dengan filter ini.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(item => {
            const arch = archetypes.find(a => a.id === item.archetypeId)!;
            const obj = objections.find(o => o.id === item.objectionId)!;
            const isCopied = copiedKey === item.key;
            return (
              <div key={item.key} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, padding: 20 }}>
                {/* Tags row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10, background: `${arch.color}15`, color: arch.color,
                      border: `1px solid ${arch.color}30`, borderRadius: 20, padding: "3px 10px",
                    }}>
                      {arch.animal} {arch.name}
                    </span>
                    <span style={{
                      fontSize: 10, background: "#161b22", color: "#8b949e",
                      border: "1px solid #21262d", borderRadius: 20, padding: "3px 10px",
                    }}>
                      {obj.icon} {obj.label}
                    </span>
                    <span style={{
                      fontSize: 10,
                      background: item.tone === "formal" ? "#a78bfa20" : "#00ccff20",
                      color: item.tone === "formal" ? "#a78bfa" : "#00ccff",
                      border: `1px solid ${item.tone === "formal" ? "#a78bfa40" : "#00ccff40"}`,
                      borderRadius: 20, padding: "3px 10px",
                    }}>
                      {item.tone === "formal" ? "Formal" : "Santai"}
                    </span>
                  </div>
                  <button
                    onClick={() => copyScript(item.script, item.key)}
                    style={{
                      background: isCopied ? "#00ff8820" : "transparent",
                      border: `1px solid ${isCopied ? "#00ff88" : "#21262d"}`,
                      color: isCopied ? "#00ff88" : "#7d8590",
                      borderRadius: 6, padding: "4px 12px", fontSize: 11,
                      cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                    }}
                  >
                    {isCopied ? "✓ Tersalin!" : "Copy"}
                  </button>
                </div>

                {/* Script text */}
                <div style={{
                  background: "#161b22", borderRadius: 8, padding: "14px 18px",
                  fontSize: 13, lineHeight: 1.8, fontStyle: "italic", color: "#e6edf3",
                  marginBottom: 10, borderLeft: `3px solid ${arch.color}`,
                }}>
                  &ldquo;{item.script}&rdquo;
                </div>

                {/* Tips */}
                <div style={{ fontSize: 11, color: "#7d8590" }}>
                  <span style={{ color: "#00ff88" }}>💡 </span>{item.tips}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
