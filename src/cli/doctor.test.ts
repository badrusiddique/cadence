import { describe, expect, it } from 'vitest';
import { runDoctor } from './doctor';

describe('doctor', () => {
  it('returns observed harness probe with recommendations', () => {
    const report = runDoctor();
    expect(report.home).toBeTruthy();
    expect(report.totals).toBeTypeOf('object');
    expect(report.evidence.state).toBe('observed');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});
