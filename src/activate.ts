import * as vscode from 'vscode';
import { Analyzer } from './analyze/analyzer';
import { ingestAll } from './ingest';
import { BUILTIN_SIGNALS } from './signals/catalog';
import { registerChatParticipant } from './host/chat';
import { registerLanguageModelTools } from './host/tools';
import { CadencePanel } from './host/panel';

let analyzer: Analyzer = new Analyzer([], new Map(), BUILTIN_SIGNALS);
let output: vscode.OutputChannel;

async function reload(context: vscode.ExtensionContext, openPanel = false): Promise<void> {
  const demoMode = vscode.workspace.getConfiguration('cadence').get<boolean>('demoMode') ?? false;
  output.appendLine(`Cadence reload (demoMode=${demoMode})…`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Cadence is reading local AI sessions',
      cancellable: false,
    },
    async (progress) => {
      const result = ingestAll({
        demoMode,
        onProgress: (u) => progress.report({ message: u.detail || u.phase }),
      });
      analyzer = new Analyzer(result.sessions, result.workspaces, BUILTIN_SIGNALS);
      for (const err of result.errors) output.appendLine(`[${err.source}] ${err.message}`);
      output.appendLine(`Loaded ${result.sessions.length} sessions from ${result.sources.length} sources.`);
      if (openPanel || CadencePanel.current) {
        CadencePanel.show(context.extensionUri, analyzer);
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
      await reload(context, true);
    }),
    vscode.commands.registerCommand('cadence.reload', async () => {
      await reload(context, Boolean(CadencePanel.current));
      void vscode.window.showInformationMessage('Cadence reloaded session data.');
    }),
    vscode.commands.registerCommand('cadence.exportSummary', async () => {
      await reload(context, false);
      const summary = analyzer.exportSummary();
      const doc = await vscode.workspace.openTextDocument({ content: summary.markdown, language: 'markdown' });
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('cadence.reviewSignals', async () => {
      void vscode.window.showInformationMessage(
        'Place SignalSpec files in ~/.cadence/signals or .cadence/signals, then reload. Trust prompts will appear in a future patch for untrusted workspaces.',
      );
    }),
    vscode.commands.registerCommand('cadence.showOutput', () => output.show(true)),
  );

  registerChatParticipant(context, getAnalyzer);
  registerLanguageModelTools(context, getAnalyzer);

  // Lightweight welcome webview view
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
