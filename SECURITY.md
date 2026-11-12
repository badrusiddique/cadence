# Security

Cadence reads local AI session logs and evaluates optional user-authored SignalSpec files. It does not phone home.

## Reporting

Use GitHub Security Advisories on the Cadence repository, or contact the maintainer listed in `package.json`.

## Trust model

| Layer | Behavior |
|---|---|
| Built-in signals | Shipped with the extension |
| Personal signals (`~/.cadence/signals`) | Written as drafts; **must be Approved** before load |
| Project signals (`.cadence/signals`) | Require VS Code workspace trust + approval |
| Signal Lab | Sandboxed predicate AST. **No `eval` / `Function`** |
| Ingest | Read-only; refuses paths outside known harness roots |

## Hardening notes (v1.1+)

- Rule Studio **Save draft** and **Approve & load** are separate steps.  
- Lab expressions only allow identifiers, literals, comparisons, `AND` / `OR`, and parentheses (AST, no `Function`).  
- Webview RPC is **allowlisted** with sanitized params.  
- Ingest enforces session / file-walk caps.  
- `cadence.offlineUi` (default on) blocks third-party CDN fetches in the webview CSP.  
- `cadence.redactSensitive` omits prompt excerpts from exports.  
- Session log contents are sensitive. Treat `~/.cadence` like other local AI caches.  
- Do not paste untrusted SignalSpec from the internet without review.  
- Org rollout: [docs/ENTERPRISE.md](docs/ENTERPRISE.md).

## Out of scope

Cadence is not a sandbox for arbitrary code execution, a secrets manager, or a multi-tenant service. Run it like any other local developer tool with access to your home directory logs.
