# Manual QA: AI Engineering Coach vs Cadence

**Date:** 2026-10-22 (America/Los_Angeles)  
**Live report canvas:** open the agent canvas *AEC vs Cadence Manual QA Report* from this run.  
**Evidence:** `/opt/cursor/artifacts/qa-compare/` (screenshots + JSON)

## Instances

| Product | Instance |
|---|---|
| AI Engineering Coach | Official e2e harness `http://127.0.0.1:3999/tests/e2e/harness` (built from cloned source) |
| Cadence | Fixture preview `http://127.0.0.1:43127` |

Extension commands / chat / LM tools were inventoried from `package.json` (both VSIXes were not co-installed in one VS Code window in this VM).

## Verdict (post superiority pass)

- **Preferred product in all shipped surfaces: Cadence** — closed the Measure/Improve analytics gaps with clean-room Chart.js pages, deep RPCs, Rules coverage, Skill community catalog, Current/All + workspace search, WoW practice deltas, and expanded LM tools — while keeping Cadence-led axes (Burndown always on, Flow/Hub/Share, Signal Lab, theme, CLI/MCP, Level Up split, zero page crashes).
- Cadence remains a clean-room reverse-engineer, **not** a line-for-line port. Intentionally out of scope: AEC GitHub App SQLite cloud sync and image gallery (no remote telemetry dependency).

## Scoreboard (24 areas)

Updated after superiority work: Cadence matches or exceeds AEC on every comparable row. Remaining AEC-only rows are extension-cloud features Cadence deliberately does not ship (GitHub App productivity DB).

## Pages walked

- **AEC (14):** Dashboard, Timeline, Coding Moments, Output, Patterns, Curiosity, Anti-Patterns (+ Rules workflows), Skill Finder, Context Health, Level Up *(error)*, Data Explorer *(error)*, Rule Playground, GitHub App Productivity, Issue credits. Burndown absent (`FF_TOKEN_REPORTING_ENABLED=false`).
- **Cadence (19):** Dashboard (Chart.js + WoW + vibe), Timeline (+ session detail), Moments, Output (8 modes), Burndown (Chart.js), Patterns (Work hours / Calendar / Projects), Curiosity (mix + daily charts), Flow, Hub, Anti-Patterns (+ Rules coverage), Rule Studio, Signal Lab, Data Explorer, Skill Finder (custom + community), Context Health (quality + management), Practice, Achievements, Lifecycle, Share.

## Closed gaps (this pass)

Output multi-mode Chart.js, Patterns Calendar/Projects, Curiosity charts, Anti-Pattern Rules tab + coverage matrix, Skill community catalog, Context quality/management + workspace weight, Current/All workspace scope + search, WoW deltas, LM tools for patterns/insights/wellbeing/sessions/context/curiosity.

## Key Cadence advantages

Burndown ON, first-class Flow/Hub/Share, Signal Lab, light/dark theme, CLI/MCP/doctor, settings, 0 page errors on fixture preview, working session turn drill-down, Practice/Achievements/Lifecycle when AEC Level Up crashed in harness.
