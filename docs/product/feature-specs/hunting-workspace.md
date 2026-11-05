# Hunting workspace

- **Code:** `components/Hunting.tsx`, `components/ActivityIsland.tsx`, `components/HuntLeads.tsx`, `components/LeadCard.tsx` (`LeadRow`).
- **PRD:** 022 §4 and Fase 4–5. **Flows:** `hunting workspace`, `sehari kerja`, `hunting: paste`, `rekap jujur`.

## Purpose

One place to run the selling day: who's waiting, who's due, who's new, and the next message.

## States

- **Island:** the week strip, the three numbers (Outreach against the target, Perlu dibales, Follow-up), and the heat map (beside it on a laptop, behind the chevron on a phone, with the job calendar). Tapping a day shows what was recorded and what's planned. Tapping a day again closes it.
- **Tabs:** Prospek (default), Leads, Performa. Leads is drawn on open.
- **Search (Prospek):** reads prospects and leads. Name matches come first. Enter on one known lead opens it. Several matches stay listed. "Kirim ke …" still makes a new target.

## Primary action per context

- Prospek list: the card's journey action.
- Leads tab: the card's next move.
- Composer: Copy or Kirim, then Udah.

## Decisions

- The heat map counts outreach and offers, not notes or schedules (QA-4).
- A run started from the Leads tab follows that list.
- Daily target defaults to 12.

## Open

- Prospek's view selector is still a dropdown (fit for drill-down filter chips, ROADMAP P1).
