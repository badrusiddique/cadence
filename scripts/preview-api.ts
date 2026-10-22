import { Analyzer } from '../src/analyze/analyzer';
import { buildFixtureSessions } from '../src/ingest/fixtures';
import { BUILTIN_SIGNALS } from '../src/signals/catalog';
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
    case 'getMoments':
      return analyzer.getMoments(filter);
    case 'getThroughput':
      return analyzer.getThroughput(filter);
    case 'getBudget':
      return analyzer.getBudget(filter);
    case 'getRhythm':
      return analyzer.getRhythm(filter);
    case 'getInquiry':
      return analyzer.getInquiry(filter);
    case 'getHabits':
      return analyzer.getHabits(filter);
    case 'getPracticeScores':
      return analyzer.getPracticeScores(filter);
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
    case 'exportSummary':
      return analyzer.exportSummary(filter);
    case 'copyMarkdown':
      return { copied: true };
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
