# Publish Cadence to the Visual Studio Marketplace

Cadence ships as a `.vsix`. The same package works in VS Code, Cursor, and other compatible editors.

**Publisher id:** `badrusiddique`  
**Extension id:** `badrusiddique.cadence-insights`  
**Listing:** https://marketplace.visualstudio.com/items?itemName=badrusiddique.cadence-insights

You do not need a paid Azure subscription. Ignore `portal.azure.com` Free Trial / Pay-As-You-Go prompts.

## Before you publish

```bash
npm ci
npm run check
npm run package
```

Checklist:

- [ ] `README.md` and `CHANGELOG.md` are current
- [ ] `assets/icon.png` is at least 128×128
- [ ] Overview loads with `cadence.demoMode`
- [ ] Privacy claims still match the product (local-only)
- [ ] `publisher` in `package.json` is `badrusiddique`

## Upload the VSIX in the browser

1. Open [Marketplace Management](https://marketplace.visualstudio.com/manage/publishers/badrusiddique)
2. Build: `npm run package` → `cadence-insights-1.2.2.vsix`
3. **+ New extension** → Visual Studio Code → upload the `.vsix`
4. Confirm the public listing URL

For later versions, open the existing extension and upload the new VSIX (or use `vsce publish` below).

## Optional: `vsce` + PAT

Azure DevOps is free and separate from Azure cloud billing. Create an org at [https://aex.dev.azure.com/me](https://aex.dev.azure.com/me) or [https://dev.azure.com/_new](https://dev.azure.com/_new), not `portal.azure.com`.

1. Avatar → **Personal access tokens** → **+ New Token**
2. Scope: **Custom** → **Show all scopes** → **Marketplace → Manage**
3. Locally:

```bash
npx vsce login badrusiddique
# paste the PAT when prompted (do not commit it)
npx vsce publish
# or:
npx vsce publish --packagePath cadence-insights-1.2.2.vsix
```

Bump `version` in `package.json` before each release. Tag `vX.Y.Z` on the git remote.

### Open VSX (optional)

```bash
npx ovsx publish cadence-insights-1.2.2.vsix -p "$OVSX_PAT"
```

## Install without publishing

```bash
code --install-extension cadence-insights-*.vsix
cursor --install-extension cadence-insights-*.vsix
```

## After publish

1. Check the Marketplace listing (icon, description, README)
2. On a clean machine: install from Marketplace → Open Overview → demo mode
3. Optionally publish the same VSIX to Open VSX
