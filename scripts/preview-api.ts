import { Analyzer } from '../src/analyze/analyzer';
import { buildFixtureSessions } from '../src/ingest/fixtures';
import { BUILTIN_SIGNALS } from '../src/signals/catalog';
import { builtinSignalTemplate, listSignalCatalog } from '../src/signals/loader';
import { parseSignalMarkdown } from '../src/signals/engine';
import { getPending } from '../src/signals/trust';
import type { Workspace } from '../src/domain/types';

const sessions = buildFixtureSessions();
const workspaces = new Map<string, Workspace>();
for (const s of sessions) {
  if (!workspaces.has(s.workspaceId)) {
    workspaces.set(s.workspaceId, { id: s.workspaceId, name: s.workspaceName, path: s.workspaceRootPath || '' });
  }
}
const analyzer = new Analyzer(sessions, workspaces, BUILTIN_SIGNALS);

export function handleRpc(method: string, params: Record<string, unknown> = {}): unknown {
  const filter = {
    workspaceId: typeof params.workspaceId === 'string' ? params.workspaceId : undefined,
    harness: typeof params.harness === 'string' ? params.harness : undefined,
    fromDate: typeof params.fromDate === 'string' ? params.fromDate : undefined,
    toDate: typeof params.toDate === 'string' ? params.toDate : undefined,
  };

  switch (method) {
    case 'getMeta':
      return analyzer.getMeta();
    case 'getOverview':
      return analyzer.getOverview(filter);
    case 'getTimeline':
      return analyzer.getTimeline(filter);
    case 'getSessionDetail':
      return analyzer.getSessionDetail(String(params.sessionId || ''));
    case 'getHarnessComparison':
      return analyzer.getHarnessComparison(filter);
    case 'getFlowState':
      return analyzer.getFlowState(filter);
    case 'getDailyActivity':
      return analyzer.getDailyActivity(filter);
    case 'getMoments':
      return analyzer.getMoments(filter);
    case 'getThroughput':
      return analyzer.getThroughput(filter);
    case 'getBudget':
      return analyzer.getBudget(filter);
    case 'getRhythm':
      return analyzer.getRhythm(filter);
    case 'getInquiry':
    case 'getCuriosity':
      return analyzer.getInquiry(filter);
    case 'getCodeProduction':
      return analyzer.getCodeProduction(filter);
    case 'getPatternsDeep':
      return analyzer.getPatternsDeep(filter);
    case 'getCuriosityDeep':
      return analyzer.getCuriosityDeep(filter);
    case 'getContextDeep':
      return analyzer.getContextDeep(filter);
    case 'getSkillCatalog':
      return analyzer.getSkillCatalog(filter);
    case 'getRuleCoverage':
      return analyzer.getRuleCoverage(filter);
    case 'getWellbeing':
      return analyzer.getWellbeing(filter);
    case 'getInsights':
      return analyzer.getInsights(filter);
    case 'getHabits':
      return analyzer.getHabits(filter);
    case 'getPracticeScores':
      return analyzer.getPracticeScores(filter);
    case 'getPracticePack':
      return analyzer.getPracticePack(filter);
    case 'getFieldBrowser':
      return analyzer.getFieldBrowser(filter);
    case 'getSkillCandidates':
      return analyzer.getSkillCandidates(filter);
    case 'getContextHealth':
      return analyzer.getContextHealth(filter);
    case 'getAchievements':
      return analyzer.getAchievements(filter);
    case 'getSdlc':
      return analyzer.getSdlc(filter);
    case 'getHub':
      return analyzer.getHub(filter);
    case 'exportSummary':
      return analyzer.exportSummary(filter);
    case 'copyMarkdown':
      return { copied: true, markdown: analyzer.exportSummary(filter).markdown };
    case 'listSignals':
      return listSignalCatalog({});
    case 'getSignalTemplate':
      return {
        markdown: builtinSignalTemplate({
          id: typeof params.id === 'string' ? params.id : undefined,
          name: typeof params.name === 'string' ? params.name : undefined,
        }),
      };
    case 'savePersonalSignal':
      return { filePath: '~/.cadence/signals/preview-skip.signal.md', id: 'preview-skip', preview: true };
    case 'testSignalMarkdown': {
      const parsed = parseSignalMarkdown(String(params.markdown || ''));
      if (!parsed) throw new Error('Could not parse SignalSpec markdown.');
      return { finding: analyzer.testSignal(parsed, filter) };
    }
    case 'evaluateLab':
      return analyzer.evaluateLabPredicate(String(params.expression || ''), filter);
    case 'getPendingSignals':
      return getPending();
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
