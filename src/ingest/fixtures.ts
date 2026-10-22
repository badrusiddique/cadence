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
    prompts: Array<{
      offsetMs: number;
      text: string;
      tools?: string[];
      loc?: number;
      canceled?: boolean;
      language?: string;
      instructions?: string[];
      skills?: string[];
      workType?: string;
    }>,
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
        referencedFiles: p.loc ? [`src/${workspace}/file-${i}.ts`, `README.md`] : [],
        customInstructions: p.instructions ?? [],
        skillsUsed: p.skills ?? [],
        aiCode: p.loc
          ? [{ language: p.language || 'typescript', lineCount: p.loc, filePath: `src/${workspace}/file-${i}.ts` }]
          : [],
        promptTokens: 1200 + i * 80,
        completionTokens: 400 + i * 20,
        cacheReadTokens: 200,
        totalElapsed: 4000 + i * 500,
        workType: p.workType || 'feature',
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

  const repeatSkill = 'Package the VS Code extension with vsce and prepare marketplace assets.';

  return [
    mk('fx-alpha', 'aurora', 'Claude Code', 'claude-sonnet-4.5', [
      {
        offsetMs: 2 * hour,
        text: 'Refactor the auth middleware to support JWT rotation and document the failure modes.',
        tools: ['Read', 'Edit'],
        loc: 86,
        instructions: ['Prefer small PRs'],
      },
      {
        offsetMs: hour,
        text: 'Add integration tests for refresh token expiry.',
        tools: ['Read', 'Write'],
        loc: 42,
        workType: 'test',
      },
      { offsetMs: 30 * 60_000, text: 'fix flaky CI on the auth suite.', tools: ['Bash', 'Read'], loc: 12, workType: 'bugfix' },
      { offsetMs: 20 * 60_000, text: repeatSkill, tools: ['Bash', 'Read'], loc: 30 },
    ]),
    mk('fx-beta', 'aurora', 'Local Agent', 'gpt-5.2', [
      { offsetMs: day + 3 * hour, text: 'fix bug', tools: [], loc: 0, workType: 'bugfix' },
      { offsetMs: day + 2 * hour, text: 'WHY IS THIS BROKEN', tools: ['read_file'], loc: 5, canceled: true },
      {
        offsetMs: day + hour,
        text: 'Implement dark-mode tokens for the settings panel with WCAG AA contrast.',
        tools: ['read_file', 'apply_patch'],
        loc: 64,
        language: 'css',
      },
      { offsetMs: day + 40 * 60_000, text: repeatSkill, tools: ['Bash'], loc: 18 },
    ]),
    mk('fx-gamma', 'northwind', 'Codex CLI', 'gpt-5.1-codex', [
      {
        offsetMs: 2 * day + 4 * hour,
        text: 'Scaffold a FastAPI service with health checks and OpenAPI.',
        tools: ['apply_patch'],
        loc: 120,
        language: 'python',
      },
      {
        offsetMs: 2 * day + 2 * hour,
        text: 'Wire Dockerfile and compose for local postgres.',
        tools: ['apply_patch'],
        loc: 55,
        language: 'dockerfile',
      },
      {
        offsetMs: 2 * day + hour,
        text: 'How should we structure FastAPI routers for multi-tenant apps?',
        tools: ['web_search', 'read'],
        loc: 0,
      },
    ]),
    mk('fx-delta', 'northwind', 'Cursor', 'claude-opus-4.6', [
      { offsetMs: 3 * day + 10 * hour, text: 'Explore how pagination works in the orders API.', tools: ['grep', 'read'], loc: 0 },
      { offsetMs: 3 * day + 9 * hour, text: 'What is the default page size?', tools: ['grep'], loc: 0 },
      {
        offsetMs: 3 * day + 8 * hour,
        text: 'Ship cursor-based pagination with tests and a short ADR.',
        tools: ['search', 'edit'],
        loc: 90,
        skills: ['api-pagination'],
      },
      { offsetMs: 3 * day + 7 * hour, text: repeatSkill, tools: ['Bash', 'Read'], loc: 22 },
    ]),
    mk('fx-epsilon', 'aurora', 'GitHub Copilot CLI', 'gpt-5.4', [
      {
        offsetMs: 4 * day + 14 * hour,
        text: 'Summarize yesterday git activity and draft a release note. See issue #42 and PR #88.',
        tools: ['Bash'],
        loc: 20,
        workType: 'docs',
      },
      { offsetMs: 5 * day + 23 * hour, text: 'quick help', tools: [], loc: 0 },
      {
        offsetMs: 5 * day + 10 * hour,
        text: 'Why does the orders query regress on weekends?',
        tools: ['grep', 'read', 'Bash'],
        loc: 8,
        workType: 'bugfix',
      },
    ]),
    mk('fx-zeta', 'harbor', 'Claude Code', 'claude-sonnet-4.5', [
      {
        offsetMs: 6 * day + 3 * hour,
        text: 'Add React accessibility pass for the checkout form.',
        tools: ['Read', 'Edit'],
        loc: 70,
        language: 'tsx',
        instructions: ['Keep components accessible'],
      },
      {
        offsetMs: 6 * day + 2 * hour,
        text: 'What ARIA roles are missing on the modal dialog?',
        tools: ['grep', 'read'],
        loc: 0,
      },
    ]),
  ];
}
