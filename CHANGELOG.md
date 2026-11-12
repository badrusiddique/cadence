# Changelog

## 1.3.0 (2026-11-12)

Cost Lens–inspired local **Spend** ledger (not a subscription invoice).

- Pricing precedence: billed AI credits / premium requests → tokens×rate → `~est` model multiplier
- Spend page: USD + credits, allowance, EOM forecast, by harness / repo / model, cache economics, provenance
- Status bar month-to-date `credits · $` (`cadence.spendStatusBar`)
- Ingest: Copilot Chat billed credits, Copilot CLI shutdown nano/token metrics, Codex `token_count`, safer OpenCode timestamps
- Verified one-by-one with real prompt data across Copilot, Cursor, Claude, Codex, Copilot CLI, OpenCode

## 1.2.9 (2026-11-12)

Lock harness matrix: isolated real-prompt ingest tests for Copilot Chat, Cursor transcripts, Composer DB, Claude Code, Codex CLI, Copilot CLI, and OpenCode.


## 1.2.8 (2026-11-12)

Stop Composer merge from collapsing Copilot/jsonl sessions that share a sessionId.

- Keep non-`cursor-db:` sessions intact when merging Composer DB rows
- Verified against real project transcript replayed into Copilot `.jsonl` + Cursor transcripts (demoMode off)


## 1.2.7 (2026-11-12)

Load real VS Code / GitHub Copilot Chat sessions from modern `.jsonl` append logs.

- Accept `.json` and `.jsonl` under `workspaceStorage/<hash>/chatSessions/` (VS Code ≥1.109)
- Rebuild append-log sessions (`kind:0` base + `kind:2` `requests` patches)
- Also ingest `GitHub.copilot-chat/transcripts/*.jsonl`, `emptyWindowChatSessions`, and `transferredChatSessions`
- Discover host User dir from extension `globalStorageUri` (portable / `--user-data-dir`)
- Doctor reports chatSessions `.json` / `.jsonl` file counts

## 1.2.6 (2026-11-12)

Skip non-Cursor `state.vscdb` files that lack `cursorDiskKV` instead of aborting the whole Composer ingest batch.

- Fixes empty dashboard when Cadence runs in VS Code (or any host whose User DB is probed alongside Cursor’s)
- Regression: VS Code-like DB + Cursor DB together still yield Composer sessions

## 1.2.5 (2026-11-12)

Discover the live Cursor User dir from the extension host and surface Composer DB diagnostics.

- Derive User from `context.globalStorageUri` (`…/User/globalStorage/<extId>` → parent.parent) so portable/`--user-data-dir` installs work
- Probe `state.vscdb` paths (exists, composer/bubble rows, sessionsParsed); log probe to Output; show version + probe on empty UI
- Reload toast: success when sessions load, warning with Show Output when 0 sessions
- Retry `state.vscdb` snapshot copy 3× (Windows lock)

## 1.2.4 (2026-11-12)

Fix Cursor Local Agent ingest when `cursorDiskKV.value` is BLOB.

- Decode Buffer/Uint8Array/ArrayBuffer KV values as UTF-8 JSON before parse (String(blob) was garbage)
- Fall back to `meta.conversation` when `fullConversationHeadersOnly` is absent
- Clearer empty-state + doctor hints for desktop Composer `state.vscdb` vs Cloud Agent chats

## 1.2.3 (2026-11-12)

Read real Cursor Local Agent chats from Composer `state.vscdb`.

- Primary source is `%APPDATA%/Cursor/User/globalStorage/state.vscdb` (composerData + bubbleId rows)
- Verified against a real SQLite fixture before release (not JSONL-only unit mocks)
- sql.js fallback when `node:sqlite` is unavailable; wasm shipped in `dist/`

## 1.2.2 (2026-11-12)

Cursor local Agent transcripts actually parse again.

- Read modern `agent-transcripts/<uuid>/<uuid>.jsonl` rows with `message.content` text/tool blocks
- Prefer transcript folders over scanning the whole project dump
- Regression test for nested Cursor JSONL layout

## 1.2.1 (2026-11-12)

Empty install no longer looks like fake workspaces.

- Removed silent demo fixtures when no local logs are found (Demo Mode stays opt-in)
- Ignore/clear cached fixture payloads so old demos do not stick after Demo Mode is off
- Empty dashboard shows a clear empty state instead of perfect scores / vibe titles

## 1.2.0 (2026-11-12)

Marketplace launch polish.

- Humanize README, getting started, and Marketplace docs (less filler, no em-dash spam)
- Clearer extension display name and description
- UI copy cleanup on empty states and page subtitles
- Leaner VSIX (drop maintainer-only docs and CI from the package)

## 1.1.0 (2026-11-09)

Enterprise hardening.

- RPC allowlist + strict param sanitization (`src/host/rpc-guard.ts`)
- Ingest caps: max sessions / walk depth / files (`cadence.maxSessions`, `cadence.maxFilesPerWalk`)
- Air-gapped UI default: offline CSP, no Google Fonts CDN
- `cadence.redactSensitive` for share/export without prompt excerpts
- Structured Output-channel logging
- Doctor reports enterprise grade + privacy controls
- CI workflow (typecheck, lint, test, package)
- Admin guide: `docs/ENTERPRISE.md`

## 1.0.0 (2026-11-09)

First stable release. E2E UI pass, C+pulse icon, Save vs Approve trust split, Function-free Lab predicates.

## 0.1.0 (2026-10-22)

Initial public preview.
