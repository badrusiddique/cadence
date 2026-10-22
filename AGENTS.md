# AGENTS.md

You are working on **Cadence**, a local-first VS Code extension that analyzes AI coding session logs.

## Invariants

- Never mutate user session logs.
- Never add phone-home telemetry.
- Token/budget numbers are estimates — keep disclaimers.
- Product name is Cadence; commands are `cadence.*`; config dirs are `~/.cadence` / `.cadence`.

## Stack

- TypeScript strict, esbuild bundles (`dist/extension.js`, `dist/webview.js`, `dist/parse-worker.js`)
- Preact + htm webview UI
- Vitest unit tests
- `@vscode/vsce` packaging

## Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Build | `npm run build` |
| Test/lint/typecheck | `npm run check` |
| Preview UI | `npm run preview` |
| Package VSIX | `npm run package` |

## Layout

See repository map in `README.md`. Design notes live in `docs/superpowers/specs/`.
