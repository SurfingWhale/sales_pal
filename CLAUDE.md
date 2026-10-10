# SalesPal — working notes

SalesPal is where every site's leads land. The contract for that — the
`inbound_leads` shape, `firestore.rules`, the import into Leads — is the leads
standard in the private `SurfingWhale/creative-hub` repository
(`standards/leads.md`, `sites/salespal.md`). Change the standard there first,
then here.

- **`firestore.rules` is deployed as a whole and replaces what is live.** Every
  collection the app reads or writes must stay covered. Today that is
  `users/{uid}/{leads,outreach,rejections,pitchTemplates,hunts,prospects,huntSessions,campaigns,costs,radarSeen,services,quotes,invoices,settings,moved}`
  (prospects/huntSessions/campaigns/costs: Hunting journeys, PRD-009; moved: rows brought into a guild, PRD-007 §2.7),
  `users/{uid}/clients/{c}/{deals,posts,reports}` (Report Klien, PRD-005)
  `users/{uid}/guilds`, `guilds/{g}` with `{members,invites,deals,targets,reports,activities}`
  plus the guild workspace (PRD-007 §2.5, `lib/space.ts`): owned
  `{leads,outreach,rejections,hunts,prospects,huntSessions,quotes,invoices,clients/{c}/{deals,posts,reports}}`
  and the shared catalogs `{services,pitchTemplates,settings,campaigns,costs}`
  (Guild, PRD-007 — role rules live in firestore.rules and are tested per role)
  plus `inbound_leads`, and the server-only `connections` (token vault),
  `usage` (quotas) and `pushSubs` (Web Push subscriptions), which deny every browser and are reached only through
  `lib/serverAuth.ts`.
  Run `tests/firestore.rules.test.mjs` (see its header) before
  `firebase deploy --only firestore:rules --project sales-pal`.
- This repository is public: the rules hold the owner's sign-in email and no
  other personal detail. Keep it that way.
- **Before a PR, run `npm run test:flows`** (and `DESKTOP=1 npm run test:flows`).
  It clicks through every flow against the Firebase emulators and writes
  `tests/flows/out/report.md` with the failing step and a screenshot. Needs
  Java (`brew install openjdk@21`). A new feature gets a flow in
  `tests/flows/flows.mjs`.
