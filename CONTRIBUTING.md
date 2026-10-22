# Contributing to Cadence

Thanks for helping the community steady their AI coding practice.

## Ground rules

1. Keep analysis **local** and **read-only** over user session logs.  
2. Do not add telemetry or network calls that upload session content.  
3. Prefer focused modules under `ingest/`, `analyze/`, `signals/`, `ui/`, `host/`.  
4. New habit signals need a clear improvement hint and a test.  
5. UI should stay calm: one job per page, no card soup, respect `prefers-reduced-motion`.

## Setup

```bash
npm ci
npm run check
npm run preview
```

## Pull requests

- Run `npm run check` before pushing.  
- Update `CHANGELOG.md` for user-visible changes.  
- For parser work, add a temp-dir fixture test.  
- Do not copy proprietary assets or trademarked Microsoft product branding.

## Code of conduct

Be respectful. This project is for builders who want better agentic habits — assume good intent, prefer precise feedback.
