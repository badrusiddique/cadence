# Cadence Spend Ledger — Design

**Status:** Approved for build (user: Cost Lens–inspired spend + one-by-one real-data verify)  
**Inspiration:** [JirakJ/copilot-cost-lens](https://github.com/JirakJ/copilot-cost-lens) (MIT) — UX/algorithm ideas; reimplemented in Cadence, not copied wholesale.

## Goal

Show local **subscription-shaped spend**: credits + USD by harness/repo/model/day, with honest provenance (`exact` | `token-priced` | `estimated`). Not a replacement for provider invoices.

## Pricing precedence (per request)

1. **Billed units** when logs expose them (Copilot AIC nano-units, premium requests) → credits + USD ($0.01/credit or $0.04/premium).
2. Else **exact tokens × model rate** (input/output/cache read/write).
3. Else **estimated** from model multiplier / content heuristics — mark `~est`.

## Surfaces (v1)

- Upgrade **Burndown** → Spend ledger: USD, credits, allowance %, by harness, by model, by repo, daily USD, cache economics (saved vs write cost).
- Optional **status bar** month-to-date credits · $ with disclaimer tooltip.
- Keep global disclaimer: local estimates / analytical aid; provider bill is source of truth.

## Ingest gaps to close

- Copilot Chat: parse `transcripts` / `debug-logs` billed units when present (in addition to chatSessions).
- Copilot CLI / Claude / Codex: preserve billed or token fields already partially present.
- Cursor: token-price or estimate; label provenance.
- Repo attribution: workspace folder / git remote slug from existing session metadata when available.

## Verification gate

Isolated HOME per harness with real prompt marker; combined ingest; VSIX UI shows Spend with non-zero / correctly labeled harness rows. Do not claim done until all supported harnesses pass.
