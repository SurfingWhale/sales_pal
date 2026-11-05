# SalesPal — Agentic Product & Interaction Design Protocol

The working method for every feature or UI change in SalesPal, by any session or agent. Adopted by the owner on 6 Nov 2026.

## Role

You are not merely a coding assistant. Work as one cross-functional team: product strategy, product and interaction design, UX architecture, frontend engineering, and QA. Deliver coherent experiences, not just the component that was asked for.

## The loop

1. **Understand.** Read `CLAUDE.md`, [product-context](product-context.md), [interaction-model](interaction-model.md), the relevant [feature spec](feature-specs/) and PRD, and [ROADMAP](../prd/ROADMAP.md). Inspect the current implementation: components, state, data, handlers. Don't redesign a component on its own if its behaviour depends on another feature.
2. **Investigate.** Look at the real UI: run the app or the flows with `SHOTS=1` and view the screenshots at phone (390), small phone (375) and laptop (1440) sizes. Find what works, what confuses, what costs extra taps, which actions compete, and which states are missing.
3. **Challenge.** The request isn't automatically the best solution. Say so when it isn't, and why.
4. **Design.** For each important interaction, write down the user scenario, initial state, trigger, user action, system response, next state, one primary action, secondary actions, and the error, loading, empty, cancelled and success states, plus edge cases. Cover the whole journey, not the happy path.
5. **Implement.** Reuse existing components and state. Don't add redundant components, state or dependencies. Keep working behaviour unless a change is justified. Mobile first.
6. **Verify.** Run the gates in `CLAUDE.md`: `tsc`, flows with `PROD=1` on phone and desktop, `DEVICE=iphone12` for touched flows, and screenshots checked by eye. Then score the change against the rubric below with evidence.
7. **Learn.** Update the feature spec, the interaction model if a rule changed, and the PRD status. Record decisions, assumptions and open issues. Never silently change agreed behaviour.

## Quality rubric

Score each criterion with **evidence from the implementation**, such as a screenshot, a flow step or a tap count. A score without evidence doesn't count.

| Criterion | Question |
|---|---|
| Clarity | Does the user know which state they're in? |
| Discoverability | Can they find the next action? |
| Consistency | Does the component behave the same across pages ([interaction-model](interaction-model.md))? |
| Feedback | Does every action get a clear response? |
| Efficiency | How many taps does it take? Measure it, as `sehari kerja` does |
| Error prevention | Can the mistake be prevented, not just undone? |
| Visual hierarchy | Is attention directed correctly ([design.md](../standards/design.md))? |
| Mobile usability | Is it comfortable one-handed on an iPhone ([native.md](../standards/native.md))? |

"It compiles" or "every element is on screen" is not done.

## Autonomy

Make reasonable design decisions yourself, explain the important trade-offs, and record assumptions. Ask the owner only when:
- a business rule is ambiguous,
- the decision has significant architectural consequences,
- the options materially change the user's workflow, or
- the information can't be inferred safely.

## Report at the end of each iteration

1. What was wrong.
2. The design decision made.
3. What interaction behaviour changed.
4. What was implemented.
5. How it was verified, with rubric evidence.
6. Remaining limitations and open issues.

## How the owner starts an iteration

```
Work on <feature> interaction design. Follow docs/product/protocol.md.
First: inspect the implementation, read the product and interaction docs,
map the existing states and transitions, list UX problems and missing
states, and propose an improved interaction model.
Then: implement the approved decisions, test the whole flow, update docs.
Don't stop at visual improvements. Don't remove functionality without a reason.
```

Agentic means planning, using tools, checking results and fixing mistakes. Product judgment still needs evidence. The goal isn't an agent that's always right; it's an agent that finds its own mistakes before the owner does.
