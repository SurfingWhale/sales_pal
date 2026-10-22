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
import { PERIODS, PeriodId, Range, Stats, change, daysSince, ownerOf, pct, perDay, rangeOf, rateOf, stats } from "@/lib/dashboard";
import type { Outreach, Rejection } from "@/components/TeamLogs";
import ActivityLog from "@/components/ActivityLog";
import { Avatar } from "@/components/GuildHub";
import { card, chip, font, heading, ink, subheading } from "@/components/ui";

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
        <div style={{ ...card, padding: "36px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Belum ada yang bisa dihitung</div>
          <div style={{ fontSize: 13, color: "var(--app-muted)", marginBottom: 18, maxWidth: 440, marginInline: "auto", lineHeight: 1.55 }}>
            Begitu ada DM, balasan, penawaran, atau pembayaran, angkanya muncul di sini, per orang dan per hari.
          </div>
          <button onClick={() => onGo("Hunting")} style={{ ...chip, minHeight: 44, padding: "10px 16px", fontSize: 14, fontWeight: 700, color: "var(--brand-text)" }}>Mulai hunting</button>
        </div>
      </div>
    );
  }

  const tiles: [string, string, ReturnType<typeof change>, string?][] = [
    ["Aktivitas", String(s.activities), change(s.activities, p.activities)],
    ["Prospek baru", String(s.prospects), change(s.prospects, p.prospects)],
    ["DM terkirim", String(s.dms), change(s.dms, p.dms)],
    ["Dibales", pct(rateOf(s.replies, s.dms)), rateChange(rateOf(s.replies, s.dms), rateOf(p.replies, p.dms)), `${s.replies} balasan`],
    ["Jadi ETB", String(s.etb), change(s.etb, p.etb), `${pct(rateOf(s.etb, s.dms))} dari DM`],
    ["Penawaran dikirim", String(s.quotesSent), change(s.quotesSent, p.quotesSent)],
    ["Closing", String(s.won), change(s.won, p.won), "penawaran diterima"],
    ["Uang masuk", rupiah(s.paid), change(s.paid, p.paid, "money")],
  ];
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

      <div role="radiogroup" aria-label="Periode" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {PERIODS.map(x => (
          <button key={x.id} role="radio" aria-checked={period === x.id} onClick={() => setPeriod(x.id)}
            style={{ ...chip, minHeight: 36, fontSize: 13, fontWeight: period === x.id ? 700 : 500, color: period === x.id ? "var(--app-text)" : "var(--app-muted)", borderColor: period === x.id ? "var(--app-line-strong)" : "var(--app-border)" }}>
            {x.label}
          </button>
        ))}
      </div>

      <section aria-label="Angka utama" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(150px, calc((100% - 30px) / 4)), 1fr))", gap: 10, marginBottom: 12 }}>
        {tiles.map(([label, value, ch, sub]) => (
          <div key={label} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--app-muted)" }}>{label}</div>
            <div className="tabnum" style={{ fontSize: value.length > 9 ? 19 : 24, fontWeight: 700, fontFamily: font, lineHeight: 1.25, marginTop: 2, overflowWrap: "anywhere" }}>{value}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: ch.dir > 0 ? ink(GOOD) : ch.dir < 0 ? ink(BAD) : "var(--app-muted)" }}>
              <span aria-hidden="true">{ch.dir > 0 ? "▲ " : ch.dir < 0 ? "▼ " : ""}</span>{ch.text}
              <span style={{ color: "var(--app-muted)" }}> vs sebelumnya</span>
            </div>
            {sub && <div style={{ fontSize: 11, color: "var(--app-muted)", marginTop: 2 }}>{sub}</div>}
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginBottom: 12 }}>
        <section aria-labelledby="dash-trend" style={{ ...card, padding: 16 }}>
          <h3 id="dash-trend" style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Aktivitas per hari</h3>
          <TrendChart data={trend} />
        </section>
        <section aria-labelledby="dash-funnel" style={{ ...card, padding: 16 }}>
          <h3 id="dash-funnel" style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>Funnel periode ini</h3>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10 }}>Dihitung dari kejadian di periode ini, persen = dari tahap sebelumnya.</div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {funnel.map(([label, n], i) => (
              <li key={label} style={{ display: "grid", gridTemplateColumns: "118px 1fr auto", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span>{label}</span>
                <span style={{ height: 10, borderRadius: 4, background: "var(--app-inner)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${(n / fMax) * 100}%`, minWidth: n ? 4 : 0, borderRadius: 4, background: "var(--heat-3)" }} />
                </span>
                <span className="tabnum" style={{ minWidth: 72, textAlign: "right" }}>
                  <b>{n}</b>{i > 0 && <span style={{ color: "var(--app-muted)" }}> · {pct(rateOf(n, funnel[i - 1][1]))}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {manager && (
        <section aria-labelledby="dash-people" style={{ ...card, padding: 16, marginBottom: 12 }}>
          <h3 id="dash-people" style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>Per sales</h3>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 10 }}>Tap satu orang buat liat dashboard, heat map, dan log-nya.</div>
          <div className="sp-dash-row sp-dash-head" aria-hidden="true" style={{ fontSize: 11, color: "var(--app-muted)", padding: "0 10px 6px" }}>
            <span>Sales</span><span>Aktivitas</span><span>DM</span><span>Dibales</span><span>ETB</span><span>Penawaran</span><span>Closing</span><span>Uang masuk</span><span>Terakhir aktif</span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {rows.map(({ x, s: r }) => {
              const sel = who === x.uid;
              const late = daysSince(r.lastAt) >= 3;
              return (
                <button key={x.uid} onClick={() => open(x.uid)} aria-pressed={sel}
                  aria-label={`${x.name}: ${r.activities} aktivitas, ${r.dms} DM, ${r.won} closing, ${rupiah(r.paid)}, terakhir aktif ${ago(r.lastAt)}`}
                  className="sp-dash-row lift" style={{ width: "100%", textAlign: "left", padding: 10, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--app-text)",
                    background: sel ? "var(--brand-tint)" : "var(--app-card)", border: `1px solid ${sel ? "var(--app-line-strong)" : "var(--app-border)"}` }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Avatar role={x.role} pick={x.avatar} size={30} />
                    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}{x.uid === me ? " (kamu)" : ""}</span>
                  </span>
                  <Cell l="Aktivitas" v={r.activities} />
                  <Cell l="DM" v={r.dms} />
                  <Cell l="Dibales" v={pct(rateOf(r.replies, r.dms))} />
                  <Cell l="ETB" v={r.etb} />
                  <Cell l="Penawaran" v={r.quotesSent} />
                  <Cell l="Closing" v={r.won} />
                  <Cell l="Uang masuk" v={rupiah(r.paid)} />
                  <span data-l="Terakhir aktif" style={{ fontSize: 12, color: late ? ink(WARN) : "var(--app-muted)", fontWeight: late ? 700 : 400 }}>{ago(r.lastAt)}</span>
                </button>
              );
            })}
          </div>
          {quiet.length > 0 && (
            <div role="note" style={{ marginTop: 10, fontSize: 13, padding: "8px 10px", borderRadius: 10, background: "#b453090f", border: "1px solid #b4530940" }}>
              <b style={{ color: ink(WARN) }}>Perlu dicek:</b> {quiet.map(r => `${r.x.name} (${ago(r.s.lastAt)})`).join(", ")}, ga ada aktivitas 3 hari atau lebih.
            </div>
          )}
        </section>
      )}

      {space.kind === "guild" ? (
        <button onClick={() => onGo("Guild")} style={{ ...chip, minHeight: 44, fontSize: 13, marginBottom: 16, color: "var(--brand-text)", fontWeight: 600 }}>Target &amp; pipeline guild ada di Report Tim →</button>
      ) : (
        <div style={{ ...card, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "var(--app-muted)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 220px" }}>Jualan bareng tim? Bikin guild, semua anggota kelihatan di sini per orang.</span>
          <button onClick={() => onGo("Guild")} style={{ ...chip, minHeight: 40, fontWeight: 700, color: "var(--brand-text)" }}>Ke Guild</button>
        </div>
      )}

      <div ref={logRef} style={{ scrollMarginTop: 120 }}>
        {(who || !manager) && (
          <ActivityLog key={who || me} owner={who || me} title={person && who !== me ? `Log aktivitas ${person.name}` : "Log aktivitas kamu"}
            hunts={hunts} sessions={sessions} quotes={quotes} invoices={invoices} outreach={outreach} rejections={rejections} onGo={onGo} />
        )}
      </div>
    </div>
  );
}

// A rate against one that didn't exist (nothing sent before) is new, not "+100 poin".
function rateChange(cur: number | null, prev: number | null): ReturnType<typeof change> {
  if (prev === null) return { text: cur === null ? "sama" : "baru", dir: 0 };
  return change(cur ?? 0, prev, "rate");
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
