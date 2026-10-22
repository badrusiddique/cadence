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

## Verdict

- **Overall maturity / analytics depth: AEC**
- **Stability this run / dual surface (CLI·MCP) / theme UX: Cadence**
- Cadence is a real clean-room reverse-engineer, **not** a line-for-line port. Gap is concentrated in Measure/Improve depth (charts, Rules DSL, Context Management, Skill catalog, GitHub App).

## Scoreboard (24 areas)

See canvas table. Headline counts: **AEC 10 · Cadence 10 · tie/split 4**.

## Pages walked

- **AEC (14):** Dashboard, Timeline, Coding Moments, Output, Patterns, Curiosity, Anti-Patterns (+ Rules workflows), Skill Finder, Context Health, Level Up *(error)*, Data Explorer *(error)*, Rule Playground, GitHub App Productivity, Issue credits. Burndown absent (`FF_TOKEN_REPORTING_ENABLED=false`).
- **Cadence (19):** Dashboard, Timeline (+ session detail), Moments, Output, Burndown, Patterns, Curiosity, Flow, Hub, Anti-Patterns, Rule Studio, Signal Lab, Data Explorer, Skill Finder, Context Health, Practice, Achievements, Lifecycle, Share.

## Key misses in Cadence

Output multi-mode Chart.js, Patterns Calendar/Projects, Curiosity charts, Anti-Pattern Rules DSL (coverage/AI generate), Skill community catalog, Context Management treemap, real image gallery, GitHub App SQLite, ~55 RPC methods, 5+ LM tools.

## Key Cadence advantages

Burndown ON, first-class Flow/Hub/Share, Signal Lab, light/dark theme, CLI/MCP/doctor, settings, 0 page errors this run, working session turn drill-down, Practice/Achievements/Lifecycle when AEC Level Up crashed in harness.
