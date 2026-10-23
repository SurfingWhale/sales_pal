"use client";

// Log aktivitas (Tim & Report): a heat map of the last 17 weeks and every
// action, newest first, read from what the app already keeps (lib/activity.ts).
// Tap a day to see only that day; the chips narrow it to one kind of work.

import { useMemo, useRef, useState } from "react";
import type { HuntSession, Prospect } from "@/lib/prospects";
import type { Hunt } from "@/lib/hunting";
import type { Invoice, Quote } from "@/lib/billing";
import { today, useSpaceCollection } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { ACT_KINDS, ActKind, activities, addDay, countByDay, heatLevel, kindLabel, streak, weekColumns } from "@/lib/activity";
import type { Outreach, Rejection } from "@/components/TeamLogs";
import { card, chip, font, heading, subheading } from "@/components/ui";

const WEEKS = 17;
const PAGE = 14;   // days of the list shown at a time
const DOW = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const dayName = (day: string, now: string) =>
  day === now ? "Hari ini" : day === addDay(now, -1) ? "Kemarin"
    : new Date(day + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
const shortDay = (day: string) => new Date(day + "T12:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
const clock = (ms: number) => new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

export default function ActivityLog({ hunts, sessions, quotes, invoices, outreach, rejections, onGo, owner, title = "Log aktivitas" }: {
  hunts: Hunt[]; sessions: HuntSession[]; quotes: Quote[]; invoices: Invoice[];
  outreach: Outreach[]; rejections: Rejection[]; onGo: (tab: string) => void;
  owner?: string;   // whose (Dashboard tim opens a seller's); you by default
  title?: string;
}) {
  const space = useSpace();
  // Every journey, closed ones too; in a guild only one person's (a Leader reads the whole team's).
  const allProspects = useSpaceCollection<Prospect>(space, "prospects");
  const who = owner || space.me.uid;
  const mine = <T extends { ownerUid?: string }>(rows: T[]) =>
    space.kind === "guild" ? rows.filter(r => (r.ownerUid || space.me.uid) === who) : rows;

  const acts = useMemo(() => activities({
    prospects: mine(allProspects), hunts: mine(hunts as (Hunt & { ownerUid?: string })[]), sessions: mine(sessions),
    quotes: mine(quotes as (Quote & { ownerUid?: string })[]), invoices: mine(invoices as (Invoice & { ownerUid?: string })[]),
    outreach: mine(outreach as (Outreach & { ownerUid?: string })[]), rejections: mine(rejections as (Rejection & { ownerUid?: string })[]),
  }), [allProspects, hunts, sessions, quotes, invoices, outreach, rejections, who]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = today();
  const [kinds, setKinds] = useState<ActKind[]>([]);   // none picked = all
  const [day, setDay] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = kinds.length ? acts.filter(a => kinds.includes(a.kind)) : acts;
  const counts = useMemo(() => countByDay(shown), [shown]);
  const cols = useMemo(() => weekColumns(now, WEEKS), [now]);
  const from = cols[0][0] || now;
  const inRange = shown.filter(a => a.day >= from);
  const max = Math.max(0, ...cols.flat().map(d => (d ? counts.get(d) || 0 : 0)));
  const allCounts = useMemo(() => countByDay(acts), [acts]);
  const run = streak(allCounts, now);
  const thisWeek = cols[WEEKS - 1].reduce((n, d) => n + (d ? allCounts.get(d) || 0 : 0), 0);
  const lastWeek = cols[WEEKS - 2].reduce((n, d) => n + (d ? allCounts.get(d) || 0 : 0), 0);
  const byDow = DOW.map((_, i) => cols.reduce((n, c) => n + (c[i] ? counts.get(c[i]!) || 0 : 0), 0));
  const busiest = Math.max(...byDow) > 0 ? DOW[byDow.indexOf(Math.max(...byDow))] : "—";

  const listed = day ? shown.filter(a => a.day === day) : shown;
  const days = Array.from(new Set(listed.map(a => a.day)));
  const pageDays = days.slice(0, pages * PAGE);

  function pick(d: string) {
    setDay(day === d ? null : d);
    setPages(1);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  const toggleKind = (k: ActKind) => { setKinds(kinds.includes(k) ? kinds.filter(x => x !== k) : [...kinds, k]); setPages(1); };
  const readout = hover ?? day;

  if (!acts.length) {
    return (
      <div>
        <div style={heading}>{title}</div>
        <div style={{ ...subheading, marginBottom: 16 }}>Semua yang kamu kerjain, per hari.</div>
        <div className="sp-grid-bg" style={{ ...card, padding: "36px 22px", textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-section)", fontWeight: 600, marginBottom: 6 }}>Belum ada aktivitas</div>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginBottom: 18, maxWidth: 420, marginInline: "auto", lineHeight: 1.55 }}>
            Simpan post, kirim DM, bikin penawaran, catat pembayaran: semuanya otomatis kecatat di sini.
          </div>
          <button onClick={() => onGo("Hunting")} style={{ ...chip, minHeight: 44, padding: "10px 16px", fontSize: "var(--fs-body)", fontWeight: 700, color: "var(--brand-text)" }}>Mulai hunting</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={heading}>{title}</div>
      <div style={{ ...subheading, marginBottom: 16 }}>Semua yang kamu kerjain, per hari: DM, balasan, penawaran, pembayaran.</div>

      <section aria-label={`Heat map aktivitas ${WEEKS} minggu`} className="sp-sec" style={{ marginTop: 0, paddingTop: "var(--sp-4)" }}>
        <div role="group" aria-label="Jenis kerjaan" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <button aria-pressed={!kinds.length} onClick={() => { setKinds([]); setPages(1); }}
            style={{ ...chip, minHeight: 36, fontWeight: !kinds.length ? 700 : 500, color: !kinds.length ? "var(--app-text)" : "var(--app-muted)", borderColor: !kinds.length ? "var(--app-line-strong)" : "var(--app-border)" }}>
            Semua <span className="tabnum">{acts.length}</span>
          </button>
          {ACT_KINDS.map(k => {
            const on = kinds.includes(k.id);
            const n = acts.filter(a => a.kind === k.id).length;
            return (
              <button key={k.id} aria-pressed={on} onClick={() => toggleKind(k.id)} disabled={!n}
                style={{ ...chip, minHeight: 36, fontWeight: on ? 700 : 500, color: on ? "var(--app-text)" : "var(--app-muted)", borderColor: on ? "var(--app-line-strong)" : "var(--app-border)", opacity: n ? 1 : 0.5 }}>
                {k.label} <span className="tabnum">{n}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", maxWidth: 520 }}>
          <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: `24px repeat(${WEEKS}, minmax(0, 1fr))`, columnGap: 3, fontSize: "var(--fs-micro)", color: "var(--app-muted)", height: 16 }}>
            <span />
            {cols.map((c, i) => {
              const first = c.find(Boolean)!;
              const month = (j: number) => cols[j]?.[0]?.slice(5, 7);
              // A month is named where it starts; the first column only when the next one doesn't start another.
              const label = (i ? month(i - 1) !== month(i) : month(1) === month(0) && month(2) === month(0))
                ? new Date(first + "T12:00:00").toLocaleDateString("id-ID", { month: "short" }) : "";
              return <span key={i} style={{ whiteSpace: "nowrap", overflow: "visible" }}>{label}</span>;
            })}
          </div>
          <div role="group" aria-label="Aktivitas per hari" style={{ display: "grid", gridTemplateColumns: `24px repeat(${WEEKS}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap: 3 }}>
            {DOW.map((d, i) => (
              <span key={d} aria-hidden="true" style={{ fontSize: "var(--fs-micro)", color: "var(--app-muted)", alignSelf: "center", visibility: i % 2 === 0 ? "visible" : "hidden" }}>{d}</span>
            ))}
            {cols.flat().map((d, i) => {
              if (!d) return <span key={`x${i}`} />;
              const n = counts.get(d) || 0;
              const lv = heatLevel(n, max);
              const sel = day === d;
              const label = `${shortDay(d)}: ${n ? `${n} aktivitas` : "kosong"}`;
              return (
                <button key={d} onClick={() => pick(d)} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(d)} onBlur={() => setHover(null)} aria-label={label} aria-pressed={sel} title={label}
                  className="sp-heat"
                  style={{ aspectRatio: "1", width: "100%", padding: 0, border: 0, borderRadius: 3, cursor: "pointer",
                    background: lv ? `var(--heat-${lv})` : "var(--app-inner)",
                    outline: sel ? "2px solid var(--app-text)" : d === now ? "1px solid var(--app-line-strong)" : "none", outlineOffset: sel ? 1 : 0 }} />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: "var(--fs-meta)", color: "var(--app-muted)", flexWrap: "wrap" }}>
            <span role="status" aria-live="polite" style={{ minHeight: 18 }}>
              {readout ? <><b style={{ color: "var(--app-text)" }}>{shortDay(readout)}</b>: {counts.get(readout) || 0} aktivitas</> : "Tap kotak buat liat harinya."}
            </span>
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              Sedikit
              {[0, 1, 2, 3, 4].map(l => <span key={l} style={{ width: 11, height: 11, borderRadius: 3, background: l ? `var(--heat-${l})` : "var(--app-inner)" }} />)}
              Banyak
            </span>
          </div>
        </div>
        <dl aria-label="Ringkasan" className="sp-strip two" style={{ flex: "1 1 240px", margin: 0 }}>
          {([
            [String(inRange.length), `aktivitas, ${WEEKS} minggu`],
            [String(run), "hari berturut-turut"],
            [String(thisWeek), `minggu ini (lalu ${lastWeek})`],
            [busiest, "hari paling rame"],
          ] as [string, string][]).map(([v, k]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column-reverse", justifyContent: "flex-end" }}>
              <dt style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginTop: "var(--sp-1)" }}>{k}</dt>
              <dd className={/^\d+$/.test(v) ? "num" : "tabnum"} style={{ margin: 0, fontSize: /^\d+$/.test(v) ? "var(--fs-num)" : "var(--fs-section)", fontWeight: 600, fontFamily: /^\d+$/.test(v) ? undefined : font, lineHeight: 1.15 }}>{v}</dd>
            </div>
          ))}
        </dl>
        </div>
      </section>

      <div ref={listRef} style={{ scrollMarginTop: 120 }}>
        {day && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>Cuma hari</span>
            <button onClick={() => setDay(null)} aria-label={`Hapus filter ${shortDay(day)}`} style={{ ...chip, minHeight: 36, fontWeight: 700, color: "var(--app-text)" }}>{shortDay(day)} ×</button>
          </div>
        )}
        {!pageDays.length && <div style={{ padding: "var(--sp-4) 0", fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>Ga ada aktivitas{day ? " di hari ini" : ""}{kinds.length ? " buat jenis yang dipilih" : ""}.</div>}
        {pageDays.map(d => {
          const rows = listed.filter(a => a.day === d);
          return (
            <section key={d} aria-label={dayName(d, now)} style={{ marginBottom: "var(--sp-5)" }}>
              <h3 style={{ display: "flex", justifyContent: "space-between", margin: 0, paddingBottom: "var(--sp-2)", borderBottom: "1px solid var(--app-line-strong)", fontSize: "var(--fs-meta)", fontWeight: 700, color: "var(--app-text)" }}>
                <span>{dayName(d, now)}</span><span className="tabnum" style={{ color: "var(--app-muted)", fontWeight: 500 }}>{rows.length}</span>
              </h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {rows.map((a, i) => (
                  <li key={a.id} style={{ borderTop: i ? "1px solid var(--app-border)" : 0 }}>
                    <button onClick={() => onGo(a.tab)} aria-label={`${a.title}. Buka ${a.tab}`}
                      style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 10, alignItems: "baseline", width: "100%", padding: "var(--sp-3) 0", minHeight: 44, border: 0, background: "none", textAlign: "left", cursor: "pointer", color: "var(--app-text)", fontFamily: "inherit" }}>
                      <span className="tabnum" style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>{a.timed ? clock(a.at) : "·"}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "var(--fs-body)", fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere" }}>{a.title}</span>
                        {a.detail && <span style={{ display: "block", fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>}
                      </span>
                      <span style={{ fontSize: "var(--fs-micro)", color: "var(--app-muted)", whiteSpace: "nowrap" }}>{kindLabel(a.kind)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {days.length > pageDays.length && (
          <button onClick={() => setPages(pages + 1)} style={{ ...chip, minHeight: 44, width: "100%", fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--brand-text)" }}>
            Lihat lebih lama ({days.length - pageDays.length} hari lagi)
          </button>
        )}
      </div>
    </div>
  );
}
