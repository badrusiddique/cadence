import * as path from 'path';
import * as vscode from 'vscode';
import { Analyzer } from './analyze/analyzer';
import { ingestAll } from './ingest';
import { clearIngestCache } from './ingest/cache';
import { loadAllSignals } from './signals/loader';
import { approve, getPending, type PendingSignal } from './signals/trust';
import { registerChatParticipant } from './host/chat';
import { registerLanguageModelTools } from './host/tools';
import { CadencePanel } from './host/panel';
import { createLogger, type CadenceLogger } from './host/log';

let analyzer: Analyzer = new Analyzer([], new Map(), loadAllSignals({}));
let output: vscode.OutputChannel;
let log: CadenceLogger;
let sidebarProvider: CadenceSidebarProvider | undefined;

function readEnterpriseConfig() {
  const cfg = vscode.workspace.getConfiguration('cadence');
  return {
    demoMode: cfg.get<boolean>('demoMode') ?? false,
    redactSensitive: cfg.get<boolean>('redactSensitive') ?? false,
    offlineUi: cfg.get<boolean>('offlineUi') ?? true,
    maxSessions: cfg.get<number>('maxSessions') ?? 5000,
    maxFilesPerWalk: cfg.get<number>('maxFilesPerWalk') ?? 8000,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class CadenceSidebarProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist'), vscode.Uri.joinPath(this.extensionUri, 'assets')],
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg: { command?: string; type?: string }) => {
      if (msg?.command === 'cadence.open' || msg?.type === 'open') {
        void vscode.commands.executeCommand('cadence.open');
        return;
      }
      if (msg?.command === 'cadence.reload' || msg?.type === 'reload') {
        void vscode.commands.executeCommand('cadence.reload');
      }
    });
  }

  refresh(): void {
    if (!this.view) return;
    this.view.webview.html = this.renderHtml(this.view.webview);
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const meta = analyzer.getMeta();
    const harnesses = meta.harnesses || [];
    const statsHtml = meta.sessionCount
      ? `<div class="card">
          <p class="label">Sessions synced</p>
          <p class="value">${meta.sessionCount}</p>
          <p class="note">${harnesses.map(escapeHtml).join(' · ') || 'No harnesses yet'}</p>
        </div>`
      : `<div class="card"><p class="note">No data yet. Open the overview to sync local AI sessions.</p></div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  :root {
    color-scheme: light dark;
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --btn: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --sec: var(--vscode-button-secondaryBackground);
    --sec-fg: var(--vscode-button-secondaryForeground);
    --border: var(--vscode-panel-border, rgba(127,127,127,.35));
    --card: var(--vscode-sideBar-background);
  }
  body {
    font-family: var(--vscode-font-family);
    color: var(--fg);
    padding: 12px;
    margin: 0;
  }
  h3 { margin: 0 0 4px; font-size: 13px; font-weight: 700; letter-spacing: .02em; }
  .tag { color: var(--muted); font-size: 11px; margin-bottom: 12px; }
  .card {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 12px;
    background: color-mix(in srgb, var(--card) 92%, transparent);
  }
  .label { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .value { margin: 4px 0; font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .note { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.4; }
  button {
    width: 100%;
    border: 0;
    border-radius: 4px;
    padding: 8px 10px;
    margin-bottom: 8px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  #open { background: var(--btn); color: var(--btn-fg); }
  #open:hover { background: var(--btn-hover); }
  #reload { background: var(--sec); color: var(--sec-fg); }
</style>
</head>
<body>
  <h3>Cadence</h3>
  <p class="tag">Local AI engineering insights</p>
  <div id="content">${statsHtml}</div>
  <button id="open" type="button">Open Overview</button>
  <button id="reload" type="button">Sync Sessions</button>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('open').addEventListener('click', function () {
      vscode.postMessage({ command: 'cadence.open' });
    });
    document.getElementById('reload').addEventListener('click', function () {
      vscode.postMessage({ command: 'cadence.reload' });
    });
  </script>
</body>
</html>`;
  }
}

async function reviewPendingTrust(context: vscode.ExtensionContext): Promise<void> {
  const pending = getPending();
  if (pending.length === 0) return;

  const action = await vscode.window.showWarningMessage(
    `${pending.length} local Cadence signal file${pending.length === 1 ? '' : 's'} need approval before they run.`,
    { modal: true, detail: pending.map((p) => `- [${p.layer}] ${p.filePath}`).join('\n') },
    'Review & Approve',
    'Skip',
  );
  if (action !== 'Review & Approve') return;

  type PickItem = vscode.QuickPickItem & { entry: PendingSignal };
  const items: PickItem[] = pending.map((p) => ({
    label: `$(file-code) ${path.basename(p.filePath)}`,
    description: `${p.layer} · sha256 ${p.hash.slice(0, 12)}`,
    detail: p.filePath,
    entry: p,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Approve local Cadence signals',
    placeHolder: 'Select files to approve. Unselected stay blocked.',
    ignoreFocusOut: true,
  });
  if (!picked?.length) return;
  for (const item of picked) {
    await approve(context.globalState, item.entry.filePath, item.entry.content);
  }
  void vscode.window.showInformationMessage(`Approved ${picked.length} signal file(s).`);
}

async function reload(context: vscode.ExtensionContext, openPanel = false, bustCache = false): Promise<{
  sessions: number;
  version: string;
  probeSummary: string;
}> {
  const ent = readEnterpriseConfig();
  const version = String(context.extension.packageJSON?.version || '');
  log.info('reload start', {
    demoMode: ent.demoMode,
    bustCache,
    redactSensitive: ent.redactSensitive,
    offlineUi: ent.offlineUi,
    maxSessions: ent.maxSessions,
    version,
  });
  if (bustCache) clearIngestCache();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const trustedWorkspace = vscode.workspace.isTrusted !== false;
  if (!trustedWorkspace) {
    log.warn('workspace untrusted; project-layer signals will not load');
  }

  let sessionCount = 0;
  let probeSummary = 'no Cursor User dirs';

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Cadence is reading local AI sessions',
      cancellable: false,
    },
    async (progress) => {
      loadAllSignals({
        store: context.globalState,
        workspaceRoot,
        trustedWorkspace,
      });
      await reviewPendingTrust(context);

      const signals = loadAllSignals({
        store: context.globalState,
        workspaceRoot,
        trustedWorkspace,
      });

      const {
        findCursorUserDirs,
        loadCursorComposerSessionsAsync,
        probeComposerDatabases,
        userDirFromExtensionStorage,
      } = await import('./ingest/harnesses/cursor-composer');
      const { findVsCodeUserDirs } = await import('./ingest/harnesses/vscode');

      const hostUserDir = userDirFromExtensionStorage(context.globalStorageUri.fsPath);
      const userDirs = findCursorUserDirs([hostUserDir]);
      const vscodeUserDirs = findVsCodeUserDirs([hostUserDir]);
      log.info('cursor user dirs', { hostUserDir, userDirs });
      log.info('vscode user dirs', { hostUserDir, vscodeUserDirs });

      const result = ingestAll({
        demoMode: ent.demoMode,
        useCache: !bustCache && !ent.demoMode,
        cursorUserDirs: userDirs,
        vscodeUserDirs,
        limits: {
          maxSessions: ent.maxSessions,
          maxFilesPerWalk: ent.maxFilesPerWalk,
        },
        onProgress: (u) => progress.report({ message: u.detail || u.phase }),
      });
      progress.report({ message: 'Cursor Composer database' });
      let sessions = result.sessions;
      let workspaces = result.workspaces;
      try {
        const composerSessions = await loadCursorComposerSessionsAsync(userDirs);
        if (composerSessions.length > 0) {
          // Only replace other Composer-DB rows. Never collapse Copilot/jsonl/transcript
          // sessions that happen to share a sessionId.
          const kept = sessions.filter((s) => !String(s.workspaceId || '').startsWith('cursor-db:'));
          const byId = new Map(
            sessions
              .filter((s) => String(s.workspaceId || '').startsWith('cursor-db:'))
              .map((s) => [s.sessionId, s] as const),
          );
          for (const s of composerSessions) byId.set(s.sessionId, s);
          sessions = [...kept, ...byId.values()];
          workspaces = new Map();
          for (const s of sessions) {
            if (!workspaces.has(s.workspaceId)) {
              workspaces.set(s.workspaceId, {
                id: s.workspaceId,
                name: s.workspaceName,
                path: s.workspaceRootPath || '',
              });
            }
          }
          log.info('composer db sessions', { count: composerSessions.length });
        }
      } catch (err) {
        log.warn('composer db read skipped', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const probe = probeComposerDatabases(userDirs);
      log.info('composer probe', { probe });
      probeSummary =
        probe.databases.length === 0
          ? 'no Cursor User dirs'
          : probe.databases
              .map((d) => `${d.dbPath} ${d.exists ? 'exists' : 'missing'}`)
              .join('; ');

      analyzer = new Analyzer(sessions, workspaces, signals);
      analyzer.setIngestDiag(probe, version);
      sessionCount = sessions.length;
      for (const err of result.errors) log.warn(err.message, { source: err.source });
      log.info('reload complete', {
        sessions: sessions.length,
        signals: signals.length,
        sources: result.sources.length,
        version,
      });
      sidebarProvider?.refresh();
      if (openPanel || CadencePanel.current) {
        CadencePanel.show(context.extensionUri, analyzer, {
          trustStore: context.globalState,
          workspaceRoot,
          redactSensitive: ent.redactSensitive,
          offlineUi: ent.offlineUi,
        });
      }
    },
  );

  return { sessions: sessionCount, version, probeSummary };
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('Cadence');
  log = createLogger(output);
  context.subscriptions.push(output);

  const getAnalyzer = () => analyzer;
  sidebarProvider = new CadenceSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('cadence.open', async () => {
      await reload(context, true, false);
    }),
    vscode.commands.registerCommand('cadence.reload', async () => {
      const { sessions, version, probeSummary } = await reload(context, Boolean(CadencePanel.current), true);
      const label = version ? `Cadence v${version}` : 'Cadence';
      if (sessions > 0) {
        void vscode.window.showInformationMessage(`${label}: loaded ${sessions} sessions.`);
      } else {
        const choice = await vscode.window.showWarningMessage(
          `${label}: 0 sessions. Checked: ${probeSummary}. Cloud Agent chats on cursor.com are not local.`,
          'Show Output',
        );
        if (choice === 'Show Output') {
          void vscode.commands.executeCommand('cadence.showOutput');
        }
      }
    }),
    vscode.commands.registerCommand('cadence.exportSummary', async () => {
      await reload(context, false, false);
      const ent = readEnterpriseConfig();
      const summary = analyzer.exportSummary({}, { redactSensitive: ent.redactSensitive });
      const doc = await vscode.workspace.openTextDocument({ content: summary.markdown, language: 'markdown' });
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('cadence.reviewSignals', async () => {
      loadAllSignals({
        store: context.globalState,
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        trustedWorkspace: vscode.workspace.isTrusted !== false,
      });
      await reviewPendingTrust(context);
      await reload(context, Boolean(CadencePanel.current), false);
    }),
    vscode.commands.registerCommand('cadence.showOutput', () => output.show(true)),
  );

  registerChatParticipant(context, getAnalyzer);
  registerLanguageModelTools(context, getAnalyzer);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('cadence.overview', sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  log.info('Cadence activated', { version: context.extension.packageJSON?.version });
}

export function deactivate(): void {
  /* noop */
}
