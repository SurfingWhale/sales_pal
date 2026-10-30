"use client";

import Icon, { IconName } from "@/components/Icon";
import { longDate } from "@/lib/billing";
import { HistoryItem, historySummary } from "@/lib/leadHistory";

const ICON: Record<HistoryItem["kind"], IconName> = { penawaran: "doc", invoice: "receipt", chat: "chat", dm: "chatLines", balas: "undo" };

// Everything that has happened with this customer (PRD-021). A quote or an
// invoice opens where it lives; the rest is the record.
export default function LeadHistory({ items, onOpen }: { items: HistoryItem[]; onOpen: (item: HistoryItem) => void }) {
  const line = (i: HistoryItem) => (
    <>
      <Icon name={ICON[i.kind]} size={18} stroke={1.8} style={{ flexShrink: 0, color: "var(--app-muted)" }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 500, overflowWrap: "anywhere" }}>{i.title}</span>
        <span className="tabnum" style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--app-muted)" }}>{longDate(i.at)}{i.note ? ` · ${i.note}` : ""}</span>
      </span>
      {i.docId && <Icon name="chevronRight" size={16} style={{ flexShrink: 0, color: "var(--app-muted)" }} />}
    </>
  );
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "10px 16px", color: "var(--app-text)", textAlign: "left" };
  const summary = historySummary(items);
  return (
    <section aria-labelledby="riwayat-h" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "0 4px 8px" }}>
        <h2 id="riwayat-h" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--app-muted)" }}>Riwayat</h2>
        {summary && <span className="tabnum" style={{ fontSize: 12, color: "var(--app-muted)" }}>{summary}</span>}
      </div>
      {items.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, background: "var(--app-card)", border: "1px solid var(--app-border)", borderRadius: 20, overflow: "hidden" }}>
          {items.map((i, n) => (
            <li key={i.id} style={{ borderTop: n ? "1px solid var(--app-border)" : "none" }}>
              {i.docId
                ? <button type="button" onClick={() => onOpen(i)} aria-label={`Buka ${i.title}`} style={{ ...row, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>{line(i)}</button>
                : <div style={row}>{line(i)}</div>}
            </li>
          ))}
        </ul>
      ) : <p style={{ margin: 0, padding: "0 4px", fontSize: 13, color: "var(--app-muted)" }}>Belum ada apa-apa. Chat, penawaran, dan invoice buat lead ini bakal kekumpul di sini.</p>}
    </section>
  );
}
