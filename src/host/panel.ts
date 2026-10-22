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

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    analyzer: Analyzer,
    opts?: { trustStore?: TrustStore | null; workspaceRoot?: string },
  ) {
    this.panel = panel;
    this.analyzer = analyzer;
    this.trustStore = opts?.trustStore ?? null;
    this.workspaceRoot = opts?.workspaceRoot;
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist'), vscode.Uri.joinPath(extensionUri, 'assets')],
    };
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => {
      CadencePanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage(async (msg: RpcRequest) => {
      try {
        const ctx: HostContext = {
          analyzer: this.analyzer,
          trustStore: this.trustStore,
          workspaceRoot: this.workspaceRoot,
        };
        const result = await handleRpc(ctx, msg.method, msg.params || {});
        if (msg.method === 'copyMarkdown' && result && typeof result === 'object' && 'markdown' in (result as any)) {
          await vscode.env.clipboard.writeText(String((result as any).markdown || ''));
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
    opts?: { trustStore?: TrustStore | null; workspaceRoot?: string },
  ): CadencePanel {
    if (CadencePanel.current) {
      CadencePanel.current.panel.reveal(vscode.ViewColumn.One);
      CadencePanel.current.analyzer = analyzer;
      if (opts?.trustStore !== undefined) CadencePanel.current.trustStore = opts.trustStore;
      if (opts?.workspaceRoot !== undefined) CadencePanel.current.workspaceRoot = opts.workspaceRoot;
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
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.panel.webview.cspSource} https: data:; style-src ${this.panel.webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
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
