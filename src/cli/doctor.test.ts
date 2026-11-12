import { describe, expect, it } from 'vitest';
import { runDoctor } from './doctor';

describe('doctor', () => {
  it('returns observed harness probe with recommendations', () => {
    const report = runDoctor();
    expect(report.home).toBeTruthy();
    expect(report.totals).toBeTypeOf('object');
    expect(report.chatSessionFiles).toEqual(
      expect.objectContaining({
        json: expect.any(Number),
        jsonl: expect.any(Number),
      }),
    );
    expect(report.evidence.state).toBe('observed');
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.enterprise.rpcAllowlistSize).toBeGreaterThan(20);
    expect(report.enterprise.privacy).toContain('no-telemetry');
    expect(['enterprise-ready', 'ready', 'needs-setup']).toContain(report.grade);
  });
});
