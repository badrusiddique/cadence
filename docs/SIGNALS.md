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

## Tests

Prefer covering new signals with Vitest fixtures (see `src/signals/engine.test.ts`) so contributors can adapt rules safely.
