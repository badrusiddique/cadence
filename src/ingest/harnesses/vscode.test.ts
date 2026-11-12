import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  findVsCodeDirs,
  findVsCodeUserDirs,
  harnessFromPath,
  parseChatSessionJsonl,
  parseVsCodeGlobalChatSessions,
  parseVsCodeSessions,
} from './vscode';

const e2eRoot = '/tmp/cadence-copilot-fixture';
const e2eSession = path.join(e2eRoot, 'User', 'workspaceStorage', 'abc', 'chatSessions', 's1.jsonl');

function writeJsonl(filePath: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

beforeAll(() => {
  writeJsonl(e2eSession, [
    {
      kind: 0,
      v: {
        sessionId: 's1',
        creationDate: '2026-01-15T12:00:00.000Z',
        requests: [
          {
            requestId: 'r1',
            message: { text: 'first user turn' },
            response: [{ value: 'first assistant reply' }],
          },
        ],
      },
    },
    {
      kind: 2,
      k: ['requests'],
      v: [
        {
          requestId: 'r2',
          message: { text: 'second user turn' },
          response: [{ value: 'second assistant reply' }],
        },
      ],
    },
  ]);
});

afterAll(() => {
  fs.rmSync(e2eRoot, { recursive: true, force: true });
});

describe('VS Code chatSessions jsonl', () => {
  it('rebuilds a session from kind 0 base + kind 2 request append', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-jsonl-'));
    const file = path.join(tmp, 'chat.jsonl');
    try {
      writeJsonl(file, [
        {
          kind: 0,
          v: {
            sessionId: 'sess-rebuild',
            creationDate: '2026-02-01T10:00:00.000Z',
            requests: [
              {
                requestId: 'a',
                message: { text: 'hello from object form' },
                response: [{ value: 'hi' }],
              },
            ],
          },
        },
        {
          kind: 2,
          k: ['requests'],
          v: [
            {
              requestId: 'b',
              message: { text: 'follow-up' },
              response: [{ value: 'sure' }],
            },
          ],
        },
      ]);

      const session = parseChatSessionJsonl(file, 'vscode:ws', 'demo', 'GitHub Copilot');
      expect(session).not.toBeNull();
      expect(session!.requests.length).toBeGreaterThanOrEqual(2);
      expect(session!.requests[0].messageText).toBe('hello from object form');
      expect(session!.requests[1].messageText).toBe('follow-up');
      expect(session!.harness).toBe('GitHub Copilot');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('picks up .jsonl files under chatSessions via parseVsCodeSessions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-vscode-root-'));
    try {
      const chatDir = path.join(root, 'hash1', 'chatSessions');
      writeJsonl(path.join(chatDir, 'live.jsonl'), [
        {
          kind: 0,
          v: {
            sessionId: 'live-1',
            creationDate: '2026-03-01T00:00:00.000Z',
            requests: [
              {
                requestId: 'r1',
                message: { text: 'jsonl picked up' },
                response: [{ value: 'ok' }],
              },
            ],
          },
        },
      ]);

      const sessions = parseVsCodeSessions([root]);
      expect(sessions.some((s) => s.requests.some((r) => r.messageText.includes('jsonl picked up')))).toBe(
        true,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not throw when a sibling workspace entry lacks chatSessions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-vscode-mixed-'));
    try {
      fs.mkdirSync(path.join(root, 'empty-entry'), { recursive: true });
      const good = path.join(root, 'good-entry', 'chatSessions');
      fs.mkdirSync(good, { recursive: true });
      fs.writeFileSync(
        path.join(good, 'flat.json'),
        JSON.stringify({
          sessionId: 'flat-1',
          creationDate: '2026-03-02T00:00:00.000Z',
          requests: [{ requestId: 'r1', message: { text: 'from json' }, response: 'ack' }],
        }),
        'utf8',
      );

      expect(() => parseVsCodeSessions([root])).not.toThrow();
      const sessions = parseVsCodeSessions([root]);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions[0].requests[0].messageText).toBe('from json');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('parses the seeded /tmp/cadence-copilot-fixture end-to-end path', () => {
    const storageRoot = path.join(e2eRoot, 'User', 'workspaceStorage');
    const sessions = parseVsCodeSessions([storageRoot]);
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions[0].sessionId).toBe('s1');
    expect(sessions[0].requests.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0].requests[0].messageText).toBe('first user turn');
    expect(sessions[0].requests[1].messageText).toBe('second user turn');
  });

  it('labels Code paths as GitHub Copilot and Cursor paths as Cursor', () => {
    expect(harnessFromPath('/home/u/.config/Code/User/workspaceStorage')).toBe('GitHub Copilot');
    expect(harnessFromPath('/home/u/.config/VSCodium/User/workspaceStorage')).toBe('GitHub Copilot');
    expect(harnessFromPath('/home/u/.config/Cursor/User/workspaceStorage')).toBe('Cursor');
  });

  it('findVsCodeUserDirs merges extra User dirs', () => {
    const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-vscode-user-'));
    try {
      const dirs = findVsCodeUserDirs([extra]);
      expect(dirs.map((d) => path.resolve(d))).toContain(path.resolve(extra));
      const storage = findVsCodeDirs([extra]);
      // extra has no workspaceStorage yet — should not throw; may omit missing dirs
      expect(Array.isArray(storage)).toBe(true);
    } finally {
      fs.rmSync(extra, { recursive: true, force: true });
    }
  });

  it('parses emptyWindowChatSessions and transferredChatSessions under User/globalStorage', () => {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-vscode-global-'));
    try {
      const emptyDir = path.join(userDir, 'globalStorage', 'emptyWindowChatSessions');
      const transferredDir = path.join(userDir, 'globalStorage', 'transferredChatSessions');
      fs.mkdirSync(emptyDir, { recursive: true });
      fs.mkdirSync(transferredDir, { recursive: true });

      writeJsonl(path.join(emptyDir, 'ew.jsonl'), [
        {
          kind: 0,
          v: {
            sessionId: 'empty-win',
            creationDate: '2026-04-01T00:00:00.000Z',
            requests: [
              {
                requestId: 'r1',
                message: { text: 'empty window chat' },
                response: [{ value: 'here' }],
              },
            ],
          },
        },
      ]);

      fs.writeFileSync(
        path.join(transferredDir, 'xfer.json'),
        JSON.stringify({
          sessionId: 'xfer-1',
          creationDate: '2026-04-02T00:00:00.000Z',
          requests: [{ requestId: 'r1', message: { text: 'transferred chat' }, response: 'ok' }],
        }),
        'utf8',
      );

      const sessions = parseVsCodeGlobalChatSessions([userDir]);
      const texts = sessions.flatMap((s) => s.requests.map((r) => r.messageText));
      expect(texts).toContain('empty window chat');
      expect(texts).toContain('transferred chat');
    } finally {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  });

  it('parses GitHub.copilot-chat transcripts as GitHub Copilot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-copilot-tx-'));
    try {
      const txDir = path.join(root, 'hash-tx', 'GitHub.copilot-chat', 'transcripts');
      fs.mkdirSync(txDir, { recursive: true });
      fs.writeFileSync(
        path.join(txDir, 'cli-like.jsonl'),
        [
          JSON.stringify({
            type: 'session.start',
            timestamp: '2026-05-01T00:00:00.000Z',
            data: { sessionId: 'tx-1', selectedModel: 'gpt-4.1' },
          }),
          JSON.stringify({
            type: 'user.message',
            id: 'u1',
            timestamp: '2026-05-01T00:00:01.000Z',
            data: { content: 'from transcript' },
          }),
          JSON.stringify({
            type: 'assistant.message',
            id: 'a1',
            timestamp: '2026-05-01T00:00:02.000Z',
            data: { content: 'transcript reply' },
          }),
        ].join('\n') + '\n',
        'utf8',
      );

      const sessions = parseVsCodeSessions([root]);
      expect(sessions.some((s) => s.harness === 'GitHub Copilot')).toBe(true);
      expect(sessions.some((s) => s.requests.some((r) => r.messageText === 'from transcript'))).toBe(
        true,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
