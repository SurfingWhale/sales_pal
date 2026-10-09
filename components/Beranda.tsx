"use client";

import { useState } from "react";
import LeadMap, { MapLead } from "@/components/LeadMap";
import Icon, { IconName } from "@/components/Icon";
import { longDate, waLink } from "@/lib/billing";

// Beranda (PRD-008 §1, canvas "Beranda — desktop" / "Beranda — HP"): what to
// do today first, then the numbers, then the lead map. Every card has one
// main action.

export interface Todo {
  key: string; when: string; icon: IconName; title: string; what: string;
  kind: string;        // "Kirim penawaran", "Invoice jatuh tempo", …
  action: string;      // the main button
  phone: string; text: string;  // a WhatsApp message, when the action is one
  wa?: boolean;        // the main action is the WhatsApp message
  snooze?: () => void; // "Tunda": push it to tomorrow
  open: () => void;
}

export interface Numbers {
  active: number; newThisWeek: number;
  high: number;
  closedThisMonth: number; closingTarget: number; paidThisMonth: string;
  pipeline: number; pipelineHigh: number;
}

// Juta, one decimal under 100 (12,5) and whole above it (331), as in the canvas.
const jtNum = (n: number) => (n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: n >= 100_000_000 ? 0 : 1 });

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

const css = `
.sp-b-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
.sp-b-h1 { margin: 0; font-size: 34px; line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; max-width: 620px; }
.sp-kpis { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: var(--app-border); border-top: 1px solid var(--app-border); border-bottom: 1px solid var(--app-border); }
.sp-kpi { background: var(--app-bg); padding: 24px 24px 26px; }
.sp-kpi:first-child { padding-left: 0; }
.sp-kpi .big { font-size: 64px; }
.sp-todo { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.sp-todo > article { border-radius: 20px; padding: 20px; min-height: 216px; gap: 14px; }
.sp-todo h3 { font-size: 20px; }
.sp-pill { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; white-space: nowrap; }
@media (max-width: 767px) {
  .sp-b-desk { display: none !important; }
  .sp-b-h1 { font-size: 26px; line-height: 1.2; letter-spacing: -0.02em; }
  .sp-kpis { margin-top: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sp-kpi { padding: 12px 10px 12px 14px; }
  .sp-kpi:first-child { padding-left: 0; }
  .sp-kpi.closing { display: none; }
  .sp-kpi .big { font-size: 38px; }
  .sp-kpi .sub { display: none; }
  .sp-kpi .lbl { font-size: 12px !important; }
  .sp-todo { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 272px; overflow-x: auto; scroll-snap-type: x mandatory; margin: 12px -16px 0; padding: 0 16px 4px; scroll-padding: 16px; scrollbar-width: none; gap: 10px; }
  .sp-todo::-webkit-scrollbar { display: none; }
  .sp-todo > article { scroll-snap-align: start; border-radius: 22px; padding: 18px; min-height: 176px; gap: 10px; }
  .sp-todo h3 { font-size: 18px; }
}
`;

export default function Beranda({ now, todo, numbers, mapLeads, onOpenLead, onImport, onAdd, onAllLeads, onSetTarget, children }: {
  now: string; todo: Todo[]; numbers: Numbers; mapLeads: MapLead[];
  onOpenLead: (id: string) => void; onImport: () => void; onAdd: () => void; onAllLeads: () => void; onSetTarget: () => void;
  children?: React.ReactNode;
}) {
  const [all, setAll] = useState(false);
  const due = todo.filter(t => t.when <= now).length;
  const shown = all ? todo : todo.slice(0, 4);
  const day = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  const pct = numbers.closingTarget ? Math.min(100, (numbers.closedThisMonth / numbers.closingTarget) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{css}</style>
      <div className="sp-b-head">
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--app-muted)", textTransform: "capitalize" }}>{day}</p>
          <h1 className="sp-b-h1">
            {due ? (
              <><span className="sp-b-desk">{greeting()}. Ada </span>{due} hal <span className="sp-b-desk">yang </span>perlu ditindak hari ini.</>
            ) : (
              <><span className="sp-b-desk">{greeting()}. </span>Belum ada yang mendesak hari ini.</>
            )}
          </h1>
        </div>
        <div className="sp-b-desk" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onImport} className="sp-pill" style={{ border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--app-text)" }}><Icon name="upload" stroke={1.6} />Import</button>
          <button onClick={onAdd} className="sp-pill" style={{ border: 0, background: "#005eb0", color: "#fff" }}><Icon name="plus" stroke={1.8} />Tambah lead</button>
        </div>
      </div>

      <section aria-label="Ringkasan pipeline" className="sp-kpis">
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Lead aktif</p>
          <p className="num big" style={{ margin: "14px 0 0" }}>{numbers.active}</p>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>{numbers.newThisWeek ? `+${numbers.newThisWeek} minggu ini` : "Belum ada yang baru minggu ini"}</p>
        </div>
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Potensi tinggi</p>
          <p className="num big" style={{ margin: "14px 0 0" }}>{numbers.high}</p>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Skor 70 ke atas</p>
        </div>
        <div className="sp-kpi closing">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Closing bulan ini</p>
          <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="num big">{numbers.closedThisMonth}</span>
            {numbers.closingTarget > 0 && <span className="num" style={{ fontSize: 30, color: "var(--app-muted)" }}>/ {numbers.closingTarget}</span>}
          </p>
          {numbers.closingTarget > 0 ? (
            <button onClick={onSetTarget} aria-label={`${numbers.closedThisMonth} dari target ${numbers.closingTarget} deal. Ubah target`} style={{ display: "block", width: "100%", marginTop: 14, padding: 0, border: 0, background: "none", cursor: "pointer" }}>
              <span style={{ display: "block", height: 4, borderRadius: 999, background: "var(--app-border)", overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 999, background: "#005eb0" }} /></span>
            </button>
          ) : (
            <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>{numbers.paidThisMonth} · <button onClick={onSetTarget} style={{ padding: 0, border: 0, background: "none", color: "var(--brand-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Atur target</button></p>
          )}
        </div>
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Nilai pipeline</p>
          <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--app-muted)" }}>Rp</span>
            <span className="num big">{jtNum(numbers.pipeline)}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--app-muted)" }}>jt</span>
          </p>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>Rp {jtNum(numbers.pipelineHigh)} jt di potensi tinggi</p>
        </div>
      </section>

      <section aria-labelledby="todo-h" style={{ marginTop: "clamp(24px, 5vw, 56px)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <h2 id="todo-h" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Perlu ditindak <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{todo.length}</span></h2>
          {todo.length > 4 && <button onClick={() => setAll(!all)} style={{ background: "none", border: "none", padding: 0, color: "var(--brand-text)", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{all ? "Ringkas" : "Lihat semua"}</button>}
        </div>
        {todo.length === 0 ? (
          <div style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 20, fontSize: 14, color: "var(--app-muted)" }}>
            Aman. Nggak ada follow-up, penawaran, deal macet, atau tagihan yang nunggu. Pasang jadwal follow-up dari detail lead.
          </div>
        ) : (
          <div className="sp-todo">
            {shown.map((t, i) => {
              const first = i === 0;
              const late = t.when < now;
              const whenText = late ? `Telat ${Math.round((Date.parse(now) - Date.parse(t.when)) / 86400000)} hari` : t.when === now ? "Hari ini" : longDate(t.when);
              const main: React.CSSProperties = first
                ? { border: 0, background: "#ffffff", color: "#004a8c" }
                : { border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--app-text)" };
              return (
                <article key={t.key} className={first ? undefined : "lift"} style={{ background: first ? "#005eb0" : "var(--app-card)", color: first ? "#fff" : "var(--app-text)", border: first ? "none" : "1px solid var(--app-border)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: first ? "rgba(255,255,255,0.88)" : "var(--app-muted)" }}>
                    <Icon name={t.icon} size={16} />
                    {t.kind}
                    {first
                      ? <span style={{ marginLeft: "auto", fontSize: 12, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.16)", color: "#fff", whiteSpace: "nowrap" }}>Paling mendesak</span>
                      : <span className="tabnum" style={{ marginLeft: "auto", whiteSpace: "nowrap", color: late ? "var(--hot)" : t.when === now ? "var(--app-text)" : "var(--app-muted)", fontWeight: t.when <= now ? 600 : 500 }}>{whenText}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontWeight: 600, letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</h3>
                    <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: first ? "rgba(255,255,255,0.92)" : "var(--app-muted)" }}>{t.what}{first ? ` · ${whenText.toLowerCase()}` : ""}</p>
                  </div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                    {t.wa && t.phone
                      ? <a href={waLink(t.phone, t.text)} target="_blank" rel="noreferrer" className="sp-pill" style={main}>{t.action}</a>
                      : <button onClick={t.open} className="sp-pill" style={main}>{t.action}</button>}
                    {t.snooze && <button onClick={t.snooze} className="sp-pill" style={{ border: 0, background: "transparent", color: first ? "#fff" : "var(--app-ink-2)", fontWeight: 500, padding: "0 14px" }}>Tunda</button>}
                    {!t.snooze && t.wa && t.phone && <button onClick={t.open} className="sp-pill" style={{ border: 0, background: "transparent", color: first ? "#fff" : "var(--app-ink-2)", fontWeight: 500, padding: "0 14px" }}>Buka</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ marginTop: "clamp(24px, 5vw, 56px)", display: "flex", flexDirection: "column", gap: 32 }}>
        <LeadMap leads={mapLeads} onOpen={onOpenLead} onAll={onAllLeads} />
        {children}
      </div>
    </div>
  );
}
