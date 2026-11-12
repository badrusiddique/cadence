# Publish Cadence to the Visual Studio Marketplace

Cadence ships as a standard VS Code extension (`.vsix`). The same package installs in VS Code, Cursor, and other compatible editors.

**Publisher id:** `badrusiddique`  
**Extension id:** `badrusiddique.cadence-insights`  
**Listing:** https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights

You do **not** need a paid Azure subscription (`portal.azure.com` Pay-As-You-Go / Free Trial) to publish.

## Before you publish

```bash
npm ci
npm run check
npm run package
```

Confirm:

- [ ] `README.md` + `CHANGELOG.md` are current  
- [ ] `assets/icon.png` is ≥128×128  
- [ ] Overview loads with `cadence.demoMode`  
- [ ] Privacy claims still match the product (local-only)  
- [ ] `publisher` in `package.json` matches Marketplace publisher id (`badrusiddique`)

## Recommended: upload the VSIX in the browser

1. Create / open the publisher at [Marketplace Management](https://marketplace.visualstudio.com/manage/publishers/badrusiddique)  
2. Build locally: `npm run package` → `cadence-insights-1.1.0.vsix`  
3. Click **+ New extension** → choose **Visual Studio Code** → upload the `.vsix`  
4. After it processes, verify the public listing URL above  

For later versions: open the existing extension on that page → upload a new VSIX (or use `vsce publish` below).

## Optional: publish with `vsce` + PAT

Azure DevOps is free and separate from Azure cloud billing. Create an org at [https://aex.dev.azure.com/me](https://aex.dev.azure.com/me) or [https://dev.azure.com/_new](https://dev.azure.com/_new) — not `portal.azure.com`.

1. Avatar → **Personal access tokens** → **+ New Token**  
2. Scope: **Custom** → **Show all scopes** → **Marketplace → Manage**  
3. Locally:

```bash
npx vsce login badrusiddique
# paste the PAT when prompted (do not commit it)
npx vsce publish
# or:
npx vsce publish --packagePath cadence-insights-1.1.0.vsix
```

Bump `version` in `package.json` (semver) before each release. Tag `vX.Y.Z` on the git remote.

### Open VSX (optional, helps Cursor / open editors)

```bash
npx ovsx publish cadence-insights-1.1.0.vsix -p "$OVSX_PAT"
```

## Install without publishing

```bash
code --install-extension cadence-insights-*.vsix
cursor --install-extension cadence-insights-*.vsix
```

## After publish

1. Open the Marketplace listing → verify icon, description, and README  
2. From a clean machine: install from Marketplace → Open Overview → demo mode  
3. Optionally publish the same VSIX to Open VSX  

## Need help?

If you have a Marketplace PAT available in the environment (env var only — never paste into chat), the maintainer can run `vsce publish` for you. Otherwise use the browser upload path above.
