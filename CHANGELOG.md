# Changelog

## 1.1.0 — 2026-11-09

Enterprise production hardening (Marketplace publish still optional).

- RPC allowlist + strict param sanitization (`src/host/rpc-guard.ts`)
- Ingest caps: max sessions / walk depth / files (`cadence.maxSessions`, `cadence.maxFilesPerWalk`)
- Air-gapped UI default: offline CSP, no Google Fonts CDN
- `cadence.redactSensitive` for share/export without prompt excerpts
- Structured Output-channel logging
- Doctor reports enterprise grade + privacy controls
- CI workflow (typecheck, lint, test, package)
- Admin guide: `docs/ENTERPRISE.md`

## 1.0.0 — 2026-11-09

First stable release — E2E UI pass, C+pulse icon, Save vs Approve trust split, Function-free Lab predicates.

## 0.1.0 — 2026-10-22

Initial public preview.
