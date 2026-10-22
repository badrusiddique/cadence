# Cadence Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship a production-grade VS Code extension (Cadence) with full capability parity to AI Engineer Coach’s feature surface, original code/UI/docs, marketplace packaging, and gap closures (tokens on, Cursor harness, preview server, publish docs).

**Architecture:** Bounded contexts under `src/ingest`, `src/analyze`, `src/signals`, `src/host`, `src/ui`, plus `src/preview` fixture dashboard. esbuild bundles extension host + webview + workers.

**Tech Stack:** TypeScript strict, VS Code Extension API, Preact+htm, Chart.js, Zod, Vitest, esbuild, @vscode/vsce.

## Global Constraints

- No Microsoft copyright headers, trademarks, icons, or verbatim source.
- Publisher `badrusiddique`; package `cadence-insights`; commands `cadence.*`.
- Config dirs `~/.cadence/` and `.cadence/`.
- Privacy: read-only logs, local-only analysis, no telemetry.
- Token/budget features enabled but labeled as estimates.
- Prefer focused files; one responsibility per module.

---

### Task 1: Scaffold extension + tooling

- [ ] Create `package.json`, `tsconfig.json`, `esbuild.mjs`, `vitest.config.mts`, `eslint`, `.vscodeignore`, `.gitignore`, LICENSE, NOTICE, README
- [ ] `npm install` and verify `npm run typecheck` on empty activate stub
- [ ] Commit

### Task 2: Domain types + fixtures

- [ ] Define Session/Request/Workspace types + Zod schemas
- [ ] Synthetic fixture generator for preview + tests
- [ ] Commit

### Task 3: Ingest layer

- [ ] Discover helpers for VS Code, Claude, Codex, OpenCode, Xcode, Cursor
- [ ] Parsers normalizing into Session[]
- [ ] Parse worker + cache
- [ ] Tests with temp dirs
- [ ] Commit

### Task 4: Analyze facade

- [ ] Implement overview, timeline, throughput, budget, rhythm, inquiry, habits, context, achievements, sdlc, share, github-hub analyzers
- [ ] Unit tests on fixtures
- [ ] Commit

### Task 5: SignalSpec engine + 45 rules

- [ ] Parser + evaluator for SignalSpec
- [ ] Trust gate for personal/project layers
- [ ] Port all 45 habit intents with original copy/IDs under Cadence naming
- [ ] Inline tests wired into vitest
- [ ] Commit

### Task 6: UI shell + pages

- [ ] Cadence theme CSS + shell (Watch/Quantify/Refine/Grow)
- [ ] All pages wired to RPC client; empty/loading/error states
- [ ] Motion + a11y
- [ ] Commit

### Task 7: Extension host surfaces

- [ ] activate commands, webview panel, chat participant, LM tools, export, trust review
- [ ] Commit

### Task 8: Preview server + docs + marketplace

- [ ] `npm run preview` on uncommon port with fixtures
- [ ] User/contributor docs (install, signals, publish)
- [ ] Package `.vsix`; verify
- [ ] Push remote; document GitHub `badrusiddique/cadence` target
