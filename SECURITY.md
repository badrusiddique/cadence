# Security

Cadence reads local AI session logs and evaluates optional user-authored SignalSpec files.

## Reporting

Email security concerns to the repository owner via GitHub Security Advisories on `badrusiddique/cadence`.

## Trust model

- Built-in signals ship with the extension.
- Personal/project signals under `~/.cadence` / `.cadence` should be reviewed before enabling in shared machines.
- Cadence refuses to read paths outside known harness roots.
