"use client";

import { useState } from "react";
import { Invoice, rupiah } from "@/lib/billing";
import { ReportMode, SourcedLead, sourceReport } from "@/lib/report";
import { card, chip, font } from "@/components/ui";

const MODES: [ReportMode, string][] = [["channel", "Sumber"], ["campaign", "Kampanye"]];

export default function LeadSources({ leads, invoices }: { leads: SourcedLead[]; invoices: Invoice[] }) {
  const [mode, setMode] = useState<ReportMode>("channel");
  const rows = sourceReport(leads, invoices, mode);
  const top = rows.reduce((m, r) => Math.max(m, r.collected || r.closedValue), 0);

  return (
    <div style={{ ...card, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>💸 Dari mana uangnya?</div>
        <div role="group" aria-label="Kelompokkan" style={{ display: "flex", gap: 6 }}>
          {MODES.map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
              style={{ ...chip, fontWeight: 700, ...(mode === m ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--app-muted)", marginBottom: 14 }}>
        {mode === "channel"
          ? "Lead per sumber, berapa yang closing, dan uang yang sudah masuk dari invoice-nya. Member = baru daftar di situs."
          : "Lead dari link ber-UTM (iklan, boost, bio). Pakai link bertag supaya kampanye kelihatan di sini."}
      </div>
      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--app-muted)", padding: "8px 0" }}>
          {mode === "channel" ? "Belum ada lead." : "Belum ada lead dari link ber-UTM. Contoh: ?utm_source=instagram&utm_medium=paid&utm_campaign=2026-10-menu"}
        </div>
      )}
      {rows.map(r => {
        const money = r.collected || r.closedValue;
        return (
          <div key={r.key} style={{ padding: "12px 0", borderTop: "1px solid var(--app-inner)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.key}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: money ? "var(--ok)" : "var(--app-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {money ? rupiah(money) : "Rp 0"}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, color: "var(--app-muted)", marginTop: 3 }}>
              <span>{r.leads} lead · {r.hot} panas · {r.closed} closing{r.leads ? ` (${Math.round((r.closed / r.leads) * 100)}%)` : ""}</span>
              <span style={{ flexShrink: 0 }}>{r.collected ? "sudah masuk" : r.closedValue ? "nilai closing" : ""}</span>
            </div>
            {top > 0 && (
              <div style={{ height: 4, background: "var(--app-inner)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: `${(money / top) * 100}%`, height: "100%", background: "var(--ok)" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
