import { describe, expect, it } from 'vitest';
import { Analyzer } from './analyzer';
import { buildFixtureSessions } from '../ingest/fixtures';
import { BUILTIN_SIGNALS } from '../signals/catalog';
import type { Workspace } from '../domain/types';

function makeAnalyzer() {
  const sessions = buildFixtureSessions();
  const workspaces = new Map<string, Workspace>();
  for (const s of sessions) {
    workspaces.set(s.workspaceId, { id: s.workspaceId, name: s.workspaceName, path: '' });
  }
  return new Analyzer(sessions, workspaces, BUILTIN_SIGNALS);
}

describe('Analyzer', () => {
  it('summarizes overview from fixtures', () => {
    const a = makeAnalyzer();
    const overview = a.getOverview();
    expect(overview.sessions).toBeGreaterThan(0);
    expect(overview.requests).toBeGreaterThan(0);
    expect(overview.practice.length).toBe(5);
  });

  it('computes budget estimates with disclaimer', () => {
    const budget = makeAnalyzer().getBudget();
    expect(budget.creditsUsed).toBeGreaterThan(0);
    expect(budget.disclaimer).toMatch(/estimates/i);
  });

  it('evaluates built-in habit signals', () => {
    const habits = makeAnalyzer().getHabits();
    expect(habits.length).toBe(BUILTIN_SIGNALS.length);
    expect(habits.some((h) => h.id === 'thin-prompts')).toBe(true);
  });

  it('exports markdown snapshot', () => {
    const summary = makeAnalyzer().exportSummary();
    expect(summary.markdown).toContain('# Cadence Snapshot');
    expect(summary.json.share.sessions).toBeGreaterThan(0);
  });
});
