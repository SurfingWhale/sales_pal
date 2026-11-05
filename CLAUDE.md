# SalesPal — working notes

## How to work here

Every feature or UI change follows [docs/product/protocol.md](docs/product/protocol.md):
understand → investigate → challenge → design the states → implement → verify
with evidence → update the docs. Read before changing:

- [docs/product/product-context.md](docs/product/product-context.md): who uses SalesPal, where, and on what budget.
- [docs/product/interaction-model.md](docs/product/interaction-model.md): rules that hold everywhere (one primary action, layers, WhatsApp confirm, separate concepts, data honesty).
- [docs/product/conversation-lifecycle.md](docs/product/conversation-lifecycle.md): funnel steps and where each is read from.
- [docs/product/feature-specs/](docs/product/feature-specs/): states and decisions per feature. Update the spec you touch.
- [docs/prd/ROADMAP.md](docs/prd/ROADMAP.md): priorities. It beats PRD numbering.
- [docs/standards/design.md](docs/standards/design.md) and [native.md](docs/standards/native.md): visual and native quality bars.

Done means the rubric in the protocol is met with evidence (screenshots at 390,
375 and 1440, flow steps, tap counts), not that it compiles.

SalesPal is where every site's leads land. The contract for that — the
`inbound_leads` shape, `firestore.rules`, the import into Leads — is the leads
standard in the private `SurfingWhale/creative-hub` repository
(`standards/leads.md`, `sites/salespal.md`). Change the standard there first,
then here.

- **`firestore.rules` is deployed as a whole and replaces what is live.** Every
  collection the app reads or writes must stay covered. Today that is
  `users/{uid}/{leads,outreach,rejections,pitchTemplates,hunts,prospects,huntSessions,campaigns,costs,radarSeen,services,components,quoteTemplates,pricelistHistory,quotes,invoices,settings,moved,analyses}`
  (prospects/huntSessions/campaigns/costs: Hunting journeys, PRD-009; moved: rows brought into a guild, PRD-007 §2.7;
  analyses: Script Intelligence history, PRD-023;
  components: what a price is built from, with its cost; quoteTemplates: quotes to start from; pricelistHistory: every price change, PRD-017),
  `users/{uid}/clients/{c}/{deals,posts,reports}` (Report Klien, PRD-005)
  `users/{uid}/guilds`, `guilds/{g}` with `{members,invites,deals,targets,reports,activities}`
  plus the guild workspace (PRD-007 §2.5, `lib/space.ts`): owned
  `{leads,outreach,rejections,hunts,prospects,huntSessions,quotes,invoices,clients/{c}/{deals,posts,reports}}`,
  the seller-only `analyses` (PRD-023: not even Leader/Officer read it; 90 days at most),
  and the shared catalogs `{services,components,quoteTemplates,pricelistHistory,pitchTemplates,settings,campaigns,costs}`
  (Guild, PRD-007 — role rules live in firestore.rules and are tested per role)
  plus `inbound_leads`, and the server-only `connections` (token vault),
  `usage` (quotas), `pushSubs` (Web Push subscriptions), the MCP server's
  `mcpDrafts`, `mcpApprovals`, `mcpRuns`, `mcpAudit`, `discordLinks` and `linkCodes`, and `config`,
  `accessRequests`, `accessAdmins` (the invite-only switch, applications and
  the admins who approve them, PRD-015), which deny every browser and are reached only through
  `lib/serverAuth.ts` / `lib/access.ts`.
  Merging a change to `main` deploys it: `.github/workflows/firestore-rules.yml`
  runs `tests/firestore.rules.test.mjs` on the emulator, then
  `firebase deploy --only firestore:rules --project sales-pal` with the
  `FIREBASE_SERVICE_ACCOUNT` secret (skipped while the secret is unset).
- This repository is public: the rules hold the owner's sign-in email and no
  other personal detail. Keep it that way.
- **Before a PR, run `npm run test:flows`** (and `DESKTOP=1 npm run test:flows`).
  It clicks through every flow against the Firebase emulators and writes
  `tests/flows/out/report.md` with the failing step and a screenshot. Needs
  Java (`brew install openjdk@21`). A new feature gets a flow in
  `tests/flows/flows.mjs`.
- **UI changes follow `docs/standards/native.md`** (PRD-010): 44pt touch
  targets, 16px fields, no browser print/alert/confirm/prompt, a way out of
  every dialog, AA contrast via the text tokens, restrained motion, neutral
  sample data. The flow runner audits every step; a finding fails the run, and
  the `native` workflow (WebKit iPhone 12 + Safari) must be green before merge.
