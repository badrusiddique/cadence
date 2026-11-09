import * as vscode from 'vscode';
import { Analyzer } from '../analyze/analyzer';
import type { RpcRequest } from '../ui/rpc';
import { handleRpc, type HostContext } from './rpc-handlers';
import type { TrustStore } from '../signals/trust';

export class CadencePanel {
  public static current: CadencePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private analyzer: Analyzer;
  private trustStore: TrustStore | null = null;
  private workspaceRoot: string | undefined;
  private redactSensitive = false;
  private offlineUi = true;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    analyzer: Analyzer,
    opts?: {
      trustStore?: TrustStore | null;
      workspaceRoot?: string;
      redactSensitive?: boolean;
      offlineUi?: boolean;
    },
  ) {
    this.panel = panel;
    this.analyzer = analyzer;
    this.trustStore = opts?.trustStore ?? null;
    this.workspaceRoot = opts?.workspaceRoot;
    this.redactSensitive = Boolean(opts?.redactSensitive);
    this.offlineUi = opts?.offlineUi !== false;
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist'), vscode.Uri.joinPath(extensionUri, 'assets')],
    };
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => {
      CadencePanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage(async (msg: RpcRequest & { type?: string; command?: string }) => {
      // Sidebar-style command passthrough (also used by embedded chrome).
      if (msg?.command === 'cadence.open' || msg?.type === 'open') {
        void vscode.commands.executeCommand('cadence.open');
        return;
      }
      if (msg?.command === 'cadence.reload' || msg?.type === 'reload') {
        void vscode.commands.executeCommand('cadence.reload');
        return;
      }
      if (!msg?.method || !msg?.id) return;
      try {
        const ctx: HostContext = {
          analyzer: this.analyzer,
          trustStore: this.trustStore,
          workspaceRoot: this.workspaceRoot,
          redactSensitive: this.redactSensitive,
        };
        const result = await handleRpc(ctx, msg.method, msg.params || {});
        if (msg.method === 'copyMarkdown' && result && typeof result === 'object' && 'markdown' in (result as object)) {
          await vscode.env.clipboard.writeText(String((result as { markdown?: string }).markdown || ''));
        }
        await this.panel.webview.postMessage({ id: msg.id, ok: true, result });
      } catch (err) {
        await this.panel.webview.postMessage({
          id: msg.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  static show(
    extensionUri: vscode.Uri,
    analyzer: Analyzer,
    opts?: {
      trustStore?: TrustStore | null;
      workspaceRoot?: string;
      redactSensitive?: boolean;
      offlineUi?: boolean;
    },
  ): CadencePanel {
    if (CadencePanel.current) {
      CadencePanel.current.panel.reveal(vscode.ViewColumn.One);
      CadencePanel.current.analyzer = analyzer;
      if (opts?.trustStore !== undefined) CadencePanel.current.trustStore = opts.trustStore;
      if (opts?.workspaceRoot !== undefined) CadencePanel.current.workspaceRoot = opts.workspaceRoot;
      if (opts?.redactSensitive !== undefined) CadencePanel.current.redactSensitive = opts.redactSensitive;
      if (opts?.offlineUi !== undefined) {
        const changed = CadencePanel.current.offlineUi !== opts.offlineUi;
        CadencePanel.current.offlineUi = opts.offlineUi;
        if (changed) CadencePanel.current.panel.webview.html = CadencePanel.current.html();
      }
      // Tell the webview to drop caches and re-query — previously the panel
      // revealed with a stale UI after reload/open.
      void CadencePanel.current.panel.webview.postMessage({ type: 'cadence-refresh' });
      return CadencePanel.current;
    }
    const panel = vscode.window.createWebviewPanel('cadence.overview', 'Cadence', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    CadencePanel.current = new CadencePanel(panel, extensionUri, analyzer, opts);
    return CadencePanel.current;
  }

  private html(): string {
    const dist = vscode.Uri.joinPath(this.extensionUri, 'dist');
    const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
    const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'));
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // Enterprise default: no third-party font/CDN fetches (air-gapped friendly).
    const csp = this.offlineUi
      ? `default-src 'none'; img-src ${this.panel.webview.cspSource} data:; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`
      : `default-src 'none'; img-src ${this.panel.webview.cspSource} https: data:; style-src ${this.panel.webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Cadence</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}">
    window.cadenceAcquireVsCodeApi = acquireVsCodeApi;
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
