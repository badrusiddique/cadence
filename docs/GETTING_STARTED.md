# Getting started with Cadence

Cadence turns the AI coding sessions already on your machine into a calm coaching dashboard. Nothing is uploaded.

## 1. Install

### From the VS Marketplace (recommended)

1. Open **Extensions** in VS Code or Cursor  
2. Search **Cadence** by publisher `badrusiddique`  
   — or open [badrusiddique.cadence-insights](https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights)  
3. **Install** → reload if prompted  

Requires **VS Code / Cursor 1.125+**. Current stable: **1.1.0**.

### From a VSIX (source build)

```bash
git clone https://github.com/badrusiddique/cadence.git
cd cadence
npm ci
npm run package
code --install-extension cadence-insights-1.1.0.vsix
# Cursor:
cursor --install-extension cadence-insights-1.1.0.vsix
```

Requires **Node 20+** to build. On Windows PowerShell, if scripts are blocked:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Publisher / packaging notes: [MARKETPLACE.md](MARKETPLACE.md).

## 2. Open the dashboard

1. **Command Palette** (`Ctrl/Cmd+Shift+P`)  
2. Run **`Cadence: Open Overview`**  
3. The sidebar also has **Open Overview** / **Sync**

You should see Observe → Measure → Improve → Level Up in the left rail.

## 3. First run with no logs? Use Demo Mode

Settings → search `cadence.demoMode` → enable.

Or rely on automatic fixture fallback when Cadence finds zero harness sessions.

**Browser-only tryout (no VS Code):**

```bash
npm ci
npm run preview
```

Then open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## 4. Orient in 60 seconds

| Control | Use it for |
|---|---|
| **Current / All** | Scope to this workspace or everything Cadence can see |
| **7d · 28d · 90d · 180d · All** | Date range (anchored to your latest local activity) |
| **Harness** | Copilot vs Claude vs Cursor vs … |
| **Reload** | Re-read logs after a coding burst |

Start on **Dashboard**, then **Anti-Patterns** for concrete coaching.

## 5. Improve a habit (adapt loop)

1. Spot a finding on **Anti-Patterns**  
2. Probe it in **Signal Lab** (safe predicates — try the example chips)  
3. **Rule Studio** → Live test → **Save draft** → **Approve & load**  
4. Drafts live under `~/.cadence/signals/` and only load after Approve  

Full authoring guide: [SIGNALS.md](SIGNALS.md).

## 6. Optional: CLI & MCP for agents

```bash
npm run cli -- doctor --json
npm run cli -- overview --demo --json
npm run mcp
```

In-editor chat: `@cadence /summary`

## Troubleshooting

| Symptom | Fix |
|---|---|
| Empty dashboard | Enable `cadence.demoMode`, or confirm harness paths in the README table |
| Stale numbers | `Cadence: Reload Sessions` |
| Custom signal not firing | Confirm you clicked **Approve & load**, not only Save draft |
| Preview port busy | `CADENCE_PREVIEW_PORT=43128 npm run preview` |

## Next

- Tune budget SKU: Settings → `cadence.budgetSku` (estimates only)  
- Publish guide: [MARKETPLACE.md](MARKETPLACE.md)  
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
