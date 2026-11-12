/**
 * Cursor agent transcript harness.
 * Reads ~/.cursor/projects/<slug>/agent-transcripts (flat or nested UUID layout).
 */
import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, listDirs, walkFiles } from '../paths';
import { asText, classifyWorkType, hasProfanity, isAllCaps, readJsonl } from '../text';

export function findCursorDirs(): string[] {
  const home = homeDir();
  const roots = [
    path.join(home, '.cursor', 'projects'),
    path.join(home, '.cursor', 'chats'),
  ];
  return roots.filter(existsDir);
}

function decodeCursorProject(name: string): string {
  return name.replace(/^(Users|home|mnt)-/, '').split('-').slice(-2).join('/') || name;
}

/** Pull plain text out of modern Cursor JSONL rows. */
export function extractCursorText(row: Record<string, unknown>): string {
  if (typeof row.content === 'string') return row.content;
  if (typeof row.text === 'string') return row.text;
  if (typeof row.message === 'string') return row.message;
  if (Array.isArray(row.content)) return asText(row.content);

  if (row.message && typeof row.message === 'object') {
    const msg = row.message as Record<string, unknown>;
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) return asText(msg.content);
    if (typeof msg.text === 'string') return msg.text;
  }
  return '';
}

function extractCursorTools(row: Record<string, unknown>): string[] {
  if (Array.isArray(row.tool_calls)) {
    return (row.tool_calls as Array<Record<string, unknown>>).map((t) =>
      String(t.name || (t.function as { name?: string } | undefined)?.name || 'tool'),
    );
  }
  const blocks: unknown[] = [];
  if (Array.isArray(row.content)) blocks.push(...row.content);
  if (row.message && typeof row.message === 'object') {
    const msg = row.message as Record<string, unknown>;
    if (Array.isArray(msg.content)) blocks.push(...msg.content);
  }
  return blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return '';
      const block = b as Record<string, unknown>;
      if (block.type === 'tool_use' || block.type === 'toolCall') return String(block.name || 'tool');
      return '';
    })
    .filter(Boolean);
}

function rowRole(row: Record<string, unknown>): string {
  return String(row.role || row.type || '');
}

export function parseTranscript(filePath: string, workspaceId: string, workspaceName: string): Session | null {
  const rows = readJsonl(filePath);
  if (rows.length === 0) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(raw)) rows.push(...raw);
      else if (raw && typeof raw === 'object') rows.push(raw);
    } catch {
      return null;
    }
  }
  if (rows.length === 0) return null;

  const sessionId = path.basename(filePath).replace(/\.(jsonl|txt|json)$/, '');
  const requests = [];
  let pending: { text: string; ts: number | null } | null = null;
  let modelId = '';

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const role = rowRole(r);
    if (/turn_ended|tool_result/i.test(role)) continue;

    const text = extractCursorText(r);
    const ts = r.timestamp ? Date.parse(String(r.timestamp)) : null;
    if (typeof r.model === 'string') modelId = r.model;
    const tools = extractCursorTools(r);

    if (/user|human/i.test(role) && text) {
      if (pending) {
        requests.push(
          emptyRequest({
            requestId: `${sessionId}:${requests.length}`,
            timestamp: pending.ts,
            messageText: pending.text,
            messageLength: pending.text.length,
            agentName: 'Cursor',
            agentMode: 'agent',
            modelId,
            workType: classifyWorkType(pending.text),
            endState: 'pending',
            isAllCaps: isAllCaps(pending.text),
            hasProfanity: hasProfanity(pending.text),
          }),
        );
      }
      pending = { text, ts };
    } else if (/assistant|ai|model/i.test(role) && pending) {
      requests.push(
        emptyRequest({
          requestId: `${sessionId}:${requests.length}`,
          timestamp: pending.ts,
          messageText: pending.text,
          responseText: text,
          messageLength: pending.text.length,
          responseLength: text.length,
          agentName: 'Cursor',
          agentMode: 'agent',
          modelId,
          toolsUsed: tools,
          workType: classifyWorkType(pending.text),
          endState: 'completed',
          isAllCaps: isAllCaps(pending.text),
          hasProfanity: hasProfanity(pending.text),
        }),
      );
      pending = null;
    }
  }

  if (pending) {
    requests.push(
      emptyRequest({
        requestId: `${sessionId}:pending`,
        timestamp: pending.ts,
        messageText: pending.text,
        messageLength: pending.text.length,
        agentName: 'Cursor',
        endState: 'pending',
        workType: classifyWorkType(pending.text),
      }),
    );
  }

  if (requests.length === 0) return null;
  return emptySession({
    sessionId,
    workspaceId,
    workspaceName,
    harness: 'Cursor',
    requests,
  });
}

export function parseCursorSessions(roots: string[]): Session[] {
  const sessions: Session[] = [];
  for (const root of roots) {
    for (const project of listDirs(root)) {
      const workspaceName = decodeCursorProject(path.basename(project));
      const workspaceId = `cursor:${path.basename(project)}`;
      const candidates = [
        path.join(project, 'agent-transcripts'),
        path.join(project, 'transcripts'),
      ].filter(existsDir);

      // Prefer transcript dirs. Only fall back to project root if those are missing.
      const dirs = candidates.length > 0 ? candidates : [project].filter(existsDir);

      for (const dir of dirs) {
        for (const file of walkFiles(dir, (n) => /\.(jsonl|json)$/.test(n))) {
          try {
            const session = parseTranscript(file, workspaceId, workspaceName);
            if (session) sessions.push(session);
          } catch {
            /* continue */
          }
        }
      }
    }
  }
  return sessions;
}
