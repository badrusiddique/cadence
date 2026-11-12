import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, walkFiles } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps } from '../text';

function coerceTs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function findOpenCodeDirs(): string[] {
  const home = homeDir();
  const bases = [
    path.join(home, '.local', 'share', 'opencode'),
    path.join(home, 'Library', 'Application Support', 'opencode'),
  ];
  return bases.filter(existsDir);
}

/** Best-effort OpenCode storage parser (JSON message dumps). SQLite DBs are detected but skipped unless json sidecars exist. */
export function parseOpenCodeSessions(bases: string[]): Session[] {
  const sessions: Session[] = [];
  for (const base of bases) {
    for (const file of walkFiles(base, (n) => n.endsWith('.json') && !n.endsWith('.db'))) {
      try {
        const session = parseOpenCodeJson(file);
        if (session) sessions.push(session);
      } catch {
        /* continue */
      }
    }
  }
  return sessions;
}

function parseOpenCodeJson(filePath: string): Session | null {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const messages: any[] = Array.isArray(raw) ? raw : raw.messages || raw.turns || [];
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const sessionId = String(raw.id || path.basename(filePath, '.json'));
  const cwd = String(raw.directory || raw.cwd || '');
  const requests = [];
  let pending: { text: string; ts: number | null } | null = null;

  for (const msg of messages) {
    const role = String(msg.role || msg.type || '');
    const text = String(msg.content || msg.text || '');
    const ts = coerceTs(msg.time?.created ?? msg.timestamp);
    if (/user/i.test(role) && text) {
      pending = { text, ts };
    } else if (/assistant/i.test(role) && pending) {
      requests.push(
        emptyRequest({
          requestId: String(msg.id || `${sessionId}:${requests.length}`),
          timestamp: pending.ts,
          messageText: pending.text,
          responseText: text,
          messageLength: pending.text.length,
          responseLength: text.length,
          modelId: String(msg.model || raw.model || ''),
          agentName: 'OpenCode',
          agentMode: 'agent',
          toolsUsed: Array.isArray(msg.tools) ? msg.tools.map(String) : [],
          workType: classifyWorkType(pending.text),
          isAllCaps: isAllCaps(pending.text),
          hasProfanity: hasProfanity(pending.text),
        }),
      );
      pending = null;
    }
  }

  if (requests.length === 0) return null;
  return emptySession({
    sessionId,
    workspaceId: `opencode:${cwd || sessionId}`,
    workspaceName: cwd ? path.basename(cwd) : 'opencode',
    workspaceRootPath: cwd || undefined,
    harness: 'OpenCode',
    requests,
  });
}
