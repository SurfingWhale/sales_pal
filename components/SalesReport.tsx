"use client";

import { useState } from "react";
import { Invoice, Quote, balance, longDate, rupiah, today, total } from "@/lib/billing";
import { seesEveryone, useSpace } from "@/lib/space";
import { card, chip, font } from "@/components/ui";

// Your own sales for a month, straight from quotes and invoices (QA 11 Okt:
// "report klien blank padahal ada invoice masuk"). Money is counted in the
// month it arrived; quotes and invoices in the month they were written.

const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const label = (month: string) => new Date(month + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

interface Row { key: string; name: string; quotes: number; won: number; billed: number; cash: number; open: number }

export default function SalesReport({ quotes, invoices }: { quotes: Quote[]; invoices: Invoice[] }) {
  const space = useSpace();
  const [month, setMonth] = useState(today().slice(0, 7));
  const inMonth = (d?: string) => !!d && d.startsWith(month);

  const q = quotes.filter(x => inMonth(x.date));
  const won = q.filter(x => x.status === "Disetujui");
  const billed = invoices.filter(i => inMonth(i.date));
  const pays = invoices.flatMap(i => (i.payments || []).filter(p => inMonth(p.date)).map(p => ({ i, p })));
  const cash = pays.reduce((a, x) => a + x.p.amount, 0);
  const paidOff = billed.filter(i => balance(i) === 0 && total(i) > 0);

  function group(by: (x: { leadName: string; ownerName?: string; ownerUid?: string }) => [string, string]): Row[] {
    const m = new Map<string, Row>();
    const row = (x: { leadName: string; ownerName?: string; ownerUid?: string }) => {
      const [key, name] = by(x);
      if (!m.has(key)) m.set(key, { key, name, quotes: 0, won: 0, billed: 0, cash: 0, open: 0 });
      return m.get(key)!;
    };
    q.forEach(x => { const r = row(x); r.quotes++; if (x.status === "Disetujui") r.won++; });
    billed.forEach(i => { row(i).billed += total(i); });
    pays.forEach(({ i, p }) => { row(i).cash += p.amount; });
    invoices.filter(i => balance(i) > 0 && (inMonth(i.date) || (i.payments || []).some(p => inMonth(p.date)))).forEach(i => { row(i).open += balance(i); });
    return Array.from(m.values()).sort((a, b) => b.cash - a.cash || b.billed - a.billed);
  }
  const byClient = group(x => [x.leadName.trim().toLowerCase(), x.leadName.trim() || "Tanpa nama"]);
  const team = space.kind === "guild" && seesEveryone(space);
  const bySeller = team ? group(x => [x.ownerUid || "-", x.ownerName || "Tanpa nama"]) : [];

  const step = (n: number, of: number) => (of ? `${n} dari ${of}` : `${n}`);

  return (
    <section aria-labelledby="sales-report" className="sp-team sp-sales-card" style={{ ...card, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h2 id="sales-report" style={{ fontSize: 15, fontWeight: 700, fontFamily: font, margin: 0 }}>Penjualan {label(month)}</h2>
        <div role="group" aria-label="Pilih bulan" style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setMonth(shift(month, -1))} aria-label="Bulan sebelumnya" title="Bulan sebelumnya" style={{ ...chip, minHeight: 40, minWidth: 44, fontSize: 18, lineHeight: 1, color: "var(--app-text)" }}>‹</button>
          <button onClick={() => setMonth(today().slice(0, 7))} disabled={month === today().slice(0, 7)} title={month === today().slice(0, 7) ? "Udah di bulan ini" : undefined} style={{ ...chip, minHeight: 40, fontSize: 13, color: "var(--app-text)", opacity: month === today().slice(0, 7) ? 0.5 : 1 }}>Bulan ini</button>
          <button onClick={() => setMonth(shift(month, 1))} aria-label="Bulan berikutnya" title="Bulan berikutnya" style={{ ...chip, minHeight: 40, minWidth: 44, fontSize: 18, lineHeight: 1, color: "var(--app-text)" }}>›</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--app-muted)", marginBottom: 14 }}>
        Dari Penawaran & Invoice{team ? " seluruh tim" : ""}. Uang dihitung di bulan uangnya masuk; penawaran & invoice di bulan dibuatnya.
      </div>

      <div className="sp-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Uang masuk", v: rupiah(cash), s: `${pays.length} pembayaran`, c: "var(--ok)" },
          { l: "Ditagih", v: rupiah(billed.reduce((a, i) => a + total(i), 0)), s: `${billed.length} invoice dibuat`, c: "#005eb0" },
          { l: "Penawaran disetujui", v: step(won.length, q.length), s: rupiah(won.reduce((a, x) => a + total(x), 0)), c: "color-mix(in srgb, #7c3aed 70%, var(--app-text))" },
          { l: "Invoice lunas", v: step(paidOff.length, billed.length), s: "dari invoice bulan ini", c: "var(--app-text)" },
        ].map(x => (
          <div key={x.l} style={{ padding: 12, borderRadius: 12, background: "var(--app-inner)", minWidth: 0 }}>
            <div className="num sp-sales-num" style={{ fontSize: 22, color: x.c, overflowWrap: "anywhere", lineHeight: 1.2 }}>{x.v}</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 12, color: "var(--app-muted)", marginTop: 2 }}>{x.s}</div>
          </div>
        ))}
      </div>

      {byClient.length === 0
        ? <div style={{ fontSize: 13, color: "var(--app-muted)" }}>Belum ada penawaran, invoice, atau pembayaran di {label(month)}. Bikin di Jualan → Penawaran atau Invoice, nanti angkanya muncul di sini.</div>
        : <Table title="Per klien" rows={byClient} />}
      {bySeller.length > 0 && <Table title="Per sales" rows={bySeller} />}
      {pays.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Rincian uang masuk</summary>
          {pays.sort((a, b) => b.p.date.localeCompare(a.p.date)).map(({ i, p }, n) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "8px 0", borderTop: "1px solid var(--app-inner)" }}>
              <span style={{ minWidth: 0 }}>{longDate(p.date)} · <b>{i.leadName}</b> <span style={{ color: "var(--app-muted)" }}>{i.number}{p.note ? ` · ${p.note}` : ""}</span></span>
              <b style={{ color: "var(--ok)", flexShrink: 0 }}>+{rupiah(p.amount)}</b>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function Table({ title, rows }: { title: string; rows: Row[] }) {
  const th: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--app-muted)", textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { fontSize: 12, textAlign: "right", padding: "8px", borderTop: "1px solid var(--app-inner)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <table className="sp-rtable sp-rtable-flat" style={{ width: "100%", borderCollapse: "collapse" }}>
        <caption style={{ textAlign: "left", fontSize: 13, fontWeight: 700, padding: "0 0 4px" }}>{title}</caption>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Nama</th>
            <th style={th}>Penawaran</th>
            <th style={th}>Ditagih</th>
            <th style={th}>Masuk</th>
            <th style={th}>Sisa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td className="sp-rt-head" style={{ ...td, textAlign: "left", fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</td>
              <td data-label="Penawaran" style={td}>{r.quotes ? `${r.won}/${r.quotes} disetujui` : "—"}</td>
              <td data-label="Ditagih" style={td}>{r.billed ? rupiah(r.billed) : "—"}</td>
              <td data-label="Masuk" style={{ ...td, color: r.cash ? "var(--ok)" : undefined, fontWeight: r.cash ? 700 : 400 }}>{r.cash ? rupiah(r.cash) : "—"}</td>
              <td data-label="Sisa" style={{ ...td, color: r.open ? "color-mix(in srgb, #ff9900 55%, var(--app-text))" : undefined }}>{r.open ? rupiah(r.open) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
