import { emptyRequest, emptySession, type Session } from '../domain/types';

/** Deterministic synthetic sessions for demos, preview, and tests. */
export function buildFixtureSessions(now = Date.UTC(2026, 9, 20, 15, 0, 0)): Session[] {
  const day = 86_400_000;
  const hour = 3_600_000;

  const mk = (
    sessionId: string,
    workspace: string,
    harness: string,
    model: string,
    prompts: Array<{ offsetMs: number; text: string; tools?: string[]; loc?: number; canceled?: boolean }>,
  ): Session => {
    const requests = prompts.map((p, i) =>
      emptyRequest({
        requestId: `${sessionId}-${i}`,
        timestamp: now - p.offsetMs,
        messageText: p.text,
        responseText: `Acknowledged: ${p.text.slice(0, 40)}`,
        messageLength: p.text.length,
        responseLength: 40 + p.text.length,
        modelId: model,
        agentName: harness,
        agentMode: 'agent',
        toolsUsed: p.tools ?? ['read_file', 'apply_patch'],
        editedFiles: p.loc ? [`src/${workspace}/file-${i}.ts`] : [],
        aiCode: p.loc ? [{ language: 'typescript', lineCount: p.loc, filePath: `src/${workspace}/file-${i}.ts` }] : [],
        promptTokens: 1200 + i * 80,
        completionTokens: 400 + i * 20,
        cacheReadTokens: 200,
        totalElapsed: 4000 + i * 500,
        workType: 'feature',
        isCanceled: Boolean(p.canceled),
        endState: p.canceled ? 'canceled' : 'completed',
        isAllCaps: p.text === p.text.toUpperCase() && p.text.length > 8,
      }),
    );
    return emptySession({
      sessionId,
      workspaceId: `ws-${workspace}`,
      workspaceName: workspace,
      workspaceRootPath: `/Users/dev/${workspace}`,
      harness,
      requests,
    });
  };

  return [
    mk('fx-alpha', 'aurora', 'Claude Code', 'claude-sonnet-4.5', [
      { offsetMs: 2 * hour, text: 'Refactor the auth middleware to support JWT rotation and document the failure modes.', tools: ['Read', 'Edit'], loc: 86 },
      { offsetMs: hour, text: 'Add integration tests for refresh token expiry.', tools: ['Read', 'Write'], loc: 42 },
      { offsetMs: 30 * 60_000, text: 'fix flaky CI on the auth suite.', tools: ['Bash', 'Read'], loc: 12 },
    ]),
    mk('fx-beta', 'aurora', 'Local Agent', 'gpt-5.2', [
      { offsetMs: day + 3 * hour, text: 'fix bug', tools: [], loc: 0 },
      { offsetMs: day + 2 * hour, text: 'WHY IS THIS BROKEN', tools: ['read_file'], loc: 5, canceled: true },
      { offsetMs: day + hour, text: 'Implement dark-mode tokens for the settings panel with WCAG AA contrast.', tools: ['read_file', 'apply_patch'], loc: 64 },
    ]),
    mk('fx-gamma', 'northwind', 'Codex CLI', 'gpt-5.1-codex', [
      { offsetMs: 2 * day + 4 * hour, text: 'Scaffold a FastAPI service with health checks and OpenAPI.', tools: ['apply_patch'], loc: 120 },
      { offsetMs: 2 * day + 2 * hour, text: 'Wire Dockerfile and compose for local postgres.', tools: ['apply_patch'], loc: 55 },
    ]),
    mk('fx-delta', 'northwind', 'Cursor', 'claude-opus-4.6', [
      { offsetMs: 3 * day + 10 * hour, text: 'Explore how pagination works in the orders API.', tools: ['grep', 'read'], loc: 0 },
      { offsetMs: 3 * day + 9 * hour, text: 'What is the default page size?', tools: ['grep'], loc: 0 },
      { offsetMs: 3 * day + 8 * hour, text: 'Ship cursor-based pagination with tests and a short ADR.', tools: ['search', 'edit'], loc: 90 },
    ]),
    mk('fx-epsilon', 'aurora', 'GitHub Copilot CLI', 'gpt-5.4', [
      { offsetMs: 4 * day + 14 * hour, text: 'Summarize yesterday git activity and draft a release note.', tools: ['Bash'], loc: 20 },
      { offsetMs: 5 * day + 23 * hour, text: 'quick help', tools: [], loc: 0 },
    ]),
  ];
}
