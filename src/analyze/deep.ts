/**
 * Deep Measure/Improve analytics — clean-room parity with AEC output / patterns /
 * curiosity / context / skill-catalog surfaces, plus Cadence extras (WoW, vibe).
 */
import type { DateFilter, HabitFinding, PracticeScore, Session } from '../domain/types';
import { allRequests, dayKey, filterSessions } from './filter';

function add(map: Map<string, number>, key: string, n: number) {
  map.set(key, (map.get(key) || 0) + n);
}

function topEntries(map: Map<string, number>, n = 12) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function fillDays(keys: string[]): string[] {
  const valid = keys.filter((k) => k !== 'unknown').sort();
  if (!valid.length) return [];
  const out: string[] = [];
  const start = new Date(`${valid[0]}T12:00:00Z`);
  const end = new Date(`${valid[valid.length - 1]}T12:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function getCodeProduction(sessions: Session[], filter: DateFilter = {}) {
  const reqs = allRequests(filterSessions(sessions, filter));
  let totalAiLoc = 0;
  let totalUserLoc = 0;
  let aiBlocks = 0;
  const langAi = new Map<string, number>();
  const dailyAi = new Map<string, number>();
  const dailyUser = new Map<string, number>();
  const wsAi = new Map<string, number>();
  const modelAi = new Map<string, number>();
  const harnessAi = new Map<string, number>();
  const dailyModel = new Map<string, Map<string, number>>();
  const dailyHarness = new Map<string, Map<string, number>>();
  const dailyWs = new Map<string, Map<string, number>>();

  for (const r of reqs) {
    const day = dayKey(r.timestamp);
    const model = r.modelId || 'unknown';
    const harness = r.session.harness;
    const ws = r.session.workspaceName;
    for (const b of r.aiCode) {
      totalAiLoc += b.lineCount;
      aiBlocks += 1;
      add(langAi, b.language || 'unknown', b.lineCount);
      if (day !== 'unknown') add(dailyAi, day, b.lineCount);
      add(wsAi, ws, b.lineCount);
      add(modelAi, model, b.lineCount);
      add(harnessAi, harness, b.lineCount);
      if (day !== 'unknown') {
        if (!dailyModel.has(day)) dailyModel.set(day, new Map());
        add(dailyModel.get(day)!, model, b.lineCount);
        if (!dailyHarness.has(day)) dailyHarness.set(day, new Map());
        add(dailyHarness.get(day)!, harness, b.lineCount);
        if (!dailyWs.has(day)) dailyWs.set(day, new Map());
        add(dailyWs.get(day)!, ws, b.lineCount);
      }
    }
    for (const b of r.userCode) {
      totalUserLoc += b.lineCount;
      if (day !== 'unknown') add(dailyUser, day, b.lineCount);
    }
  }

  const days = fillDays([...dailyAi.keys(), ...dailyUser.keys()]);
  const langs = topEntries(langAi);
  const workspaces = topEntries(wsAi);
  const models = topEntries(modelAi);
  const harnesses = topEntries(harnessAi);

  return {
    summary: {
      totalAiLoc,
      totalUserLoc,
      totalLoc: totalAiLoc + totalUserLoc,
      totalNetAiLoc: totalAiLoc,
      aiBlocks,
      aiRatio: totalAiLoc + totalUserLoc ? totalAiLoc / (totalAiLoc + totalUserLoc) : 1,
    },
    byLanguage: { labels: langs.map(([k]) => k), aiLoc: langs.map(([, v]) => v) },
    byWorkspace: { labels: workspaces.map(([k]) => k), aiLoc: workspaces.map(([, v]) => v) },
    byModel: { labels: models.map(([k]) => k), aiLoc: models.map(([, v]) => v) },
    byHarness: { labels: harnesses.map(([k]) => k), aiLoc: harnesses.map(([, v]) => v) },
    dailyTimeline: {
      labels: days,
      aiLoc: days.map((d) => dailyAi.get(d) || 0),
      userLoc: days.map((d) => dailyUser.get(d) || 0),
    },
    dailyByModel: {
      labels: days,
      series: models.slice(0, 6).map(([name]) => ({
        name,
        values: days.map((d) => dailyModel.get(d)?.get(name) || 0),
      })),
    },
    dailyByHarness: {
      labels: days,
      series: harnesses.slice(0, 6).map(([name]) => ({
        name,
        values: days.map((d) => dailyHarness.get(d)?.get(name) || 0),
      })),
    },
    dailyByWorkspace: {
      labels: days,
      series: workspaces.slice(0, 6).map(([name]) => ({
        name,
        values: days.map((d) => dailyWs.get(d)?.get(name) || 0),
      })),
    },
    modes: [
      'code-output',
      'by-workspace',
      'by-harness',
      'by-model',
      'by-language',
      'net-output',
      'daily-model',
      'daily-harness',
    ] as const,
  };
}

export function getPatternsDeep(sessions: Session[], filter: DateFilter = {}) {
  const scoped = filterSessions(sessions, filter);
  const reqs = allRequests(scoped);
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const hourTotals = Array.from({ length: 24 }, () => 0);
  const calendar = new Map<string, { date: string; requests: number; sessions: number; aiLoc: number }>();
  const projects = new Map<
    string,
    { workspace: string; sessions: number; requests: number; aiLoc: number; harnesses: Record<string, number> }
  >();

  let late = 0;
  let weekend = 0;
  let timed = 0;

  for (const r of reqs) {
    if (r.timestamp == null) continue;
    const d = new Date(r.timestamp);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    heatmap[dow]![hour]! += 1;
    hourTotals[hour]! += 1;
    timed += 1;
    if (hour >= 22 || hour < 5) late += 1;
    if (dow === 0 || dow === 6) weekend += 1;
    const day = dayKey(r.timestamp);
    if (!calendar.has(day)) calendar.set(day, { date: day, requests: 0, sessions: 0, aiLoc: 0 });
    const cal = calendar.get(day)!;
    cal.requests += 1;
    cal.aiLoc += r.aiCode.reduce((n, c) => n + c.lineCount, 0);
  }

  const sessionDays = new Set<string>();
  for (const s of scoped) {
    const start = dayKey(s.startedAt ?? s.requests[0]?.timestamp ?? null);
    if (start !== 'unknown') {
      sessionDays.add(`${start}:${s.sessionId}`);
      if (calendar.has(start)) calendar.get(start)!.sessions += 1;
    }
    if (!projects.has(s.workspaceId)) {
      projects.set(s.workspaceId, {
        workspace: s.workspaceName,
        sessions: 0,
        requests: 0,
        aiLoc: 0,
        harnesses: {},
      });
    }
    const p = projects.get(s.workspaceId)!;
    p.sessions += 1;
    p.requests += s.requests.length;
    p.aiLoc += s.requests.reduce((n, r) => n + r.aiCode.reduce((m, c) => m + c.lineCount, 0), 0);
    p.harnesses[s.harness] = (p.harnesses[s.harness] || 0) + 1;
  }

  const peakHour = hourTotals.indexOf(Math.max(...hourTotals, 0));
  return {
    tab: 'work-hours' as const,
    heatmap,
    hourly: hourTotals,
    peakHour: hourTotals.some((v) => v > 0) ? peakHour : null,
    lateNightRatio: timed ? late / timed : 0,
    weekendRatio: timed ? weekend / timed : 0,
    balanceScore: Math.max(
      0,
      Math.round(100 - (late / Math.max(timed, 1)) * 120 - (weekend / Math.max(timed, 1)) * 80),
    ),
    calendar: [...calendar.values()].sort((a, b) => a.date.localeCompare(b.date)),
    projects: [...projects.values()].sort((a, b) => b.requests - a.requests),
    total: timed,
  };
}

export function getCuriosityDeep(sessions: Session[], filter: DateFilter = {}) {
  const scoped = filterSessions(sessions, filter);
  const reqs = allRequests(scoped);
  const isQuestion = (t: string) => /\?/.test(t) || /^(what|why|how|where|when|who|explain|investigate)\b/i.test(t.trim());
  const isWeb = (r: (typeof reqs)[0]) => r.toolsUsed.some((t) => /web|fetch|browse|search_web/i.test(t));
  const isRepo = (r: (typeof reqs)[0]) => r.toolsUsed.some((t) => /read|grep|glob|search|list|file/i.test(t));
  const isAction = (r: (typeof reqs)[0]) =>
    r.toolsUsed.some((t) => /edit|write|apply|bash|shell|terminal|run/i.test(t)) || r.aiCode.some((c) => c.lineCount > 0);

  let direct = 0;
  let web = 0;
  let repository = 0;
  let action = 0;
  const daily = new Map<string, { date: string; direct: number; web: number; repository: number; action: number }>();
  const langs = new Map<string, { language: string; inquiry: number; sessions: Set<string> }>();
  const questions: string[] = [];
  const inquirySessions = new Set<string>();

  for (const r of reqs) {
    const q = isQuestion(r.messageText);
    const w = isWeb(r);
    const repo = isRepo(r);
    const act = isAction(r);
    if (q) {
      direct += 1;
      questions.push(r.messageText.slice(0, 140));
      inquirySessions.add(r.session.sessionId);
    }
    if (w) web += 1;
    if (repo) repository += 1;
    if (act) action += 1;
    const day = dayKey(r.timestamp);
    if (day !== 'unknown') {
      if (!daily.has(day)) daily.set(day, { date: day, direct: 0, web: 0, repository: 0, action: 0 });
      const row = daily.get(day)!;
      if (q) row.direct += 1;
      if (w) row.web += 1;
      if (repo) row.repository += 1;
      if (act) row.action += 1;
    }
    for (const b of r.aiCode) {
      const lang = b.language || 'unknown';
      if (!langs.has(lang)) langs.set(lang, { language: lang, inquiry: 0, sessions: new Set() });
      const L = langs.get(lang)!;
      if (q) {
        L.inquiry += 1;
        L.sessions.add(r.session.sessionId);
      }
    }
  }

  const totalClassified = direct + web + repository + action || 1;
  const inquiryShare = (direct + web + repository) / totalClassified;
  const actionShare = action / totalClassified;
  let tier: 'balanced' | 'needs-review' | 'strongly-skewed' | 'insufficient' = 'insufficient';
  if (reqs.length < 5) tier = 'insufficient';
  else if (inquiryShare > 0.75 || actionShare > 0.85) tier = 'strongly-skewed';
  else if (inquiryShare > 0.55 || actionShare > 0.7) tier = 'needs-review';
  else tier = 'balanced';

  const suggestions: string[] = [];
  if (tier === 'strongly-skewed' && inquiryShare > 0.75) {
    suggestions.push('Inquiry-heavy: pair questions with an execution turn that edits or runs tests.');
  } else if (tier === 'strongly-skewed') {
    suggestions.push('Build-heavy: add investigative turns (search/read) before large edits.');
  } else if (tier === 'balanced') {
    suggestions.push('Curiosity balance looks healthy — keep alternating inquire → act.');
  }

  return {
    counts: { direct, web, repository, action },
    sessions: scoped.length,
    inquirySessions: inquirySessions.size,
    questionRequests: direct,
    investigationRequests: web + repository,
    balance: { tier, inquiryShare, actionShare, label: tier.replace('-', ' ') },
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    languages: [...langs.values()]
      .map((l) => ({ language: l.language, inquiry: l.inquiry, sessions: l.sessions.size }))
      .sort((a, b) => b.inquiry - a.inquiry)
      .slice(0, 12),
    topQuestions: questions.slice(0, 16),
    suggestions,
    research: {
      web: {
        turns: web,
        sessions: scoped.filter((s) =>
          s.requests.some((r) => r.toolsUsed.some((t) => /web|fetch|browse|search_web/i.test(t))),
        ).length,
      },
      repository: {
        turns: repository,
        sessions: scoped.filter((s) =>
          s.requests.some((r) => r.toolsUsed.some((t) => /read|grep|glob|search|list|file/i.test(t))),
        ).length,
      },
      action: {
        turns: action,
        sessions: scoped.filter((s) =>
          s.requests.some(
            (r) =>
              r.toolsUsed.some((t) => /edit|write|apply|bash|shell|terminal|run/i.test(t)) ||
              r.aiCode.some((c) => c.lineCount > 0),
          ),
        ).length,
      },
    },
  };
}

export function getContextDeep(sessions: Session[], filter: DateFilter = {}) {
  const scoped = filterSessions(sessions, filter);
  const reqs = allRequests(scoped);
  const total = reqs.length || 1;
  const withFiles = reqs.filter((r) => r.referencedFiles.length > 0 || r.editedFiles.length > 0);
  const withInstructions = reqs.filter((r) => r.customInstructions.length > 0);
  const withSkills = reqs.filter((r) => r.skillsUsed.length > 0);
  const withTools = reqs.filter((r) => r.toolsUsed.length > 0);
  const withCompaction = reqs.filter((r) => r.compaction != null);
  const longContext = reqs.filter((r) => (r.promptTokens || 0) > 8000);
  const multiFile = reqs.filter((r) => new Set([...r.referencedFiles, ...r.editedFiles]).size >= 3);

  const qualityScore = Math.round(
    (withFiles.length / total) * 30 +
      (withInstructions.length / total) * 20 +
      (withSkills.length / total) * 15 +
      (withTools.length / total) * 20 +
      (multiFile.length / total) * 15,
  );

  const managementScore = Math.max(
    0,
    Math.round(100 - (withCompaction.length / total) * 40 - (longContext.length / total) * 35),
  );

  const byWorkspace = new Map<
    string,
    { name: string; requests: number; withFiles: number; withTools: number; tokens: number }
  >();
  for (const r of reqs) {
    const id = r.session.workspaceId;
    if (!byWorkspace.has(id)) {
      byWorkspace.set(id, { name: r.session.workspaceName, requests: 0, withFiles: 0, withTools: 0, tokens: 0 });
    }
    const row = byWorkspace.get(id)!;
    row.requests += 1;
    if (r.referencedFiles.length || r.editedFiles.length) row.withFiles += 1;
    if (r.toolsUsed.length) row.withTools += 1;
    row.tokens += (r.promptTokens || 0) + (r.completionTokens || 0);
  }

  return {
    score: Math.min(100, qualityScore),
    managementScore: Math.min(100, managementScore),
    overall: Math.round((Math.min(100, qualityScore) + Math.min(100, managementScore)) / 2),
    qualityChecks: [
      { id: 'file-context', label: 'Prompts reference or edit files', pass: withFiles.length / total > 0.2, value: withFiles.length, pct: withFiles.length / total },
      { id: 'instructions', label: 'Custom instructions used', pass: withInstructions.length > 0, value: withInstructions.length, pct: withInstructions.length / total },
      { id: 'skills', label: 'Skills invoked', pass: withSkills.length > 0, value: withSkills.length, pct: withSkills.length / total },
      { id: 'tools', label: 'Tool-using agent turns', pass: withTools.length / total > 0.3, value: withTools.length, pct: withTools.length / total },
      { id: 'multi-file', label: 'Multi-file context (≥3 files)', pass: multiFile.length / total > 0.1, value: multiFile.length, pct: multiFile.length / total },
    ],
    managementChecks: [
      { id: 'compaction', label: 'Compaction events (lower is healthier)', pass: withCompaction.length / total < 0.15, value: withCompaction.length, pct: withCompaction.length / total },
      { id: 'long-context', label: 'Very long prompts (>8k tokens)', pass: longContext.length / total < 0.2, value: longContext.length, pct: longContext.length / total },
      { id: 'tool-discipline', label: 'Tools used when editing', pass: withTools.length >= withFiles.length * 0.5, value: withTools.length, pct: withTools.length / total },
    ],
    treemap: [...byWorkspace.values()]
      .map((w) => ({
        label: w.name,
        value: Math.max(1, w.tokens || w.requests),
        requests: w.requests,
        fileRate: w.requests ? w.withFiles / w.requests : 0,
        toolRate: w.requests ? w.withTools / w.requests : 0,
      }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Static community skill/agent catalog for offline Skill Finder (no network required). */
export const COMMUNITY_CATALOG = [
  { kind: 'skill' as const, id: 'skill:vscode-ext', title: 'VS Code Extension Commands', description: 'Scaffold and wire VS Code contribution points and commands.', category: 'tooling', tags: ['vscode', 'extension', 'command'] },
  { kind: 'skill' as const, id: 'skill:vscode-i18n', title: 'VS Code Ext Localization', description: 'Localize extension strings and package.nls.', category: 'tooling', tags: ['vscode', 'i18n', 'localization'] },
  { kind: 'skill' as const, id: 'skill:fastapi', title: 'FastAPI Service Scaffold', description: 'Bootstrap FastAPI routes, models, and tests.', category: 'backend', tags: ['fastapi', 'python', 'api'] },
  { kind: 'skill' as const, id: 'skill:auth-middleware', title: 'Auth Middleware Refactor', description: 'Harden auth middleware and session handling.', category: 'security', tags: ['auth', 'middleware', 'security'] },
  { kind: 'skill' as const, id: 'skill:pagination', title: 'API Pagination Patterns', description: 'Cursor and offset pagination for list endpoints.', category: 'backend', tags: ['pagination', 'api'] },
  { kind: 'skill' as const, id: 'skill:git-summary', title: 'Git Activity Summary', description: 'Summarize recent commits and open work.', category: 'workflow', tags: ['git', 'summary'] },
  { kind: 'instruction' as const, id: 'inst:tests-first', title: 'Tests Before Merge', description: 'Require tests and a diff summary before merging.', category: 'quality', tags: ['test', 'review'] },
  { kind: 'agent' as const, id: 'agent:debugger', title: 'Bug Hunt Agent', description: 'Reproduce, isolate, and fix bugs with evidence.', category: 'debugging', tags: ['bug', 'debug', 'fix'] },
  { kind: 'skill' as const, id: 'skill:package-ext', title: 'Package VS Code Extension', description: 'vsce package, publish checklist, marketplace assets.', category: 'tooling', tags: ['vsce', 'package', 'marketplace'] },
  { kind: 'skill' as const, id: 'skill:react-a11y', title: 'React Accessibility Pass', description: 'Audit and fix a11y issues in React UIs.', category: 'frontend', tags: ['react', 'a11y', 'accessibility'] },
];

export function getSkillCatalog(sessions: Session[], filter: DateFilter = {}) {
  const scoped = filterSessions(sessions, filter);
  const map = new Map<string, { count: number; sample: string; sessions: Set<string> }>();
  for (const r of allRequests(scoped)) {
    const key = r.messageText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
    if (key.length < 16) continue;
    if (!map.has(key)) map.set(key, { count: 0, sample: r.messageText.trim().slice(0, 160), sessions: new Set() });
    const row = map.get(key)!;
    row.count += 1;
    row.sessions.add(r.session.sessionId);
  }
  const custom = [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([key, v], i) => {
      const id = `recurring-${i + 1}`;
      const draftMarkdown = `---
name: ${id}
description: Recurring prompt detected by Cadence (${v.count}×). Refine before installing.
---

# ${id}

## When to use
When you need: ${v.sample}

## Steps
1. Restate the goal and constraints.
2. Attach only the relevant files.
3. Ask for tests or a verification checklist.
`;
      const hay = key;
      const community = COMMUNITY_CATALOG.filter((c) => c.tags.some((t) => hay.includes(t))).slice(0, 3);
      return {
        id,
        prompt: key,
        count: v.count,
        sessions: v.sessions.size,
        sample: v.sample,
        suggestion: `Promote to a skill (${v.count} repeats across ${v.sessions.size} sessions)`,
        draftMarkdown,
        communityMatches: community,
      };
    });

  const scanned = custom.flatMap((c) => c.communityMatches.map((m) => m.id));
  const community = COMMUNITY_CATALOG.map((c) => ({
    ...c,
    matched: scanned.includes(c.id),
  }));

  return { custom, community, totalScanned: COMMUNITY_CATALOG.length };
}

export function getRuleCoverage(findings: HabitFinding[], sessions: Session[]) {
  const rules = findings.map((f) => ({ id: f.id, name: f.name, group: f.group, triggered: f.triggered, count: f.count }));
  const workspaces = [...new Set(sessions.map((s) => s.workspaceName))];
  const matrix: Record<string, Record<string, number>> = {};
  for (const f of findings) {
    matrix[f.id] = {};
    for (const ws of workspaces) {
      // Approximate: attribute finding examples/counts evenly when triggered
      matrix[f.id]![ws] = f.triggered ? Math.max(1, Math.round(f.count / Math.max(workspaces.length, 1))) : 0;
    }
  }
  return { rules, workspaces, matrix };
}

export function getVibeRole(practice: PracticeScore[], habits: HabitFinding[]) {
  const avg = practice.length ? practice.reduce((n, p) => n + p.score, 0) / practice.length : 0;
  const top = [...habits].filter((h) => h.triggered).sort((a, b) => b.pct - a.pct)[0];
  let title = 'Stack Trace Survivor';
  if (avg >= 90) title = 'Merge Wizard';
  else if (avg >= 75) title = 'Ship Goblin Deluxe';
  else if (avg >= 60) title = 'Vibe Refactor Gremlin';
  else if (avg >= 40) title = 'Rubber Duck Ringleader';
  return {
    title,
    score: Math.round(avg),
    reason: top ? `Top pattern: ${top.name}` : 'Steady practice — no dominant anti-pattern',
    topPattern: top?.name ?? null,
  };
}

export function withWow<T extends { score: number }>(current: T[], previous: T[] | null): Array<T & { wowPct: number | null }> {
  return current.map((c, i) => {
    const prev = previous?.[i]?.score;
    if (prev == null || prev === 0) return { ...c, wowPct: null };
    return { ...c, wowPct: Math.round(((c.score - prev) / prev) * 100) };
  });
}

export function previousWeekFilter(filter: DateFilter = {}): DateFilter {
  const to = filter.toDate ? new Date(`${filter.toDate}T12:00:00Z`) : new Date();
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    ...filter,
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  };
}
