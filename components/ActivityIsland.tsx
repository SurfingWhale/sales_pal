"use client";

import { useMemo, useState } from "react";
import type { HuntSession, Prospect } from "@/lib/prospects";
import type { Hunt } from "@/lib/hunting";
import type { Invoice, Quote } from "@/lib/billing";
import { today } from "@/lib/billing";
import { Space, useSpace } from "@/lib/space";
import { OUTREACH_TYPES, activities, countByDay, heatLevel, streak, weekColumns, weekOf } from "@/lib/activity";
import type { Outreach, Rejection } from "@/components/TeamLogs";
import Icon from "@/components/Icon";
import OccupancyCalendar from "@/components/OccupancyCalendar";

// The top of Hunting (QA-4): the week, with what went out and what's planned
// each day; three numbers for today; and the heat map, which shows whether you
// really reached out, so it counts work done, not what was scheduled. On a
// phone the heat map and the jobs open under the chevron, so the list stays near.

const WEEKS = 17;
const DOW = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const LOOK = 12;   // rows shown for a day

function heatFill(lv: number) { return lv ? `var(--heat-${lv})` : "var(--app-inner)"; }
function shortDate(day: string) { return new Date(day + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" }); }
function longDay(day: string) { return new Date(day + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" }); }

// In a guild the island is your own day, even for a Leader who reads everyone's rows.
export function ownRows<T>(rows: T[], space: Space): T[] {
  if (space.kind !== "guild") return rows;
  return rows.filter(r => ((r as { ownerUid?: string }).ownerUid || space.me.uid) === space.me.uid);
}

export default function ActivityIsland({ sent, goal, replies, rate, due, canEdit, onGoal, onReplies, onDue, onLog, schedule, prospects, hunts, sessions, quotes, invoices, outreach, rejections }: {
  sent: number; goal: number; replies: number; rate: string; due: number; canEdit: boolean;
  onGoal: () => void; onReplies: () => void; onDue: () => void; onLog?: () => void;
  schedule: { day: string; title: string }[];
  prospects: Prospect[]; hunts: Hunt[]; sessions: HuntSession[]; quotes: Quote[]; invoices: Invoice[];
  outreach: Outreach[]; rejections: Rejection[];
}) {
  const space = useSpace();
  const now = today();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<string | null>(null);
  const acts = useMemo(() => activities({
    prospects: ownRows(prospects, space), hunts: ownRows(hunts, space), sessions: ownRows(sessions, space),
    quotes: ownRows(quotes, space), invoices: ownRows(invoices, space),
    outreach: ownRows(outreach, space), rejections: ownRows(rejections, space),
  }), [prospects, hunts, sessions, quotes, invoices, outreach, rejections, space]);
  const counts = useMemo(() => countByDay(acts.filter(a => OUTREACH_TYPES.includes(a.type))), [acts]);
  const cols = useMemo(() => weekColumns(now, WEEKS), [now]);
  const cells = cols.flat();
  const max = Math.max(0, ...cells.map(d => (d ? counts.get(d) || 0 : 0)));
  const total = cells.reduce((n, d) => n + (d ? counts.get(d) || 0 : 0), 0);
  const week = weekOf(now, offset);
  const done = day ? acts.filter(a => a.day === day) : [];
  const planned = day ? schedule.filter(s => s.day === day) : [];

  const h3: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-muted)" };
  const step: React.CSSProperties = { width: 44, height: 44, border: 0, background: "transparent", color: "var(--app-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const cell: React.CSSProperties = { minWidth: 0, minHeight: 76, padding: "10px 4px 10px 14px", border: 0, background: "transparent", color: "inherit", textAlign: "left", fontFamily: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 };
  const word: React.CSSProperties = { fontSize: "var(--fs-meta)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  const num: React.CSSProperties = { fontSize: "var(--fs-section)", fontWeight: 700, lineHeight: 1.2 };
  const hint: React.CSSProperties = { fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <section aria-label="Hari ini" className={`sp-island${open ? " open" : ""}`}>
      <div className="sp-island-top">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button type="button" className="sp-island-more" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Heat map dan jadwal job" style={step}><Icon name={open ? "chevronDown" : "chevronRight"} size={18} stroke={2} /></button>
            <h3 style={{ ...h3, flex: 1, minWidth: 0 }}>Kalender aktivitas</h3>
            <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Minggu sebelumnya" style={step}><Icon name="chevronLeft" size={16} stroke={2} /></button>
            <span className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)", whiteSpace: "nowrap" }}>{shortDate(week[0])} – {shortDate(week[6])}</span>
            <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Minggu berikutnya" style={step}><Icon name="chevronRight" size={16} stroke={2} /></button>
          </div>
          <div role="group" aria-label="Kalender minggu ini" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, padding: "0 8px 10px" }}>
            {week.map((d, i) => {
              const n = counts.get(d) || 0;
              const s = schedule.filter(x => x.day === d).length;
              const on = day === d;
              return (
                <button key={d} type="button" onClick={() => setDay(on ? null : d)} aria-pressed={on} aria-current={d === now ? "date" : undefined}
                  aria-label={`${DOW[i]} ${shortDate(d)}: ${n} outreach${s ? `, ${s} dijadwalkan` : ""}`}
                  style={{ minWidth: 0, minHeight: 64, padding: "6px 0", borderRadius: 12, border: `1px solid ${on ? "#005eb0" : "transparent"}`, background: d === now ? "var(--brand-tint)" : "transparent", color: "var(--app-text)", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 11, color: "var(--app-muted)" }}>{DOW[i]}</span>
                  <span className="tabnum" style={{ fontSize: 15, fontWeight: d === now ? 700 : 600 }}>{Number(d.slice(8))}</span>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: n ? `var(--heat-${heatLevel(n, max) || 1})` : s ? "transparent" : "var(--app-inner)", boxShadow: !n && s ? "inset 0 0 0 1.5px var(--brand-text)" : "none" }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="sp-island-heat">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <h3 style={h3}>Heatmap outreach</h3>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--app-muted)" }}>
              Kosong{[0, 1, 2, 3, 4].map(l => <span key={l} style={{ width: 10, height: 10, borderRadius: 3, background: heatFill(l) }} />)}Tinggi
            </span>
          </div>
          <div role="img" aria-label={`${total} outreach dan penawaran dalam ${WEEKS} minggu, ${streak(counts, now)} hari berturut-turut`}
            style={{ display: "grid", gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap: 3 }}>
            {cells.map((d, i) => <span key={d || `x${i}`} style={{ aspectRatio: "1", borderRadius: 3, background: d ? heatFill(heatLevel(counts.get(d) || 0, max)) : "transparent" }} />)}
          </div>
        </div>
      </div>

      {day && (
        <div role="region" aria-label={`Aktivitas ${longDay(day)}`} style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--app-border)", display: "grid", gap: 8 }}>
          <h3 style={h3}>{longDay(day)}</h3>
          {!done.length && !planned.length && <p style={{ margin: 0, fontSize: 13, color: "var(--app-muted)" }}>Ga ada yang tercatat atau dijadwalkan.</p>}
          {planned.length > 0 && <ul aria-label="Dijadwalkan" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13, lineHeight: 1.6 }}>{planned.slice(0, LOOK).map((p, i) => <li key={i}><b style={{ fontWeight: 600 }}>Dijadwalkan:</b> {p.title}</li>)}</ul>}
          {done.length > 0 && <ul aria-label="Tercatat" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 13, lineHeight: 1.6 }}>{done.slice(0, LOOK).map(a => <li key={a.id}>{a.title}</li>)}</ul>}
          {done.length + planned.length > LOOK * 2 && <p style={{ margin: 0, fontSize: 12, color: "var(--app-muted)" }}>Sisanya ada di Log aktivitas.</p>}
          {onLog && <button type="button" onClick={onLog} style={{ justifySelf: "start", minHeight: 44, padding: 0, border: 0, background: "none", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Buka Log aktivitas</button>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: "1px solid var(--app-border)" }}>
        <button type="button" onClick={onGoal} disabled={!canEdit} aria-label={`Hari ini ${sent} dari ${goal} pesan. ${canEdit ? "Ubah target harian" : "Target harian diatur Leader atau Officer"}`} style={{ ...cell, cursor: canEdit ? "pointer" : "default" }}>
          <span style={word}>Outreach</span>
          <span className="tabnum" style={{ ...num, color: sent >= goal ? "var(--ok)" : "var(--brand-text)" }}>{sent}</span>
          <span className="tabnum" style={hint}>Target {goal}</span>
        </button>
        <button type="button" onClick={onReplies} aria-label={`${replies} perlu dibales`} style={cell}>
          <span style={word}>Perlu dibales</span>
          <span className="tabnum" style={{ ...num, color: replies ? "var(--ok)" : "var(--app-text)" }}>{replies}</span>
          <span className="tabnum" style={hint}>Dibales 7 hr {rate}</span>
        </button>
        <button type="button" onClick={onDue} aria-label={`${due} follow-up jatuh tempo`} style={cell}>
          <span style={word}>Follow-up</span>
          <span className="tabnum" style={num}>{due}</span>
          <span style={hint}>Jatuh tempo</span>
        </button>
      </div>

      {open && <div style={{ padding: "12px 14px 2px", borderTop: "1px solid var(--app-border)" }}><OccupancyCalendar quotes={quotes} invoices={invoices} /></div>}
    </section>
  );
}
