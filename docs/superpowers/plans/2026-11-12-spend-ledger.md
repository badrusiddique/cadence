# Spend Ledger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use TDD.

**Goal:** Cost Lens–inspired local spend ledger in Cadence with per-harness verification.

**Architecture:** Domain pricing helper → analyzer `getBudget` enrichment → UI Spend page (+ status bar) → ingest billed units where missing → harness matrix spend tests + real-data verify script.

**Tech stack:** Existing TypeScript / Preact / Vitest / VS Code status bar API.

---

### Task 1: Pricing engine + request cost provenance

**Files:**
- Create: `src/domain/pricing.ts`
- Test: `src/domain/pricing.test.ts`
- Modify: `src/domain/types.ts` (optional billed fields on Request)
- Modify: `src/domain/constants.ts` (SKU presets aligned with Copilot AIC)

### Task 2: Analyzer spend ledger

**Files:**
- Modify: `src/analyze/analyzer.ts` (`getBudget` → richer spend payload)
- Test: `src/analyze/analyzer.test.ts`

Payload includes: creditsUsed, usdEstimate, budget, pct, remaining, daily[{date,credits,usd}], byModel, byHarness, byRepo, cacheEconomics, estimatedShare, forecast, disclaimer, provenanceCounts.

### Task 3: Ingest billed / token fields

**Files:**
- Modify: `src/ingest/harnesses/vscode.ts`, `copilot-cli.ts`, `claude.ts`, `codex.ts`, cursor paths as needed
- Tests per harness or extend harness-matrix

### Task 4: UI Spend page + status bar

**Files:**
- Modify: `src/ui/app.ts` (Burndown → Spend)
- Modify: `src/activate.ts` (status bar item)
- package.json contribution if needed

### Task 5: Real-data one-by-one verification

**Files:**
- Extend `/tmp/harness-verify` or `scripts/` verify with spend assertions
- Evidence under `/cursor/stores/self/media/spend-verify/`
- Package + bump version, bundle handoff

---
