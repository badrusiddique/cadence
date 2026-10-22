import type { HabitFinding, PracticeGroup, Session, Severity } from '../domain/types';
import { allRequests } from '../analyze/filter';

export interface SignalThresholds {
  [key: string]: number;
}

export interface SignalDefinition {
  id: string;
  name: string;
  group: PracticeGroup;
  severity: Severity;
  scope: 'requests' | 'sessions';
  version: number;
  tags: string[];
  thresholds: SignalThresholds;
  description: string;
  whenTriggered: string;
  howToImprove: string;
  /** Simple predicate language evaluated in JS for built-ins. */
  match: (row: Record<string, unknown>, thresholds: SignalThresholds) => boolean;
  aggregate?: 'ratio' | 'count' | 'some';
  check?: (stats: { count: number; total: number; ratio: number }, thresholds: SignalThresholds) => boolean;
  example?: (row: Record<string, unknown>) => string;
}

function template(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

export function evaluateSignals(signals: SignalDefinition[], sessions: Session[]): HabitFinding[] {
  const requestRows = allRequests(sessions).map((r) => ({
    messageText: r.messageText,
    messageLength: r.messageLength,
    responseLength: r.responseLength,
    isCanceled: r.isCanceled,
    toolsUsed: r.toolsUsed,
    toolCount: r.toolsUsed.length,
    editedFiles: r.editedFiles,
    referencedFiles: r.referencedFiles,
    skillsUsed: r.skillsUsed,
    customInstructions: r.customInstructions,
    slashCommand: r.slashCommand,
    modelId: r.modelId,
    isAllCaps: Boolean(r.isAllCaps),
    hasProfanity: Boolean(r.hasProfanity),
    promptTokens: r.promptTokens ?? 0,
    completionTokens: r.completionTokens ?? 0,
    cacheReadTokens: r.cacheReadTokens ?? 0,
    cacheWriteTokens: r.cacheWriteTokens ?? 0,
    totalElapsed: r.totalElapsed ?? 0,
    workType: r.workType,
    timestamp: r.timestamp,
    hour: r.timestamp != null ? new Date(r.timestamp).getUTCHours() : -1,
    dayOfWeek: r.timestamp != null ? new Date(r.timestamp).getUTCDay() : -1,
    harness: r.session.harness,
    sessionRequestCount: r.session.requests.length,
  }));

  const sessionRows = sessions.map((s) => ({
    requestCount: s.requests.length,
    harness: s.harness,
    workspaceName: s.workspaceName,
    durationMs: (s.endedAt ?? 0) - (s.startedAt ?? 0),
    cancelRate: s.requests.length ? s.requests.filter((r) => r.isCanceled).length / s.requests.length : 0,
  }));

  return signals.map((signal) => {
    const rows = signal.scope === 'sessions' ? sessionRows : requestRows;
    const matched = rows.filter((row) => {
      try {
        return signal.match(row, signal.thresholds);
      } catch {
        return false;
      }
    });
    const count = matched.length;
    const total = rows.length || 1;
    const ratio = count / total;
    const aggregate = signal.aggregate ?? 'ratio';
    const stats = { count, total, ratio };
    const triggered = signal.check
      ? signal.check(stats, signal.thresholds)
      : aggregate === 'count'
        ? count > (signal.thresholds.minCount ?? 0)
        : aggregate === 'some'
          ? count > 0
          : ratio > (signal.thresholds.maxRatio ?? 0.2) && count > (signal.thresholds.minSample ?? 3);

    const examples = matched.slice(0, 5).map((row) => {
      if (signal.example) return signal.example(row);
      const rec = row as Record<string, unknown>;
      return String(rec.messageText || rec.workspaceName || '');
    });

    return {
      id: signal.id,
      name: signal.name,
      group: signal.group,
      severity: signal.severity,
      triggered,
      count,
      total,
      pct: Number((ratio * 100).toFixed(1)),
      message: template(signal.whenTriggered, {
        count,
        total,
        pct: Number((ratio * 100).toFixed(1)),
        ...Object.fromEntries(Object.entries(signal.thresholds).map(([k, v]) => [k, v])),
      }),
      improvement: signal.howToImprove,
      examples,
    };
  });
}

/** Parse a minimal SignalSpec markdown file into a definition (for dynamic local rules). */
export function parseSignalMarkdown(markdown: string, fallbackMatch?: SignalDefinition['match']): SignalDefinition | null {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const meta: Record<string, string> = {};
  const thresholds: SignalThresholds = {};
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (key === 'thresholds') continue;
    if (/^\s+\w+:/.test(line)) continue;
    meta[key] = val.replace(/^\[|\]$/g, '');
  }
  // thresholds nested
  const thBlock = fm[1].match(/thresholds:\n((?:\s+\w+:\s*.+\n?)+)/);
  if (thBlock) {
    for (const line of thBlock[1].split('\n')) {
      const m = line.match(/^\s+(\w+):\s*([0-9.]+)/);
      if (m) thresholds[m[1]] = Number(m[2]);
    }
  }

  const section = (title: string) => {
    const re = new RegExp(`# ${title}\\n([\\s\\S]*?)(?=\\n# |$)`);
    return (markdown.match(re)?.[1] || '').trim();
  };

  if (!meta.id || !meta.name) return null;

  return {
    id: meta.id,
    name: meta.name,
    group: (meta.group as PracticeGroup) || 'prompt-quality',
    severity: (meta.severity as Severity) || 'medium',
    scope: meta.scope === 'sessions' ? 'sessions' : 'requests',
    version: Number(meta.version || 1),
    tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()) : [],
    thresholds,
    description: section('Description'),
    whenTriggered: section('When Triggered') || '{{count}} matches ({{pct}}%).',
    howToImprove: section('How to Improve') || 'Adjust your practice.',
    match:
      fallbackMatch ||
      ((row, th) => {
        const minChars = th.minChars ?? 0;
        return Number(row.messageLength || 0) < minChars && Number(row.messageLength || 0) > 0;
      }),
  };
}
