# SalesPal — working notes

SalesPal is where every site's leads land. The contract for that — the
`inbound_leads` shape, `firestore.rules`, the import into Leads — is the leads
standard in the private `SurfingWhale/creative-hub` repository
(`standards/leads.md`, `sites/salespal.md`). Change the standard there first,
then here.

- **`firestore.rules` is deployed as a whole and replaces what is live.** Every
  collection the app reads or writes must stay covered. Today that is
  `users/{uid}/{leads,outreach,rejections,pitchTemplates,hunts,radarSeen,services,quotes,invoices,settings}`
  plus `inbound_leads`.
  Run `tests/firestore.rules.test.mjs` (see its header) before
  `firebase deploy --only firestore:rules --project sales-pal`.
- This repository is public: the rules hold the owner's sign-in email and no
  other personal detail. Keep it that way.
- **Before a PR, run `npm run test:flows`** (and `DESKTOP=1 npm run test:flows`).
  It clicks through every flow against the Firebase emulators and writes
  `tests/flows/out/report.md` with the failing step and a screenshot. Needs
  Java (`brew install openjdk@21`). A new feature gets a flow in
  `tests/flows/flows.mjs`.
