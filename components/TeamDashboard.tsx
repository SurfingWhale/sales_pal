"use client";

// Dashboard tim (PRD-014 §2): for a leader, what each seller did in a period
// and what came of it, against the period before; for anyone else, their own.
// Counted from the same activities as Log aktivitas, so nothing new is stored.

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HuntSession, Prospect } from "@/lib/prospects";
import type { Hunt } from "@/lib/hunting";
import type { Invoice, Quote } from "@/lib/billing";
import { rupiah, today as todayStr, useSpaceCollection } from "@/lib/billing";
import { useSpace } from "@/lib/space";
import { isManager, isSeller, type Member, type Role } from "@/lib/guild";
import { activities } from "@/lib/activity";
import { PERIODS, PeriodId, Range, change, dashboardDoc, daysSince, ownerOf, pct, perDay, rangeOf, rateChange, rateOf, stats } from "@/lib/dashboard";
import { reportName } from "@/lib/reportPdf";
import ReportShell from "@/components/ReportShell";
import ReportPaper from "@/components/ReportPaper";
import type { Outreach, Rejection } from "@/components/TeamLogs";
import ActivityLog from "@/components/ActivityLog";
import { Avatar } from "@/components/GuildHub";
import { card, chip, heading, ink, subheading } from "@/components/ui";

const GOOD = "#00a862", BAD = "#dc2626", WARN = "#b45309";
const dayLabel = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const longDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
const rangeLabel = (r: Range) => r.from === r.to ? dayLabel(r.from) : `${dayLabel(r.from)} – ${dayLabel(r.to)}`;
const ago = (ms: number) => {
  const d = daysSince(ms);
  return d === Infinity ? "belum ada" : d === 0 ? "hari ini" : d === 1 ? "kemarin" : `${d} hari lalu`;
};

interface Person { uid: string; name: string; role: Role; avatar?: string }

export default function TeamDashboard({ hunts, quotes, invoices, outreach, rejections, onGo }: {
  hunts: Hunt[]; quotes: Quote[]; invoices: Invoice[]; outreach: Outreach[]; rejections: Rejection[];
  onGo: (tab: string) => void;
}) {
  const space = useSpace();
  const me = space.me.uid;
  const prospects = useSpaceCollection<Prospect>(space, "prospects");
  const sessions = useSpaceCollection<HuntSession>(space, "huntSessions");
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    if (space.kind !== "guild") { setMembers([]); return; }
    return onSnapshot(collection(db, "guilds", space.id, "members"),
      s => setMembers(s.docs.map(d => ({ ...(d.data() as Member), uid: d.id }))), () => setMembers([]));
  }, [space.kind, space.id]);

  const manager = space.kind === "guild" && isManager(space.role);
  const acts = useMemo(() => activities({ prospects, hunts, sessions, quotes, invoices, outreach, rejections }),
    [prospects, hunts, sessions, quotes, invoices, outreach, rejections]);

  // Who shows: every seller for a Leader/Officer (and anyone who left but owns
  // records), otherwise just you.
  const people: Person[] = useMemo(() => {
    const list: Person[] = manager ? members.filter(m => isSeller(m.role)).map(m => ({ uid: m.uid, name: m.name, role: m.role, avatar: m.avatar })) : [];
    if (!list.some(p => p.uid === me)) list.unshift({ uid: me, name: space.me.name, role: space.role || "leader" });
    if (manager) for (const a of acts) {
      const o = ownerOf(a, me);
      if (!list.some(p => p.uid === o)) list.push({ uid: o, name: "Mantan anggota", role: "member" });
    }
    return list;
  }, [manager, members, acts, me, space.me.name, space.role]);

  const [period, setPeriod] = useState<PeriodId>("month");
  const [who, setWho] = useState<string | null>(null);
  const [paper, setPaper] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const now = todayStr();
  const { cur, prev } = rangeOf(period, now);
  const byOwner = (uid: string) => acts.filter(a => ownerOf(a, me) === uid);
  const scoped = who ? byOwner(who) : manager ? acts : byOwner(me);
  const s = stats(scoped, cur);
  const p = stats(scoped, prev);
  const trend = perDay(scoped, cur);
  const person = who ? people.find(x => x.uid === who) : null;
  const rows = people.map(x => ({ x, s: stats(byOwner(x.uid), cur) }))
    .sort((a, b) => b.s.paid - a.s.paid || b.s.won - a.s.won || b.s.activities - a.s.activities);
  const quiet = manager ? rows.filter(r => daysSince(r.s.lastAt) >= 3) : [];

  function open(uid: string) {
    setWho(who === uid ? null : uid);
    requestAnimationFrame(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const title = manager ? "Dashboard tim" : "Dashboard kamu";
  if (!acts.length) {
    return (
      <div>
        <div style={heading}>{title}</div>
        <div style={{ ...subheading, marginBottom: 16 }}>Siapa ngerjain apa, dan jadinya apa.</div>
        <div className="sp-grid-bg" style={{ ...card, padding: "36px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada yang bisa dihitung</div>
          <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 18, maxWidth: 440, marginInline: "auto", lineHeight: 1.55 }}>
            Begitu ada DM, balasan, penawaran, atau pembayaran, angkanya muncul di sini, per orang dan per hari.
          </div>
          <button onClick={() => onGo("Hunting")} style={{ ...chip, minHeight: 44, padding: "10px 16px", fontSize: 14, fontWeight: 700, color: "var(--brand-text)" }}>Mulai hunting</button>
        </div>
      </div>
    );
  }

  // The one number that matters most this period (docs/standards/design.md §1):
  // money in, else closings, else how much work was done.
  const all: { key: string; label: string; value: string; ch: ReturnType<typeof change>; sub?: string }[] = [
    { key: "paid", label: "Uang masuk", value: rupiah(s.paid), ch: change(s.paid, p.paid, "money") },
    { key: "won", label: "Closing", value: String(s.won), ch: change(s.won, p.won), sub: "penawaran diterima" },
    { key: "activities", label: "Aktivitas", value: String(s.activities), ch: change(s.activities, p.activities) },
    { key: "prospects", label: "Prospek baru", value: String(s.prospects), ch: change(s.prospects, p.prospects) },
    { key: "dms", label: "DM terkirim", value: String(s.dms), ch: change(s.dms, p.dms) },
    { key: "replies", label: "Dibales", value: pct(rateOf(s.replies, s.dms)), ch: rateChange(rateOf(s.replies, s.dms), rateOf(p.replies, p.dms)), sub: `${s.replies} balasan` },
    { key: "etb", label: "Jadi ETB", value: String(s.etb), ch: change(s.etb, p.etb), sub: `${pct(rateOf(s.etb, s.dms))} dari DM` },
    { key: "quotes", label: "Penawaran dikirim", value: String(s.quotesSent), ch: change(s.quotesSent, p.quotesSent) },
  ];
  const heroKey = s.paid > 0 ? "paid" : s.won > 0 ? "won" : "activities";
  const hero = all.find(x => x.key === heroKey)!;
  const strip = all.filter(x => x.key !== heroKey);
  const tone = (ch: ReturnType<typeof change>) => (ch.dir > 0 ? ink(GOOD) : ch.dir < 0 ? ink(BAD) : "var(--app-muted)");
  const arrow = (ch: ReturnType<typeof change>) => (ch.dir > 0 ? "▲ " : ch.dir < 0 ? "▼ " : "");
  const funnel: [string, number][] = [["Prospek baru", s.prospects], ["DM terkirim", s.dms], ["Dibales", s.replies], ["Jadi ETB", s.etb], ["Penawaran dikirim", s.quotesSent], ["Closing", s.won]];
  const fMax = Math.max(1, ...funnel.map(f => f[1]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <div style={heading}>{person ? `Dashboard ${person.name}` : title}</div>
          <div style={subheading}>{rangeLabel(cur)} · dibanding {rangeLabel(prev)}</div>
        </div>
        {manager && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--app-muted)" }}>
            Lihat
            <select value={who || ""} onChange={e => setWho(e.target.value || null)} aria-label="Lihat dashboard siapa"
              style={{ minHeight: 40, fontSize: 16, padding: "6px 10px", borderRadius: 10, border: "1px solid var(--app-border)", background: "var(--app-card)", color: "var(--app-text)", fontFamily: "inherit" }}>
              <option value="">Semua tim</option>
              {people.map(x => <option key={x.uid} value={x.uid}>{x.name}{x.uid === me ? " (kamu)" : ""}</option>)}
            </select>
          </label>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
      <div role="radiogroup" aria-label="Periode" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PERIODS.map(x => (
          <button key={x.id} role="radio" aria-checked={period === x.id} onClick={() => setPeriod(x.id)}
            style={{ ...chip, minHeight: 36, fontSize: 13, fontWeight: period === x.id ? 700 : 500, color: period === x.id ? "var(--app-text)" : "var(--app-muted)", borderColor: period === x.id ? "var(--app-line-strong)" : "var(--app-border)" }}>
            {x.label}
          </button>
        ))}
      </div>
        <button onClick={() => setPaper(true)} style={{ ...chip, minHeight: 36, fontSize: 13, fontWeight: 700, color: "var(--brand-text)", marginLeft: "auto" }}>PDF laporan</button>
      </div>

      <section aria-label="Angka utama">
        <p style={{ margin: "var(--sp-5) 0 var(--sp-5)", display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "var(--sp-3)", rowGap: "var(--sp-1)" }}>
          <span className="num" style={{ fontSize: "var(--fs-num-hero)", color: "var(--app-text)" }}>{hero.value}</span>
          <span style={{ fontSize: "var(--fs-section)", fontWeight: 600 }}>{hero.label.toLowerCase()}</span>
          <span style={{ flexBasis: "100%", fontSize: "var(--fs-body)", color: tone(hero.ch) }}>
            <span aria-hidden="true">{arrow(hero.ch)}</span>{hero.ch.text}<span style={{ color: "var(--app-muted)" }}> dibanding {rangeLabel(prev)}</span>
          </span>
        </p>
        <div className="sp-strip">
          {strip.map(x => (
            <div key={x.key}>
              <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>{x.label}</div>
              <div className="num" style={{ fontSize: "var(--fs-num)", marginTop: "var(--sp-2)", overflowWrap: "anywhere" }}>{x.value}</div>
              <div style={{ fontSize: "var(--fs-meta)", marginTop: "var(--sp-2)", color: tone(x.ch) }}>
                <span aria-hidden="true">{arrow(x.ch)}</span>{x.ch.text}{x.sub && <span style={{ color: "var(--app-muted)" }}> · {x.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", columnGap: "var(--sp-6)" }}>
        <section aria-labelledby="dash-trend" className="sp-sec">
          <h3 id="dash-trend" style={{ marginBottom: "var(--sp-3)" }}>Aktivitas per hari</h3>
          <TrendChart data={trend} />
        </section>
        <section aria-labelledby="dash-funnel" className="sp-sec">
          <h3 id="dash-funnel">Funnel periode ini</h3>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginBottom: "var(--sp-3)" }}>Kejadian di periode ini; persen dari tahap sebelumnya.</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {funnel.map(([label, n], i) => (
              <li key={label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 84px", alignItems: "center", gap: "var(--sp-3)", fontSize: "var(--fs-body)", padding: "var(--sp-2) 0", borderTop: i ? "1px solid var(--app-border)" : 0 }}>
                <span>{label}</span>
                <span style={{ height: 8, borderRadius: 4, background: "var(--app-inner)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(n / fMax) * 100}%`, minWidth: n ? 4 : 0, borderRadius: 4, background: "var(--heat-3)" }} />
                </span>
                <span className="tabnum" style={{ textAlign: "right" }}>
                  <b>{n}</b>{i > 0 && <span style={{ color: "var(--app-muted)", fontSize: "var(--fs-meta)" }}> · {pct(rateOf(n, funnel[i - 1][1]))}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {manager && (
        <section aria-labelledby="dash-people" className="sp-sec">
          <h3 id="dash-people">Per sales</h3>
          <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginBottom: "var(--sp-3)" }}>Tap satu orang buat liat dashboard, heat map, dan log-nya.</div>
          <div className="sp-dash-row sp-dash-head" aria-hidden="true" style={{ fontSize: "var(--fs-micro)", color: "var(--app-muted)", padding: "0 var(--sp-2) var(--sp-2)", borderBottom: "1px solid var(--app-line-strong)" }}>
            <span>Sales</span><span>Aktivitas</span><span>DM</span><span>Dibales</span><span>ETB</span><span>Penawaran</span><span>Closing</span><span>Uang masuk</span><span>Terakhir aktif</span>
          </div>
          <div>
            {rows.map(({ x, s: r }) => {
              const sel = who === x.uid;
              const late = daysSince(r.lastAt) >= 3;
              return (
                <button key={x.uid} onClick={() => open(x.uid)} aria-pressed={sel}
                  aria-label={`${x.name}: ${r.activities} aktivitas, ${r.dms} DM, ${r.won} closing, ${rupiah(r.paid)}, terakhir aktif ${ago(r.lastAt)}`}
                  className="sp-dash-row" style={{ width: "100%", textAlign: "left", padding: "var(--sp-3) var(--sp-2)", border: 0, borderBottom: "1px solid var(--app-border)", borderRadius: 0, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
                    background: sel ? "var(--brand-tint)" : "transparent", boxShadow: sel ? "inset 3px 0 0 var(--brand-text)" : "none" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
                    <Avatar role={x.role} pick={x.avatar} size={30} />
                    <span style={{ fontWeight: 600, fontSize: "var(--fs-body)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}{x.uid === me ? " (kamu)" : ""}</span>
                  </span>
                  <Cell l="Aktivitas" v={r.activities} />
                  <Cell l="DM" v={r.dms} />
                  <Cell l="Dibales" v={pct(rateOf(r.replies, r.dms))} />
                  <Cell l="ETB" v={r.etb} />
                  <Cell l="Penawaran" v={r.quotesSent} />
                  <Cell l="Closing" v={r.won} />
                  <Cell l="Uang masuk" v={rupiah(r.paid)} />
                  <span data-l="Terakhir aktif" style={{ fontSize: "var(--fs-meta)", color: late ? ink(WARN) : "var(--app-muted)", fontWeight: late ? 600 : 400 }}>{ago(r.lastAt)}</span>
                </button>
              );
            })}
          </div>
          {quiet.length > 0 && (
            <p role="note" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-meta)" }}>
              <b style={{ color: ink(WARN) }}>Perlu dicek:</b> {quiet.map(r => `${r.x.name} (${ago(r.s.lastAt)})`).join(", ")}, ga ada aktivitas 3 hari atau lebih.
            </p>
          )}
        </section>
      )}

      <div className="sp-sec" style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", flexWrap: "wrap", fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginBottom: "var(--sp-5)" }}>
        {space.kind === "guild" ? (
          <button onClick={() => onGo("Guild")} style={{ ...chip, minHeight: 44, fontSize: "var(--fs-meta)", color: "var(--brand-text)", fontWeight: 600 }}>Target &amp; pipeline guild ada di Report Tim →</button>
        ) : (
          <>
            <span style={{ flex: "1 1 220px" }}>Jualan bareng tim? Bikin guild, semua anggota kelihatan di sini per orang.</span>
            <button onClick={() => onGo("Guild")} style={{ ...chip, minHeight: 40, fontWeight: 700, color: "var(--brand-text)" }}>Ke Guild</button>
          </>
        )}
      </div>

      {paper && (() => {
        const periodLabel = PERIODS.find(x => x.id === period)!.label;
        const name = person ? person.name : manager ? space.name : space.me.name;
        const doc = dashboardDoc({
          title: name, team: manager && !who, period: periodLabel, cur, prev, s, p, trend,
          rows: rows.map(r => ({ name: r.x.name, s: r.s })), quiet: quiet.map(r => ({ name: r.x.name, lastAt: r.s.lastAt })),
        });
        const stamp = period === "month" || period === "lastMonth" ? cur.from.slice(0, 7) : `${cur.from}_${cur.to}`;
        return (
          <ReportShell title={`Laporan ${name} · ${periodLabel}`} fileName={reportName(`Dashboard ${name}`, stamp)} doc={doc} onClose={() => setPaper(false)}>
            <ReportPaper doc={doc} />
          </ReportShell>
        );
      })()}

      <div ref={logRef} style={{ scrollMarginTop: 120 }}>
        {(who || !manager) && (
          <ActivityLog key={who || me} owner={who || me} title={person && who !== me ? `Log aktivitas ${person.name}` : "Log aktivitas kamu"}
            hunts={hunts} sessions={sessions} quotes={quotes} invoices={invoices} outreach={outreach} rejections={rejections} onGo={onGo} />
        )}
      </div>
    </div>
  );
}

function Cell({ l, v }: { l: string; v: string | number }) {
  return <span data-l={l} className="tabnum" style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>;
}

// Activities a day: one line, a recessive grid, a crosshair and tooltip on
// hover or arrow keys.
function TrendChart({ data }: { data: { day: string; n: number }[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hi, setHi] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 170, L = 30, R = 10, T = 10, B = 22;
  const raw = Math.max(1, ...data.map(d => d.n));
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500].find(s => s * 2 >= raw) || Math.ceil(raw / 2);
  const top = step * 2;
  const x = (i: number) => L + (data.length > 1 ? (i * (w - L - R)) / (data.length - 1) : (w - L - R) / 2);
  const y = (n: number) => T + (H - T - B) * (1 - n / top);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.n).toFixed(1)}`).join("");
  const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const total = data.reduce((a, d) => a + d.n, 0);
  const peak = data.reduce((m, d, i) => (d.n > data[m].n ? i : m), 0);
  const ticks = [0, Math.floor(data.length / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !data.length) return;
    const i = Math.round(((clientX - r.left - L) / Math.max(1, w - L - R)) * (data.length - 1));
    setHi(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hi !== null ? data[hi] : null;
  return (
    <div ref={box} style={{ position: "relative" }}>
      <svg width={w} height={H} role="img" tabIndex={0}
        aria-label={`Aktivitas per hari: total ${total}, paling rame ${longDay(data[peak].day)} (${data[peak].n}). Panah kiri/kanan buat liat per hari.`}
        onPointerMove={e => pick(e.clientX)} onPointerDown={e => pick(e.clientX)} onPointerLeave={() => setHi(null)}
        onFocus={() => setHi(data.length - 1)} onBlur={() => setHi(null)}
        onKeyDown={e => { if (e.key === "ArrowLeft") setHi(Math.max(0, (hi ?? data.length) - 1)); if (e.key === "ArrowRight") setHi(Math.min(data.length - 1, (hi ?? -1) + 1)); }}
        style={{ display: "block", touchAction: "pan-y", outlineOffset: 2 }}>
        {[0, step, top].map(v => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--app-border)" strokeWidth={1} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--app-muted)">{v}</text>
          </g>
        ))}
        {ticks.map(i => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--app-muted)">{dayLabel(data[i].day)}</text>
        ))}
        <path d={area} fill="color-mix(in srgb, var(--heat-3) 14%, transparent)" />
        <path d={line} fill="none" stroke="var(--heat-3)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hi !== null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={T} y2={y(0)} stroke="var(--app-line-strong)" strokeWidth={1} />
            <circle cx={x(hi)} cy={y(data[hi].n)} r={5} fill="var(--heat-3)" stroke="var(--app-card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <div role="status" style={{ position: "absolute", top: 0, left: Math.min(Math.max(0, x(hi!) - 70), w - 140), width: 140, pointerEvents: "none",
          background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 8, padding: "6px 8px", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}>
          <div style={{ color: "var(--app-muted)" }}>{longDay(h.day)}</div>
          <div><b className="tabnum">{h.n}</b> aktivitas</div>
        </div>
      )}
    </div>
  );
}
