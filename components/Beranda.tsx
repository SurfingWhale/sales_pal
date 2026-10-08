"use client";

import { useState } from "react";
import LeadMap, { MapLead } from "@/components/LeadMap";
import { longDate, waLink } from "@/lib/billing";

// Beranda (PRD-008 §1): what to do today first, then four numbers, then the
// lead map. Every card has one main action.

export interface Todo {
  key: string; when: string; icon: string; title: string; what: string;
  kind: string;        // "Kirim penawaran", "Invoice jatuh tempo", …
  action: string;      // the main button
  phone: string; text: string;  // a WhatsApp message, when the action is one
  wa?: boolean;        // the main action is the WhatsApp message
  open: () => void;
}

export interface Numbers {
  active: number; newThisWeek: number;
  high: number;
  closedThisMonth: number; paidThisMonth: string;
  pipeline: number; pipelineHigh: number;
}

const jtNum = (n: number) => (n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 });

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

export default function Beranda({ now, todo, numbers, mapLeads, onOpenLead, onImport, onAdd, children }: {
  now: string; todo: Todo[]; numbers: Numbers; mapLeads: MapLead[];
  onOpenLead: (id: string) => void; onImport: () => void; onAdd: () => void; children?: React.ReactNode;
}) {
  const [all, setAll] = useState(false);
  const due = todo.filter(t => t.when <= now).length;
  const shown = all ? todo : todo.slice(0, 4);
  const day = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

  const pill = (primary: boolean, onDark = false): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", borderRadius: 999,
    fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "none",
    border: primary ? "none" : `1px solid ${onDark ? "rgba(255,255,255,0.5)" : "var(--app-border)"}`,
    background: primary ? (onDark ? "#fff" : "#005eb0") : "transparent",
    color: primary ? (onDark ? "#004a8c" : "#fff") : onDark ? "#fff" : "var(--app-text)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--app-muted)", textTransform: "capitalize" }}>{day}</p>
          <h1 style={{ margin: 0, fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.02em", maxWidth: 620 }}>
            {greeting()}. {due ? `Ada ${due} hal yang perlu ditindak hari ini.` : "Belum ada yang mendesak hari ini."}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onImport} style={pill(false)}>Import</button>
          <button onClick={onAdd} style={pill(true)}>Tambah lead</button>
        </div>
      </div>

      <section aria-label="Ringkasan pipeline" className="sp-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, background: "var(--app-border)", borderTop: "1px solid var(--app-border)", borderBottom: "1px solid var(--app-border)" }}>
        {[
          { label: "Lead aktif", value: String(numbers.active), sub: numbers.newThisWeek ? `+${numbers.newThisWeek} minggu ini` : "belum ada yang baru minggu ini" },
          { label: "Potensi tinggi", value: String(numbers.high), sub: "Skor 70 ke atas" },
          { label: "Closing bulan ini", value: String(numbers.closedThisMonth), sub: numbers.paidThisMonth },
          { label: "Nilai pipeline", value: jtNum(numbers.pipeline), unit: true, sub: `Rp ${jtNum(numbers.pipelineHigh)} jt di potensi tinggi` },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--app-bg)", padding: "18px 16px 20px 0" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-muted)" }}>{k.label}</p>
            <p style={{ margin: "8px 0 0", display: "flex", alignItems: "baseline", gap: 4, fontVariantNumeric: "tabular-nums" }}>
              {k.unit && <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-muted)" }}>Rp</span>}
              <span style={{ fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{k.value}</span>
              {k.unit && <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-muted)" }}>jt</span>}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--app-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="todo-h">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
          <h2 id="todo-h" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Perlu ditindak <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{todo.length}</span></h2>
          {todo.length > 4 && <button onClick={() => setAll(!all)} style={{ background: "none", border: "none", padding: 0, color: "var(--brand-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{all ? "Ringkas" : `Lihat semua (${todo.length})`}</button>}
        </div>
        {todo.length === 0 ? (
          <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 20, fontSize: 13, color: "var(--app-muted)" }}>
            Aman. Nggak ada follow-up, penawaran, deal macet, atau tagihan yang nunggu. Pasang jadwal follow-up dari detail lead.
          </div>
        ) : (
          <div className="sp-todo">
            <style>{`
              .sp-todo { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
              .sp-todo > article { min-height: 190px; }
              @media (max-width: 640px) {
                .sp-todo { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 84%; overflow-x: auto; scroll-snap-type: x mandatory; margin: 0 -16px; padding: 0 16px 4px; scroll-padding: 16px; scrollbar-width: none; }
                .sp-todo::-webkit-scrollbar { display: none; }
                .sp-todo > article { min-height: 0; scroll-snap-align: start; }
              }
            `}</style>
            {shown.map((t, i) => {
              const first = i === 0;
              const late = t.when < now;
              const whenText = late ? `telat ${Math.round((Date.parse(now) - Date.parse(t.when)) / 86400000)} hari` : t.when === now ? "hari ini" : longDate(t.when);
              return (
                <article key={t.key} style={{ background: first ? "#005eb0" : "var(--app-card)", color: first ? "#fff" : "var(--app-text)", border: first ? "none" : "1px solid var(--app-border)", borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: first ? "rgba(255,255,255,0.9)" : "var(--app-muted)" }}>
                    <span aria-hidden="true">{t.icon}</span>{t.kind}
                    <span style={{ marginLeft: "auto", fontSize: 12, padding: first ? "3px 8px" : 0, borderRadius: 999, background: first ? "rgba(255,255,255,0.16)" : "transparent", color: first ? "#fff" : late ? "color-mix(in srgb, #dc2626 75%, var(--app-text))" : "var(--app-muted)" }}>{first ? "Paling mendesak" : whenText}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.5, color: first ? "rgba(255,255,255,0.92)" : "var(--app-muted)" }}>{t.what}{first ? ` · ${whenText}` : ""}</p>
                  </div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.wa && t.phone
                      ? <a href={waLink(t.phone, t.text)} target="_blank" rel="noreferrer" style={pill(first, first)}>{t.action}</a>
                      : <button onClick={t.open} style={pill(first, first)}>{t.action}</button>}
                    {t.wa && t.phone
                      ? <button onClick={t.open} style={{ ...pill(false, first), border: "none" }}>Buka</button>
                      : t.phone && <a href={waLink(t.phone, t.text)} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${t.title}`} style={{ ...pill(false, first), border: "none" }}>WA</a>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <LeadMap leads={mapLeads} onOpen={onOpenLead} />

      {children}
    </div>
  );
}
