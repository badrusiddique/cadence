import * as path from 'path';
import { emptyRequest, emptySession, type EditLocIndex, type Session, type SessionRequest } from '../../domain/types';
import { existsDir, homeDir, walkFiles } from '../paths';
import { classifyWorkType, countLines, detectLanguage, hasProfanity, isAllCaps, readJsonl } from '../text';

export function findCodexDirs(): string[] {
  const home = homeDir();
  const dirs: string[] = [];
  for (const name of ['sessions', 'archived_sessions', 'archived-sessions']) {
    const p = path.join(home, '.codex', name);
    if (existsDir(p)) dirs.push(p);
  }
  return dirs;
}

function extractPatchFiles(input: string): Array<{ file: string; added: number }> {
  const out: Array<{ file: string; added: number }> = [];
  const blocks = input.split('*** ');
  for (const block of blocks) {
    const addMatch = block.match(/^(?:Add|Update) File:\s*(.+)\n([\s\S]*)$/);
    if (!addMatch) continue;
    const file = addMatch[1].trim();
    const body = addMatch[2];
    const added = body.split('\n').filter((l) => l.startsWith('+')).length || countLines(body);
    out.push({ file, added });
  }
  return out;
}

export function parseCodexSessions(sessionsDir: string, editLocIndex: EditLocIndex = new Map()): Session[] {
  const sessions: Session[] = [];
  for (const file of walkFiles(sessionsDir, (n) => n.endsWith('.jsonl'))) {
    try {
      const session = parseCodexFile(file, editLocIndex);
      if (session) sessions.push(session);
    } catch {
      /* continue */
    }
  }
  return sessions;
}

function parseCodexFile(filePath: string, editLocIndex: EditLocIndex): Session | null {
  const rows = readJsonl(filePath);
  if (rows.length === 0) return null;

  let sessionId = path.basename(filePath, '.jsonl');
  let cwd = '';
  const requests: SessionRequest[] = [];
  let pendingUser: { text: string; ts: number | null } | null = null;
  let tools: string[] = [];
  let edited: string[] = [];
  let responseParts: string[] = [];
  const modelId = 'codex';
  let reqIndex = 0;
  const pendingPatches = new Map<string, Array<{ file: string; added: number }>>();

  const flush = () => {
    if (!pendingUser) return;
    const messageText = pendingUser.text;
    const responseText = responseParts.join('\n');
    requests.push(
      emptyRequest({
        requestId: `${sessionId}:${reqIndex}`,
        timestamp: pendingUser.ts,
        messageText,
        responseText,
        messageLength: messageText.length,
        responseLength: responseText.length,
        modelId,
        agentName: 'Codex CLI',
        agentMode: 'agent',
        toolsUsed: [...tools],
        editedFiles: [...edited],
        workType: classifyWorkType(messageText),
        aiCode: edited.map((fp) => ({
          language: detectLanguage(fp),
          lineCount: editLocIndex.get(`${sessionId}:codex:${reqIndex}`)?.get(fp)?.added ?? 0,
          filePath: fp,
        })),
        isAllCaps: isAllCaps(messageText),
        hasProfanity: hasProfanity(messageText),
      }),
    );
    reqIndex++;
    pendingUser = null;
    tools = [];
    edited = [];
    responseParts = [];
  };

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const payload = (r.payload || {}) as Record<string, unknown>;

    if (r.type === 'session_meta') {
      if (typeof payload.id === 'string') sessionId = payload.id;
      if (typeof payload.cwd === 'string') cwd = payload.cwd;
      continue;
    }

    if (r.type === 'response_item') {
      const ts = r.timestamp ? Date.parse(String(r.timestamp)) : null;
      if (payload.role === 'user' || payload.type === 'message') {
        const content = payload.content;
        let text = '';
        if (Array.isArray(content)) {
          text = content.map((c: any) => c?.text || c?.input_text || '').join('\n');
        } else if (typeof content === 'string') text = content;
        if (payload.role === 'user' && text) {
          flush();
          pendingUser = { text, ts };
        } else if (payload.role === 'assistant' && text) {
          responseParts.push(text);
        }
      }

      if (payload.type === 'custom_tool_call') {
        const name = String(payload.name || 'tool');
        tools.push(name);
        const callId = String(payload.call_id || '');
        if (name === 'apply_patch' && typeof payload.input === 'string') {
          pendingPatches.set(callId, extractPatchFiles(payload.input));
        }
      }

      if (payload.type === 'custom_tool_call_output') {
        const callId = String(payload.call_id || '');
        const output = payload.output as Record<string, unknown> | undefined;
        const ok = output?.success !== false;
        const patches = pendingPatches.get(callId) || [];
        pendingPatches.delete(callId);
        if (ok) {
          const key = `${sessionId}:codex:${reqIndex}`;
          if (!editLocIndex.has(key)) editLocIndex.set(key, new Map());
          for (const p of patches) {
            edited.push(p.file);
            editLocIndex.get(key)!.set(p.file, { added: p.added, removed: 0 });
          }
        }
      }
    }
  }
  flush();
  if (requests.length === 0) return null;

  const workspaceName = cwd ? path.basename(cwd) : 'codex';
  return emptySession({
    sessionId,
    workspaceId: `codex:${cwd || sessionId}`,
    workspaceName,
    workspaceRootPath: cwd || undefined,
    harness: 'Codex CLI',
    requests,
  });
}
