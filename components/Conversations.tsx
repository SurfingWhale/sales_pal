"use client";

// Percakapan (Hunting): every person like a chat list — the last thing said,
// when, and what they need next — so the cycle (scraped → sapa → follow-up →
// promo) carries on from one place. A tap opens the conversation.

import { useState } from "react";
import { today } from "@/lib/billing";
import { Prospect, Strategy, dropReady, isDue, lastLine, silentDays } from "@/lib/prospects";
import { chip, inputStyle } from "@/components/ui";

const FILTERS = ["Semua", "Follow-up hari ini", "Dibales", "Diem 7+ hari", "Siap dibuang"] as const;
type F = (typeof FILTERS)[number];
const PAGE = 30;

const when = (ms: number) => {
  const d = new Date(ms), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};

export default function Conversations({ prospects, strategy, onOpen }: {
  prospects: Prospect[]; strategy: Strategy; onOpen: (p: Prospect) => void;
}) {
  const on = today();
  const [f, setF] = useState<F>("Semua");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const live = prospects.filter(p => !p.closed);
  const pass = (p: Prospect, x: F) => {
    const quiet = silentDays(p, on);
    switch (x) {
      case "Semua": return true;
      case "Follow-up hari ini": return isDue(p, on, strategy) && !dropReady(p, on, strategy);
      case "Dibales": return p.contact === "terhubung";
      case "Diem 7+ hari": return quiet !== null && quiet >= 7 && !dropReady(p, on, strategy);
      case "Siap dibuang": return dropReady(p, on, strategy);
    }
  };
  const needle = q.trim().toLowerCase().replace(/^@/, "");
  const rows = live.filter(p => pass(p, f))
    .filter(p => !needle || [p.handle, p.name || "", p.id].some(x => x.toLowerCase().replace(/^@/, "").includes(needle)))
    .map(p => ({ p, last: lastLine(p) }))
    .sort((a, b) => (b.last?.at || b.p.updatedAt) - (a.last?.at || a.p.updatedAt));

  return (
    <div>
      <input type="search" value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE); }} aria-label="Cari percakapan"
        placeholder="Cari @username, nama, atau ID" style={{ ...inputStyle, fontSize: 16, marginBottom: 10 }} />
      <div role="group" aria-label="Saring percakapan" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }}>
        {FILTERS.map(x => {
          const n = live.filter(p => pass(p, x)).length;
          return (
            <button key={x} onClick={() => { setF(x); setLimit(PAGE); }} aria-pressed={f === x}
              style={{ ...chip, flexShrink: 0, minHeight: 36, fontWeight: 700, ...(f === x ? { background: "#005eb0", color: "#fff", border: "1px solid #005eb0" } : {}) }}>
              {x}{x !== "Semua" && n ? <span> {n}</span> : null}
            </button>
          );
        })}
      </div>
      {!rows.length && <div style={{ fontSize: 13, color: "var(--app-muted)", padding: "14px 0" }}>{needle ? "Ga ketemu." : "Belum ada percakapan di sini."}</div>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.slice(0, limit).map(({ p, last }) => {
          const quiet = silentDays(p, on);
          const due = isDue(p, on, strategy);
          const drop = dropReady(p, on, strategy);
          const who = p.name ? `${p.name} (${p.handle})` : p.handle;
          return (
            <li key={p.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
              <button onClick={() => onOpen(p)} aria-label={`Buka percakapan ${who}`}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", width: "100%", textAlign: "left", padding: "12px 4px", minHeight: 56, border: 0, background: "none", cursor: "pointer", color: "var(--app-text)", fontFamily: "inherit" }}>
                <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{who}</span>
                <span style={{ fontSize: 12, color: due ? "var(--brand-text)" : "var(--app-muted)", fontWeight: due ? 700 : 400 }}>{last ? when(last.at) : ""}</span>
                <span style={{ fontSize: 13, color: "var(--app-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last ? `${last.who === "kamu" ? "Kamu: " : last.who === "dia" ? "" : "· "}${last.text.replace(/\s+/g, " ")}` : "Belum ada pesan"}
                </span>
                <span style={{ fontSize: 11, color: drop ? "color-mix(in srgb, #dc2626 55%, var(--app-text))" : "var(--app-muted)", whiteSpace: "nowrap", fontWeight: drop || due ? 700 : 400 }}>
                  {drop ? "siap dibuang" : due ? "follow-up" : quiet !== null && quiet >= 2 ? `diem ${quiet} hr` : p.platform}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > limit && <button onClick={() => setLimit(limit + PAGE)} style={{ ...chip, minHeight: 44, width: "100%", marginTop: 10, fontWeight: 600 }}>Lihat {Math.min(PAGE, rows.length - limit)} lagi</button>}
    </div>
  );
}
