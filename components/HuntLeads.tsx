"use client";

import { useState } from "react";
import { QueryLead, VIEWS, View, inView, matches, sortLeads } from "@/lib/leadQuery";
import { CardLead, LeadRow } from "@/components/LeadCard";
import { inputStyle } from "@/components/ui";

// Leads inside Hunting (PRD-022 Q11): two lists, one place to work. Cards in
// Prospek's pattern, the views of Jualan → Leads, sorted by what needs doing.

export type HuntLead = CardLead & QueryLead;
const PAGE = 20;

export default function HuntLeads({ leads, view, setView, q, setQ, now, showOwner, score, onOpen }: {
  leads: HuntLead[]; view: View; setView: (v: View) => void; q: string; setQ: (q: string) => void;
  now: string; showOwner: boolean; score: (l: HuntLead) => number;
  onOpen: (id: string, start: "chat" | "edit" | null, list: string[]) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const list = sortLeads(leads.filter(l => inView(l, view, now) && matches(l, q)), "kerja", score, now);
  const ids = list.map(l => l.id);
  return (
    <>
      <label htmlFor="hunt-lead-search" className="vh">Cari lead</label>
      <input id="hunt-lead-search" type="search" value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Cari nama, nomor, catatan, kebutuhan…" style={{ ...inputStyle, minHeight: 44, fontSize: 16, marginBottom: 10 }} />
      <div role="group" aria-label="Tampilan cepat" className="sp-chiprow" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
        {VIEWS.map(v => {
          const n = v.id === "semua" ? leads.length : leads.filter(l => inView(l, v.id, now)).length;
          const on = view === v.id;
          if (v.id !== "semua" && !n && !on) return null;
          return (
            <button key={v.id} onClick={() => { setView(v.id); setLimit(PAGE); }} aria-pressed={on}
              style={{ flexShrink: 0, height: 44, padding: "0 14px", borderRadius: 999, border: `1px solid ${on ? "var(--app-text)" : "var(--app-line-strong)"}`, background: on ? "var(--app-text)" : "transparent", color: on ? "var(--app-card)" : "var(--app-text)", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit" }}>
              {v.label} <span className="tabnum">{n}</span>
            </button>
          );
        })}
      </div>
      {list.length === 0 ? (
        <p style={{ margin: "20px 0", fontSize: 14, color: "var(--app-muted)" }}>{leads.length ? "Ga ada lead yang cocok." : "Belum ada lead. Tambah dari Jualan → Leads."}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 8 }}>
          {list.slice(0, limit).map(l => <LeadRow key={l.id} lead={l} now={now} showOwner={showOwner} onOpen={start => onOpen(l.id, start, ids)} />)}
        </div>
      )}
      {list.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)} style={{ marginTop: 14, minHeight: 44, padding: "0 18px", border: "1px solid var(--app-line-strong)", borderRadius: 999, background: "transparent", color: "var(--app-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tampilkan {Math.min(PAGE, list.length - limit)} lagi</button>}
    </>
  );
}
