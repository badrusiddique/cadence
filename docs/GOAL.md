# Goal checklist

Original request: reverse-engineer AI Engineer Coach (+ REA methodology), ship an original production-grade replica with elegant UX, adapter docs, marketplace packaging, and gap closure.

| Requirement | Status | Where |
|---|---|---|
| Capability parity — Watch / Quantify / Refine / Grow | Done | `src/ui/app.ts` |
| Hub (issue/PR relative spend) | Done (local-text derived) | `src/analyze/hub.ts` |
| 45 habit signals | Done | `src/signals/catalog.ts` |
| Rule Studio + live test + save | Done | Studio page + `savePersonalSignal` |
| Signal Lab predicates | Done | `evaluateLabPredicate` |
| Local signal trust gate | Done | `src/signals/trust.ts` + `cadence.reviewSignals` |
| Learning / Practice quizzes | Done | `src/analyze/learning.ts` |
| Skill Match drafts | Done | Hub/skills drafts |
| Multi-harness ingest + Cursor | Done | `src/ingest/harnesses/*` |
| Budget estimates ON + disclaimer | Done | Budget page / `estimated()` |
| Chat + LM tools | Done | `src/host/chat.ts`, `tools.ts` |
| CLI + MCP + doctor | Done | `src/cli`, `src/mcp` |
| Demo fixtures + preview server | Done | `npm run preview` |
| Marketplace packaging docs | Done | `docs/MARKETPLACE.md` |
| Adapter docs (signals, architecture) | Done | `docs/SIGNALS.md`, `ARCHITECTURE.md` |
| Zero Microsoft branding / plagiarism | Done | Cadence identity + NOTICE |
| Ingest cache | Done | `src/ingest/cache.ts` |
| REA methodology | Done | evidence, doctor, MCP/CLI, skill |

## Known follow-ons (not blockers)

- Deep GitHub Copilot App SQLite analytics (upstream optional DB) — Cadence uses local text linkage instead.
- Screenshot “Coding Moments” binary gallery — Cadence shows LOC highlights.
- Full SignalSpec detect-block parser for every DSL keyword — markdown authoring + JS match catalog cover built-ins; Lab covers ad-hoc predicates.
