# SignalSpec authoring

Cadence detects habits with **SignalSpec** — small declarative definitions evaluated locally against your session data.

Built-in signals live in [`src/signals/catalog.ts`](../src/signals/catalog.ts). Personal / project signals can be authored as markdown (see format below) under:

| Layer | Path |
|---|---|
| Personal | `~/.cadence/signals/*.signal.md` |
| Project | `<workspace>/.cadence/signals/*.signal.md` |

## Markdown format

```markdown
---
id: thin-prompts
name: Thin Prompts
group: prompt-quality   # prompt-quality | session-hygiene | code-review | tool-mastery | context-management
severity: medium         # low | medium | high
scope: requests         # requests | sessions
version: 1
tags: [prompt, quality]
thresholds:
  minChars: 30
  maxRatio: 0.3
  minSample: 8
---

# Description
Short prompts that starve the model of intent.

# When Triggered
{{count}} requests ({{pct}}%) are under {{minChars}} characters.

# How to Improve
State the goal, constraints, and what “done” looks like.
```

Template variables available in **When Triggered**: `count`, `total`, `pct`, plus every threshold key.

## Practice groups

1. **Prompt Craft** — clarity, tone, cost discipline  
2. **Session Hygiene** — cancels, mega-sessions, wellbeing timing  
3. **Review Discipline** — speed-accept, YOLO shell, vibe spikes  
4. **Tool Mastery** — modes, skills, slash commands, MCP soup  
5. **Context Stewardship** — files, instructions, specs, cache  

## Signal Lab predicates

Use **Signal Lab** to probe live request fields before promoting a rule to SignalSpec.

| Operators | ` < > <= >= == != AND OR ( ) ` |
|---|---|
| Fields | `messageLength`, `modelId`, `toolCount`, `aiLoc`, `promptTokens`, `isCanceled`, `workType`, `harness` |

Examples:

```
messageLength < 30 AND messageLength > 0
aiLoc > 80 AND toolCount < 2
isCanceled == true
workType == "test" OR workType == "docs"
```

Lab is a **safe exploration subset**. Persist durable coaching rules as SignalSpec markdown in Rule Studio; personal files load only after the local trust gate approves them.

## Adapt loop (for contributors)

1. Find a pattern in Dashboard / Anti-Patterns / Data Explorer.  
2. Probe it in Signal Lab.  
3. Author SignalSpec in Rule Studio → Live test → **Save draft** → **Approve & load**.  
4. Add a Vitest fixture case when the rule is shared in-repo.  

Saving alone does **not** trust a signal. Approval writes the content hash into the local trust store.

## Tests

Prefer covering new signals with Vitest fixtures (see `src/signals/engine.test.ts`) so contributors can adapt rules safely.
