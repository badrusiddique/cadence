# Design: Senior-review hardening (post dual walk v2)

**Date:** 2026-10-23 (America/Los_Angeles)  
**Audience:** Experienced engineers reviewing Cadence against AEC.

## Evidence

Fresh dual walk: `/opt/cursor/artifacts/qa-compare-v2/`  
Winner counts (honest, post-superiority): **Cadence 12 · tie 5 · AEC 3 · split 2**.

AEC still wins on: Timeline day swimlane, date-range chips, deeper Rules DSL.  
AEC failed this run on: Patterns (JS), Level Up, Data Explorer, GitHub App.

## Decision

### Chase (this pass)

1. **Date range chips** (7d / 28d / 90d / 180d / All) — filter credibility gap seniors notice first.
2. **Day-grouped Timeline** — Observe overview without cloning AEC’s concurrent swimlane.
3. **DSL / Lab reference polish** — in-UI operators + fields + examples; expand `docs/SIGNALS.md`. Not a full AEC DSL compiler or AI-generate.

### Defer (document, do not fake)

| Item | Why defer |
|---|---|
| GitHub App SQLite productivity | Breaks local-only privacy story; empty/error without Copilot App DB |
| Screenshot image gallery | Binary pipeline; LOC moments already teach |
| Full DSL compiler + AI rule generate | Large surface; SignalSpec + Lab cover adapt loop for v0.1 |

## Product bar for reviewers

Cadence must read as a **production local coaching tool**, not an AEC skim:

- Clear problem: make agentic practice measurable and improvable offline.
- Easy adapt path: Studio → Lab → personal SignalSpec → trust gate.
- Honest scope: no fake cloud GitHub App parity.
- Stable: zero page crashes on fixture preview.
