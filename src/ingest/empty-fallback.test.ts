import { describe, expect, it } from 'vitest';
import { ingestAll } from './index';
import type { DiscoveredSources } from './discover';

const emptySources: DiscoveredSources = {
  vscode: [],
  claude: [],
  codex: [],
  opencode: [],
  copilotCli: [],
  cursor: [],
};

describe('ingest empty install', () => {
  it('does not invent demo workspaces when demoMode is off', () => {
    const result = ingestAll({
      demoMode: false,
      useCache: false,
      sources: emptySources,
      // Exact empty list — do not pick up a real ~/.config/Cursor seeded on the test machine.
      cursorUserDirs: [],
    });
    expect(result.sessions).toEqual([]);
    expect(result.workspaces.size).toBe(0);
    expect(result.sources).toEqual([]);
    expect(result.errors.some((e) => /No local AI session logs/i.test(e.message))).toBe(true);
    expect(result.sources.includes('fixtures-fallback')).toBe(false);
  });

  it('still loads fixtures when demoMode is on', () => {
    const result = ingestAll({ demoMode: true, useCache: false });
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(result.sources).toEqual(['fixtures']);
    expect([...result.workspaces.values()].some((w) => /aurora|northwind|harbor/i.test(w.name))).toBe(true);
  });
});
