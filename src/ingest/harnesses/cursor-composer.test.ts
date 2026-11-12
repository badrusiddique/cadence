import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composerToSession, loadCursorComposerSessions } from './cursor-composer';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-composer-'));

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
  const db = new SQL.Database();
  db.run('CREATE TABLE cursorDiskKV (key TEXT, value TEXT)');
  const meta = {
    composerId: 'abc-123',
    name: 'Summary request',
    unifiedMode: 'agent',
    createdAt: 1_700_000_000_000,
    fullConversationHeadersOnly: [
      { bubbleId: 'b1', type: 1 },
      { bubbleId: 'b2', type: 2 },
    ],
    conversationMap: {},
    modelConfig: { modelName: 'composer-1' },
  };
  db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
    'composerData:abc-123',
    JSON.stringify(meta),
  ]);
  db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
    'bubbleId:abc-123:b1',
    JSON.stringify({ text: 'give me a summary', type: 1, createdAt: 1_700_000_000_000 }),
  ]);
  db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
    'bubbleId:abc-123:b2',
    JSON.stringify({ text: 'Cadence is local-first', type: 2, createdAt: 1_700_000_001_000 }),
  ]);
  const outDir = path.join(fixtureRoot, 'globalStorage');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'state.vscdb'), Buffer.from(db.export()));
  db.close();
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('Cursor Composer DB', () => {
  it('builds a session from composerData + bubble rows', () => {
    const bubbles = new Map<string, Record<string, unknown>>([
      ['b1', { text: 'hello', type: 1, createdAt: 1 }],
      ['b2', { text: 'world', type: 2, createdAt: 2 }],
    ]);
    const session = composerToSession(
      'id-1',
      {
        name: 'Summary request',
        unifiedMode: 'agent',
        createdAt: 10,
        fullConversationHeadersOnly: [
          { bubbleId: 'b1', type: 1 },
          { bubbleId: 'b2', type: 2 },
        ],
        conversationMap: {},
      },
      bubbles,
    );
    expect(session?.requests).toHaveLength(1);
    expect(session?.requests[0].messageText).toBe('hello');
    expect(session?.requests[0].responseText).toBe('world');
    expect(session?.harness).toBe('Cursor');
  });

  it('reads a real state.vscdb fixture (verified before release)', () => {
    const sessions = loadCursorComposerSessions([fixtureRoot]);
    expect(sessions.length).toBe(1);
    expect(sessions[0].workspaceName).toBe('Summary request');
    expect(sessions[0].requests[0].messageText).toContain('summary');
    expect(sessions[0].requests[0].responseText).toContain('local-first');
  });
});
