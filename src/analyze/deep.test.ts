import { describe, expect, it } from 'vitest';
import { Analyzer } from './analyzer';
import { buildFixtureSessions } from '../ingest/fixtures';
import { BUILTIN_SIGNALS } from '../signals/catalog';
import type { Workspace } from '../domain/types';
import {
  COMMUNITY_CATALOG,
  getCodeProduction,
  getContextDeep,
  getCuriosityDeep,
  getPatternsDeep,
  getSkillCatalog,
  previousWeekFilter,
  withWow,
} from './deep';

function makeAnalyzer() {
  const sessions = buildFixtureSessions();
  const workspaces = new Map<string, Workspace>();
  for (const s of sessions) {
    workspaces.set(s.workspaceId, { id: s.workspaceId, name: s.workspaceName, path: '' });
  }
  return { analyzer: new Analyzer(sessions, workspaces, BUILTIN_SIGNALS), sessions };
}

describe('deep analytics', () => {
  it('computes multi-mode code production', () => {
    const { sessions } = makeAnalyzer();
    const prod = getCodeProduction(sessions);
    expect(prod.summary.totalAiLoc).toBeGreaterThan(0);
    expect(prod.modes).toContain('daily-model');
    expect(prod.byLanguage.labels.length).toBeGreaterThan(0);
    expect(prod.dailyTimeline.labels.length).toBeGreaterThan(0);
  });

  it('builds patterns heatmap, calendar, and projects', () => {
    const { sessions } = makeAnalyzer();
    const p = getPatternsDeep(sessions);
    expect(p.heatmap).toHaveLength(7);
    expect(p.heatmap[0]).toHaveLength(24);
    expect(p.calendar.length).toBeGreaterThan(0);
    expect(p.projects.length).toBeGreaterThan(0);
    expect(p.balanceScore).toBeGreaterThanOrEqual(0);
  });

  it('classifies curiosity balance', () => {
    const { sessions } = makeAnalyzer();
    const c = getCuriosityDeep(sessions);
    expect(c.counts.direct + c.counts.web + c.counts.repository + c.counts.action).toBeGreaterThan(0);
    expect(['balanced', 'needs-review', 'strongly-skewed', 'insufficient']).toContain(c.balance.tier);
  });

  it('scores context quality and management', () => {
    const { sessions } = makeAnalyzer();
    const ctx = getContextDeep(sessions);
    expect(ctx.score).toBeGreaterThanOrEqual(0);
    expect(ctx.managementScore).toBeGreaterThanOrEqual(0);
    expect(ctx.qualityChecks.length).toBeGreaterThan(0);
    expect(ctx.treemap.length).toBeGreaterThan(0);
  });

  it('matches community skill catalog offline', () => {
    const { sessions } = makeAnalyzer();
    const skills = getSkillCatalog(sessions);
    expect(skills.totalScanned).toBe(COMMUNITY_CATALOG.length);
    expect(skills.community.length).toBe(COMMUNITY_CATALOG.length);
    expect(skills.custom.some((c) => c.count >= 2)).toBe(true);
  });

  it('exposes deep RPCs on Analyzer and WoW helpers', () => {
    const { analyzer } = makeAnalyzer();
    expect(analyzer.getMeta().currentWorkspaceId).toBeTruthy();
    expect(analyzer.getCodeProduction().summary.totalLoc).toBeGreaterThan(0);
    expect(analyzer.getPatternsDeep().total).toBeGreaterThan(0);
    expect(analyzer.getCuriosityDeep().sessions).toBeGreaterThan(0);
    expect(analyzer.getContextDeep().overall).toBeGreaterThanOrEqual(0);
    expect(analyzer.getSkillCatalog().community.length).toBeGreaterThan(0);
    expect(analyzer.getRuleCoverage().rules.length).toBeGreaterThan(0);
    const overview = analyzer.getOverview();
    expect(overview.vibe?.title).toBeTruthy();
    expect(overview.practice[0]).toHaveProperty('wowPct');
    const wow = withWow([{ score: 80 }], [{ score: 40 }]);
    expect(wow[0]!.wowPct).toBe(100);
    const prev = previousWeekFilter({ fromDate: '2026-10-14', toDate: '2026-10-20' });
    expect(prev.toDate).toBe('2026-10-13');
  });
});
