# Cadence for enterprise

Cadence is a **local-first** VS Code / Cursor extension. It is designed so security and platform teams can allow it without accepting cloud coaching or prompt exfiltration.

## Guarantees

| Control | Behavior |
|---|---|
| Telemetry | None — Cadence does not phone home |
| Session logs | **Read-only**; never mutated |
| Network (UI) | `cadence.offlineUi` default **true** — webview CSP blocks font/CDN fetches |
| Custom rules | Personal/project SignalSpec require **explicit Approve** (hash-bound trust) |
| RPC | Allowlisted methods + sanitized params only |
| Ingest | Caps on sessions / walk depth / files (`cadence.maxSessions`, `cadence.maxFilesPerWalk`) |
| Sharing | Optional `cadence.redactSensitive` strips prompt excerpts from exports |

## Recommended org settings

```json
{
  "cadence.offlineUi": true,
  "cadence.redactSensitive": true,
  "cadence.demoMode": false,
  "cadence.maxSessions": 5000
}
```

Ship via internal VSIX or private Marketplace. End users: **Cadence: Open Overview**.

## Trust & compliance checklist

1. Confirm VS Code **Workspace Trust** policy for your org.  
2. Restrict who can write `~/.cadence/signals` and `<repo>/.cadence/signals`.  
3. Point auditors at Output channel **Cadence** (structured reload logs).  
4. Run `cadence doctor --json` on a sample laptop — expect `grade: "enterprise-ready"` when harness logs exist.  
5. Review [SECURITY.md](../SECURITY.md) and [NOTICE](../NOTICE).

## What Cadence deliberately does not do

- No GitHub Copilot App cloud DB sync  
- No screenshot upload / image gallery pipeline  
- No automatic execution of untrusted SignalSpec  
- No remote rule marketplace install without local review  

## Support bundle (safe)

Ask the user for:

- `Cadence: Show Output` log excerpt (no prompts when redact is on)  
- `npm run cli -- doctor --json`  
- Extension version (`1.2.2+`)  

Do **not** request raw `~/.claude` / chat JSONL dumps unless under an existing DLP exception.
