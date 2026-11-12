import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { parseCursorSessions } from './cursor';

describe('Cursor transcript parser', () => {
  it('parses modern nested agent-transcripts with message.content blocks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-cursor-'));
    const project = path.join(root, 'Users-me-cadence');
    const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const dir = path.join(project, 'agent-transcripts', sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const lines = [
      {
        role: 'user',
        message: {
          content: [{ type: 'text', text: 'give me a summary of this repo' }],
        },
      },
      {
        role: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Cadence is a local-first extension.' },
            { type: 'tool_use', name: 'Read', input: { path: 'README.md' } },
          ],
        },
      },
      { type: 'turn_ended', status: 'success' },
    ];
    fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n'));

    const sessions = parseCursorSessions([root]);
    expect(sessions.length).toBe(1);
    expect(sessions[0].harness).toBe('Cursor');
    expect(sessions[0].requests[0].messageText).toContain('summary');
    expect(sessions[0].requests[0].responseText).toContain('local-first');
    expect(sessions[0].requests[0].toolsUsed).toContain('Read');

    fs.rmSync(root, { recursive: true, force: true });
  });
});
