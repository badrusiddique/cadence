import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseChatSessionFile } from '../ingest/harnesses/vscode';
import { parseCLIEventsFile } from '../ingest/harnesses/copilot-cli';
import { parseCodexSessions } from '../ingest/harnesses/codex';
import { priceRequest } from './pricing';

describe('spend ingest fields', () => {
  it('reads Copilot Chat billed credits', () => {
    const raw = {
      sessionId: 's1',
      requests: [
        {
          requestId: 'r1',
          timestamp: '2026-11-10T12:00:00.000Z',
          message: { text: 'hello' },
          response: [{ value: 'hi' }],
          modelId: 'gpt-5.2',
          copilotCredits: 1.25,
        },
      ],
    };
    const session = parseChatSessionFile(raw, 'ws', 'repo', 'GitHub Copilot');
    expect(session?.requests[0]?.billedCredits).toBe(1.25);
    expect(priceRequest(session!.requests[0]!).provenance).toBe('billed');
  });

  it('reads Copilot CLI shutdown nano credits and tokens', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-cli-'));
    const file = path.join(dir, 'sess.jsonl');
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: 'session.start',
          timestamp: '2026-11-10T12:00:00.000Z',
          data: { sessionId: 'cli-1', selectedModel: 'gpt-6.1-sol' },
        }),
        JSON.stringify({
          type: 'user.message',
          timestamp: '2026-11-10T12:00:01.000Z',
          data: { content: 'analyze ai-engineering-coach' },
        }),
        JSON.stringify({
          type: 'assistant.message',
          timestamp: '2026-11-10T12:00:02.000Z',
          id: 'a1',
          data: { content: 'ok', modelId: 'gpt-6.1-sol', inputTokens: 100, outputTokens: 50 },
        }),
        JSON.stringify({
          type: 'session.shutdown',
          timestamp: '2026-11-10T12:00:03.000Z',
          data: {
            modelMetrics: {
              'gpt-6.1-sol': {
                totalNanoAiu: 2_500_000_000,
                usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 200, cacheWriteTokens: 50 },
                requests: { cost: 0 },
              },
            },
          },
        }),
      ].join('\n'),
    );
    const session = parseCLIEventsFile(file, 'cli', 'repo');
    const billed = session?.requests.find((r) => r.billedCredits);
    expect(billed?.billedCredits).toBeCloseTo(2.5, 6);
    expect(priceRequest(billed!).provenance).toBe('billed');
  });

  it('reads Codex token_count usage', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-codex-'));
    const file = path.join(dir, 'rollout.jsonl');
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          type: 'session_meta',
          payload: { id: 'cx1', cwd: '/tmp/proj' },
        }),
        JSON.stringify({
          type: 'turn_context',
          payload: { model: 'gpt-5.2-codex', cwd: '/tmp/proj' },
        }),
        JSON.stringify({
          type: 'response_item',
          timestamp: '2026-11-10T12:00:00.000Z',
          payload: { role: 'user', content: [{ text: 'hi' }] },
        }),
        JSON.stringify({
          type: 'response_item',
          timestamp: '2026-11-10T12:00:01.000Z',
          payload: { role: 'assistant', content: [{ text: 'yo' }] },
        }),
        JSON.stringify({
          type: 'event_msg',
          timestamp: '2026-11-10T12:00:02.000Z',
          payload: {
            type: 'token_count',
            info: { last_token_usage: { input_tokens: 1500, cached_input_tokens: 500, output_tokens: 200 } },
          },
        }),
      ].join('\n'),
    );
    const sessions = parseCodexSessions(dir);
    expect(sessions[0]?.requests[0]?.promptTokens).toBe(1000);
    expect(sessions[0]?.requests[0]?.cacheReadTokens).toBe(500);
    expect(sessions[0]?.requests[0]?.completionTokens).toBe(200);
    expect(priceRequest(sessions[0]!.requests[0]!).provenance).toBe('token-priced');
  });
});
