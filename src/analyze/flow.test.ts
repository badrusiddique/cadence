import { describe, expect, it } from 'vitest';
import { computeFlowState } from './flow';
import { buildFixtureSessions } from '../ingest/fixtures';

describe('computeFlowState', () => {
  it('scores fixture sessions with timed turns', () => {
    const flow = computeFlowState(buildFixtureSessions());
    expect(flow.totalDays).toBeGreaterThan(0);
    expect(flow.overallFlowScore).toBeGreaterThanOrEqual(0);
    expect(flow.hourlyFlow).toHaveLength(24);
    expect(Array.isArray(flow.suggestions)).toBe(true);
  });
});
