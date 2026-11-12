# Getting started with Cadence

Cadence reads AI coding sessions already on your machine and shows them in a dashboard. Nothing leaves your computer.

## 1. Install

### VS Marketplace (recommended)

1. Open **Extensions** in VS Code or Cursor
2. Search **Cadence** by publisher `badrusiddique`,  
   or open [badrusiddique.cadence-insights](https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights)
3. Install, then reload if prompted

Needs **VS Code / Cursor 1.125+**. Current release: **1.2.1**.

### VSIX from source

```bash
git clone https://github.com/badrusiddique/cadence.git
cd cadence
npm ci
npm run package
code --install-extension cadence-insights-1.2.1.vsix
# Cursor:
cursor --install-extension cadence-insights-1.2.1.vsix
```

Needs **Node 20+** to build. On Windows PowerShell, if scripts are blocked:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Publishing notes: [MARKETPLACE.md](MARKETPLACE.md).

## 2. Open the dashboard

1. **Command Palette** (`Ctrl/Cmd+Shift+P`)
2. Run **`Cadence: Open Overview`**
3. Or use **Open Overview** / **Sync** in the sidebar

You should see Observe → Measure → Improve → Level Up in the left rail.

## 3. No logs yet?

By default Cadence stays **empty** until it finds real local AI session logs. It does not invent sample workspaces on install.

Want a tour with fake data? Settings → `cadence.demoMode` → enable (opt-in only).

Browser-only tryout (no VS Code):

```bash
npm ci
npm run preview
```

Then open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## 4. Orient quickly

| Control | Use it for |
|---|---|
| **Current / All** | This workspace, or everything Cadence can see |
| **7d · 28d · 90d · 180d · All** | Date range (from your latest local activity) |
| **Harness** | Copilot, Claude, Cursor, and so on |
| **Reload** | Re-read logs after a coding session |

Start on **Dashboard**, then **Anti-Patterns** for concrete findings.

## 5. Custom habit rules

1. Find something on **Anti-Patterns**
2. Try it in **Signal Lab** (use the example chips)
3. **Rule Studio** → Live test → **Save draft** → **Approve & load**
4. Drafts live under `~/.cadence/signals/` and only load after Approve

Details: [SIGNALS.md](SIGNALS.md).

## 6. CLI and MCP (optional)

```bash
npm run cli -- doctor --json
npm run cli -- overview --demo --json
npm run mcp
```

In-editor chat: `@cadence /summary`

## Troubleshooting

| Symptom | Fix |
|---|---|
| Empty dashboard | Enable `cadence.demoMode`, or check harness paths in the README |
| Stale numbers | `Cadence: Reload Sessions` |
| Custom signal not firing | Use **Approve & load**, not only Save draft |
| Preview port busy | `CADENCE_PREVIEW_PORT=43128 npm run preview` |

## Next

- Budget SKU: Settings → `cadence.budgetSku` (estimates only)
- Publish guide: [MARKETPLACE.md](MARKETPLACE.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
