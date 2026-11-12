import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, walkFiles } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps, readJsonl } from '../text';

export function findCopilotCliDirs(): string[] {
  const home = homeDir();
  const dirs: string[] = [];
  for (const name of ['session-state', 'history-session-state']) {
    const p = path.join(home, '.copilot', name);
    if (existsDir(p)) dirs.push(p);
  }
  return dirs;
}

function nanoToCredits(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return v / 1_000_000_000;
}

export function parseCLIEventsFile(filePath: string, workspaceId: string, workspaceName: string): Session | null {
  const rows = readJsonl(filePath);
  if (rows.length === 0) return null;

  let sessionId = path.basename(filePath, path.extname(filePath));
  let harness = 'GitHub Copilot CLI';
  let modelId = '';
  let startedAt: number | null = null;
  const requests = [];
  let pendingUser: { text: string; ts: number | null } | null = null;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const data = (r.data || {}) as Record<string, unknown>;
    const ts = r.timestamp ? Date.parse(String(r.timestamp)) : null;

    if (r.type === 'session.start') {
      if (typeof data.sessionId === 'string') sessionId = data.sessionId;
      if (typeof data.selectedModel === 'string') modelId = data.selectedModel;
      if (data.remoteSteerable) harness = 'GitHub Copilot App';
      startedAt = ts;
      continue;
    }

    if (r.type === 'user.message') {
      pendingUser = { text: String(data.content || ''), ts };
      continue;
    }

    if (r.type === 'assistant.message' && pendingUser) {
      const tools = Array.isArray(data.toolRequests)
        ? (data.toolRequests as any[]).map((t) => String(t.toolName || t.name || 'tool'))
        : [];
      const messageText = pendingUser.text;
      const responseText = String(data.content || '');
      const cacheRead = typeof data.cacheReadTokens === 'number' ? data.cacheReadTokens : null;
      const inputRaw = typeof data.inputTokens === 'number' ? data.inputTokens : null;
      // Copilot often reports inputTokens inclusive of cache reads.
      const freshInput =
        inputRaw != null && cacheRead != null ? Math.max(0, inputRaw - cacheRead) : inputRaw;
      requests.push(
        emptyRequest({
          requestId: String(r.id || `${sessionId}:${requests.length}`),
          timestamp: pendingUser.ts,
          messageText,
          responseText,
          messageLength: messageText.length,
          responseLength: responseText.length,
          modelId: String(data.modelId || modelId || ''),
          agentName: harness,
          agentMode: 'agent',
          toolsUsed: tools,
          completionTokens: typeof data.outputTokens === 'number' ? data.outputTokens : null,
          promptTokens: freshInput,
          cacheReadTokens: cacheRead,
          cacheWriteTokens: typeof data.cacheWriteTokens === 'number' ? data.cacheWriteTokens : null,
          billedCredits: nanoToCredits(data.totalNanoAiu ?? data.copilotUsageNanoAiu),
          premiumRequests: typeof data.premiumRequests === 'number' ? data.premiumRequests : null,
          totalElapsed: pendingUser.ts && ts ? ts - pendingUser.ts : null,
          workType: classifyWorkType(messageText),
          endState: 'completed',
          isAllCaps: isAllCaps(messageText),
          hasProfanity: hasProfanity(messageText),
        }),
      );
      pendingUser = null;
      continue;
    }

    // Session-level billed metrics (preferred when present).
    if (r.type === 'session.shutdown') {
      const metrics = (data.modelMetrics || {}) as Record<string, unknown>;
      for (const [model, value] of Object.entries(metrics)) {
        const entry = (value || {}) as Record<string, any>;
        const usage = (entry.usage || {}) as Record<string, number>;
        const reqMeta = (entry.requests || {}) as Record<string, number>;
        const cacheRead = typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0;
        const inputRaw = typeof usage.inputTokens === 'number' ? usage.inputTokens : 0;
        const freshInput = Math.max(0, inputRaw - cacheRead);
        const nano = entry.totalNanoAiu;
        const premium = reqMeta.cost;
        requests.push(
          emptyRequest({
            requestId: `${sessionId}:shutdown:${model}`,
            timestamp: ts,
            messageText: '[session usage]',
            messageLength: 0,
            modelId: model,
            agentName: harness,
            agentMode: 'agent',
            promptTokens: freshInput || null,
            completionTokens: typeof usage.outputTokens === 'number' ? usage.outputTokens : null,
            cacheReadTokens: cacheRead || null,
            cacheWriteTokens: typeof usage.cacheWriteTokens === 'number' ? usage.cacheWriteTokens : null,
            billedCredits: nanoToCredits(nano),
            premiumRequests: typeof premium === 'number' && premium > 0 ? premium : null,
            workType: 'unknown',
            endState: 'completed',
          }),
        );
      }
    }
  }

  if (pendingUser) {
    requests.push(
      emptyRequest({
        requestId: `${sessionId}:pending`,
        timestamp: pendingUser.ts,
        messageText: pendingUser.text,
        messageLength: pendingUser.text.length,
        agentName: harness,
        endState: 'pending',
        workType: classifyWorkType(pendingUser.text),
      }),
    );
  }

  if (requests.length === 0) return null;
  return emptySession({
    sessionId,
    workspaceId,
    workspaceName,
    harness,
    startedAt,
    requests,
  });
}

export function parseCopilotCliSessions(dirs: string[]): Session[] {
  const sessions: Session[] = [];
  for (const dir of dirs) {
    for (const file of walkFiles(dir, (n) => n.endsWith('.jsonl') || n.endsWith('.json'))) {
      try {
        const session = parseCLIEventsFile(file, `copilot-cli:${dir}`, path.basename(dir));
        if (session) sessions.push(session);
      } catch {
        /* continue */
      }
    }
  }
  return sessions;
}
