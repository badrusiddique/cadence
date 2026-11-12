# Changelog

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
