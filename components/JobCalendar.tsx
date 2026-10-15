"use client";

import { useState } from "react";
import { Invoice, Quote } from "@/lib/billing";
import { fullDay } from "@/lib/when";
import { chip } from "@/components/ui";

// Is that day still free? The jobs already booked, from the "Tanggal acara"
// on quotes and invoices, around the day a prospect asked for (QA 11 Okt:
// "ada leads tanggal 24, gw perlu cek itu hari apa dan udah ada kerjaan apa").

export interface Job { date: string; who: string; what: string; firm: boolean }

export function jobsFrom(quotes: Quote[], invoices: Invoice[]): Job[] {
  const inv = invoices.filter(i => i.eventDate).map(i => ({ date: i.eventDate!, who: i.leadName, what: i.number, firm: true }));
  const q = quotes.filter(x => x.eventDate && !x.invoiceId && x.status !== "Ditolak")
    .map(x => ({ date: x.eventDate!, who: x.leadName, what: `${x.number} · ${x.status === "Disetujui" ? "disetujui" : "penawaran"}`, firm: x.status === "Disetujui" }));
  return [...inv, ...q];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function JobCalendar({ date, jobs, today }: { date: string; jobs: Job[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  const that = jobs.filter(j => j.date === date);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : ymd(new Date(y, m - 1, i - lead + 1))));
  const byDay = new Map<string, Job[]>();
  jobs.forEach(j => byDay.set(j.date, [...(byDay.get(j.date) || []), j]));
  const go = (by: number) => { const d = new Date(y, m - 1 + by, 1); setMonth(ymd(d).slice(0, 7)); };

  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "var(--app-card)", border: "1px solid var(--app-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12 }}>
          <b>{fullDay(date)}</b>{" "}
          {that.length === 0
            ? <span style={{ color: "var(--ok)", fontWeight: 700 }}>· kosong, belum ada job</span>
            : <span style={{ color: "color-mix(in srgb, #ff9900 55%, var(--app-text))", fontWeight: 700 }}>· udah ada {that.length} job</span>}
          {date < today && <span style={{ color: "var(--app-muted)" }}> · udah lewat</span>}
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ ...chip, minHeight: 32 }}>{open ? "Tutup kalender" : "Lihat kalender"}</button>
      </div>
      {that.map((j, i) => (
        <div key={i} style={{ fontSize: 12, color: "var(--app-sub)", marginTop: 4 }}>• {j.who} <span style={{ color: "var(--app-muted)" }}>({j.what}{j.firm ? "" : ", belum pasti"})</span></div>
      ))}

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <button onClick={() => go(-1)} aria-label="Bulan sebelumnya" style={{ ...chip, minHeight: 32, minWidth: 36 }}>‹</button>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{first.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
            <button onClick={() => go(1)} aria-label="Bulan berikutnya" style={{ ...chip, minHeight: 32, minWidth: 36 }}>›</button>
          </div>
          <div role="grid" aria-label="Kalender job" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3, fontSize: 12, textAlign: "center" }}>
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => <div key={d} style={{ color: "var(--app-muted)", padding: "2px 0" }}>{d}</div>)}
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const js = byDay.get(c) || [];
              const asked = c === date;
              return (
                <div key={i} role="gridcell" aria-label={`${fullDay(c)}${js.length ? `, ${js.length} job: ${js.map(j => j.who).join(", ")}` : ", kosong"}${asked ? ", tanggal yang diminta" : ""}`}
                  title={js.map(j => j.who).join(", ")}
                  style={{ padding: "5px 0", borderRadius: 8, fontVariantNumeric: "tabular-nums",
                    background: js.length ? "#ff99001f" : "transparent",
                    outline: asked ? "2px solid #005eb0" : c === today ? "1px dashed var(--app-muted)" : "none", outlineOffset: -2,
                    color: c < today ? "var(--app-muted)" : "var(--app-text)", fontWeight: asked || js.length ? 700 : 400 }}>
                  {Number(c.slice(8))}
                  <div style={{ height: 4, display: "flex", justifyContent: "center", gap: 2, marginTop: 1 }}>
                    {js.slice(0, 3).map((j, k) => <span key={k} style={{ width: 4, height: 4, borderRadius: 2, background: j.firm ? "#ff9900" : "#8a94a6" }} />)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 6 }}>Job diambil dari &quot;Tanggal acara&quot; di Penawaran & Invoice. Titik oranye = pasti, abu = masih penawaran.</div>
        </div>
      )}
    </div>
  );
}
