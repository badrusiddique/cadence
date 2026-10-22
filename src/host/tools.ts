import * as vscode from 'vscode';
import { Analyzer } from '../analyze/analyzer';

function filterFrom(params: Record<string, unknown>) {
  return {
    fromDate: typeof params.fromDate === 'string' ? params.fromDate : undefined,
    toDate: typeof params.toDate === 'string' ? params.toDate : undefined,
    workspaceId: typeof params.workspaceId === 'string' ? params.workspaceId : undefined,
    harness: typeof params.harness === 'string' ? params.harness : undefined,
  };
}

export function registerLanguageModelTools(context: vscode.ExtensionContext, getAnalyzer: () => Analyzer): void {
  const register = (name: string, run: (params: Record<string, unknown>) => unknown) => {
    context.subscriptions.push(
      vscode.lm.registerTool(name, {
        async invoke(options) {
          const params = (options.input || {}) as Record<string, unknown>;
          const result = run(params);
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
          ]);
        },
      }),
    );
  };

  register('cadence_summary', (p) => getAnalyzer().getOverview(filterFrom(p)));
  register('cadence_activity', (p) => getAnalyzer().getDailyActivity(filterFrom(p)));
  register('cadence_budget', (p) => getAnalyzer().getBudget(filterFrom(p)));
  register('cadence_throughput', (p) => getAnalyzer().getCodeProduction(filterFrom(p)));
  register('cadence_flow', (p) => getAnalyzer().getFlowState(filterFrom(p)));
  register('cadence_habits', (p) => getAnalyzer().getHabits(filterFrom(p)));
  register('cadence_compare', (p) => getAnalyzer().getHarnessComparison(filterFrom(p)));
  register('cadence_patterns', (p) => getAnalyzer().getPatternsDeep(filterFrom(p)));
  register('cadence_insights', (p) => getAnalyzer().getInsights(filterFrom(p)));
  register('cadence_wellbeing', (p) => getAnalyzer().getWellbeing(filterFrom(p)));
  register('cadence_sessions', (p) => {
    if (typeof p.sessionId === 'string' && p.sessionId) return getAnalyzer().getSessionDetail(p.sessionId);
    return getAnalyzer().getTimeline(filterFrom(p));
  });
  register('cadence_context', (p) => getAnalyzer().getContextDeep(filterFrom(p)));
  register('cadence_curiosity', (p) => getAnalyzer().getCuriosityDeep(filterFrom(p)));
}
