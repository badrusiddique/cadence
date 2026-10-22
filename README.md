# Cadence

**Steady your AI coding practice.**

Cadence is a local-first VS Code extension that reads your AI coding session logs and turns them into a calm, actionable dashboard — Watch, Quantify, Refine, Grow. Nothing leaves your machine.

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-0D8F6F">
  <img alt="VS Code 1.125+" src="https://img.shields.io/badge/VS%20Code-1.125%2B-142033">
  <img alt="Marketplace ready" src="https://img.shields.io/badge/Marketplace-ready-0D8F6F">
</p>

## Why Cadence

If you use Copilot, Claude Code, Codex, Cursor, OpenCode, or similar harnesses, your best coaching data is already on disk. Cadence makes it visible:

- **Watch** — overview, session timeline, high-signal coding moments  
- **Quantify** — throughput, budget estimates, weekly rhythm, inquiry patterns  
- **Refine** — 45 habit signals, rule studio, field browser, skill match, context score  
- **Grow** — practice focus, marks/XP, lifecycle mix, shareable snapshot  

Cadence is an original project. It explores the same problem space as Microsoft’s MIT-licensed [AI Engineer Coach](https://github.com/microsoft/ai-engineering-coach) but ships its own product identity, architecture, UI, and packaging. See [NOTICE](NOTICE).

## Gaps closed vs common prior art

| Gap | Cadence |
|---|---|
| Not marketplace-published | Packaging + [publish guide](docs/MARKETPLACE.md) for VS Marketplace / Open VSX |
| Token/burndown hidden | **Budget** enabled with explicit “estimate, not billing” labeling |
| No Cursor transcripts | Dedicated **Cursor** harness |
| Hard to try without logs | Demo fixtures + `npm run preview` browser dashboard |
| Agent-only workflows | **CLI + stdio MCP** + doctor + agent skill (REA-grade dual surface) |
| Contributor onboarding | Architecture notes, SignalSpec docs, AGENTS.md |

Cadence was reverse-engineered against [AI Engineer Coach](https://github.com/microsoft/ai-engineering-coach) and hardened with methodology from [REA](https://github.com/morluto/rea) (evidence tags, doctor, MCP/CLI). Details: [docs/REA-REVERSE-ENGINEERING.md](docs/REA-REVERSE-ENGINEERING.md).

## Install

### From a VSIX (recommended until Marketplace listing is live)

```bash
git clone https://github.com/badrusiddique/cadence.git
cd cadence
npm ci
npm run package
code --install-extension cadence-insights-*.vsix
```

Then: **Command Palette → “Cadence: Open Overview”**.

### Demo mode

Settings → `cadence.demoMode` → enable, or rely on automatic fixture fallback when no logs are found.

## Preview without VS Code

```bash
npm ci
npm run preview
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127) for the fixture-backed dashboard.

## CLI and MCP

```bash
npm run cli -- doctor --json
npm run cli -- overview --demo --json
npm run cli -- habits --demo --json
npm run mcp                  # stdio MCP for Cursor / Claude / Codex
npm run setup:mcp            # dry-run MCP registration plan
npm run setup:mcp -- --yes   # write after you approve
```

Agent skill: [`.agents/skills/cadence-insights/SKILL.md`](.agents/skills/cadence-insights/SKILL.md).

## Supported harnesses

| Harness | Typical location |
|---|---|
| VS Code / Copilot chat | `.../User/workspaceStorage/*/chatSessions` |
| Cursor (storage + transcripts) | Cursor `workspaceStorage` + `~/.cursor/projects/**` |
| GitHub Copilot CLI / App | `~/.copilot/session-state` |
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` |
| OpenCode | `~/.local/share/opencode` (JSON sidecars) |

All reads are **read-only**. Cadence never modifies session files and does not phone home.

## Privacy

- Local analysis only  
- No proprietary telemetry  
- Optional language-model features (chat / tools) run only when you invoke them through VS Code  

## Develop

```bash
npm ci
npm run check      # typecheck + lint + test
npm run build
npm run preview    # UI against fixtures
```

| Path | Role |
|---|---|
| `src/ingest/` | Discover + parse harness logs |
| `src/analyze/` | Analytics facade used by UI + LM tools |
| `src/signals/` | Habit SignalSpec engine + catalog |
| `src/ui/` | Preact dashboard |
| `src/host/` | VS Code panel, chat, tools |
| `src/cli/` | Doctor + overview/habits/export |
| `src/mcp/` | Stdio MCP server |
| `docs/` | Signals, marketplace, architecture, REA notes |

See [docs/SIGNALS.md](docs/SIGNALS.md) to author habits, and [docs/MARKETPLACE.md](docs/MARKETPLACE.md) to publish.

## Commands

- `Cadence: Open Overview`  
- `Cadence: Reload Sessions`  
- `Cadence: Export Snapshot`  
- `Cadence: Review Local Signals`  
- Chat: `@cadence /summary|habits|compare|flow`  

## License

[MIT](LICENSE) © Badru Siddique
