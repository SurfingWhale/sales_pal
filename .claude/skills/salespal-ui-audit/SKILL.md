---
name: salespal-ui-audit
description: Audit and redesign a SalesPal screen as a senior product designer, mobile-first for iPhone Safari PWA, then desktop. Use when a screen feels generic, card-heavy, "AI-made", cramped, or not native; when asked for a UI/UX audit, a design system pass, or a redesign of a section (e.g. Script pesan); before a PR that restructures a screen. Triggers on audit UI, UX audit, redesign, "kayak template AI", "terlalu banyak kotak", native, hierarchy, design system, bottom sheet, mobile-first.
---

# SalesPal UI/UX audit & redesign

A redesign is not a recolor. Changing color, radius, shadow or type alone is not a fix. Every change must answer **what the person is trying to do on this screen, and in what order**.

The rules already exist; this skill applies them:
- `docs/standards/design.md`: hierarchy, when a box is allowed, tokens `--fs-*` `--sp-*` `--r-*`, hairline rows.
- `docs/standards/native.md` (PRD-010): 44pt targets, 16px fields, no browser dialogs, a way out of every dialog, AA contrast through text tokens, restrained motion, neutral sample data.

Where those two disagree with taste, they win.

## Knowledge vs execution

The judgment lives in the owner's Knowledge Inbox (Notion → *Knowledge Inbox DA&Code* → "UI Interaction Design — Native Feel & Interaction Quality"): what good interaction is. This skill is the execution: how to apply it to a SalesPal screen now. Use that knowledge as the UX constraint; don't paste it into prompts or docs.

**First pass for every screen or component: interaction review, not redesign.** Identify and write down:
- the current user context, and what the person is trying to do there;
- the current UI state of the object (and which states exist: loading, empty, error, success, and the domain states);
- the primary action, and the secondary actions;
- the feedback available after each action;
- the interaction pattern in use (inline action, popover, sheet, modal, navigation) and whether it fits that context.

Then improve the interaction hierarchy and state visibility. Priority: interaction quality → state visibility → action hierarchy → contextual interaction → mobile usability → visual polish.
Don't add components, buttons, modals or animation unless they solve a named interaction problem. Keep the information architecture and business logic unless a UX reason requires the change. The target is natural, predictable, contextual, mobile-friendly interaction, not a prettier UI.

## The interaction model

SalesPal's behaviour is modelled in `docs/interaction/`: A (information architecture), B (flows), C (state models), D (interaction contracts), E (screen behaviour), F (component behaviour), `ambiguities.md` (decisions the owner makes), and `review.md`. Read the relevant parts before changing a screen. Every UI change updates them in the same PR. A behaviour that isn't decided yet goes into `ambiguities.md` as AMBIGUITY / WHY IT MATTERS / RECOMMENDED DECISION / IMPACT. Don't build it on a guess.

## 0. Before touching code

1. **Read the screen's components** and list each piece of data and every action, including CRUD, filters, search and navigation. Note where each action lives, how many taps it takes, and which Firestore calls it makes.
2. **Read the data model:** the collection, its fields, and readers like `stageOf` / `brandOf` that interpret old docs. Nothing may break existing documents.
3. **Screenshot "before"** at **390×844, 375×667 and 1440×900**, with realistic neutral data seeded through `seedDocs` in a flow. Record `scrollWidth` vs `clientWidth` at each size.

## 1. Audit

Check every item and give each finding *why it hurts*, tied to a task:

- **Containers:** a box per list row, a box inside a box, or a border where spacing alone would group. design.md §2 allows boxes only for a whole tappable object, a movable or closable object, or content with a different context.
- **Hierarchy:** one most-important thing per screen; ≤ 3 type sizes per section; only token sizes; reading order follows size order.
- **Actions:**
  - repeated buttons on every row;
  - primary vs secondary actions that look alike;
  - destructive actions sitting next to common ones;
  - actions behind a disclosure that expands in place and shifts the layout.
- **Density:** how many items fit on one phone screen, and whether the important text is visible without opening anything.
- **Spacing:** values outside `--sp-*`, and gaps between related groups equal to gaps between unrelated ones.
- **Labels:** ambiguous words ("Lainnya", "Semua"), a meaning that depends on position, icons without text.
- **States:**
  - loading: no flash of "empty" while data loads;
  - empty: say what it is for and offer one action;
  - no results: name the filter and offer a way to clear it;
  - error: say what to do;
  - success: confirm, with undo for reversible destructive actions.
- **Mobile patterns:**
  - a contextual menu means an action sheet, not inline chips;
  - filters go in a sheet when they would take more than one row;
  - Back steps back one level;
  - safe areas;
  - the keyboard must not hide the primary action;
  - nothing on open grabs focus in a way that pops a picker.
- **Desktop:** uses the width with intent (master–detail or columns), not a stretched phone, and works with keyboard and hover.
- **Domain meaning:** if the data has a structure (the sales lifecycle Intro → Follow-up → Gali → Penawaran → Closing → ETB), the UI shows it. A row of equal chips does not.

## 2. Design decisions

Give a short rationale per decision.

- **Tokens:** extend `globals.css`; never add a parallel system. When a needed token is missing (e.g. a state layer or focus ring), add it once with light and dark values.
- **Lists are rows**, separated by hairlines. The whole row is the tap target for the main action. Secondary actions go in a trailing **⋯** button that opens an action sheet (`components/Sheet`). Destructive actions go last, in red, behind `useConfirm`.
- **Show sequence as sequence:** a stepper or timeline with connectors, plus the "when to use" sentence for the selected step.
- **Filters:** search stays inline. Other filters go behind one "Filter" control with an active count, and active filters show as removable chips.
- **Desktop ≥ 1024:** a side rail plus master–detail where editing is frequent. Keep it one scroll per pane.

## 3. Plan, then build

- Write the **information architecture**, the **component tree**, and the **interaction table** (gesture or key → result, including Back, Escape and ✕) before coding.
- Keep every existing operation working, and keep flow selectors stable or update the flows in the same change.
- No new dependencies.

## 4. Validate (only claim what ran)

- **Flow:** add or update a flow in `tests/flows/flows.mjs` that:
  - seeds data and walks every action (create, edit, duplicate, default, archive, restore, delete);
  - uses `page.setViewportSize` for 390×844, 375×667 and 1440×900, and asserts `scrollWidth <= clientWidth` at each;
  - checks that no actionable element sits outside the viewport;
  - drives the screen with the keyboard (Tab, Enter, Escape) as well as taps.
- **Audit:** the runner's HIG audit must report 0 findings.
- **Suites:** `npm run test:flows` and `DESKTOP=1`. CI runs WebKit (iPhone 12, Safari).
- **Look at the screenshots yourself** before and after. Report each check as passed, failed, or not run.

Write the audit and its results to `docs/qa-reviews/<date>-<screen>-ux.md`.
