import { PRACTICE_LABELS, SKU_AI_CREDITS } from '../domain/constants';
import { priceRequest, type CostProvenance } from '../domain/pricing';
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
import { getHubDelivery } from './hub';
import { computeFlowState } from './flow';
import {
  getCodeProduction,
  getCuriosityDeep,
  getContextDeep,
  getPatternsDeep,
  getRuleCoverage,
  getSkillCatalog,
  getVibeRole,
  previousWeekFilter,
  withWow,
} from './deep';
import { buildSafePredicate } from './predicate';

export class Analyzer {
  private ingestDiag: unknown = null;
  private extensionVersion = '';

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

  setIngestDiag(d: unknown, extensionVersion?: string): void {
    this.ingestDiag = d;
    if (extensionVersion != null) this.extensionVersion = extensionVersion;
  }

  private scoped(filter?: DateFilter): Session[] {
    return filterSessions(this.sessions, filter);
  }

  getMeta() {
    const harnesses = [...new Set(this.sessions.map((s) => s.harness))].sort();
    let currentWorkspaceId = '';
    let latest = -1;
    for (const s of this.sessions) {
      const t = s.startedAt ?? s.requests[0]?.timestamp ?? 0;
      if (t >= latest) {
        latest = t;
        currentWorkspaceId = s.workspaceId;
      }
    }
    if (!currentWorkspaceId) {
      currentWorkspaceId = [...this.workspaces.keys()][0] || '';
    }
    return {
      sessionCount: this.sessions.length,
      requestCount: this.sessions.reduce((n, s) => n + s.requests.length, 0),
      workspaces: [...this.workspaces.values()].map((w) => ({ id: w.id, name: w.name })),
      harnesses,
      currentWorkspaceId,
      latestActivityAt: latest > 0 ? latest : Date.now(),
      dateRanges: ['7d', '28d', '90d', '180d', 'all'] as const,
      extensionVersion: this.extensionVersion || undefined,
      ingestDiag: this.ingestDiag ?? undefined,
    };
  }

  getOverview(filter: DateFilter = {}) {
    const sessions = this.scoped(filter);
    const requests = allRequests(sessions);
    const aiLoc = requests.reduce((n, r) => n + r.aiCode.reduce((m, c) => m + c.lineCount, 0), 0);
    const userLoc = requests.reduce((n, r) => n + r.userCode.reduce((m, c) => m + c.lineCount, 0), 0);
    const canceled = requests.filter((r) => r.isCanceled).length;
    const empty = sessions.length === 0;
    const practiceBase = empty ? [] : this.getPracticeScores(filter);
    const prevPractice = empty ? [] : this.getPracticeScores(previousWeekFilter(filter));
    const practice = withWow(practiceBase, prevPractice);
    const activity = this.getDailyActivity(filter);
    const avgScore = practice.length ? Math.round(practice.reduce((n, p) => n + p.score, 0) / practice.length) : 0;
    const habits = empty ? [] : this.getHabits(filter).filter((h) => h.triggered);
    const skills = empty ? [] : this.getSkillCatalog(filter).custom;
    const flow = empty
      ? { overallFlowScore: 0, suggestions: [] as string[] }
      : this.getFlowState(filter);
    const vibe = empty ? null : getVibeRole(practiceBase, this.getHabits(filter));
    const production = getCodeProduction(this.sessions, filter);
    const languages = production.byLanguage.labels.slice(0, 6);

    const byHarness: Record<string, number> = {};
    for (const s of sessions) byHarness[s.harness] = (byHarness[s.harness] || 0) + 1;

    const topHabit = habits.sort((a, b) => b.pct - a.pct)[0];
    const recommendations = [
      ...practice
        .filter((p) => p.score < 70)
        .slice(0, 2)
        .map((p) => {
          const tip = p.findings.find((f) => f.triggered)?.improvement;
          return tip || `Raise ${p.label} (currently ${p.score}).`;
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
      vibe,
      languages,
      skillPreview: skills.slice(0, 4),
      badges: {
        sessions: sessions.length,
        aiLoc,
        habits: habits.length,
        skills: skills.length,
        budgetPct: this.getBudget(filter).pct,
      },
    };
  }

  getCodeProduction(filter: DateFilter = {}) {
    return getCodeProduction(this.sessions, filter);
  }

  getPatternsDeep(filter: DateFilter = {}) {
    return getPatternsDeep(this.sessions, filter);
  }

  getCuriosityDeep(filter: DateFilter = {}) {
    return getCuriosityDeep(this.sessions, filter);
  }

  getContextDeep(filter: DateFilter = {}) {
    return getContextDeep(this.sessions, filter);
  }

  getSkillCatalog(filter: DateFilter = {}) {
    return getSkillCatalog(this.sessions, filter);
  }

  getRuleCoverage(filter: DateFilter = {}) {
    return getRuleCoverage(this.getHabits(filter), this.scoped(filter));
  }

  getWellbeing(filter: DateFilter = {}) {
    const patterns = getPatternsDeep(this.sessions, filter);
    const flow = this.getFlowState(filter);
    return {
      ...patterns,
      flowScore: flow.overallFlowScore,
      suggestions: [
        ...(patterns.lateNightRatio > 0.25
          ? [`${Math.round(patterns.lateNightRatio * 100)}% of turns are late-night — protect sleep.`]
          : []),
        ...(patterns.weekendRatio > 0.3
          ? [`${Math.round(patterns.weekendRatio * 100)}% weekend activity — schedule recovery.`]
          : []),
        ...flow.suggestions.slice(0, 2),
      ].slice(0, 5),
    };
  }

  getInsights(filter: DateFilter = {}) {
    const overview = this.getOverview(filter);
    const curiosity = getCuriosityDeep(this.sessions, filter);
    const context = getContextDeep(this.sessions, filter);
    return {
      practiceScore: overview.practiceScore,
      vibe: overview.vibe,
      recommendations: overview.recommendations,
      curiosityTier: curiosity.balance.tier,
      contextScore: context.overall,
      topHabits: this.getHabits(filter)
        .filter((h) => h.triggered)
        .slice(0, 5),
      flowScore: overview.flowScore,
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

  /** Day-grouped timeline for Observe overview (clean-room alternative to AEC swimlane). */
  getTimelineByDay(filter: DateFilter = {}) {
    const rows = this.getTimeline(filter);
    const byDay = new Map<
      string,
      {
        date: string;
        sessions: typeof rows;
        requests: number;
        aiLoc: number;
      }
    >();
    for (const r of rows) {
      const date = dayKey(r.startedAt);
      if (!byDay.has(date)) byDay.set(date, { date, sessions: [], requests: 0, aiLoc: 0 });
      const day = byDay.get(date)!;
      day.sessions.push(r);
      day.requests += r.requestCount;
      day.aiLoc += r.aiLoc;
    }
    return [...byDay.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({
        date: d.date,
        sessionCount: d.sessions.length,
        requests: d.requests,
        aiLoc: d.aiLoc,
        harnesses: [...new Set(d.sessions.map((s) => s.harness))],
        sessions: d.sessions,
      }));
  }

  getLabReference() {
    return {
      fields: [
        { name: 'messageLength', type: 'number', note: 'Prompt character count' },
        { name: 'modelId', type: 'string', note: 'Model identifier' },
        { name: 'toolCount', type: 'number', note: 'Tools invoked on the turn' },
        { name: 'aiLoc', type: 'number', note: 'AI-produced lines on the turn' },
        { name: 'promptTokens', type: 'number', note: 'Prompt tokens when present' },
        { name: 'isCanceled', type: 'boolean', note: 'Turn canceled by user' },
        { name: 'workType', type: 'string', note: 'feature | bugfix | refactor | test | docs…' },
        { name: 'harness', type: 'string', note: 'Source agent harness' },
      ],
      operators: ['<', '>', '<=', '>=', '==', '!=', 'AND', 'OR', '(', ')'],
      examples: [
        'messageLength < 30 AND messageLength > 0',
        'aiLoc > 80 AND toolCount < 2',
        'isCanceled == true',
        'workType == "test" OR workType == "docs"',
        'promptTokens > 8000',
      ],
      tip: 'Lab predicates are a safe subset for exploration. Persist durable rules as SignalSpec markdown in Rule Studio (trusted locally before load).',
    };
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
    const sessions = this.scoped(filter);
    const requests = allRequests(sessions);
    let credits = 0;
    let usd = 0;
    let cacheSavedUsd = 0;
    let cacheWriteUsd = 0;
    let cacheReadUsd = 0;
    const daily: Record<string, { credits: number; usd: number }> = {};
    const byModel: Record<string, { credits: number; usd: number; requests: number; estimated: number }> = {};
    const byHarness: Record<string, { credits: number; usd: number; requests: number; estimated: number }> = {};
    const byRepo: Record<string, { credits: number; usd: number; requests: number; estimated: number }> = {};
    const provenanceCounts: Record<CostProvenance, number> = {
      billed: 0,
      'token-priced': 0,
      estimated: 0,
    };

    for (const r of requests) {
      const priced = priceRequest(r);
      credits += priced.credits;
      usd += priced.usd;
      cacheSavedUsd += priced.cacheSavedUsd;
      cacheWriteUsd += priced.cacheWriteUsd;
      cacheReadUsd += priced.cacheReadUsd;
      provenanceCounts[priced.provenance] += 1;

      const d = dayKey(r.timestamp);
      if (d !== 'unknown') {
        if (!daily[d]) daily[d] = { credits: 0, usd: 0 };
        daily[d].credits += priced.credits;
        daily[d].usd += priced.usd;
      }

      const model = r.modelId || 'unknown';
      if (!byModel[model]) byModel[model] = { credits: 0, usd: 0, requests: 0, estimated: 0 };
      byModel[model].credits += priced.credits;
      byModel[model].usd += priced.usd;
      byModel[model].requests += 1;
      if (priced.provenance === 'estimated') byModel[model].estimated += 1;

      const harness = r.session.harness || 'unknown';
      if (!byHarness[harness]) byHarness[harness] = { credits: 0, usd: 0, requests: 0, estimated: 0 };
      byHarness[harness].credits += priced.credits;
      byHarness[harness].usd += priced.usd;
      byHarness[harness].requests += 1;
      if (priced.provenance === 'estimated') byHarness[harness].estimated += 1;

      const repo = r.session.workspaceName || r.session.workspaceId || 'unknown';
      if (!byRepo[repo]) byRepo[repo] = { credits: 0, usd: 0, requests: 0, estimated: 0 };
      byRepo[repo].credits += priced.credits;
      byRepo[repo].usd += priced.usd;
      byRepo[repo].requests += 1;
      if (priced.provenance === 'estimated') byRepo[repo].estimated += 1;
    }

    const budget = sku === 'custom' ? customCredits : SKU_AI_CREDITS[sku] || SKU_AI_CREDITS.pro;
    const estimatedShare =
      requests.length === 0 ? 0 : Number(((provenanceCounts.estimated / requests.length) * 100).toFixed(1));

    // Linear end-of-month forecast from month-to-date burn (UTC calendar month).
    const now = new Date();
    const dayOfMonth = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const forecastCredits =
      dayOfMonth > 0 ? Number(((credits / dayOfMonth) * daysInMonth).toFixed(2)) : Number(credits.toFixed(2));
    const forecastUsd =
      dayOfMonth > 0 ? Number(((usd / dayOfMonth) * daysInMonth).toFixed(4)) : Number(usd.toFixed(4));
    const runOutDay =
      budget > 0 && credits > 0
        ? Math.min(daysInMonth, Math.ceil((budget * dayOfMonth) / credits))
        : null;

    const sortRows = (rows: Record<string, { credits: number; usd: number; requests: number; estimated: number }>) =>
      Object.entries(rows)
        .map(([key, v]) => ({
          key,
          credits: Number(v.credits.toFixed(4)),
          usd: Number(v.usd.toFixed(6)),
          requests: v.requests,
          estimated: v.estimated,
          est: v.estimated > 0,
        }))
        .sort((a, b) => b.usd - a.usd);

    return {
      creditsUsed: Number(credits.toFixed(2)),
      usdEstimate: Number(usd.toFixed(4)),
      budget,
      remaining: Number((budget - credits).toFixed(2)),
      pct: budget ? Number(((credits / budget) * 100).toFixed(1)) : 0,
      daily: Object.entries(daily)
        .map(([date, value]) => ({
          date,
          credits: Number(value.credits.toFixed(4)),
          usd: Number(value.usd.toFixed(6)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [
          k,
          {
            credits: Number(v.credits.toFixed(4)),
            usd: Number(v.usd.toFixed(6)),
            requests: v.requests,
            estimated: v.estimated,
          },
        ]),
      ),
      byHarness: sortRows(byHarness),
      byRepo: sortRows(byRepo).slice(0, 50),
      cacheEconomics: {
        savedOnCacheReadsUsd: Number(cacheSavedUsd.toFixed(4)),
        paidForCacheWritesUsd: Number(cacheWriteUsd.toFixed(4)),
        cacheReadUsd: Number(cacheReadUsd.toFixed(4)),
        netUsd: Number((cacheSavedUsd - cacheWriteUsd).toFixed(4)),
      },
      provenanceCounts,
      estimatedShare,
      forecast: {
        credits: forecastCredits,
        usd: forecastUsd,
        runOutDay,
        daysInMonth,
      },
      disclaimer:
        'Local spend ledger (billed units when present, else tokens×rate, else ~est). Not a subscription invoice — provider billing remains source of truth.',
    };
  }

  getRhythm(filter: DateFilter = {}) {
    const deep = getPatternsDeep(this.sessions, filter);
    return {
      heatmap: deep.heatmap,
      lateNightRatio: deep.lateNightRatio,
      weekendRatio: deep.weekendRatio,
      total: deep.total,
      balanceScore: deep.balanceScore,
      hourly: deep.hourly,
      peakHour: deep.peakHour,
      calendar: deep.calendar,
      projects: deep.projects,
    };
  }

  getInquiry(filter: DateFilter = {}) {
    return getCuriosityDeep(this.sessions, filter);
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
    const deep = getContextDeep(this.sessions, filter);
    return {
      score: deep.score,
      managementScore: deep.managementScore,
      overall: deep.overall,
      checks: deep.qualityChecks,
      qualityChecks: deep.qualityChecks,
      managementChecks: deep.managementChecks,
      treemap: deep.treemap,
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
    return getSkillCatalog(this.sessions, filter).custom;
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

  exportSummary(filter: DateFilter = {}, opts?: { redactSensitive?: boolean }) {
    const overview = this.getOverview(filter);
    const habits = this.getHabits(filter).filter((h) => h.triggered);
    const share = this.getShareCard(filter);
    const redact = Boolean(opts?.redactSensitive);
    const habitLines = habits.slice(0, 8).map((h) => {
      const detail = redact ? `${h.count} finding(s)` : h.message;
      return `- **${h.name}** (${h.severity}): ${detail}`;
    });
    const jsonOverview = redact
      ? {
          ...overview,
          recommendations: overview.recommendations.map(() => '[redacted]'),
          skillPreview: [],
          topPattern: overview.topPattern ? '[redacted]' : null,
          vibe: overview.vibe ? { ...overview.vibe, reason: '[redacted]', topPattern: null } : overview.vibe,
        }
      : overview;
    return {
      json: { overview: jsonOverview, habits: redact ? habits.map((h) => ({ ...h, message: '[redacted]', examples: [], improvement: '[redacted]' })) : habits, share },
      markdown: [
        `# Cadence Snapshot`,
        ``,
        `- Sessions: **${overview.sessions}**`,
        `- Requests: **${overview.requests}**`,
        `- AI LOC: **${overview.aiLoc}**`,
        `- Practice score: **${overview.practiceScore}**`,
        redact ? `- Redaction: **on** (prompt excerpts omitted)` : '',
        ``,
        `## Top habits to refine`,
        ...habitLines,
        ``,
        `_Generated locally by Cadence. No data left this machine._`,
      ]
        .filter((line) => line !== '')
        .join('\n'),
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

