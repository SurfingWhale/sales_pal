# Conversation lifecycle

How one sales conversation moves, and where SalesPal reads each step from. The funnel's stages are in [ROADMAP §3 PRD-021](../prd/ROADMAP.md). Today's positions and their sources are in `lib/leadStand.ts`.

| Step | What happened | Read from | Next move |
|---|---|---|---|
| Baru | Lead exists, no contact | no `contactedAt`, reply, Outreach row, hunt, or quote | Kirim intro |
| Dikontak | A message was confirmed sent | `contactedAt`, Outreach row, hunt | Follow-up on schedule |
| Merespons | They replied | `lastReplyAt`; `ourTurn` says whose turn it is | Balas when it's our turn |
| Terkualifikasi | A real need is known | rule in PRD-021 Fase 2 | Gali kebutuhan → penawaran |
| Penawaran | A live quote is out | quotes `sent` / `viewed` | Follow-up the offer |
| Negosiasi | The offer is being revised | rule in PRD-021 Fase 2 | Revise or close |
| Menang | Offer accepted / Closed | quote accepted, status Closed | Invoice DP |
| Lunas | Fully paid | invoices fully paid | ETB / repeat |
| Gugur | Lost, with a reason | status Lost + rejection reason | Retry date, if any |

Rules:
- An imported or stamped date is not a contact.
- Menang is not Lunas.
- A stage is read from data the app already has. A stage with no data behind it isn't shown as if it were known.
- Scripts are chosen by this step (`leadStage`, PRD-024), and Otak Pesan reads it (PRD-025).
