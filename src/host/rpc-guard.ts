/**
 * Enterprise RPC surface control — allowlist + strict param sanitization.
 * Unknown methods and oversized/malformed params are rejected before analyzer work.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STR = 240;
const MAX_MARKDOWN = 120_000;
const MAX_EXPR = 500;

export const RPC_ALLOWLIST = new Set([
  'getMeta',
  'getOverview',
  'getTimeline',
  'getTimelineByDay',
  'getLabReference',
  'getSessionDetail',
  'getHarnessComparison',
  'getFlowState',
  'getDailyActivity',
  'getMoments',
  'getThroughput',
  'getBudget',
  'getRhythm',
  'getInquiry',
  'getCuriosity',
  'getCodeProduction',
  'getPatternsDeep',
  'getCuriosityDeep',
  'getContextDeep',
  'getSkillCatalog',
  'getRuleCoverage',
  'getWellbeing',
  'getInsights',
  'getHabits',
  'getPracticeScores',
  'getPracticePack',
  'getFieldBrowser',
  'getSkillCandidates',
  'getContextHealth',
  'getAchievements',
  'getSdlc',
  'getHub',
  'exportSummary',
  'copyMarkdown',
  'listSignals',
  'getSignalTemplate',
  'savePersonalSignal',
  'approvePersonalSignal',
  'testSignalMarkdown',
  'evaluateLab',
  'getPendingSignals',
]);

function asOptionalString(value: unknown, field: string, max = MAX_STR): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`Invalid ${field}: expected string.`);
  if (value.length > max) throw new Error(`Invalid ${field}: exceeds ${max} characters.`);
  return value;
}

function asOptionalDate(value: unknown, field: string): string | undefined {
  const s = asOptionalString(value, field, 32);
  if (!s) return undefined;
  if (!ISO_DATE.test(s)) throw new Error(`Invalid ${field}: use YYYY-MM-DD.`);
  return s;
}

export function assertAllowedMethod(method: string): void {
  if (!method || typeof method !== 'string') throw new Error('RPC method required.');
  if (!RPC_ALLOWLIST.has(method)) throw new Error(`RPC method not allowed: ${method}`);
}

export function sanitizeRpcParams(method: string, params: Record<string, unknown> = {}): Record<string, unknown> {
  assertAllowedMethod(method);
  if (params == null || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('RPC params must be an object.');
  }

  const out: Record<string, unknown> = {
    workspaceId: asOptionalString(params.workspaceId, 'workspaceId'),
    harness: asOptionalString(params.harness, 'harness', 80),
    fromDate: asOptionalDate(params.fromDate, 'fromDate'),
    toDate: asOptionalDate(params.toDate, 'toDate'),
  };

  if (method === 'getSessionDetail') {
    out.sessionId = asOptionalString(params.sessionId, 'sessionId', 200) || '';
  }
  if (method === 'getSignalTemplate') {
    out.id = asOptionalString(params.id, 'id', 80);
    out.name = asOptionalString(params.name, 'name', 120);
  }
  if (method === 'savePersonalSignal' || method === 'testSignalMarkdown' || method === 'approvePersonalSignal') {
    const md = asOptionalString(params.markdown, 'markdown', MAX_MARKDOWN);
    if (!md) throw new Error('markdown is required.');
    out.markdown = md;
  }
  if (method === 'approvePersonalSignal') {
    const fp = asOptionalString(params.filePath, 'filePath', 500);
    if (!fp) throw new Error('filePath is required.');
    // Must reference Cadence signals dir — block path traversal.
    if (fp.includes('..') || !fp.includes('.cadence')) {
      throw new Error('filePath must be a Cadence signals path under .cadence.');
    }
    out.filePath = fp;
  }
  if (method === 'evaluateLab') {
    const expression = asOptionalString(params.expression, 'expression', MAX_EXPR);
    if (!expression) throw new Error('expression is required.');
    out.expression = expression;
  }

  return out;
}
