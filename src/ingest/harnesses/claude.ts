import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type EditLocIndex, type Session, type SessionRequest } from '../../domain/types';
import { existsDir, homeDir, walkFiles } from '../paths';
import { asText, classifyWorkType, countLines, detectLanguage, hasProfanity, isAllCaps, readJsonl } from '../text';

export function findClaudeDirs(): string[] {
  const projects = path.join(homeDir(), '.claude', 'projects');
  return existsDir(projects) ? [projects] : [];
}

function decodeProjectName(encoded: string): string {
  // Claude encodes paths like -Users-me-proj
  const decoded = encoded.replace(/^-/, '/').replace(/-/g, '/');
  return path.basename(decoded) || encoded;
}

function parseClaudeJsonl(
  filePath: string,
  workspaceId: string,
  workspaceName: string,
  editLocIndex: EditLocIndex,
): Session | null {
  const rows = readJsonl(filePath);
  if (rows.length === 0) return null;

  let sessionId = path.basename(filePath, '.jsonl');
  let cwd = '';
  const requests: SessionRequest[] = [];
  let pendingUser: { text: string; ts: number | null; id: string } | null = null;
  let tools: string[] = [];
  let edited: string[] = [];
  let modelId = '';
  let responseParts: string[] = [];
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let cacheRead: number | null = null;
  let cacheWrite: number | null = null;
  let reqIndex = 0;

  const flush = () => {
    if (!pendingUser) return;
    const messageText = pendingUser.text;
    const responseText = responseParts.join('\n');
    const aiCode = edited.map((fp) => ({
      language: detectLanguage(fp),
      lineCount: editLocIndex.get(`${sessionId}:claude:${reqIndex}`)?.get(fp)?.added ?? 0,
      filePath: fp,
    }));
    requests.push(
      emptyRequest({
        requestId: pendingUser.id || `${sessionId}:${reqIndex}`,
        timestamp: pendingUser.ts,
        messageText,
        responseText,
        messageLength: messageText.length,
        responseLength: responseText.length,
        modelId,
        agentName: 'Claude Code',
        agentMode: 'agent',
        toolsUsed: [...tools],
        editedFiles: [...edited],
        promptTokens,
        completionTokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        workType: classifyWorkType(messageText),
        aiCode,
        isAllCaps: isAllCaps(messageText),
        hasProfanity: hasProfanity(messageText),
      }),
    );
    reqIndex++;
    pendingUser = null;
    tools = [];
    edited = [];
    responseParts = [];
    promptTokens = null;
    completionTokens = null;
    cacheRead = null;
    cacheWrite = null;
  };

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.sessionId === 'string') sessionId = r.sessionId;
    if (typeof r.cwd === 'string') cwd = r.cwd;

    if (r.type === 'user') {
      const msg = r.message as Record<string, unknown> | undefined;
      const text = asText(msg?.content);
      const isToolResult = Array.isArray(msg?.content) && (msg?.content as unknown[]).some((c) => (c as any)?.type === 'tool_result');
      if (isToolResult) continue;
      flush();
      pendingUser = {
        text,
        ts: r.timestamp ? Date.parse(String(r.timestamp)) : null,
        id: typeof r.uuid === 'string' ? r.uuid : `${sessionId}:${reqIndex}`,
      };
      continue;
    }

    if (r.type === 'assistant' && pendingUser) {
      const msg = r.message as Record<string, unknown> | undefined;
      if (typeof msg?.model === 'string') modelId = msg.model;
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const part of content as any[]) {
          if (part?.type === 'text' && part.text) responseParts.push(String(part.text));
          if (part?.type === 'tool_use') {
            const name = String(part.name || 'tool');
            tools.push(name);
            const input = part.input || {};
            if (name === 'Edit' || name === 'Write' || name === 'MultiEdit') {
              const fp = String(input.file_path || input.filePath || '');
              if (fp) {
                edited.push(fp);
                const key = `${sessionId}:claude:${reqIndex}`;
                if (!editLocIndex.has(key)) editLocIndex.set(key, new Map());
                const added =
                  typeof input.new_string === 'string'
                    ? countLines(input.new_string)
                    : typeof input.content === 'string'
                      ? countLines(input.content)
                      : 1;
                editLocIndex.get(key)!.set(fp, { added, removed: 0 });
              }
            }
          }
        }
      }
      const usage = msg?.usage as Record<string, number> | undefined;
      if (usage) {
        promptTokens = (promptTokens ?? 0) + (usage.input_tokens ?? 0);
        completionTokens = (completionTokens ?? 0) + (usage.output_tokens ?? 0);
        cacheRead = (cacheRead ?? 0) + (usage.cache_read_input_tokens ?? 0);
        cacheWrite = (cacheWrite ?? 0) + (usage.cache_creation_input_tokens ?? 0);
      }
    }
  }
  flush();
  if (requests.length === 0) return null;

  return emptySession({
    sessionId,
    workspaceId,
    workspaceName,
    workspaceRootPath: cwd || undefined,
    harness: 'Claude Code',
    requests,
  });
}

export function parseClaudeSessions(projectsDir: string, editLocIndex: EditLocIndex = new Map()): Session[] {
  const sessions: Session[] = [];
  for (const proj of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const projPath = path.join(projectsDir, proj.name);
    const workspaceName = decodeProjectName(proj.name);
    const workspaceId = `claude:${proj.name}`;
    for (const file of walkFiles(projPath, (n) => n.endsWith('.jsonl'))) {
      // Skip nested subagent dirs' deep noise by still parsing; parent merge is best-effort.
      try {
        const session = parseClaudeJsonl(file, workspaceId, workspaceName, editLocIndex);
        if (session) sessions.push(session);
      } catch {
        /* continue */
      }
    }
  }
  return sessions;
}
