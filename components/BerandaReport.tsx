"use client";

import { addDays, today } from "@/lib/billing";
import type { Hunt } from "@/lib/hunting";
import { HuntSession, Prospect, journey, rate, sessionMinutes } from "@/lib/prospects";
import type { Numbers } from "@/components/Beranda";

// Beranda, Report & closing (docs/prd/PRD-008 §6): how this month is going,
// from the first DM to the money in, and the way to every detailed report.

const STAGES = ["Cold", "Warm", "Hot", "Closed"] as const;

// Juta, like Beranda's numbers: "Rp 12,5 jt".
const jt = (n: number) => (n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: n >= 100_000_000 ? 0 : 1 });

function Money({ n }: { n: number }) {
  return (
    <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: "var(--app-muted)" }}>Rp</span>
      <span className="num big">{jt(n)}</span>
      <span style={{ fontSize: 16, fontWeight: 600, color: "var(--app-muted)" }}>jt</span>
    </p>
  );
}

function Funnel({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const top = Math.max(1, rows[0]?.n || 0);
  return (
    <section aria-label={title} style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 20 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>{title}</h3>
      {rows.map((r, i) => (
        <div key={r.label} style={{ marginTop: i ? 10 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 4 }}>
            <span>{r.label}</span>
            <span className="tabnum" style={{ fontWeight: 600 }}>{r.n}{i > 0 ? <span style={{ color: "var(--app-muted)", fontWeight: 400 }}> · {rate(r.n, rows[i - 1].n)}</span> : null}</span>
          </div>
          <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: "var(--app-inner)", overflow: "hidden" }}>
            <div style={{ width: `${(r.n / top) * 100}%`, height: "100%", borderRadius: 999, background: i === rows.length - 1 ? "#00a862" : "#005eb0" }} />
          </div>
        </div>
      ))}
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--app-muted)" }}>Angka di samping = lanjut dari tahap sebelumnya. Di bawah 10 ditulis &quot;X dari Y&quot;.</p>
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
    ["Report Tim", "Guild", "Target & capaian tiap sales"],
    ["Report Klien", "Report Klien", "Konten → chat → lunas, report bulanan"],
    ["Performa hunter", "Hunting", "Contact rate, konversi, biaya"],
    ["Outreach", "Outreach", "Email & pesan keluar"],
    ["Rejection Log", "Rejection Log", "Yang nolak & kapan coba lagi"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1 className="sp-b-h1">
        {monthLabel}: {numbers.closedThisMonth} closing{numbers.closingTarget ? ` dari target ${numbers.closingTarget}` : ""}.
      </h1>

      <section aria-label="Bulan ini" className="sp-kpis">
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Closing bulan ini</p>
          <p style={{ margin: "14px 0 0", display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="num big">{numbers.closedThisMonth}</span>
            {numbers.closingTarget > 0 && <span className="num" style={{ fontSize: 30, color: "var(--app-muted)" }}>/ {numbers.closingTarget}</span>}
          </p>
          <button onClick={onSetTarget} aria-label={numbers.closingTarget ? `Ubah target closing, sekarang ${numbers.closingTarget}` : "Atur target closing"} style={{ display: "block", width: "100%", marginTop: 14, padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left" }}>
            {numbers.closingTarget > 0
              ? <span style={{ display: "block", height: 4, borderRadius: 999, background: "var(--app-border)", overflow: "hidden" }}><span style={{ display: "block", width: `${pct}%`, height: "100%", borderRadius: 999, background: "#005eb0" }} /></span>
              : <span className="sub" style={{ fontSize: 13, color: "var(--brand-text)", fontWeight: 600 }}>Atur target</span>}
          </button>
        </div>
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Uang masuk</p>
          <Money n={paid} />
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>pembayaran tercatat bulan ini</p>
        </div>
        <div className="sp-kpi">
          <p className="lbl" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--app-muted)" }}>Belum tertagih</p>
          <Money n={receivable} />
          <p className="sub" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--app-muted)" }}>sisa invoice yang belum lunas</p>
        </div>
      </section>

      <div style={{ marginTop: "clamp(24px, 4vw, 40px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <Funnel title="Hunting, 30 hari" rows={[
          { label: "Prospek masuk", n: j.masuk }, { label: "Di-intro", n: j.intro }, { label: "Dibales", n: j.terhubung }, { label: "Kasih data (ETB)", n: j.data },
        ]} />
        <Funnel title="Pipeline lead, sekarang" rows={STAGES.map(s => ({ label: s, n: leadsByStatus[s] || 0 }))} />
      </div>

      <section aria-label="Aktivitas 7 hari" style={{ marginTop: 12, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Aktivitas 7 hari</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, fontSize: 13 }}>
          {([["DM terkirim", String(week.length)], ["Dibales", rate(weekReplied, week.length)], ["Tertarik", String(weekInterested)], ["Jam hunting", weekHours.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })]] as [string, string][]).map(([k, v]) => (
            <div key={k}>
              <div className={/^[\d.,]+$/.test(v) ? "num tabnum" : "tabnum"} style={{ fontSize: /^[\d.,]+$/.test(v) ? 32 : 20, fontWeight: 600, lineHeight: 1.2 }}>{v}</div>
              <div style={{ color: "var(--app-muted)", marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="rep-links-h" style={{ marginTop: "clamp(24px, 4vw, 40px)" }}>
        <h2 id="rep-links-h" style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 600 }}>Report lengkap</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {links.map(([label, tab, sub]) => (
            <button key={label} onClick={() => onGo(tab)} className="lift" style={{ textAlign: "left", background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 16, padding: 16, cursor: "pointer", color: "var(--app-text)", fontFamily: "inherit" }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{label} →</div>
              <div style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 4 }}>{sub}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
