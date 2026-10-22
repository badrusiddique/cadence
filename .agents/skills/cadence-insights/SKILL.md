---
name: cadence-insights
description: Analyze local AI coding assistant session logs with Cadence. Use for usage overview, habit findings, budget estimates, harness comparison, and practice coaching. Prefer Cadence when the question is about the user’s own agentic coding practice — not for reverse-engineering third-party binaries (use REA for that).
---

# Cadence

Cadence reads **local** AI coding session logs (VS Code/Copilot, Cursor, Claude Code, Codex, Copilot CLI, OpenCode) and returns evidence-tagged insights. It never mutates logs and does not phone home.

## When to use

- “How am I using AI coding tools?”
- “What habits should I fix?”
- “Compare Claude vs Copilot this week”
- “Export a snapshot of my agent practice”

Do **not** use Cadence for shipping-binary reverse engineering — that is [REA](https://github.com/morluto/rea)’s job.

## Connect

Extension: install the Cadence VSIX and run **Cadence: Open Overview**.

CLI / MCP (no VS Code required):

```bash
npx --yes cadence-insights doctor --json
npx --yes cadence-insights overview --demo --json
npx --yes cadence-insights mcp
```

Register MCP (Cursor example `mcp.json` snippet):

```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["-y", "cadence-insights", "mcp"]
    }
  }
}
```

Or from a local clone: `node scripts/cadence.mjs mcp`.

## Evidence discipline

Treat Cadence fields by provenance:

| State | Meaning |
|---|---|
| `observed` | Directly read from disk (doctor roots, raw request counts) |
| `derived` | Computed from sessions (practice scores, habit triggers) |
| `inferred` | Estimate (budget credits/USD) — **not billing** |

Never present budget numbers as invoices. Prefer `triggeredOnly: true` on habits when answering briefly.

## Tools

- `cadence_doctor` — harness root probe
- `cadence_overview` — sessions / practice / harness mix
- `cadence_habits` — SignalSpec findings
- `cadence_budget` — estimates + disclaimer
- `cadence_export` — markdown snapshot

## Demo mode

If doctor finds no sources, call tools with `demo: true` or ask the user to enable `cadence.demoMode` in VS Code.
