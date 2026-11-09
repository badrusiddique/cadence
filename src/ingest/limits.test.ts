import { describe, expect, it } from 'vitest';
import { resolveIngestLimits, truncateSessions } from './limits';

describe('ingest limits', () => {
  it('clamps configuration into safe bounds', () => {
    expect(resolveIngestLimits({ maxSessions: 1 }).maxSessions).toBe(100);
    expect(resolveIngestLimits({ maxSessions: 999999 }).maxSessions).toBe(50_000);
    expect(resolveIngestLimits({}).maxSessions).toBe(5_000);
  });

  it('truncates oversized session lists', () => {
    const rows = Array.from({ length: 10 }, (_, i) => i);
    const { sessions, truncated } = truncateSessions(rows, 4);
    expect(sessions).toEqual([0, 1, 2, 3]);
    expect(truncated).toBe(6);
  });
});
