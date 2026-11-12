# Changelog

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
