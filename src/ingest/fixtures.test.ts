import { describe, expect, it } from 'vitest';
import { buildFixtureSessions } from './fixtures';
import { parseClaudeSessions } from './harnesses/claude';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('fixtures', () => {
  it('builds deterministic demo sessions', () => {
    const a = buildFixtureSessions();
    const b = buildFixtureSessions();
    expect(a.length).toBe(b.length);
    expect(a[0].harness).toBe('Claude Code');
    expect(a.some((s) => s.harness === 'Cursor')).toBe(true);
  });
});

describe('claude parser', () => {
  it('parses a minimal jsonl project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-claude-'));
    const proj = path.join(root, 'projects', '-Users-me-demo');
    fs.mkdirSync(proj, { recursive: true });
    const lines = [
      { type: 'user', timestamp: '2026-01-01T10:00:00Z', sessionId: 's1', cwd: '/Users/me/demo', uuid: 'u1', message: { role: 'user', content: [{ type: 'text', text: 'Add a health check endpoint' }] } },
      { type: 'assistant', timestamp: '2026-01-01T10:00:02Z', sessionId: 's1', message: { role: 'assistant', model: 'claude-sonnet-4.5', content: [{ type: 'text', text: 'Done.' }], usage: { input_tokens: 10, output_tokens: 5 } } },
    ];
    fs.writeFileSync(path.join(proj, 's1.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
    const sessions = parseClaudeSessions(path.join(root, 'projects'));
    expect(sessions.length).toBe(1);
    expect(sessions[0].requests[0].messageText).toContain('health check');
    fs.rmSync(root, { recursive: true, force: true });
  });
});
