import * as vscode from 'vscode';
import { Analyzer } from '../analyze/analyzer';
import type { RpcRequest } from '../ui/rpc';

export class CadencePanel {
  public static current: CadencePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private analyzer: Analyzer;

  private constructor(panel: vscode.WebviewPanel, private readonly extensionUri: vscode.Uri, analyzer: Analyzer) {
    this.panel = panel;
    this.analyzer = analyzer;
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
        const result = await this.dispatch(msg.method, msg.params || {});
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

  static show(extensionUri: vscode.Uri, analyzer: Analyzer): CadencePanel {
    if (CadencePanel.current) {
      CadencePanel.current.panel.reveal(vscode.ViewColumn.One);
      // Rebuild panel with fresh analyzer by disposing and recreating would lose scroll;
      // instead swap via mutable reference on the instance.
      CadencePanel.current.analyzer = analyzer;
      return CadencePanel.current;
    }
    const panel = vscode.window.createWebviewPanel('cadence.overview', 'Cadence', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    CadencePanel.current = new CadencePanel(panel, extensionUri, analyzer);
    return CadencePanel.current;
  }

  private async dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    const filter = {
      workspaceId: typeof params.workspaceId === 'string' ? params.workspaceId : undefined,
      harness: typeof params.harness === 'string' ? params.harness : undefined,
      fromDate: typeof params.fromDate === 'string' ? params.fromDate : undefined,
      toDate: typeof params.toDate === 'string' ? params.toDate : undefined,
    };

    switch (method) {
      case 'getMeta':
        return this.analyzer.getMeta();
      case 'getOverview':
        return this.analyzer.getOverview(filter);
      case 'getTimeline':
        return this.analyzer.getTimeline(filter);
      case 'getMoments':
        return this.analyzer.getMoments(filter);
      case 'getThroughput':
        return this.analyzer.getThroughput(filter);
      case 'getBudget':
        return this.analyzer.getBudget(filter);
      case 'getRhythm':
        return this.analyzer.getRhythm(filter);
      case 'getInquiry':
        return this.analyzer.getInquiry(filter);
      case 'getHabits':
        return this.analyzer.getHabits(filter);
      case 'getPracticeScores':
        return this.analyzer.getPracticeScores(filter);
      case 'getFieldBrowser':
        return this.analyzer.getFieldBrowser(filter);
      case 'getSkillCandidates':
        return this.analyzer.getSkillCandidates(filter);
      case 'getContextHealth':
        return this.analyzer.getContextHealth(filter);
      case 'getAchievements':
        return this.analyzer.getAchievements(filter);
      case 'getSdlc':
        return this.analyzer.getSdlc(filter);
      case 'exportSummary':
        return this.analyzer.exportSummary(filter);
      case 'copyMarkdown': {
        const summary = this.analyzer.exportSummary(filter);
        await vscode.env.clipboard.writeText(summary.markdown);
        return { copied: true };
      }
      default:
        throw new Error(`Unknown method: ${method}`);
    }
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
