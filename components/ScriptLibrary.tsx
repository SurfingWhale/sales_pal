"use client";

import { ink } from "@/components/ui";
import AnimalArt from "@/components/AnimalArt";
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
  const [copyFail, setCopyFail] = useState<string | null>(null);
  // Eight at a time: all 32 at once made a phone scroll for ages.
  const PAGE = 8;
  const [limit, setLimit] = useState(PAGE);
  const filterKey = `${filterArchetype}|${filterObjection}|${filterTone}|${searchQuery}`;
  const [shownFor, setShownFor] = useState(filterKey);
  if (shownFor !== filterKey) { setShownFor(filterKey); setLimit(PAGE); }

  async function copyScript(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFail(null); setCopiedKey(key);
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 2000);
    } catch {
      setCopiedKey(null); setCopyFail(key);
    }
  }
  const resetFilters = () => { setFilterArchetype("all"); setFilterObjection("all"); setFilterTone("all"); setSearchQuery(""); };

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
    background: "var(--app-card)", border: "1px solid var(--app-line-strong)", borderRadius: 999,
    color: "var(--app-text)", padding: "0 18px", minHeight: 48, fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif",
  } as React.CSSProperties;

  return (
    <div className="sp-learn">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Script Library</div>
        <div style={{ color: "var(--app-muted)", fontSize: 13, marginTop: 4 }}>
          {filtered.length} script · saring per tipe customer dan keberatan, lalu copy langsung ke chat
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="search"
          aria-label="Cari script"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari script atau kata kunci…"
          style={{ ...inputBase, flex: "1 1 240px", minWidth: 0 }}
        />
        <select
          aria-label="Skenario"
          value={filterObjection}
          onChange={e => setFilterObjection(e.target.value)}
          style={{ ...inputBase, flex: "1 1 180px", minWidth: 0 }}
        >
          <option value="all">Semua skenario</option>
          {objections.map(o => (
            <option key={o.id} value={o.id}>{o.icon} {o.label}</option>
          ))}
        </select>
        <div role="group" aria-label="Gaya bahasa" style={{ display: "flex", flex: "1 1 220px", gap: 4, padding: 4, background: "var(--app-inner)", borderRadius: 999 }}>
          {(["all", "formal", "santai"] as const).map(t => (
            <button
              key={t}
              aria-pressed={filterTone === t}
              onClick={() => setFilterTone(t)}
              style={{
                background: filterTone === t ? "var(--app-card)" : "transparent", borderRadius: 999,
                boxShadow: filterTone === t ? "0 1px 3px rgba(0,0,0,.12)" : "none",
                border: "none", color: filterTone === t ? "var(--app-text)" : "var(--app-ink-2)", fontWeight: filterTone === t ? 700 : 500,
                flex: 1, padding: "0 14px", minHeight: 40, fontSize: 14, cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
              }}
            >
              {t === "all" ? "Semua" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Archetype quick-filter pills */}
      <div role="group" aria-label="Tipe customer" className="sp-chiprow" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          aria-pressed={filterArchetype === "all"}
          onClick={() => setFilterArchetype("all")}
          style={{
            background: filterArchetype === "all" ? "var(--app-text)" : "transparent", flexShrink: 0, whiteSpace: "nowrap",
            border: `1px solid ${filterArchetype === "all" ? "var(--app-text)" : "var(--app-line-strong)"}`, borderRadius: 999, color: filterArchetype === "all" ? "var(--app-card)" : "var(--app-ink-2)",
            padding: "0 16px", minHeight: 44, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Semua tipe
        </button>
        {archetypes.map(a => (
          <button
            key={a.id}
            aria-pressed={filterArchetype === a.id}
            onClick={() => setFilterArchetype(filterArchetype === a.id ? "all" : a.id)}
            style={{
              background: filterArchetype === a.id ? "var(--app-text)" : "transparent", flexShrink: 0, whiteSpace: "nowrap",
              border: `1px solid ${filterArchetype === a.id ? "var(--app-text)" : "var(--app-line-strong)"}`,
              borderRadius: 999, color: filterArchetype === a.id ? "var(--app-card)" : "var(--app-ink-2)",
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "0 16px 0 8px", minHeight: 44, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <AnimalArt id={a.id} size={28} />{a.name}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--app-muted)", fontSize: 13, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 12 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ marginBottom: 16 }}>Ga ada script yang cocok. Coba kata lain atau buka semua saringan.</div>
          <button onClick={resetFilters} style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: 0, background: "#005eb0", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reset saringan</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.slice(0, limit).map(item => {
            const arch = archetypes.find(a => a.id === item.archetypeId)!;
            const obj = objections.find(o => o.id === item.objectionId)!;
            const isCopied = copiedKey === item.key;
            return (
              <div key={item.key} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, padding: "clamp(14px, 4vw, 20px)" }}>
                {/* Tags row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 12, background: `${arch.color}15`, color: ink(arch.color),
                      border: `1px solid ${arch.color}30`, borderRadius: 20, padding: "3px 10px",
                    }}>
                      <AnimalArt id={arch.id} size={18} /> {arch.name}
                    </span>
                    <span style={{
                      fontSize: 12, background: "var(--app-inner)", color: "var(--app-muted)",
                      border: "1px solid var(--app-border)", borderRadius: 20, padding: "3px 10px",
                    }}>
                      {obj.icon} {obj.label}
                    </span>
                    <span style={{
                      fontSize: 12,
                      background: item.tone === "formal" ? "#a78bfa20" : "#00ccff20",
                      color: item.tone === "formal" ? "var(--violet-text)" : "var(--brand-text)",
                      border: `1px solid ${item.tone === "formal" ? "#a78bfa40" : "#00ccff40"}`,
                      borderRadius: 20, padding: "3px 10px",
                    }}>
                      {item.tone === "formal" ? "Formal" : "Santai"}
                    </span>
                  </div>
                </div>

                {/* Script text */}
                <div style={{
                  background: "var(--app-inner)", borderRadius: 14, padding: "14px 16px",
                  fontSize: 16, lineHeight: 1.6, color: "var(--app-text)",
                  marginBottom: 14,
                }}>
                  &ldquo;{item.script}&rdquo;
                </div>

                {/* Tips + copy */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 13, color: "var(--app-muted)", lineHeight: 1.5, minWidth: 0 }}>
                    <span style={{ color: "var(--ok)" }}>💡 </span>{item.tips}
                  </div>
                  <button
                    onClick={() => copyScript(item.script, item.key)}
                    style={{
                      background: isCopied ? "#00a8621a" : "transparent",
                      border: `1px solid ${isCopied ? "var(--ok)" : "var(--app-border)"}`,
                      color: isCopied ? "var(--ok)" : "var(--app-text)",
                      borderRadius: 999, padding: "0 18px", minHeight: 44, fontSize: 14, fontWeight: 700, flexShrink: 0,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {isCopied ? "✓ Tersalin" : "Copy"}
                  </button>
                </div>
                {copyFail === item.key && <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--hot)" }}>Gagal nyalin otomatis. Tekan lama teks script-nya, lalu salin manual.</p>}
              </div>
            );
          })}
          {filtered.length > limit && (
            <button onClick={() => setLimit(limit + PAGE)} style={{ minHeight: 44, borderRadius: 10, border: "1px dashed var(--app-border)", background: "transparent", color: "var(--brand-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Tampilkan {Math.min(PAGE, filtered.length - limit)} lagi · {filtered.length - limit} tersisa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
