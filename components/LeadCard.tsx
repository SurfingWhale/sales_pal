"use client";

import { longDate } from "@/lib/billing";
import { ink } from "@/components/ui";
import { StandLead, missingOf, nextMove, standOf } from "@/lib/leadStand";
import Icon from "@/components/Icon";

// One lead in a list: where they stand, what's missing, and the one next move.
// LeadCard is the card in Jualan → Leads; LeadRow is the same lead in Hunting,
// in the pattern of a Prospek card (QA-4: same look, a different job).

export interface CardLead extends StandLead {
  category: string; value: number; nextAction?: string; nextActionDate?: string; ownerName?: string;
}

export default function LeadCard({ lead, now, showOwner, onOpen }: {
  lead: CardLead; now: string; showOwner?: boolean;
  onOpen: (start: "chat" | "edit" | null) => void;
}) {
  const stand = standOf(lead, now);
  const missing = missingOf(lead);
  const move = nextMove(lead);
  return (
    <article style={{ display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid var(--app-border)", background: "var(--app-card)", overflow: "hidden" }}>
      <button className="lead-row" aria-label={`Buka lead ${lead.name}`} onClick={() => onOpen(null)}
        style={{ textAlign: "left", width: "100%", padding: "16px 16px 12px", border: 0, background: "transparent", color: "var(--app-text)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, fontFamily: "inherit" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", background: "var(--app-inner)", color: "var(--app-ink-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>{lead.name.replace(/[^A-Za-z0-9À-ÿ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?"}</span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.name}</span>
            <span style={{ fontSize: 13, color: "var(--app-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.category} · {lead.source}{showOwner && lead.ownerName ? ` · 👤 ${lead.ownerName}` : ""}</span>
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: stand.color }} />{stand.word}
        </span>
        {missing.length > 0 && <span style={{ fontSize: 13, color: "var(--app-muted)" }}>Kurang: {missing.join(", ")}</span>}
        {lead.nextActionDate && <span style={{ fontSize: 13, color: lead.nextActionDate < now ? "var(--hot)" : lead.nextActionDate === now ? "var(--warm)" : "var(--app-muted)", display: "flex", alignItems: "center", gap: 6 }}><Icon name="clock" size={14} />{lead.nextAction || "Follow-up"} · {longDate(lead.nextActionDate)}</span>}
      </button>
      <div style={{ marginTop: "auto", padding: "0 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="tabnum" style={{ fontSize: 13, color: "var(--app-ink-2)", fontWeight: 500 }}>{lead.value ? `Rp ${(lead.value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : ""}</span>
        <button onClick={() => onOpen(move.kind === "open" ? null : move.kind)} aria-label={`${move.label}: ${lead.name}`}
          style={{ flexShrink: 0, minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{move.label}</button>
      </div>
    </article>
  );
}

export function LeadRow({ lead, now, showOwner, onOpen }: {
  lead: CardLead & { notes?: string }; now: string; showOwner?: boolean;
  onOpen: (start: "chat" | "edit" | null) => void;
}) {
  const stand = standOf(lead, now);
  const missing = missingOf(lead);
  const move = nextMove(lead);
  const say = lead.nextActionDate ? `${lead.nextAction || "Follow-up"} · ${longDate(lead.nextActionDate)}` : missing.length ? `Kurang: ${missing.join(", ")}` : lead.notes;
  return (
    <div className="sp-pcard" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
      <div className="sp-pcard-top">
        <button className="sp-pcard-main lead-row" aria-label={`Buka lead ${lead.name}`} onClick={() => onOpen(null)}>
          <span className="sp-pini" aria-hidden="true" style={{ background: `color-mix(in srgb, ${stand.color} 14%, var(--app-card))`, color: ink(stand.color) }}>{lead.name.replace(/[^A-Za-z0-9À-ÿ ]/g, "").slice(0, 2).toUpperCase() || "?"}</span>
          <span className="sp-pbody">
            <span className="sp-phead"><span className="sp-pname">{lead.name}</span></span>
            <span className="sp-psub"><span className="sp-pbadge" style={{ color: ink(stand.color) }}>{stand.word}</span>{[lead.category, lead.source, showOwner ? lead.ownerName : ""].filter(Boolean).map(x => ` · ${x}`).join("")}</span>
            {say && <span className="sp-plast">{say}</span>}
          </span>
        </button>
      </div>
      <div style={{ marginTop: "auto", padding: "0 12px 10px", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => onOpen(move.kind === "open" ? null : move.kind)} aria-label={`${move.label}: ${lead.name}`}
          style={{ minHeight: 44, padding: "0 16px", borderRadius: 999, border: "1px solid var(--app-line-strong)", background: "transparent", color: "var(--brand-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{move.label}</button>
      </div>
    </div>
  );
}
