/**
 * Cursor agent transcript harness — gap fill vs upstream AI Engineer Coach.
 * Reads local Cursor project agent transcripts when present.
 */
import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, listDirs, walkFiles } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps, readJsonl } from '../text';

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

function parseTranscript(filePath: string, workspaceId: string, workspaceName: string): Session | null {
  const rows = readJsonl(filePath);
  // Some Cursor dumps are a single JSON array / object
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
    const role = String(r.role || r.type || '');
    const text = String(r.content || r.text || r.message || '');
    const ts = r.timestamp ? Date.parse(String(r.timestamp)) : null;
    if (typeof r.model === 'string') modelId = r.model;

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
          toolsUsed: Array.isArray(r.tool_calls) ? (r.tool_calls as any[]).map((t) => String(t.name || t.function?.name || 'tool')) : [],
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
        project,
      ].filter(existsDir);

      for (const dir of candidates) {
        for (const file of walkFiles(dir, (n) => /\.(jsonl|json|txt)$/.test(n))) {
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
