# Goal checklist

Original request: reverse-engineer AI Engineer Coach (+ REA methodology), ship an original production-grade replica with elegant UX, adapter docs, marketplace packaging, and gap closure.

## Source analysis status

| Source | Pulled | Analyzed | Replicated |
|---|---|---|---|
| `microsoft/AI-Engineering-Coach` (~75k LOC TS) | Yes (`/tmp/source-analysis/ai-engineering-coach`) | Yes — pages, RPC map, ingest, rules, flow | **Clean-room rewrite**, not a line-for-line port |
| `morluto/rea` | Yes (`/tmp/source-analysis/rea`) | Yes — evidence / doctor / MCP patterns | Methodology ported into Cadence |

Cadence is intentionally original (~6–8k LOC). Capability surface tracks AEC’s Observe / Measure / Improve / Level Up IA. Deep optional paths (Copilot App SQLite, screenshot galleries, full DSL compiler, LLM quiz generation) are gap-filled with local equivalents.

## Capability map

| Requirement | Status | Where |
|---|---|---|
| Observe — Dashboard / Timeline / Moments | Done | `src/ui/app.ts` + analyzer |
| Measure — Output / Burndown / Patterns / Curiosity / Flow / Hub | Done | `deep.ts` + Chart.js pages |
| Improve — Anti-Patterns / Studio / Lab / Explorer / Skills / Context | Done | signals + Rules coverage + community skills |
| Level Up — Practice / Achievements / Lifecycle / Share | Done | learning + export |
| Output multi-mode charts | Done | `getCodeProduction` + Output seg modes |
| Patterns Calendar / Projects | Done | `getPatternsDeep` tabs |
| Curiosity channel charts | Done | `getCuriosityDeep` |
| Context quality + management | Done | `getContextDeep` |
| Skill community catalog | Done | `COMMUNITY_CATALOG` offline |
| Current / All + workspace search | Done | rail filters |
| Practice WoW + vibe role | Done | `withWow` / `getVibeRole` |
| Expanded LM tools | Done | patterns/insights/wellbeing/sessions/context/curiosity |
| AEC superiority (comparable surfaces) | Done | see `docs/QA-AEC-VS-CADENCE.md` |
| Date range chips | Done | rail `7d…All` anchored to latest activity |
| Day-grouped Timeline | Done | `getTimelineByDay` + By day / List |
| Lab predicate reference | Done | `getLabReference` + SIGNALS.md adapt loop |
| Honest dual-walk matrix v2 | Done | `docs/qa-matrix-v2.json` |
| Lab without Function/eval | Done | `src/analyze/predicate.ts` |
| Save vs Approve trust split | Done | Rule Studio + `approvePersonalSignal` |
| Adoption-ready docs | Done | README + `docs/GETTING_STARTED.md` |
| Session detail drill-down | Done | `getSessionDetail` |
| Harness comparison | Done | `getHarnessComparison` |
| Flow scoring | Done | `src/analyze/flow.ts` |
| 45 habit signals | Done | `src/signals/catalog.ts` |
| Rule Studio + live test + save | Done | Studio page + `savePersonalSignal` |
| Signal Lab predicates | Done | `evaluateLabPredicate` |
| Local signal trust gate | Done | `src/signals/trust.ts` |
| Multi-harness ingest + Cursor | Done | `src/ingest/harnesses/*` |
| Sidebar Open Overview + Sync | Done | `src/activate.ts` CadenceSidebarProvider |
| Panel refresh after reload | Done | `cadence-refresh` host message |
| Light / dark theme | Done | `theme.css` + toggle |
| Chat + LM tools | Done | `src/host/chat.ts`, `tools.ts` |
| CLI + MCP + doctor | Done | `src/cli`, `src/mcp` |
| Demo fixtures + preview server | Done | `npm run preview` |
| Marketplace packaging docs | Done | `docs/MARKETPLACE.md` |
| Zero Microsoft branding / plagiarism | Done | Cadence identity + NOTICE |

## Known intentional gaps (not silent stubs)

- Deep GitHub Copilot App SQLite analytics — Cadence uses local text linkage (`getHub`).
- Screenshot “Coding Moments” binary gallery — Cadence surfaces LOC highlights.
- Full SignalSpec detect-block DSL compiler for every AEC keyword — built-in JS match catalog + Lab predicates cover the authoring loop.
- LLM-generated learning quizzes / catalog install from awesome-copilot — Practice pack is local/heuristic; Skill Finder ships an offline community catalog with prompt matches.
- AEC GitHub App cloud productivity DB — intentionally local-only via Hub text linkage.
