import { describe, expect, it } from 'vitest';
import { assertAllowedMethod, sanitizeRpcParams } from './rpc-guard';

describe('rpc-guard', () => {
  it('rejects unknown methods', () => {
    expect(() => assertAllowedMethod('rm -rf')).toThrow(/not allowed/);
    expect(() => assertAllowedMethod('__proto__')).toThrow(/not allowed/);
  });

  it('sanitizes filters and dates', () => {
    const p = sanitizeRpcParams('getOverview', {
      workspaceId: 'ws-a',
      harness: 'Cursor',
      fromDate: '2026-10-01',
      toDate: '2026-10-20',
      evil: 'drop',
    });
    expect(p.workspaceId).toBe('ws-a');
    expect(p.fromDate).toBe('2026-10-01');
    expect(p).not.toHaveProperty('evil');
  });

  it('rejects bad dates and huge markdown', () => {
    expect(() => sanitizeRpcParams('getOverview', { fromDate: '10/01/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() =>
      sanitizeRpcParams('savePersonalSignal', { markdown: 'x'.repeat(200_000) }),
    ).toThrow(/exceeds/);
  });

  it('guards approve path traversal', () => {
    expect(() =>
      sanitizeRpcParams('approvePersonalSignal', {
        markdown: '---\nid: x\nname: X\ngroup: prompt-quality\nseverity: low\nscope: requests\n---\n',
        filePath: '../../etc/passwd',
      }),
    ).toThrow(/Cadence signals path/);
  });
});
