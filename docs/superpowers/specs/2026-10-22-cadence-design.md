# Cadence — Design Spec

> Clean-room product inspired by the capabilities of [microsoft/ai-engineering-coach](https://github.com/microsoft/ai-engineering-coach) (MIT). Original name, UI, architecture, copy, and packaging. No Microsoft trademarks, assets, or verbatim source.

## Product identity

| | |
|---|---|
| **Name** | Cadence |
| **Display name** | Cadence — Agent Engineering Insights |
| **Tagline** | Steady your AI coding practice. |
| **Package id** | `cadence-insights` |
| **Publisher** | `badrusiddique` |
| **Repo** | `github.com/badrusiddique/cadence` |
| **License** | MIT (Badru Siddique) |
| **Config dirs** | `~/.cadence/`, `<workspace>/.cadence/` |
| **Command prefix** | `cadence.*` |
| **Chat participant** | `@cadence` |

### Visual language (deliberately different)

- **Atmosphere**: Cool mist canvas (`#E8EEF4` → soft blue-gray gradient), not VS Code-native dark chrome and not cream/terracotta.
- **Ink**: `#142033` primary text; muted `#5A6A7A`.
- **Accent**: Seafoam `#0D8F6F` (single brand color — no purple cluster).
- **Typography**: Display `Fraunces`, UI `IBM Plex Sans` (bundled via Google Fonts CDN in webview; system fallbacks offline).
- **Motion**: Page cross-fade (180ms), sidebar filter expand, chart draw-in. Honor `prefers-reduced-motion`.
- **Layout**: Left rail with four groups — **Watch / Quantify / Refine / Grow**. No card soup; charts and tables sit on the canvas with hairline separators only when needed for interaction.

### Information architecture (parity map)

| Cadence | Capability (parity) |
|---|---|
| Watch → Overview | Dashboard (practice scores, trends, activity) |
| Watch → Sessions | Timeline (Gantt + overlap) |
| Watch → Moments | Coding Moments gallery |
| Quantify → Throughput | Code output by language/model/harness |
| Quantify → Budget | Token/credit burndown (**enabled**, labeled estimates) |
| Quantify → Rhythm | 7×24 heatmap + work-life signals |
| Quantify → Inquiry | Curiosity / investigation analytics |
| Hub → Delivery | GitHub Copilot app productivity (conditional) |
| Hub → Issue spend | Issue credit estimates (conditional) |
| Refine → Habits | Anti-pattern findings (45 Signal rules) |
| Refine → Rule Studio | Visual + markdown rule editor |
| Refine → Signal Lab | DSL playground / REPL |
| Refine → Field Browser | Data explorer |
| Refine → Skill Match | Repeated-prompt → skill discovery |
| Refine → Context Score | Context health / readiness |
| Grow → Practice | Learning quizzes from usage |
| Grow → Marks | Achievements / XP tiers |
| Grow → Lifecycle | Agentic SDLC map |
| Grow → Snapshot | Shareable card + Markdown/JSON export |

## Reverse-engineering summary (source of truth for behavior)

Studied `microsoft/ai-engineering-coach` (empty-repo session clone under `/tmp/source-analysis`). Key facts:

1. **VS Code extension** (engine `^1.125`), Preact+htm webview, Chart.js, Zod, esbuild, Vitest, Playwright.
2. **Local-only ingest** of AI session logs; never mutates logs; no proprietary telemetry.
3. **Harnesses**: VS Code Copilot (workspaceStorage), VS Code CLI, Xcode, Claude Code (`~/.claude`), Codex (`~/.codex/sessions`), OpenCode. GitHub Copilot app analytics when local DB present.
4. **Normalized model**: `Session` → `SessionRequest[]` with tokens, tools, edits, skills, compaction, todos, curiosity signals.
5. **Workers**: parse worker, warm-up (anti-patterns + config health), cache-write — keep host responsive.
6. **Rules**: Markdown + YAML + `detect` DSL; layers built-in / personal / project; trust gate for local files.
7. **Host surfaces**: activity-bar webview, chat participant, language-model tools, Copilot-app canvas.
8. **Explicit gaps in upstream**: not marketplace-published; token/burndown feature-flagged off; no Cursor transcript harness; limited first-run guidance.

## Approach chosen

**Recommended: Clean-room rewrite with capability parity + gap closure.**

| Approach | Pros | Cons |
|---|---|---|
| A. Fork + rebrand | Fast 100% code path | Feels plagiarized; Microsoft copyright headers everywhere |
| B. Clean-room rewrite (chosen) | Original code/UI/docs; clear provenance | Larger build effort; must re-validate parsers |
| C. Thin analytics CLI only | Small | Misses extension/marketplace goal |

We implement Cadence as original TypeScript with a **different module layout** and **SignalSpec** rule language (compatible *concepts*, original syntax/docs). Public docs cite upstream as prior art for the problem space, not as a fork.

## Architecture

```
cadence/
├── package.json                 # VS Code extension + publisher metadata
├── esbuild.mjs                  # extension + webview + workers
├── src/
│   ├── activate.ts              # extension host entry
│   ├── ingest/                  # harness discovery + parsers → Session[]
│   │   ├── discover.ts
│   │   ├── normalize.ts
│   │   ├── harnesses/           # vscode, claude, codex, opencode, xcode, cursor
│   │   └── workers/
│   ├── analyze/                 # pure analytics over Session[]
│   │   ├── overview.ts, timeline.ts, throughput.ts, budget.ts, ...
│   │   └── index.ts             # Analyzer facade (RPC surface)
│   ├── signals/                 # SignalSpec engine + 45 built-in rules
│   │   ├── engine.ts, loader.ts, trust.ts
│   │   ├── rules/*.signal.md
│   │   └── metrics/*.metric.md
│   ├── host/                    # VS Code chat, LM tools, export, trust UI
│   ├── ui/                      # Preact dashboard (pages + shell + theme)
│   └── preview/                 # Fixture-backed browser preview (dev server)
├── docs/                        # Contributor + user docs (adapt/fork guide)
├── fixtures/                    # Synthetic sessions for demos/tests
└── .vscodeignore
```

### Data flow

1. `discover()` → trusted log roots per harness.
2. Parse workers stream sessions → Zod-validated `Session[]` + edit-LOC index + workspace map.
3. Disk cache keyed by source mtime/hash (read-only of user logs).
4. `Analyzer` answers typed queries used by webview RPC and LM tools.
5. Signal engine evaluates built-in + trusted local rules → habit findings.
6. UI requests via postMessage RPC; optional Copilot LM for skill match / instruction review only when user invokes.

### Privacy invariants

- Read-only over session files.
- All analysis local.
- No phone-home telemetry.
- Optional LM features require explicit user action.
- Untrusted workspaces: project `.cadence/` rules not loaded until trust approval.

## Gaps closed vs upstream

1. **Marketplace-ready**: publisher `badrusiddique`, `vsce package`/`publish` docs, Open VSX notes, icon, categories, LICENSE.
2. **Budget/Throughput tokens ON** with clear “local estimate, not billing” labeling.
3. **Cursor agent transcripts** harness (`~/.cursor/projects/**/agent-transcripts` and related paths when present).
4. **First-run Overview** with harness detection checklist and fixture demo mode.
5. **`npm run preview`** browser dashboard for contributors without Extension Development Host.
6. **Contributor docs**: architecture, SignalSpec authoring, marketplace publish, adapting/forking.

## Non-goals (this slice)

- Shipping Microsoft Hugo theme or their screenshots/video.
- Claiming Microsoft endorsement.
- Server-side SaaS analytics.
- Mutating user session logs or auto-installing skills without confirmation.

## Testing & quality bar

- Vitest unit tests for ingest normalize, SignalSpec engine, analyzers (fixtures).
- Inline `# Tests` blocks in signal files executed by the test harness.
- `npm run check` = typecheck + lint + test.
- `npm run package` produces installable `.vsix`.
- Preview server serves Overview against fixtures on an uncommon port.

## Success criteria

1. Installable VS Code/Compatible editor extension (`.vsix`) under Cadence branding.
2. All IA pages listed above present and functional (fixture or live logs).
3. ≥45 habit signals across the five practice groups.
4. Distinct UI that fails the “remove the word Cadence and it still looks unique” brand test.
5. Docs sufficient for a stranger to run, adapt rules, and publish to Marketplace.
6. No Microsoft copyright headers, icons, or product name strings in the shipped artifact.
7. NOTICE acknowledges prior art / problem-space inspiration without implying a fork.

## Risk notes

- Parser parity for every edge case of every harness will grow over time; fixtures + golden tests are the contract.
- Marketplace publish requires the publisher’s Personal Access Token on the operator machine — docs cover the steps; CI packages `.vsix` artifacts.
- GitHub repo creation under `badrusiddique` requires authenticated `gh`; workspace pushes to the session remote until that remote exists.
