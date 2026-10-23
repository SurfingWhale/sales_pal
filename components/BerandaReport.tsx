"use client";

import { addDays, today } from "@/lib/billing";
import type { Hunt } from "@/lib/hunting";
import { HuntSession, Prospect, journey, rate, sessionMinutes } from "@/lib/prospects";
import type { Numbers } from "@/components/Beranda";
import Icon from "@/components/Icon";

// Beranda, Report & closing (docs/prd/PRD-008 §6): how this month is going,
// from the first DM to the money in, and the way to every detailed report.

const STAGES = ["Cold", "Warm", "Hot", "Closed"] as const;

// Juta, like Beranda's numbers: "Rp 12,5 jt".
const jt = (n: number) => (n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: n >= 100_000_000 ? 0 : 1 });

// A funnel as rows split by hairlines (docs/standards/design.md §2): label,
// a bar against the first stage, the count and how many carried on.
function Funnel({ id, title, rows }: { id: string; title: string; rows: { label: string; n: number }[] }) {
  const top = Math.max(1, rows[0]?.n || 0);
  return (
    <section aria-labelledby={id} className="sp-sec">
      <h3 id={id} style={{ marginBottom: "var(--sp-3)" }}>{title}</h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <li key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(96px, 130px) 1fr minmax(72px, auto)", alignItems: "center", gap: "var(--sp-3)", fontSize: "var(--fs-body)", padding: "var(--sp-2) 0", borderTop: i ? "1px solid var(--app-border)" : 0 }}>
            <span>{r.label}</span>
            <span aria-hidden="true" style={{ height: 8, borderRadius: 4, background: "var(--app-inner)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(r.n / top) * 100}%`, minWidth: r.n ? 4 : 0, borderRadius: 4, background: i === rows.length - 1 ? "var(--ok)" : "var(--heat-3)" }} />
            </span>
            <span className="tabnum" style={{ textAlign: "right" }}>
              <b>{r.n}</b>{i > 0 && <span style={{ color: "var(--app-muted)", fontSize: "var(--fs-meta)" }}> · {rate(r.n, rows[i - 1].n)}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function BerandaReport({ now, numbers, paid, receivable, leadsByStatus, prospects, hunts, sessions, onGo, onSetTarget }: {
  now: string; numbers: Numbers; paid: number; receivable: number; leadsByStatus: Record<string, number>;
  prospects: Prospect[]; hunts: Hunt[]; sessions: HuntSession[];
  onGo: (tab: string) => void; onSetTarget: () => void;
}) {
  const monthLabel = new Date(now + "T00:00:00").toLocaleDateString("id-ID", { month: "long" });
  const j = journey(prospects, addDays(now, -29));
  const weekAgo = addDays(today(), -6);
  const week = hunts.filter(h => h.date >= weekAgo);
  const weekReplied = week.filter(h => h.status === "Dibales" || h.status === "Tertarik" || h.status === "Ditolak").length;
  const weekInterested = week.filter(h => h.status === "Tertarik").length;
  const t = Date.now();
  const weekHours = sessions.filter(s => s.startedAt >= t - 7 * 86400000).reduce((a, s) => a + sessionMinutes(s, t), 0) / 60;
  const pct = numbers.closingTarget ? Math.min(100, (numbers.closedThisMonth / numbers.closingTarget) * 100) : 0;
  const links: [string, string, string][] = [
    ["Dashboard tim", "Dashboard tim", "Siapa ngerjain apa, konversi, uang masuk"],
    ["Log aktivitas", "Log aktivitas", "Heat map & semua yang kamu kerjain"],
    ["Report Tim", "Guild", "Target & capaian tiap sales"],
    ["Report Klien", "Report Klien", "Konten → chat → lunas, report bulanan"],
    ["Performa hunter", "Hunting", "Contact rate, konversi, biaya"],
    ["Outreach", "Outreach", "Email & pesan keluar"],
    ["Rejection Log", "Rejection Log", "Yang nolak & kapan coba lagi"],
  ];

  const strip: { k: string; v: string; money?: boolean; sub: string }[] = [
    { k: "Uang masuk", v: jt(paid), money: true, sub: "bulan ini" },
    { k: "Belum tertagih", v: jt(receivable), money: true, sub: "sisa invoice" },
    { k: "DM terkirim", v: String(week.length), sub: "7 hari" },
    { k: "Dibales", v: rate(weekReplied, week.length), sub: "dari DM 7 hari" },
    { k: "Tertarik", v: String(weekInterested), sub: "7 hari" },
    { k: "Jam hunting", v: weekHours.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), sub: "7 hari" },
  ];

  // One hero (design.md §1): the month's closings against the target, in a
  // sentence; the money and the week sit in the strip under it.
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1 className="sp-b-h1">
        {monthLabel}: {numbers.closedThisMonth} closing{numbers.closingTarget ? ` dari target ${numbers.closingTarget}` : ""}.
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-2)", maxWidth: 520 }}>
        {numbers.closingTarget > 0 && (
          <span aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--app-border)", overflow: "hidden" }}>
            <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "var(--heat-3)" }} />
          </span>
        )}
        <button onClick={onSetTarget} aria-label={numbers.closingTarget ? `Ubah target closing, sekarang ${numbers.closingTarget}` : "Atur target closing"}
          style={{ minHeight: 44, padding: 0, border: 0, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "var(--fs-meta)", fontWeight: 600, color: "var(--brand-text)", whiteSpace: "nowrap" }}>
          {numbers.closingTarget ? "Ubah target" : "Atur target"}
        </button>
      </div>

      <section aria-label="Bulan ini" className="sp-strip three" style={{ marginTop: "var(--sp-4)" }}>
        {strip.map(x => (
          <div key={x.k}>
            <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>{x.k}</div>
            <div style={{ marginTop: "var(--sp-2)", display: "flex", alignItems: "baseline", gap: "var(--sp-1)" }}>
              {x.money && <span style={{ fontSize: "var(--fs-meta)", fontWeight: 600, color: "var(--app-muted)" }}>Rp</span>}
              <span className={/^[\d.,]+$/.test(x.v) ? "num" : "tabnum"} style={{ fontSize: /^[\d.,]+$/.test(x.v) ? "var(--fs-num)" : "var(--fs-section)", fontWeight: 600, lineHeight: 1.1 }}>{x.v}</span>
              {x.money && <span style={{ fontSize: "var(--fs-meta)", fontWeight: 600, color: "var(--app-muted)" }}>jt</span>}
            </div>
            <div style={{ fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginTop: "var(--sp-1)" }}>{x.sub}</div>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", columnGap: "var(--sp-6)" }}>
        <Funnel id="rep-hunt" title="Hunting, 30 hari" rows={[
          { label: "Prospek masuk", n: j.masuk }, { label: "Di-intro", n: j.intro }, { label: "Dibales", n: j.terhubung }, { label: "Kasih data (ETB)", n: j.data },
        ]} />
        <Funnel id="rep-pipe" title="Pipeline lead, sekarang" rows={STAGES.map(s => ({ label: s, n: leadsByStatus[s] || 0 }))} />
      </div>
      <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-meta)", color: "var(--app-muted)" }}>Persen = lanjut dari tahap sebelumnya; di bawah 10 ditulis &quot;X dari Y&quot;.</p>

      <section aria-labelledby="rep-links-h" className="sp-sec">
        <h3 id="rep-links-h" style={{ marginBottom: "var(--sp-2)" }}>Report lengkap</h3>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", columnGap: "var(--sp-6)" }}>
          {links.map(([label, tab, sub]) => (
            <li key={label} style={{ borderBottom: "1px solid var(--app-border)" }}>
              <button onClick={() => onGo(tab)} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", width: "100%", minHeight: 56, padding: "var(--sp-3) 0", textAlign: "left", border: 0, background: "none", cursor: "pointer", color: "var(--app-text)", fontFamily: "inherit" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "var(--fs-body)", fontWeight: 600 }}>{label}</span>
                  <span style={{ display: "block", fontSize: "var(--fs-meta)", color: "var(--app-muted)", marginTop: 2 }}>{sub}</span>
                </span>
                <span aria-hidden="true" style={{ color: "var(--app-muted)", display: "inline-flex" }}><Icon name="chevronRight" size={16} /></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
