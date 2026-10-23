# Manual QA: AI Engineering Coach vs Cadence

**Date:** 2026-10-23 (America/Los_Angeles) — dual walk v2 + senior-review hardening  
**Evidence:** `/opt/cursor/artifacts/qa-compare-v2/` (fresh screenshots + JSON); prior pass in `/opt/cursor/artifacts/qa-compare/`

## Instances

| Product | Instance |
|---|---|
| AI Engineering Coach | Official e2e harness `http://127.0.0.1:3999/tests/e2e/harness` (built from cloned source) |
| Cadence | Fixture preview `http://127.0.0.1:43127` |

Extension commands / chat / LM tools were inventoried from `package.json` (both VSIXes were not co-installed in one VS Code window in this VM).

## Verdict (dual walk v2 — honest)

- **Preferred for production local coaching: Cadence** on most comparable surfaces.
- Fresh matrix counts: **Cadence 12 · tie 5 · AEC 3 · split 2** (see `matrix.json` under evidence).
- **Not 100% AEC clone.** AEC still denser on concurrent Timeline swimlane chrome and full Rules DSL/AI-generate. Cadence deliberately does **not** ship GitHub App SQLite or screenshot galleries.
- AEC harness this run: Patterns JS error; Level Up / Data Explorer / GitHub App failed to render. Cadence: **0 page JS errors**.

## Chase / defer (locked 2026-10-23)

| Chase | Defer |
|---|---|
| Date range chips (7d–All) | GitHub App productivity DB |
| Day-grouped Timeline | Screenshot image gallery |
| Lab/Studio predicate + SignalSpec adapt docs | Full DSL compiler + AI rule generate |

Design note: `docs/superpowers/specs/2026-10-23-senior-review-hardening-design.md`.

## Pages walked (v2)

- **AEC (14):** Dashboard, Timeline, Coding Moments, Output, Patterns *(JS error)*, Curiosity, Anti-Patterns (+ Rules), Skill Finder, Context Health, Level Up *(fail)*, Data Explorer *(fail)*, Rule Playground, GitHub App *(fail)*, Issue credits. Burndown gated off.
- **Cadence (19):** Dashboard, Timeline (By day / List + drill-down), Moments, Output (8 modes), Burndown, Patterns (3 tabs), Curiosity, Flow, Hub, Anti-Patterns (+ Rules coverage), Rule Studio, Signal Lab (+ reference), Data Explorer, Skill Finder (custom + community), Context Health, Practice, Achievements, Lifecycle, Share — plus Current/All, workspace search, **date range chips**.

## Why Cadence for senior reviewers

Stable local coaching, burndown on, dual surface (CLI/MCP), clear adapt loop (Lab → Studio → trust), honest scope. Use the matrix JSON for line-item debate — do not claim pixel parity with AEC.
