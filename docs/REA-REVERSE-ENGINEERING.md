# Using REA to reverse-engineer session coaches

This project used [morluto/rea](https://github.com/morluto/rea) as a **methodology aid** while reconstructing the capability surface of Microsoft’s AI Engineer Coach.

## What we ran

```bash
npx -y rea-agents@latest analyze-javascript-application \
  /absolute/path/to/ai-engineering-coach --json
```

REA returns NDJSON progress events, then one Evidence record with:

- `normalized_result.statistics` — files parsed, AST nodes visited  
- `normalized_result.graph` — modules, imports, workers, endpoints  
- `limitations` — what static analysis cannot claim  

## How findings mapped into Cadence

| REA observation | Cadence response |
|---|---|
| Extension host + webview split | `src/activate.ts` + `src/ui/` |
| Heavy `src/core` analytics | `src/analyze/` + `src/ingest/` |
| Worker for cache writes | `src/ingest/workers/parse-worker.ts` (parse off host); cache worker planned |
| Chat + language-model tools | `src/host/chat.ts`, `src/host/tools.ts` |
| MCP-facing tools | `src/mcp/server.ts` + VS Code LM tools |
| Evidence / limitations culture | `src/domain/evidence.ts`, doctor, budget disclaimers |

## What Cadence deliberately did *not* take from REA

- Hopper/Ghidra/IDA bridges  
- Frida / APK / firmware / pcap tooling  
- REA’s product name, icons, or tool catalog  

Those belong to reverse-engineering binaries and runtimes. Cadence’s domain is **your** AI coding practice logs.

## Reproduce

Keep REA optional. Contributors can re-run the command above when comparing Cadence’s module map to upstream coaches. Treat REA confidence tags (`observed` / `derived` / `inferred`) seriously — low-confidence “network endpoint” candidates in the coach repo were mostly prompt string literals, not HTTP APIs.
