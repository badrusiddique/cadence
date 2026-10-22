import {
  LATE_NIGHT_END,
  LATE_NIGHT_START,
  PRACTICE_LABELS,
  SKU_AI_CREDITS,
  modelMultiplier,
  tokenRateFor,
} from '../domain/constants';
import type {
  DailyActivity,
  DateFilter,
  HabitFinding,
  PracticeGroup,
  PracticeScore,
  Session,
  Workspace,
} from '../domain/types';
import { evaluateSignals, type SignalDefinition } from '../signals/engine';
import { allRequests, dayKey, filterSessions } from './filter';
import { buildPracticePack } from './learning';
import { getHubDelivery, getSkillDrafts } from './hub';
import { computeFlowState } from './flow';

export class Analyzer {
  constructor(
    private sessions: Session[],
    private workspaces: Map<string, Workspace>,
    private signals: SignalDefinition[] = [],
  ) {}

  replaceData(sessions: Session[], workspaces: Map<string, Workspace>): void {
    this.sessions = sessions;
    this.workspaces = workspaces;
  }

  setSignals(signals: SignalDefinition[]): void {
    this.signals = signals;
  }

  private scoped(filter?: DateFilter): Session[] {
    return filterSessions(this.sessions, filter);
  }

  getMeta() {
    const harnesses = [...new Set(this.sessions.map((s) => s.harness))].sort();
    return {
      sessionCount: this.sessions.length,
      requestCount: this.sessions.reduce((n, s) => n + s.requests.length, 0),
      workspaces: [...this.workspaces.values()].map((w) => ({ id: w.id, name: w.name })),
      harnesses,
    };
  }

  getOverview(filter: DateFilter = {}) {
    const sessions = this.scoped(filter);
    const requests = allRequests(sessions);
    const aiLoc = requests.reduce((n, r) => n + r.aiCode.reduce((m, c) => m + c.lineCount, 0), 0);
    const userLoc = requests.reduce((n, r) => n + r.userCode.reduce((m, c) => m + c.lineCount, 0), 0);
    const canceled = requests.filter((r) => r.isCanceled).length;
    const practice = this.getPracticeScores(filter);
    const activity = this.getDailyActivity(filter);
    const avgScore = practice.length ? Math.round(practice.reduce((n, p) => n + p.score, 0) / practice.length) : 0;
    const habits = this.getHabits(filter).filter((h) => h.triggered);
    const skills = this.getSkillCandidates(filter);
    const flow = this.getFlowState(filter);

    const byHarness: Record<string, number> = {};
    for (const s of sessions) byHarness[s.harness] = (byHarness[s.harness] || 0) + 1;

    const topHabit = habits.sort((a, b) => b.pct - a.pct)[0];
    const recommendations = [
      ...practice
        .filter((p) => p.score < 70)
        .slice(0, 2)
        .map((p) => {
          const tip = p.findings.find((f) => f.triggered)?.improvement;
          return tip || `Raise ${p.label} — currently ${p.score}.`;
        }),
      ...flow.suggestions.slice(0, 1),
      ...(skills[0] ? [`Repeated prompt (${skills[0].count}×): turn it into a skill.`] : []),
    ].slice(0, 4);

    return {
      sessions: sessions.length,
      requests: requests.length,
      aiLoc,
      userLoc,
      canceled,
      cancelRate: requests.length ? canceled / requests.length : 0,
      practiceScore: avgScore,
      practice,
      activity,
      byHarness,
      topWorkspaces: this.topWorkspaces(sessions, 5),
      habitCount: habits.length,
      skillCount: skills.length,
      flowScore: flow.overallFlowScore,
      topPattern: topHabit?.name ?? null,
      recommendations,
      badges: {
        sessions: sessions.length,
        aiLoc,
        habits: habits.length,
        skills: skills.length,
        budgetPct: this.getBudget(filter).pct,
      },
    };
  }

  getDailyActivity(filter: DateFilter = {}): DailyActivity[] {
    const map = new Map<string, DailyActivity>();
    for (const session of this.scoped(filter)) {
      for (const req of session.requests) {
        const date = dayKey(req.timestamp);
        if (date === 'unknown') continue;
        if (!map.has(date)) {
          map.set(date, { date, requests: 0, sessions: 0, aiLoc: 0, userLoc: 0, harnesses: {} });
        }
        const row = map.get(date)!;
        row.requests += 1;
        row.aiLoc += req.aiCode.reduce((n, c) => n + c.lineCount, 0);
        row.userLoc += req.userCode.reduce((n, c) => n + c.lineCount, 0);
        row.harnesses[session.harness] = (row.harnesses[session.harness] || 0) + 1;
      }
      const start = dayKey(session.startedAt ?? session.requests[0]?.timestamp ?? null);
      if (start !== 'unknown' && map.has(start)) map.get(start)!.sessions += 1;
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getTimeline(filter: DateFilter = {}) {
    return this.scoped(filter)
      .map((s) => ({
        sessionId: s.sessionId,
        workspaceId: s.workspaceId,
        workspaceName: s.workspaceName,
        harness: s.harness,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        requestCount: s.requestCount,
        aiLoc: s.requests.reduce((n, r) => n + r.aiCode.reduce((m, c) => m + c.lineCount, 0), 0),
        models: [...new Set(s.requests.map((r) => r.modelId).filter(Boolean))],
        title: s.title || s.requests[0]?.messageText.slice(0, 80) || s.sessionId,
      }))
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }

  getSessionDetail(sessionId: string) {
    const s = this.sessions.find((x) => x.sessionId === sessionId);
    if (!s) return null;
    return {
      sessionId: s.sessionId,
      workspaceName: s.workspaceName,
      harness: s.harness,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      title: s.title || s.requests[0]?.messageText.slice(0, 120) || s.sessionId,
      requestCount: s.requests.length,
      requests: s.requests.map((r) => ({
        requestId: r.requestId,
        timestamp: r.timestamp,
        messageText: r.messageText.slice(0, 240),
        modelId: r.modelId,
        toolsUsed: r.toolsUsed,
        aiLoc: r.aiCode.reduce((n, c) => n + c.lineCount, 0),
        isCanceled: r.isCanceled,
        workType: r.workType,
        totalElapsed: r.totalElapsed,
      })),
    };
  }

  getHarnessComparison(filter: DateFilter = {}) {
    const sessions = this.scoped(filter);
    const map = new Map<
      string,
      { harness: string; sessions: number; requests: number; aiLoc: number; canceled: number; tools: number }
    >();
    for (const s of sessions) {
      if (!map.has(s.harness)) {
        map.set(s.harness, { harness: s.harness, sessions: 0, requests: 0, aiLoc: 0, canceled: 0, tools: 0 });
      }
      const row = map.get(s.harness)!;
      row.sessions += 1;
      row.requests += s.requests.length;
      for (const r of s.requests) {
        row.aiLoc += r.aiCode.reduce((n, c) => n + c.lineCount, 0);
        if (r.isCanceled) row.canceled += 1;
        if (r.toolsUsed.length) row.tools += 1;
      }
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        cancelRate: r.requests ? r.canceled / r.requests : 0,
        toolRate: r.requests ? r.tools / r.requests : 0,
        locPerRequest: r.requests ? Math.round(r.aiLoc / r.requests) : 0,
      }))
      .sort((a, b) => b.requests - a.requests);
  }

  getFlowState(filter: DateFilter = {}) {
    return computeFlowState(this.sessions, filter);
  }

  getThroughput(filter: DateFilter = {}) {
    const requests = allRequests(this.scoped(filter));
    const byLanguage: Record<string, number> = {};
    const byModel: Record<string, { requests: number; aiLoc: number; tokens: number }> = {};
    const byHarness: Record<string, { requests: number; aiLoc: number }> = {};

    let aiLoc = 0;
    let userLoc = 0;
    for (const r of requests) {
      const loc = r.aiCode.reduce((n, c) => n + c.lineCount, 0);
      aiLoc += loc;
      userLoc += r.userCode.reduce((n, c) => n + c.lineCount, 0);
      for (const block of r.aiCode) byLanguage[block.language] = (byLanguage[block.language] || 0) + block.lineCount;
      const model = r.modelId || 'unknown';
      if (!byModel[model]) byModel[model] = { requests: 0, aiLoc: 0, tokens: 0 };
      byModel[model].requests += 1;
      byModel[model].aiLoc += loc;
      byModel[model].tokens += (r.promptTokens || 0) + (r.completionTokens || 0);
      const h = r.session.harness;
      if (!byHarness[h]) byHarness[h] = { requests: 0, aiLoc: 0 };
      byHarness[h].requests += 1;
      byHarness[h].aiLoc += loc;
    }

    return { aiLoc, userLoc, byLanguage, byModel, byHarness, estimateNote: 'Token figures are local estimates, not billing.' };
  }

  getBudget(filter: DateFilter = {}, sku = 'pro', customCredits = 1000) {
    const requests = allRequests(this.scoped(filter));
    let credits = 0;
    let usd = 0;
    const daily: Record<string, number> = {};
    const byModel: Record<string, { credits: number; usd: number; requests: number }> = {};

    for (const r of requests) {
      const mult = modelMultiplier(r.modelId || 'auto');
      const requestCredits = mult;
      credits += requestCredits;
      const rate = tokenRateFor(r.modelId || '');
      const input = r.promptTokens || 0;
      const output = r.completionTokens || 0;
      const cached = r.cacheReadTokens || 0;
      const write = r.cacheWriteTokens || 0;
      const cost =
        (input / 1e6) * rate.input +
        (cached / 1e6) * rate.cached +
        (output / 1e6) * rate.output +
        (write / 1e6) * (rate.cacheWrite || rate.input);
      usd += cost;
      const d = dayKey(r.timestamp);
      if (d !== 'unknown') daily[d] = (daily[d] || 0) + requestCredits;
      const model = r.modelId || 'unknown';
      if (!byModel[model]) byModel[model] = { credits: 0, usd: 0, requests: 0 };
      byModel[model].credits += requestCredits;
      byModel[model].usd += cost;
      byModel[model].requests += 1;
    }

    const budget = sku === 'custom' ? customCredits : SKU_AI_CREDITS[sku] || SKU_AI_CREDITS.pro;
    return {
      creditsUsed: Number(credits.toFixed(2)),
      usdEstimate: Number(usd.toFixed(4)),
      budget,
      remaining: Number((budget - credits).toFixed(2)),
      pct: budget ? Number(((credits / budget) * 100).toFixed(1)) : 0,
      daily: Object.entries(daily)
        .map(([date, value]) => ({ date, credits: value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byModel,
      disclaimer: 'Local estimates only. Do not use for billing reconciliation.',
    };
  }

  getRhythm(filter: DateFilter = {}) {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    let lateNight = 0;
    let weekend = 0;
    let total = 0;

    for (const r of allRequests(this.scoped(filter))) {
      if (r.timestamp == null) continue;
      const d = new Date(r.timestamp);
      const dow = d.getUTCDay();
      const hour = d.getUTCHours();
      grid[dow][hour] += 1;
      total += 1;
      if (hour >= LATE_NIGHT_START || hour < LATE_NIGHT_END) lateNight += 1;
      if (dow === 0 || dow === 6) weekend += 1;
    }

    return {
      heatmap: grid,
      lateNightRatio: total ? lateNight / total : 0,
      weekendRatio: total ? weekend / total : 0,
      total,
      balanceScore: Math.max(0, Math.round(100 - (lateNight / Math.max(total, 1)) * 120 - (weekend / Math.max(total, 1)) * 80)),
    };
  }

  getInquiry(filter: DateFilter = {}) {
    const requests = allRequests(this.scoped(filter));
    const questions = requests.filter((r) => /\?/.test(r.messageText) || /^(what|why|how|where|when|who)\b/i.test(r.messageText.trim()));
    const explore = requests.filter((r) => r.toolsUsed.some((t) => /search|grep|glob|explore|read/i.test(t)));
    return {
      inquirySessions: this.scoped(filter).filter((s) => s.requests.some((r) => /\?/.test(r.messageText))).length,
      questionRequests: questions.length,
      investigationRequests: explore.length,
      topQuestions: questions.slice(0, 12).map((r) => r.messageText.slice(0, 120)),
      languages: this.languageContext(requests),
    };
  }

  getHabits(filter: DateFilter = {}): HabitFinding[] {
    const sessions = this.scoped(filter);
    if (this.signals.length === 0) return this.fallbackHabits(sessions);
    return evaluateSignals(this.signals, sessions);
  }

  getPracticeScores(filter: DateFilter = {}): PracticeScore[] {
    const findings = this.getHabits(filter);
    const groups: PracticeGroup[] = [
      'prompt-quality',
      'session-hygiene',
      'code-review',
      'tool-mastery',
      'context-management',
    ];
    return groups.map((group) => {
      const gf = findings.filter((f) => f.group === group);
      const triggered = gf.filter((f) => f.triggered);
      const severityWeight = { low: 1, medium: 2, high: 3 } as const;
      const penalty = triggered.reduce((n, f) => n + severityWeight[f.severity], 0);
      const score = Math.max(0, Math.min(100, 100 - penalty * 8));
      return {
        group,
        label: PRACTICE_LABELS[group],
        score,
        previousScore: null,
        findings: gf,
      };
    });
  }

  getContextHealth(filter: DateFilter = {}) {
    const sessions = this.scoped(filter);
    const requests = allRequests(sessions);
    const withFiles = requests.filter((r) => r.referencedFiles.length > 0 || r.editedFiles.length > 0).length;
    const withInstructions = requests.filter((r) => r.customInstructions.length > 0).length;
    const withSkills = requests.filter((r) => r.skillsUsed.length > 0).length;
    const withTools = requests.filter((r) => r.toolsUsed.length > 0).length;
    const total = requests.length || 1;
    const score = Math.round(
      ((withFiles / total) * 25 + (withInstructions / total) * 25 + (withSkills / total) * 25 + (withTools / total) * 25) *
        (100 / 25),
    );
    return {
      score: Math.min(100, score),
      checks: [
        { id: 'file-context', label: 'Prompts reference or edit files', pass: withFiles / total > 0.2, value: withFiles },
        { id: 'instructions', label: 'Custom instructions used', pass: withInstructions > 0, value: withInstructions },
        { id: 'skills', label: 'Skills invoked', pass: withSkills > 0, value: withSkills },
        { id: 'tools', label: 'Tool-using agent turns', pass: withTools / total > 0.3, value: withTools },
      ],
      workspaces: [...this.workspaces.values()],
    };
  }

  getAchievements(filter: DateFilter = {}) {
    const overview = this.getOverview(filter);
    const practice = overview.practiceScore;
    const xp = overview.requests * 3 + overview.aiLoc + practice * 5;
    const tier =
      xp > 20000 ? 'Diamond' : xp > 8000 ? 'Gold' : xp > 2500 ? 'Silver' : xp > 500 ? 'Bronze' : 'Starter';
    return {
      xp,
      tier,
      badges: [
        { id: 'first-sessions', name: 'Getting Started', earned: overview.sessions >= 1 },
        { id: 'polyglot', name: 'Polyglot Output', earned: Object.keys(this.getThroughput(filter).byLanguage).length >= 2 },
        { id: 'steady', name: 'Steady Cadence', earned: overview.activity.length >= 3 },
        { id: 'craft', name: 'Craft Score 70+', earned: practice >= 70 },
        { id: 'flow', name: 'Low Cancel Rate', earned: overview.cancelRate < 0.1 },
      ],
    };
  }

  getSdlc(filter: DateFilter = {}) {
    const counts: Record<string, number> = {
      feature: 0,
      bugfix: 0,
      refactor: 0,
      test: 0,
      docs: 0,
      unknown: 0,
    };
    for (const r of allRequests(this.scoped(filter))) {
      counts[r.workType] = (counts[r.workType] || 0) + 1;
    }
    return { phases: counts };
  }

  getSkillCandidates(filter: DateFilter = {}) {
    return getSkillDrafts(this.sessions, filter);
  }

  getPracticePack(filter: DateFilter = {}) {
    return buildPracticePack(this.getPracticeScores(filter), this.getHabits(filter));
  }

  getHub(filter: DateFilter = {}) {
    return getHubDelivery(this.sessions, filter);
  }

  testSignal(signal: SignalDefinition, filter: DateFilter = {}) {
    const findings = evaluateSignals([signal], this.scoped(filter));
    return findings[0] ?? null;
  }

  evaluateLabPredicate(expression: string, filter: DateFilter = {}) {
    const rows = this.getFieldBrowser(filter).sample as Array<Record<string, unknown>>;
    const fn = buildSafePredicate(expression);
    const matched = rows.filter((row) => {
      try {
        return fn(row);
      } catch {
        return false;
      }
    });
    return {
      expression,
      total: rows.length,
      matched: matched.length,
      ratio: rows.length ? matched.length / rows.length : 0,
      samples: matched.slice(0, 8),
      evidence: { state: 'derived' as const, confidence: 'medium' as const, authority: 'signal-engine' as const },
    };
  }

  getShareCard(filter: DateFilter = {}) {
    const o = this.getOverview(filter);
    const a = this.getAchievements(filter);
    return {
      title: 'My Cadence',
      sessions: o.sessions,
      requests: o.requests,
      aiLoc: o.aiLoc,
      practiceScore: o.practiceScore,
      tier: a.tier,
      xp: a.xp,
      generatedAt: new Date().toISOString(),
    };
  }

  getMoments(filter: DateFilter = {}) {
    // Screenshot moments require binary assets; surface session highlights instead.
    return this.scoped(filter)
      .flatMap((s) =>
        s.requests
          .filter((r) => r.aiCode.some((c) => c.lineCount > 20))
          .map((r) => ({
            sessionId: s.sessionId,
            workspaceName: s.workspaceName,
            harness: s.harness,
            timestamp: r.timestamp,
            caption: r.messageText.slice(0, 100),
            loc: r.aiCode.reduce((n, c) => n + c.lineCount, 0),
          })),
      )
      .slice(0, 40);
  }

  getFieldBrowser(filter: DateFilter = {}) {
    const requests = allRequests(this.scoped(filter));
    const sample = requests.slice(0, 50).map((r) => ({
      requestId: r.requestId,
      harness: r.session.harness,
      modelId: r.modelId,
      messageLength: r.messageLength,
      toolCount: r.toolsUsed.length,
      tools: r.toolsUsed.length,
      aiLoc: r.aiCode.reduce((n, c) => n + c.lineCount, 0),
      isCanceled: r.isCanceled,
      canceled: r.isCanceled,
      workType: r.workType,
      promptTokens: r.promptTokens ?? 0,
    }));
    return {
      fields: [
        'messageLength',
        'modelId',
        'toolCount',
        'aiLoc',
        'promptTokens',
        'isCanceled',
        'workType',
        'harness',
      ],
      sample,
      count: requests.length,
    };
  }

  exportSummary(filter: DateFilter = {}) {
    const overview = this.getOverview(filter);
    const habits = this.getHabits(filter).filter((h) => h.triggered);
    const share = this.getShareCard(filter);
    return {
      json: { overview, habits, share },
      markdown: [
        `# Cadence Snapshot`,
        ``,
        `- Sessions: **${overview.sessions}**`,
        `- Requests: **${overview.requests}**`,
        `- AI LOC: **${overview.aiLoc}**`,
        `- Practice score: **${overview.practiceScore}**`,
        ``,
        `## Top habits to refine`,
        ...habits.slice(0, 8).map((h) => `- **${h.name}** (${h.severity}): ${h.message}`),
        ``,
        `_Generated locally by Cadence. No data left this machine._`,
      ].join('\n'),
    };
  }

  private topWorkspaces(sessions: Session[], n: number) {
    const map = new Map<string, { id: string; name: string; sessions: number; requests: number }>();
    for (const s of sessions) {
      if (!map.has(s.workspaceId)) map.set(s.workspaceId, { id: s.workspaceId, name: s.workspaceName, sessions: 0, requests: 0 });
      const row = map.get(s.workspaceId)!;
      row.sessions += 1;
      row.requests += s.requests.length;
    }
    return [...map.values()].sort((a, b) => b.requests - a.requests).slice(0, n);
  }

  private languageContext(requests: ReturnType<typeof allRequests>) {
    const map: Record<string, number> = {};
    for (const r of requests) for (const b of r.aiCode) map[b.language] = (map[b.language] || 0) + b.lineCount;
    return map;
  }

  private fallbackHabits(sessions: Session[]): HabitFinding[] {
    const requests = allRequests(sessions);
    const total = requests.length || 1;
    const short = requests.filter((r) => r.messageLength > 0 && r.messageLength < 30);
    const caps = requests.filter((r) => r.isAllCaps);
    const canceled = requests.filter((r) => r.isCanceled);
    const noTools = requests.filter((r) => r.toolsUsed.length === 0 && r.messageLength > 40);
    const mega = sessions.filter((s) => s.requests.length >= 30);

    const mk = (
      id: string,
      name: string,
      group: PracticeGroup,
      severity: HabitFinding['severity'],
      count: number,
      message: string,
      improvement: string,
      examples: string[],
    ): HabitFinding => ({
      id,
      name,
      group,
      severity,
      triggered: count / total > 0.15 || (id === 'mega-sessions' && count > 0),
      count,
      total,
      pct: Number(((count / total) * 100).toFixed(1)),
      message,
      improvement,
      examples,
      evidence: { state: 'derived', confidence: 'high', authority: 'signal-engine' },
    });

    return [
      mk('thin-prompts', 'Thin Prompts', 'prompt-quality', 'medium', short.length, `${short.length} requests are under 30 characters.`, 'Add intent, constraints, and expected shape.', short.slice(0, 3).map((r) => r.messageText)),
      mk('caps-lock', 'Shouting at the Model', 'prompt-quality', 'low', caps.length, `${caps.length} all-caps prompts.`, 'Rewrite calmly with specifics.', caps.slice(0, 3).map((r) => r.messageText)),
      mk('high-cancel', 'High Cancellation', 'session-hygiene', 'high', canceled.length, `${canceled.length} canceled turns.`, 'Clarify the goal before launching long agent runs.', []),
      mk('agentic-no-tools', 'Agent Mode Without Tools', 'tool-mastery', 'medium', noTools.length, `${noTools.length} long prompts used no tools.`, 'Prefer plan/ask mode for pure Q&A; reserve agent mode for tool work.', []),
      mk('mega-sessions', 'Mega Sessions', 'session-hygiene', 'medium', mega.length, `${mega.length} sessions exceed 30 turns.`, 'Split work into focused sessions with a clear outcome.', mega.slice(0, 3).map((s) => s.sessionId)),
    ];
  }
}

/** Tiny sandbox for Signal Lab — identifiers become row lookups; no free JS. */
function buildSafePredicate(expression: string): (row: Record<string, unknown>) => boolean {
  const expr = expression.trim();
  if (!expr) return () => false;
  if (/[^a-zA-Z0-9_\s.<>=!&|()'"]/.test(expr)) {
    throw new Error('Expression contains unsupported characters.');
  }
  return (row) => {
    const replaced = expr
      .replace(/\bAND\b/gi, '&&')
      .replace(/\bOR\b/gi, '||')
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (id) => {
        if (['true', 'false', 'null'].includes(id)) return id;
        if (/^\d/.test(id)) return id;
        const v = row[id];
        if (typeof v === 'string') return JSON.stringify(v);
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        if (v == null) return 'null';
        return JSON.stringify(v);
      });
    return Boolean(Function(`"use strict"; return (${replaced});`)());
  };
}

