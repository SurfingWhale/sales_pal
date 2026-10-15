"use client";

import { useState } from "react";
import { Invoice, Quote, rupiah, today, total } from "@/lib/billing";
import { fullDay } from "@/lib/when";
import { jobsFrom } from "@/components/JobCalendar";
import { chip } from "@/components/ui";

// The month at a glance, behind one toggle (QA 15 Okt: "calendar berbentuk
// toggle buat liat okupansi sales bulanan"): which days already have a job,
// how full the month is, and what it's worth. Jobs come from the "Tanggal
// acara" on quotes and invoices.

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function OccupancyCalendar({ quotes, invoices }: { quotes: Quote[]; invoices: Invoice[] }) {
  const now = today();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(now.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);

  const jobs = jobsFrom(quotes, invoices);

  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const inMonth = jobs.filter(j => j.date.startsWith(month));
  const booked = new Set(inMonth.filter(j => j.firm).map(j => j.date));
  const pending = new Set(inMonth.filter(j => !j.firm && !booked.has(j.date)).map(j => j.date));
  const worth = invoices.filter(i => i.eventDate?.startsWith(month)).reduce((a, i) => a + total(i), 0)
    + quotes.filter(q => q.eventDate?.startsWith(month) && !q.invoiceId && q.status === "Disetujui").reduce((a, q) => a + total(q), 0);
  const pct = Math.round((booked.size / days) * 100);
  const label = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : ymd(new Date(y, m - 1, i - lead + 1))));
  const go = (by: number) => { const d = new Date(y, m - 1 + by, 1); setMonth(ymd(d).slice(0, 7)); setDay(null); };
  const dayJobs = day ? jobs.filter(j => j.date === day) : [];

  return (
    <section aria-label="Kalender okupansi" style={{ background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "10px 16px", border: 0, background: "transparent", color: "var(--app-text)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span aria-hidden="true" style={{ fontSize: 20 }}>📅</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Kalender {label}</span>
          <span className="tabnum" style={{ display: "block", fontSize: 13, color: "var(--app-sub)" }}>
            {booked.size} dari {days} hari terisi ({pct}%){pending.size ? ` · ${pending.size} hari masih penawaran` : ""}{worth ? ` · ${rupiah(worth)}` : ""}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: 13, color: "var(--app-sub)", fontWeight: 600 }}>{open ? "Tutup ▴" : "Lihat ▾"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div role="progressbar" aria-label="Okupansi bulan ini" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
            style={{ height: 6, borderRadius: 3, background: "var(--app-inner)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#ff9900" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => go(-1)} aria-label="Bulan sebelumnya" style={{ ...chip, minHeight: 44, minWidth: 44, fontSize: 16 }}>‹</button>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
            <button onClick={() => go(1)} aria-label="Bulan berikutnya" style={{ ...chip, minHeight: 44, minWidth: 44, fontSize: 16 }}>›</button>
          </div>
          <div role="grid" aria-label={`Okupansi ${label}`} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, textAlign: "center" }}>
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => <div key={d} style={{ fontSize: 12, color: "var(--app-muted)", padding: "2px 0" }}>{d}</div>)}
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const n = jobs.filter(j => j.date === c).length;
              const full = booked.has(c), maybe = pending.has(c);
              return (
                <button key={i} role="gridcell" onClick={() => setDay(day === c ? null : c)} aria-pressed={day === c}
                  aria-label={`${fullDay(c)}${n ? `, ${n} job${maybe ? " (penawaran)" : ""}` : ", kosong"}`}
                  style={{ minHeight: 44, minWidth: 0, padding: 0, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 14,
                    fontWeight: full || maybe || c === now ? 700 : 400, fontVariantNumeric: "tabular-nums",
                    border: day === c ? "2px solid #005eb0" : c === now ? "1px dashed var(--app-muted)" : "1px solid transparent",
                    background: full ? "#ff99002e" : maybe ? "var(--app-inner)" : "transparent",
                    color: c < now ? "var(--app-muted)" : "var(--app-text)" }}>
                  {Number(c.slice(8))}
                  {n > 0 && <span style={{ display: "block", fontSize: 11, lineHeight: 1, color: "var(--app-sub)" }}>{n} job</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--app-sub)", marginTop: 10 }}>
            <span><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ff99002e", border: "1px solid #ff990080", marginRight: 6 }} />Ada job (invoice / disetujui)</span>
            <span><span aria-hidden="true" style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "var(--app-inner)", border: "1px solid var(--app-border)", marginRight: 6 }} />Masih penawaran</span>
          </div>
          {day && (
            <div role="status" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--app-inner)", fontSize: 14 }}>
              <b>{fullDay(day)}</b>
              {dayJobs.length === 0
                ? <div style={{ color: "var(--ok)", marginTop: 4 }}>Kosong — bisa ditawarin.</div>
                : dayJobs.map((j, k) => <div key={k} style={{ marginTop: 4, color: "var(--app-sub)" }}>• <span style={{ color: "var(--app-text)", fontWeight: 600 }}>{j.who}</span> · {j.what}{j.firm ? "" : " (belum pasti)"}</div>)}
            </div>
          )}
          {inMonth.length === 0 && <p style={{ fontSize: 13, color: "var(--app-sub)", margin: "10px 0 0" }}>Belum ada job bulan ini. Job keisi dari &quot;Tanggal acara&quot; di Penawaran & Invoice.</p>}
        </div>
      )}
    </section>
  );
}
