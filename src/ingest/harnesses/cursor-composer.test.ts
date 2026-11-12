import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  composerToSession,
  decodeKvValue,
  findCursorUserDirs,
  loadCursorComposerSessions,
  userDirFromExtensionStorage,
} from './cursor-composer';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-composer-'));

function utf8JsonBlob(value: unknown): Uint8Array {
  return Uint8Array.from(Buffer.from(JSON.stringify(value), 'utf8'));
}

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file),
  });
  const db = new SQL.Database();
  // Cursor stores cursorDiskKV.value as BLOB (UTF-8 JSON bytes), not TEXT.
  db.run('CREATE TABLE cursorDiskKV (key TEXT, value BLOB)');
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
    utf8JsonBlob(meta),
  ]);
  db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
    'bubbleId:abc-123:b1',
    utf8JsonBlob({ text: 'give me a summary', type: 1, createdAt: 1_700_000_000_000 }),
  ]);
  db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
    'bubbleId:abc-123:b2',
    utf8JsonBlob({ text: 'Cadence is local-first', type: 2, createdAt: 1_700_000_001_000 }),
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

  it('falls back to meta.conversation when fullConversationHeadersOnly is absent', () => {
    const bubbles = new Map<string, Record<string, unknown>>();
    const session = composerToSession(
      'id-2',
      {
        name: 'Conversation fallback',
        unifiedMode: 'agent',
        createdAt: 20,
        conversation: [
          { bubbleId: 'c1', type: 1, text: 'ping' },
          { bubbleId: 'c2', type: 2, text: 'pong' },
        ],
        conversationMap: {},
      },
      bubbles,
    );
    expect(session?.requests).toHaveLength(1);
    expect(session?.requests[0].messageText).toBe('ping');
    expect(session?.requests[0].responseText).toBe('pong');
  });

  it('decodeKvValue turns Buffer JSON into a parseable string', () => {
    const raw = decodeKvValue(Buffer.from(JSON.stringify({ a: 1 })));
    expect(JSON.parse(raw)).toEqual({ a: 1 });
  });

  it('reads a real state.vscdb fixture (verified before release)', () => {
    const sessions = loadCursorComposerSessions([fixtureRoot]);
    expect(sessions.length).toBe(1);
    expect(sessions[0].workspaceName).toBe('Summary request');
    expect(sessions[0].requests[0].messageText).toContain('summary');
    expect(sessions[0].requests[0].responseText).toContain('local-first');
  });

  it('userDirFromExtensionStorage walks up from globalStorage/<extId> to User', () => {
    const globalStorageFsPath = path.join(
      'C:',
      'Users',
      'me',
      'AppData',
      'Roaming',
      'Cursor',
      'User',
      'globalStorage',
      'publisher.cadence-insights',
    );
    expect(userDirFromExtensionStorage(globalStorageFsPath)).toBe(
      path.resolve(globalStorageFsPath, '..', '..'),
    );
    expect(path.basename(userDirFromExtensionStorage(globalStorageFsPath))).toBe('User');
  });

  it('findCursorUserDirs merges extra even when only extra exists', () => {
    const extraRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-extra-user-'));
    try {
      const dirs = findCursorUserDirs([extraRoot]);
      expect(dirs.map((d) => path.resolve(d))).toContain(path.resolve(extraRoot));
    } finally {
      fs.rmSync(extraRoot, { recursive: true, force: true });
    }
  });
});
