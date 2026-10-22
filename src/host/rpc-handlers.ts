import type { Analyzer } from '../analyze/analyzer';
import {
  builtinSignalTemplate,
  listSignalCatalog,
  loadAllSignals,
  writePersonalSignal,
} from '../signals/loader';
import { approve, getPending, type TrustStore } from '../signals/trust';
import { parseSignalMarkdown } from '../signals/engine';

export interface HostContext {
  analyzer: Analyzer;
  trustStore?: TrustStore | null;
  workspaceRoot?: string;
}

export async function handleRpc(
  ctx: HostContext,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const filter = {
    workspaceId: typeof params.workspaceId === 'string' ? params.workspaceId : undefined,
    harness: typeof params.harness === 'string' ? params.harness : undefined,
    fromDate: typeof params.fromDate === 'string' ? params.fromDate : undefined,
    toDate: typeof params.toDate === 'string' ? params.toDate : undefined,
  };
  const a = ctx.analyzer;

  switch (method) {
    case 'getMeta':
      return a.getMeta();
    case 'getOverview':
      return a.getOverview(filter);
    case 'getTimeline':
      return a.getTimeline(filter);
    case 'getSessionDetail':
      return a.getSessionDetail(String(params.sessionId || ''));
    case 'getHarnessComparison':
      return a.getHarnessComparison(filter);
    case 'getFlowState':
      return a.getFlowState(filter);
    case 'getDailyActivity':
      return a.getDailyActivity(filter);
    case 'getMoments':
      return a.getMoments(filter);
    case 'getThroughput':
      return a.getThroughput(filter);
    case 'getBudget':
      return a.getBudget(filter);
    case 'getRhythm':
      return a.getRhythm(filter);
    case 'getInquiry':
      return a.getInquiry(filter);
    case 'getHabits':
      return a.getHabits(filter);
    case 'getPracticeScores':
      return a.getPracticeScores(filter);
    case 'getPracticePack':
      return a.getPracticePack(filter);
    case 'getFieldBrowser':
      return a.getFieldBrowser(filter);
    case 'getSkillCandidates':
      return a.getSkillCandidates(filter);
    case 'getContextHealth':
      return a.getContextHealth(filter);
    case 'getAchievements':
      return a.getAchievements(filter);
    case 'getSdlc':
      return a.getSdlc(filter);
    case 'getHub':
      return a.getHub(filter);
    case 'exportSummary':
      return a.exportSummary(filter);
    case 'copyMarkdown':
      return { copied: true, markdown: a.exportSummary(filter).markdown };
    case 'listSignals':
      return listSignalCatalog({ store: ctx.trustStore, workspaceRoot: ctx.workspaceRoot });
    case 'getSignalTemplate':
      return {
        markdown: builtinSignalTemplate({
          id: typeof params.id === 'string' ? params.id : undefined,
          name: typeof params.name === 'string' ? params.name : undefined,
        }),
      };
    case 'savePersonalSignal': {
      const markdown = String(params.markdown || '');
      const parsed = parseSignalMarkdown(markdown);
      if (!parsed) throw new Error('Could not parse SignalSpec markdown.');
      const filePath = writePersonalSignal(parsed.id, markdown);
      if (ctx.trustStore) await approve(ctx.trustStore, filePath, markdown);
      // hot-reload signals into analyzer
      const signals = loadAllSignals({
        store: ctx.trustStore,
        workspaceRoot: ctx.workspaceRoot,
        trustedWorkspace: true,
      });
      a.setSignals(signals);
      return { filePath, id: parsed.id };
    }
    case 'testSignalMarkdown': {
      const markdown = String(params.markdown || '');
      const parsed = parseSignalMarkdown(markdown);
      if (!parsed) throw new Error('Could not parse SignalSpec markdown.');
      return { finding: a.testSignal(parsed, filter) };
    }
    case 'evaluateLab':
      return a.evaluateLabPredicate(String(params.expression || ''), filter);
    case 'getPendingSignals':
      return getPending();
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
