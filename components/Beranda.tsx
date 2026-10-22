"use client";

import { useState } from "react";
import LeadMap, { MapLead } from "@/components/LeadMap";
import Icon, { IconName } from "@/components/Icon";
import { longDate, waLink } from "@/lib/billing";

// Beranda (PRD-008 §1, canvas "Beranda — desktop" / "Beranda — HP"): what to
// do today first, then the numbers, then the lead map. Every card has one
// main action.
//
// Three modes (PRD-008 §6), because the day isn't one flow: Jualan (what to
// move today), Report & closing (how the month is going, to the money in),
// Belajar (what the numbers teach, and practice). The last one picked is
// remembered on this device.

export type BerandaMode = "jualan" | "report" | "belajar";
const MODES: [BerandaMode, string][] = [["jualan", "Jualan"], ["report", "Report & closing"], ["belajar", "Belajar"]];
const MODE_KEY = "sp-beranda-mode";
function savedMode(): BerandaMode {
  try { const m = localStorage.getItem(MODE_KEY); return m === "report" || m === "belajar" ? m : "jualan"; } catch { return "jualan"; }
}

export interface HuntingStrip { live: boolean; sentToday: number; goal: number; queued: number; onStart: () => void; onOpen: () => void }

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
.sp-b-panel { display: flex; flex-direction: column; }
.sp-b-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px; }
.sp-b-date { margin: 0 0 10px; font-size: 14px; color: var(--app-muted); text-transform: capitalize; }
.sp-b-h1 { margin: 0; font-size: 34px; line-height: 1.15; font-weight: 600; letter-spacing: -0.025em; max-width: 620px; }

/* Segmented control: a 36px track and 32px thumb, inside a 44px tap row. */
.sp-seg { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; max-width: 440px; margin-bottom: clamp(16px, 3vw, 28px); padding: 0 2px; }
.sp-seg::before { content: ""; position: absolute; inset: 4px 0; border-radius: 9px; background: color-mix(in srgb, var(--app-text) 7%, transparent); }
.sp-seg-btn { position: relative; height: 44px; padding: 6px 0; border: 0; background: none; cursor: pointer; color: var(--app-ink-2); font: 500 13px 'Plus Jakarta Sans', sans-serif; }
.sp-seg-btn > span { display: flex; align-items: center; justify-content: center; height: 32px; border-radius: 7px; white-space: nowrap; transition: background-color .18s ease; }
.sp-seg-btn[aria-selected="true"] { color: var(--app-text); font-weight: 600; }
.sp-seg-btn[aria-selected="true"] > span { background: var(--thumb); box-shadow: 0 1px 2px rgba(15,30,60,0.10), 0 2px 6px rgba(15,30,60,0.06); }

.sp-card { background: var(--app-card); border: 1px solid var(--app-border); border-radius: 16px; }
.sp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 12px; font: 600 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; text-decoration: none; white-space: nowrap; border: 0; }
.sp-btn.line { border: 1px solid var(--app-line-strong); background: transparent; color: var(--app-text); }
.sp-btn.blue { background: #005eb0; color: #fff; }
.sp-btn.hunt { background: #b93a06; color: #fff; }
.sp-btn.ghost { background: transparent; color: var(--app-ink-2); font-weight: 500; padding: 0 12px; }

.sp-find { display: flex; align-items: center; gap: 14px; padding: 16px; margin-top: 12px; }
.sp-find-ic { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: #005eb0; color: #fff; }
.sp-find-sub { display: block; font-size: 13px; color: var(--app-muted); }

.sp-today { margin-top: 20px; display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; padding: 12px 16px; }
.sp-today-txt { font-size: 14px; min-width: 0; flex: 1 1 200px; display: flex; align-items: center; gap: 10px; }
.sp-today-bar { display: none; }

.sp-kpis { margin-top: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; background: var(--app-border); border-top: 1px solid var(--app-border); border-bottom: 1px solid var(--app-border); }
.sp-kpi { background: var(--app-bg); padding: 24px 24px 26px; }
.sp-kpi:first-child { padding-left: 0; }
.sp-kpi .lbl { margin: 0; font-size: 13px; font-weight: 500; color: var(--app-muted); }
.sp-kpi .val { margin: 14px 0 0; display: flex; align-items: baseline; gap: 6px; }
.sp-kpi .unit { font-size: 16px; font-weight: 600; color: var(--app-muted); }
.sp-kpi .sub { margin: 10px 0 0; font-size: 13px; color: var(--app-muted); }
/* A tablet is touched too: the target link keeps a 44pt row. */
.sp-kpi .sub button { min-height: 44px; vertical-align: baseline; }
.sp-kpi .big { font-size: 64px; }

.sp-todo-sec { margin-top: clamp(24px, 5vw, 56px); }
.sp-todo-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.sp-todo-more { display: inline-flex; align-items: center; gap: 2px; min-height: 44px; background: none; border: none; padding: 0; color: var(--brand-text); font: 500 14px 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
.sp-todo { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.sp-task { display: flex; flex-direction: column; border-radius: 20px; padding: 20px; min-height: 216px; gap: 14px; background: var(--app-card); color: var(--app-text); border: 1px solid var(--app-border); }
.sp-task h3 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-task-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--app-muted); }
.sp-task-when { margin-left: auto; white-space: nowrap; }
.sp-task-when.is-late { color: var(--hot); font-weight: 600; }
.sp-task-when.is-today { color: var(--app-text); font-weight: 600; }
.sp-task-flag { margin-left: auto; font-size: 12px; padding: 3px 8px; border-radius: 999px; white-space: nowrap; background: rgba(255,255,255,0.16); color: #fff; }
.sp-task-what { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--app-muted); }
.sp-task-acts { margin-top: auto; display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.sp-task .sp-btn { border-radius: 999px; }
.sp-task.is-first { background: #005eb0; color: #fff; border-color: #005eb0; }
.sp-task.is-first .sp-task-meta { color: rgba(255,255,255,0.88); }
.sp-task.is-first .sp-task-what { color: rgba(255,255,255,0.92); }
.sp-task.is-first .sp-btn.line { background: #fff; color: #004a8c; border-color: #fff; }
.sp-task.is-first .sp-btn.ghost { color: #fff; }
.sp-b-more { margin-top: clamp(24px, 5vw, 56px); display: flex; flex-direction: column; gap: 32px; }

@media (min-width: 768px) and (max-width: 1099px) {
  .sp-kpi { padding: 20px 16px 22px; }
  .sp-kpi .big { font-size: 48px; }
}
@media (max-width: 767px) {
  .sp-b-desk { display: none !important; }
  /* One rhythm on a phone: 16px between blocks, 8/12px inside them. */
  .sp-b-panel { gap: 16px; }
  .sp-b-date { margin: 0 0 4px; font-size: 13px; }
  .sp-b-h1 { font-size: 22px; line-height: 1.25; letter-spacing: -0.015em; }
  .sp-seg { max-width: none; margin-bottom: 12px; }
  .sp-card { border-radius: 14px; }

  .sp-find { margin: 0; padding: 12px; gap: 12px; }
  .sp-find-ic { width: 36px; height: 36px; border-radius: 10px; }
  .sp-find-ttl { font-size: 15px !important; }
  .sp-find-sub { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; }
  .sp-find .sp-btn { padding: 0 14px; }

  .sp-today { margin: 0; flex-direction: column; align-items: stretch; gap: 12px; padding: 12px; }
  .sp-today-txt { flex: none; }
  .sp-today-bar { display: block; height: 4px; border-radius: 2px; background: var(--app-inner); overflow: hidden; }
  .sp-today-bar > span { display: block; height: 100%; border-radius: 2px; background: #b93a06; }
  .sp-today .sp-btn { width: 100%; }

  .sp-kpis { margin: 0; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; background: var(--app-card); border: 1px solid var(--app-border); border-radius: 14px; overflow: hidden; }
  .sp-kpi { background: transparent; padding: 12px; }
  .sp-kpi:first-child { padding-left: 12px; }
  .sp-kpi + .sp-kpi { box-shadow: inset 1px 0 0 var(--app-border); }
  .sp-kpi.closing { display: none; }
  .sp-kpi.closing + .sp-kpi { box-shadow: inset 1px 0 0 var(--app-border); }
  .sp-kpi .lbl { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sp-kpi .val { margin-top: 4px; gap: 3px; }
  .sp-kpi .big { font: 700 24px/1.15 'Plus Jakarta Sans', sans-serif; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .sp-kpi .unit { font-size: 13px; }
  .sp-kpi .sub { display: none; }

  /* Perlu ditindak: one grouped list, rows split by hairlines — no card in a card. */
  .sp-todo-sec { margin: 0; }
  .sp-todo-head { margin-bottom: 4px; }
  .sp-todo { display: flex; flex-direction: column; gap: 0; background: var(--app-card); border: 1px solid var(--app-border); border-radius: 14px; overflow: hidden; }
  .sp-task, .sp-task.is-first { min-height: 0; border: 0; border-radius: 0; padding: 12px 16px; gap: 8px; background: transparent; color: var(--app-text); }
  .sp-task + .sp-task { box-shadow: inset 0 1px 0 var(--app-border); }
  .sp-task h3 { font-size: 15px; line-height: 1.3; }
  .sp-task-meta, .sp-task.is-first .sp-task-meta { font-size: 12px; gap: 6px; color: var(--app-muted); }
  .sp-task-what, .sp-task.is-first .sp-task-what { margin-top: 2px; font-size: 13px; line-height: 1.4; color: var(--app-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sp-task-flag { background: color-mix(in srgb, #005eb0 12%, transparent); color: var(--brand-text); font-weight: 600; padding: 2px 8px; }
  .sp-task-acts { margin-top: 0; gap: 8px; }
  .sp-task .sp-btn { border-radius: 10px; padding: 0 14px; }
  .sp-task.is-first .sp-btn.line { background: #005eb0; color: #fff; border-color: #005eb0; }
  .sp-task.is-first .sp-btn.ghost { color: var(--app-ink-2); }
  .sp-b-more { margin-top: 8px; gap: 24px; }
}
@media (max-width: 360px) {
  .sp-find { flex-wrap: wrap; }
  .sp-find > span:nth-child(2) { flex-basis: calc(100% - 48px) !important; }
  .sp-find .sp-btn { width: 100%; }
  .sp-kpi .lbl { white-space: normal; min-height: 2.6em; line-height: 1.3; }
  .sp-seg-btn { font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) { .sp-seg-btn > span { transition: none; } }
`;

export default function Beranda({ now, todo, numbers, mapLeads, onOpenLead, onImport, onFind, onAdd, onAllLeads, onSetTarget, hunting, report, learn, children }: {
  now: string; todo: Todo[]; numbers: Numbers; mapLeads: MapLead[];
  onOpenLead: (id: string) => void; onImport: () => void; onFind?: () => void; onAdd: () => void; onAllLeads: () => void; onSetTarget: () => void;
  hunting?: HuntingStrip; report?: React.ReactNode; learn?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [mode, setModeState] = useState<BerandaMode>(savedMode);
  const setMode = (m: BerandaMode) => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ } };
  const [all, setAll] = useState(false);
  const due = todo.filter(t => t.when <= now).length;
  const shown = all ? todo : todo.slice(0, 4);
  const day = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  const pct = numbers.closingTarget ? Math.min(100, (numbers.closedThisMonth / numbers.closingTarget) * 100) : 0;

  const tabs = (
    <div role="tablist" aria-label="Mode Beranda" className="sp-seg">
      {MODES.map(([m, l]) => (
        <button key={m} role="tab" className="sp-seg-btn" id={`bm-${m}`} aria-selected={mode === m} aria-controls="beranda-panel" onClick={() => setMode(m)}>
          <span>{l}</span>
        </button>
      ))}
    </div>
  );

  if (mode !== "jualan") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <style>{css}</style>
        {tabs}
        <div id="beranda-panel" role="tabpanel" aria-labelledby={`bm-${mode}`}>{mode === "report" ? report : learn}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{css}</style>
      {tabs}
      <div id="beranda-panel" role="tabpanel" aria-labelledby="bm-jualan" className="sp-b-panel">
      <div className="sp-b-head">
        <div style={{ minWidth: 0 }}>
          <p className="sp-b-date">{day}</p>
          <h1 className="sp-b-h1">
            {due ? (
              <><span className="sp-b-desk">{greeting()}. Ada </span>{due} hal <span className="sp-b-desk">yang </span>perlu ditindak hari ini.</>
            ) : (
              <><span className="sp-b-desk">{greeting()}. </span>Belum ada yang mendesak hari ini.</>
            )}
          </h1>
        </div>
        <div className="sp-b-desk" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onImport} className="sp-btn line" style={{ borderRadius: 999 }}><Icon name="upload" stroke={1.6} />Import</button>
          <button onClick={onAdd} className="sp-btn blue" style={{ borderRadius: 999 }}><Icon name="plus" stroke={1.8} />Tambah lead</button>
        </div>
      </div>

      {hunting && (
        // The day's one main move: today's DMs against the goal, then start.
        <section aria-label="Hunting hari ini" className="sp-card sp-today">
          <span className="sp-today-txt">
            <Icon name="target" size={18} />
            <span><b className="tabnum">{hunting.sentToday}/{hunting.goal}</b> DM hari ini · <b className="tabnum">{hunting.queued}</b> prospek di antrian</span>
          </span>
          <span className="sp-today-bar" aria-hidden="true"><span style={{ width: `${hunting.goal ? Math.min(100, (hunting.sentToday / hunting.goal) * 100) : 0}%` }} /></span>
          {hunting.live
            ? <button onClick={hunting.onOpen} className="sp-btn line">Sesi jalan · buka Hunting</button>
            : <button onClick={hunting.onStart} className="sp-btn hunt">▶ Mulai hunting</button>}
        </section>
      )}

      {onFind && (
        // Cari bisnis (PRD-012): new prospects from Google Maps or an Excel list.
        <section aria-label="Cari calon klien" className="sp-card sp-find">
          <span aria-hidden="true" className="sp-find-ic"><Icon name="search" size={18} stroke={1.8} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="sp-find-ttl" style={{ display: "block", fontSize: 15, fontWeight: 700 }}>Cari calon klien</span>
            <span className="sp-find-sub">Bisnis dari Google Maps, titik lemahnya, dan pesan pembuka. Atau import daftar Excel.</span>
          </span>
          <button onClick={onFind} className="sp-btn blue" style={{ flexShrink: 0 }}>Cari bisnis</button>
        </section>
      )}

      <section aria-label="Ringkasan pipeline" className="sp-kpis">
        <div className="sp-kpi">
          <p className="lbl">Lead aktif</p>
          <p className="val"><span className="num big">{numbers.active}</span></p>
          <p className="sub">{numbers.newThisWeek ? `+${numbers.newThisWeek} minggu ini` : "Belum ada yang baru minggu ini"}</p>
        </div>
        <div className="sp-kpi">
          <p className="lbl">Potensi tinggi</p>
          <p className="val"><span className="num big">{numbers.high}</span></p>
          <p className="sub">Skor 70 ke atas</p>
        </div>
        <div className="sp-kpi closing">
          <p className="lbl">Closing bulan ini</p>
          <p className="val">
            <span className="num big">{numbers.closedThisMonth}</span>
            {numbers.closingTarget > 0 && <span className="num" style={{ fontSize: 30, color: "var(--app-muted)" }}>/ {numbers.closingTarget}</span>}
          </p>
          {numbers.closingTarget > 0 ? (
            <button onClick={onSetTarget} aria-label={`${numbers.closedThisMonth} dari target ${numbers.closingTarget} deal. Ubah target`} style={{ display: "block", width: "100%", marginTop: 14, padding: 0, border: 0, background: "none", cursor: "pointer" }}>
              <span style={{ display: "block", height: 4, borderRadius: 999, background: "var(--app-border)", overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 999, background: "#005eb0" }} /></span>
            </button>
          ) : (
            <p className="sub">{numbers.paidThisMonth} · <button onClick={onSetTarget} style={{ padding: 0, border: 0, background: "none", color: "var(--brand-text)", font: "inherit", fontWeight: 600, cursor: "pointer" }}>Atur target</button></p>
          )}
        </div>
        <div className="sp-kpi">
          <p className="lbl">Nilai pipeline</p>
          <p className="val">
            <span className="unit">Rp</span>
            <span className="num big">{jtNum(numbers.pipeline)}</span>
            <span className="unit">jt</span>
          </p>
          <p className="sub">Rp {jtNum(numbers.pipelineHigh)} jt di potensi tinggi</p>
        </div>
      </section>

      <section aria-labelledby="todo-h" className="sp-todo-sec">
        <div className="sp-todo-head">
          <h2 id="todo-h" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Perlu ditindak <span style={{ color: "var(--app-muted)", fontWeight: 500 }}>{todo.length}</span></h2>
          {todo.length > 4 && <button onClick={() => setAll(!all)} className="sp-todo-more">{all ? "Ringkas" : "Lihat semua"}<Icon name={all ? "chevronDown" : "chevronRight"} size={14} stroke={1.8} /></button>}
        </div>
        {todo.length === 0 ? (
          <div className="sp-card" style={{ padding: 16, fontSize: 14, color: "var(--app-muted)" }}>
            Aman. Ga ada follow-up, penawaran, deal macet, atau tagihan yang nunggu. Pasang jadwal follow-up dari detail lead.
          </div>
        ) : (
          <div className="sp-todo">
            {shown.map((t, i) => {
              const first = i === 0;
              const late = t.when < now;
              const whenText = late ? `Telat ${Math.round((Date.parse(now) - Date.parse(t.when)) / 86400000)} hari` : t.when === now ? "Hari ini" : longDate(t.when);
              return (
                <article key={t.key} className={`sp-task${first ? " is-first" : " lift"}`}>
                  <div className="sp-task-meta">
                    <Icon name={t.icon} size={16} />
                    {t.kind}
                    {first
                      ? <span className="sp-task-flag">Paling mendesak</span>
                      : <span className={`sp-task-when tabnum${late ? " is-late" : t.when === now ? " is-today" : ""}`}>{whenText}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{t.title}</h3>
                    <p className="sp-task-what">{t.what}{first ? ` · ${whenText.toLowerCase()}` : ""}</p>
                  </div>
                  <div className="sp-task-acts">
                    {t.wa && t.phone
                      ? <a href={waLink(t.phone, t.text)} target="_blank" rel="noreferrer" className="sp-btn line">{t.action}</a>
                      : <button onClick={t.open} className="sp-btn line">{t.action}</button>}
                    {t.snooze && <button onClick={t.snooze} className="sp-btn ghost">Tunda</button>}
                    {!t.snooze && t.wa && t.phone && <button onClick={t.open} className="sp-btn ghost">Buka</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="sp-b-more">
        <LeadMap leads={mapLeads} onOpen={onOpenLead} onAll={onAllLeads} onAdd={onAdd} onImport={onImport} />
        {children}
      </div>
      </div>
    </div>
  );
}
