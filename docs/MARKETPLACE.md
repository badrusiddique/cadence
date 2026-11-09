# Publish Cadence to the Visual Studio Marketplace

Cadence ships as a standard VS Code extension (`.vsix`). The same package installs in VS Code, Cursor, and other compatible editors.

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
- [ ] `publisher` in `package.json` matches your Marketplace publisher id (`badrusiddique`)

## One-time publisher setup

1. Create a publisher at [Marketplace Management](https://marketplace.visualstudio.com/manage)  
   - Publisher id should match `package.json` → `"publisher": "badrusiddique"`  
2. In Azure DevOps, create a **Personal Access Token** with scope **Marketplace → Manage**  
3. Login locally:

```bash
npx vsce login badrusiddique
# paste the PAT when prompted (do not commit it)
```

## Publish

```bash
# package + publish current version
npx vsce publish

# or publish an existing artifact
npx vsce publish --packagePath cadence-insights-0.1.0.vsix
```

Bump `version` in `package.json` (semver) before each release. Tag `vX.Y.Z` on the git remote and attach the `.vsix`.

### Open VSX (optional, helps Cursor / open editors)

```bash
npx ovsx publish cadence-insights-0.1.0.vsix -p "$OVSX_PAT"
```

## Install without publishing

```bash
code --install-extension cadence-insights-*.vsix
cursor --install-extension cadence-insights-*.vsix
```

## After publish

1. Open the Marketplace listing → verify screenshots / description  
2. From a clean machine: install from Marketplace → Open Overview → demo mode  
3. Update README badges from “Marketplace ready” to the live listing URL when you have one  

## Need help?

If you have a Marketplace PAT available in the environment (env var only — never paste into chat), the maintainer can run `vsce publish` for you. Otherwise run the commands above on a trusted machine.
