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

let analyzer: Analyzer = new Analyzer([], new Map(), loadAllSignals({}));
let output: vscode.OutputChannel;

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

async function reload(context: vscode.ExtensionContext, openPanel = false, bustCache = false): Promise<void> {
  const demoMode = vscode.workspace.getConfiguration('cadence').get<boolean>('demoMode') ?? false;
  output.appendLine(`Cadence reload (demoMode=${demoMode}, bustCache=${bustCache})…`);
  if (bustCache) clearIngestCache();

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const trustedWorkspace = vscode.workspace.isTrusted !== false;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Cadence is reading local AI sessions',
      cancellable: false,
    },
    async (progress) => {
      // First pass discovers pending local signals
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

      const result = ingestAll({
        demoMode,
        useCache: !bustCache && !demoMode,
        onProgress: (u) => progress.report({ message: u.detail || u.phase }),
      });
      analyzer = new Analyzer(result.sessions, result.workspaces, signals);
      for (const err of result.errors) output.appendLine(`[${err.source}] ${err.message}`);
      output.appendLine(`Loaded ${result.sessions.length} sessions; ${signals.length} signals.`);
      if (openPanel || CadencePanel.current) {
        CadencePanel.show(context.extensionUri, analyzer, {
          trustStore: context.globalState,
          workspaceRoot,
        });
      }
    },
  );
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('Cadence');
  context.subscriptions.push(output);

  const getAnalyzer = () => analyzer;

  context.subscriptions.push(
    vscode.commands.registerCommand('cadence.open', async () => {
      await reload(context, true, false);
    }),
    vscode.commands.registerCommand('cadence.reload', async () => {
      await reload(context, Boolean(CadencePanel.current), true);
      void vscode.window.showInformationMessage('Cadence reloaded session data.');
    }),
    vscode.commands.registerCommand('cadence.exportSummary', async () => {
      await reload(context, false, false);
      const summary = analyzer.exportSummary();
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
    vscode.window.registerWebviewViewProvider('cadence.overview', {
      resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);padding:1rem">
          <h2 style="margin:0 0 .5rem">Cadence</h2>
          <p style="opacity:.8">Open the full dashboard to watch sessions, quantify throughput, refine habits, and grow practice.</p>
          <button id="open" style="margin-top:1rem;padding:.5rem 1rem">Open Overview</button>
          <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('open').onclick = () => vscode.postMessage({ type: 'open' });
          </script>
        </body></html>`;
        webviewView.webview.onDidReceiveMessage((msg) => {
          if (msg?.type === 'open') void vscode.commands.executeCommand('cadence.open');
        });
      },
    }),
  );

  output.appendLine('Cadence activated.');
}

export function deactivate(): void {
  /* noop */
}
