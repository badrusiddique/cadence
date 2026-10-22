# Publish Cadence to the Visual Studio Marketplace

Cadence is packaged as a standard VS Code extension (`.vsix`). Compatible editors (VS Code, Cursor, and others that support the VS Code extension API) can install it.

## One-time publisher setup

1. Create a publisher at [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)  
   - Recommended publisher id: `badrusiddique` (already set in `package.json`).
2. Create a Personal Access Token (Azure DevOps) with **Marketplace → Manage** scope.
3. Install tooling (already a devDependency):

```bash
npm ci
npx vsce login badrusiddique
```

## Package locally

```bash
npm run check
npm run package
```

This produces `cadence-insights-0.1.0.vsix`.

Install without publishing:

```bash
code --install-extension cadence-insights-*.vsix
# or
cursor --install-extension cadence-insights-*.vsix
```

## Publish

```bash
npx vsce publish
# or publish an existing vsix:
npx vsce publish --packagePath cadence-insights-0.1.0.vsix
```

### Open VSX (optional)

Many open editors also consume Open VSX:

```bash
npx ovsx publish cadence-insights-0.1.0.vsix -p <OPEN_VSX_TOKEN>
```

## Checklist before release

- [ ] `README.md` and `CHANGELOG.md` updated  
- [ ] `assets/icon.png` 128×128+  
- [ ] `npm run check` green  
- [ ] Manual smoke: Overview loads with demo fixtures (`cadence.demoMode`)  
- [ ] Privacy claims still accurate (local-only, no telemetry)  

## Versioning

Bump `version` in `package.json` using semver. Tag releases on GitHub as `vX.Y.Z` and attach the `.vsix`.
