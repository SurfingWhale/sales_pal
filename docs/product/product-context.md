# Product context

- **What:** SalesPal, a lightweight sales system for a small photography business (Visufavor, UNTMD Sports, BeUntamed), from finding a prospect to money received. Direction and priorities: [ROADMAP](../prd/ROADMAP.md).
- **Who:** one owner selling on their own between shoots. Guild members (a small team) use the same app with roles (PRD-007).
- **Where:** iPhone Safari, installed as a PWA, first. A laptop sometimes. The UI is in Indonesian. Words used in the UI, PRDs and code: [GLOSSARY](../../GLOSSARY.md).
- **How selling happens:** manually, over WhatsApp (and DMs on Threads/Instagram). SalesPal prepares the message and records what the seller confirms. It never sends anything itself.
- **Budget:** Rp 0 for now. No paid service is built or switched on. Anything metered has a hard cap (Places 900 per month, address lookup 100 per day per account).
- **Stack:** Next.js 14 App Router, Firebase Auth and Firestore (`lib/space.ts` for personal and guild spaces), Vercel. Public repo: no personal data.
- **What a good change feels like:** intentional, light, fast, native. More cards, buttons, badges, borders or modals is not more usable ([design.md](../standards/design.md), "slop").
