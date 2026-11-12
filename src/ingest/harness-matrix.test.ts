/**
 * One-harness-at-a-time ingest against native on-disk formats.
 * Prompt text is from the Cadence project brief (not aurora/northwind fixtures).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { ingestAll } from './index';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const MARKER = 'ai-engineering-coach';
const REAL_USER =
  'I want you to take this repository https://github.com/microsoft/ai-engineering-coach and analyse it';
const REAL_ASSISTANT = 'Starting a clean-room Cadence rebuild inspired by that coach surface.';

const pairs = [
  { user: REAL_USER, assistant: REAL_ASSISTANT, ts: 1_700_000_000_000, ats: 1_700_000_060_000 },
  { user: 'Ship Copilot jsonl ingest next.', assistant: 'Added chatSessions *.jsonl parsing.', ts: 1_700_000_120_000, ats: 1_700_000_180_000 },
];

let prevHome: string | undefined;
let prevProfile: string | undefined;
let prevAppdata: string | undefined;
let tempHome: string | undefined;

function writeJsonl(file: string, rows: unknown[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function useTempHome() {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-harness-'));
  prevHome = process.env.HOME;
  prevProfile = process.env.USERPROFILE;
  prevAppdata = process.env.APPDATA;
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  process.env.APPDATA = path.join(tempHome, 'AppData', 'Roaming');
  fs.mkdirSync(process.env.APPDATA, { recursive: true });
  return tempHome;
}

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = prevProfile;
  if (prevAppdata === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = prevAppdata;
  if (tempHome) fs.rmSync(tempHome, { recursive: true, force: true });
  tempHome = undefined;
});

describe('harness matrix (real prompt, isolated HOME)', () => {
  it('GitHub Copilot Chat jsonl', () => {
    const home = useTempHome();
    const hash = 'hashcopilot';
    const chat = path.join(home, '.config', 'Code', 'User', 'workspaceStorage', hash, 'chatSessions');
    fs.mkdirSync(chat, { recursive: true });
    fs.writeFileSync(
      path.join(home, '.config', 'Code', 'User', 'workspaceStorage', hash, 'workspace.json'),
      JSON.stringify({ folder: 'file:///workspace' }),
    );
    const reqs = pairs.map((p, i) => ({
      requestId: `r${i}`,
      timestamp: p.ts,
      message: { text: p.user, parts: [] },
      response: [{ value: p.assistant }],
      modelId: 'copilot/gpt-4.1',
      variableData: { variables: [] },
    }));
    writeJsonl(path.join(chat, 's.jsonl'), [
      { kind: 0, v: { version: 3, sessionId: 's', creationDate: pairs[0].ts, requests: [reqs[0]] } },
      ...reqs.slice(1).map((r) => ({ kind: 2, k: ['requests'], v: [r] })),
    ]);
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'GitHub Copilot')).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('Cursor agent transcripts', () => {
    const home = useTempHome();
    const sid = 'cursor-s';
    const dir = path.join(home, '.cursor', 'projects', 'workspace', 'agent-transcripts', sid);
    writeJsonl(path.join(dir, `${sid}.jsonl`), [
      {
        role: 'user',
        message: { content: [{ type: 'text', text: pairs[0].user }] },
        timestamp: new Date(pairs[0].ts).toISOString(),
      },
      {
        role: 'assistant',
        message: { content: [{ type: 'text', text: pairs[0].assistant }] },
        timestamp: new Date(pairs[0].ats).toISOString(),
      },
    ]);
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => /cursor/i.test(s.harness))).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('Claude Code', () => {
    const home = useTempHome();
    const proj = path.join(home, '.claude', 'projects', '-workspace');
    writeJsonl(path.join(proj, 'c.jsonl'), [
      {
        type: 'user',
        sessionId: 'c',
        cwd: '/workspace',
        timestamp: new Date(pairs[0].ts).toISOString(),
        message: { content: [{ type: 'text', text: pairs[0].user }] },
      },
      {
        type: 'assistant',
        sessionId: 'c',
        timestamp: new Date(pairs[0].ats).toISOString(),
        message: { model: 'claude-opus-4', content: [{ type: 'text', text: pairs[0].assistant }] },
      },
    ]);
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'Claude Code')).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('Codex CLI (OpenAI)', () => {
    const home = useTempHome();
    writeJsonl(path.join(home, '.codex', 'sessions', 'x.jsonl'), [
      { type: 'session_meta', timestamp: new Date(pairs[0].ts).toISOString(), payload: { id: 'x', cwd: '/workspace' } },
      {
        type: 'response_item',
        timestamp: new Date(pairs[0].ts).toISOString(),
        payload: { role: 'user', type: 'message', content: [{ text: pairs[0].user }] },
      },
      {
        type: 'response_item',
        timestamp: new Date(pairs[0].ats).toISOString(),
        payload: { role: 'assistant', type: 'message', content: [{ text: pairs[0].assistant }] },
      },
    ]);
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'Codex CLI')).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('GitHub Copilot CLI', () => {
    const home = useTempHome();
    writeJsonl(path.join(home, '.copilot', 'session-state', 's1', 'events.jsonl'), [
      {
        type: 'session.start',
        timestamp: new Date(pairs[0].ts).toISOString(),
        data: { sessionId: 'cli', selectedModel: 'gpt-4.1' },
      },
      { type: 'user.message', timestamp: new Date(pairs[0].ts).toISOString(), data: { content: pairs[0].user } },
      {
        type: 'assistant.message',
        timestamp: new Date(pairs[0].ats).toISOString(),
        data: { content: pairs[0].assistant, modelId: 'gpt-4.1' },
      },
    ]);
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'GitHub Copilot CLI')).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('OpenCode', () => {
    const home = useTempHome();
    const dir = path.join(home, '.local', 'share', 'opencode', 'sessions');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'o.json'),
      JSON.stringify({
        id: 'o',
        directory: '/workspace',
        messages: [
          { role: 'user', content: pairs[0].user, timestamp: pairs[0].ts },
          { role: 'assistant', content: pairs[0].assistant, timestamp: pairs[0].ats },
        ],
      }),
    );
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'OpenCode')).toBe(true);
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });

  it('Cursor Composer state.vscdb', async () => {
    const home = useTempHome();
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({
      locateFile: (f: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', f),
    });
    const db = new SQL.Database();
    db.run('CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB)');
    const composerId = 'comp-1';
    const meta = {
      composerId,
      name: 'real',
      unifiedMode: 'agent',
      createdAt: pairs[0].ts,
      fullConversationHeadersOnly: [
        { bubbleId: 'u0', type: 1 },
        { bubbleId: 'a0', type: 2 },
      ],
      conversationMap: {},
      modelConfig: { modelName: 'composer-1' },
    };
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8');
    db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [`composerData:${composerId}`, enc(meta)]);
    db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
      `bubbleId:${composerId}:u0`,
      enc({ text: pairs[0].user, type: 1, createdAt: pairs[0].ts }),
    ]);
    db.run('INSERT INTO cursorDiskKV VALUES (?, ?)', [
      `bubbleId:${composerId}:a0`,
      enc({ text: pairs[0].assistant, type: 2, createdAt: pairs[0].ats }),
    ]);
    const out = path.join(home, '.config', 'Cursor', 'User', 'globalStorage');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'state.vscdb'), Buffer.from(db.export()));
    db.close();
    const result = ingestAll({ demoMode: false, useCache: false });
    expect(result.sessions.some((s) => s.harness === 'Cursor' && String(s.workspaceId).startsWith('cursor-db:'))).toBe(
      true,
    );
    expect(result.sessions.some((s) => s.requests.some((r) => r.messageText.includes(MARKER)))).toBe(true);
  });
});
