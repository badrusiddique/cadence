# Cadence

Local insights for Copilot, Claude Code, Codex, Cursor, and OpenCode inside VS Code and Cursor.

Cadence reads session logs already on your machine, shows habits worth fixing, and stays offline. It does not send telemetry or change your logs.

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights"><img alt="VS Marketplace" src="https://img.shields.io/badge/VS%20Marketplace-badrusiddique.cadence--insights-0D8F6F"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-0D8F6F">
  <img alt="VS Code 1.125+" src="https://img.shields.io/badge/VS%20Code-1.125%2B-142033">
  <img alt="Local only" src="https://img.shields.io/badge/privacy-local%20only-0D8F6F">
  <img alt="Version 1.2.2" src="https://img.shields.io/badge/version-1.2.2-0D8F6F">
</p>

<p align="center">
  <img src="assets/icon-256.png" alt="Cadence icon" width="96" height="96" />
</p>

```text
  Observe  →  Measure  →  Improve  →  Level Up
  sessions    charts      signals     practice
```

## Install

### Marketplace (recommended)

1. Open **Extensions** in VS Code or Cursor
2. Search **Cadence** (publisher `badrusiddique`)  
   or open the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights)
3. Install, then **Command Palette → `Cadence: Open Overview`**
4. If you have no local logs yet, turn on **Settings → `cadence.demoMode`**

### VSIX from source

```bash
git clone https://github.com/badrusiddique/cadence.git
cd cadence
npm ci
npm run package
code --install-extension cadence-insights-1.2.2.vsix
# or: cursor --install-extension cadence-insights-1.2.2.vsix
```

Windows PowerShell blocking `npm`:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# or use Command Prompt / npm.cmd
```

### Browser preview (no extension)

```bash
npm ci
npm run preview
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127) for fixture data and the full dashboard.

Full walkthrough: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

## Features

| Area | What you get |
|---|---|
| **Observe** | Dashboard, day-grouped timeline, coding moments |
| **Measure** | Output charts, burndown estimates, patterns, curiosity, flow, hub |
| **Improve** | Habit signals, Rule Studio, Signal Lab, skill finder, context health |
| **Level Up** | Practice drills, achievements, lifecycle mix, shareable snapshot |
| **Agents** | CLI, stdio MCP, `@cadence` chat, LM tools |

Useful details:

- Offline by default (no cloud coaching account)
- Burndown is always available and labeled as estimates, not billing
- One view across Cursor, Claude, Codex, Copilot, and OpenCode
- Custom rules: Lab → Save draft → Approve → load

## Everyday use

1. Open Overview
2. Filter with Current/All, date range, and harness
3. Check Anti-Patterns; use Rule Studio for a custom signal if you want one
4. Export Snapshot for a shareable weekly card

```bash
npm run cli -- doctor --json
npm run cli -- overview --demo --json
npm run cli -- habits --demo --json
npm run mcp
npm run setup:mcp
```

In-editor: `@cadence /summary`, `/habits`, `/compare`, `/flow`

## Supported harnesses

| Harness | Typical path |
|---|---|
| VS Code / Copilot chat | `.../User/workspaceStorage/*/chatSessions` |
| Cursor | `workspaceStorage` + `~/.cursor/projects/**` |
| Copilot CLI | `~/.copilot/session-state` |
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` |
| OpenCode | `~/.local/share/opencode` |

Reads are read-only. Session files are never mutated.

## Privacy

- Local analysis only
- Personal signals under `~/.cadence/signals` need explicit Approve before they load
- Lab predicates use a sandboxed parser (no `eval` / `Function`)
- Defaults include offline webview CSP, RPC allowlist, ingest caps, optional export redaction
- See [SECURITY.md](SECURITY.md), [docs/ENTERPRISE.md](docs/ENTERPRISE.md), [docs/SIGNALS.md](docs/SIGNALS.md)

## Develop

```bash
npm ci
npm run check
npm run build
npm run preview
npm run package
```

| Path | Role |
|---|---|
| `src/ingest/` | Discover and parse harness logs (capped) |
| `src/analyze/` | Analytics for UI and LM tools |
| `src/signals/` | Habit SignalSpec engine and catalog |
| `src/ui/` | Preact dashboard |
| `src/host/` | Panel, RPC guard, chat, tools |
| `src/cli/` · `src/mcp/` | Doctor, overview, MCP server |

## Docs

| Doc | Purpose |
|---|---|
| [Getting started](docs/GETTING_STARTED.md) | Install, first session, demo mode |
| [Enterprise](docs/ENTERPRISE.md) | Org rollout and privacy controls |
| [Signals](docs/SIGNALS.md) | Author habit rules |
| [Marketplace](docs/MARKETPLACE.md) | Publish to VS Marketplace / Open VSX |
| [Architecture](docs/ARCHITECTURE.md) | How the pieces fit |
| [QA vs AEC](docs/QA-AEC-VS-CADENCE.md) | Comparison notes |
| [NOTICE](NOTICE) | Prior art disclosure |

## Commands

- `Cadence: Open Overview`
- `Cadence: Reload Sessions`
- `Cadence: Export Snapshot`
- `Cadence: Review Local Signals`

## License

[MIT](LICENSE) © Badru Siddique

Same problem space as Microsoft’s MIT-licensed [AI Engineering Coach](https://github.com/microsoft/ai-engineering-coach). See [NOTICE](NOTICE). Not a fork.
