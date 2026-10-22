import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, listDirs, walkFiles } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps } from '../text';

const VS_EDITIONS = ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'];

export function findVsCodeDirs(): string[] {
  const home = homeDir();
  const dirs: string[] = [];
  const platform = process.platform;

  for (const edition of VS_EDITIONS) {
    let vsPath = '';
    if (platform === 'darwin') {
      vsPath = path.join(home, 'Library', 'Application Support', edition, 'User', 'workspaceStorage');
    } else if (platform === 'win32') {
      vsPath = path.join(process.env.APPDATA || '', edition, 'User', 'workspaceStorage');
    } else {
      vsPath = path.join(home, '.config', edition, 'User', 'workspaceStorage');
    }
    if (existsDir(vsPath)) dirs.push(vsPath);
  }

  if (platform !== 'win32') {
    for (const serverDir of ['.vscode-server', '.vscode-server-insiders']) {
      const serverPath = path.join(home, serverDir, 'data', 'User', 'workspaceStorage');
      if (existsDir(serverPath)) dirs.push(serverPath);
    }
  }

  return dirs;
}

export function harnessFromPath(storagePath: string): string {
  const p = storagePath.toLowerCase();
  if (p.includes('cursor')) return 'Cursor';
  if (p.includes('insiders') && p.includes('server')) return 'Local Agent (Server Insiders)';
  if (p.includes('server')) return 'Local Agent (Server)';
  if (p.includes('insiders')) return 'Local Agent (Insiders)';
  return 'Local Agent';
}

function readWorkspaceName(entryPath: string): string {
  try {
    const ws = JSON.parse(fs.readFileSync(path.join(entryPath, 'workspace.json'), 'utf8'));
    if (typeof ws.folder === 'string') return path.basename(ws.folder.replace('file://', ''));
    if (typeof ws.workspace === 'string') return path.basename(ws.workspace);
  } catch {
    /* ignore */
  }
  return path.basename(entryPath).slice(0, 8);
}

function parseChatSessionFile(filePath: string, workspaceId: string, workspaceName: string, harness: string): Session | null {
  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }

  const sessionId = String(raw.sessionId || raw.id || path.basename(filePath, '.json'));
  const requests = [];
  const requestsArr: any[] = raw.requests || raw.turns || [];

  for (let i = 0; i < requestsArr.length; i++) {
    const req = requestsArr[i];
    const messageText = extractUserText(req);
    const responseText = extractAssistantText(req);
    const modelId = String(req.modelId || req.model || raw.model || '');
    const tools = extractTools(req);
    const ts = req.timestamp ? Date.parse(String(req.timestamp)) : raw.creationDate ? Date.parse(String(raw.creationDate)) : null;

    requests.push(
      emptyRequest({
        requestId: String(req.requestId || req.id || `${sessionId}:${i}`),
        timestamp: Number.isFinite(ts) ? ts : null,
        messageText,
        responseText,
        messageLength: messageText.length,
        responseLength: responseText.length,
        modelId,
        agentName: harness,
        agentMode: String(req.agentMode || req.mode || 'agent'),
        toolsUsed: tools,
        isCanceled: Boolean(req.isCanceled || req.canceled),
        endState: req.isCanceled ? 'canceled' : 'completed',
        promptTokens: num(req.promptTokens ?? req.metadata?.promptTokens),
        completionTokens: num(req.completionTokens ?? req.metadata?.outputTokens),
        workType: classifyWorkType(messageText),
        slashCommand: String(req.slashCommand || ''),
        skillsUsed: Array.isArray(req.skills) ? req.skills.map(String) : [],
        isAllCaps: isAllCaps(messageText),
        hasProfanity: hasProfanity(messageText),
      }),
    );
  }

  if (requests.length === 0) return null;
  return emptySession({
    sessionId,
    workspaceId,
    workspaceName,
    harness,
    requests,
    title: typeof raw.title === 'string' ? raw.title : undefined,
  });
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function extractUserText(req: any): string {
  if (typeof req.message === 'string') return req.message;
  if (typeof req.prompt === 'string') return req.prompt;
  if (req.message?.text) return String(req.message.text);
  if (Array.isArray(req.message?.parts)) {
    return req.message.parts.map((p: any) => p.text || '').join('');
  }
  return String(req.userMessage || '');
}

function extractAssistantText(req: any): string {
  if (typeof req.response === 'string') return req.response;
  if (Array.isArray(req.response)) {
    return req.response.map((r: any) => r.value || r.text || '').join('\n');
  }
  if (req.result?.metadata?.responseText) return String(req.result.metadata.responseText);
  return String(req.assistantMessage || '');
}

function extractTools(req: any): string[] {
  const tools: string[] = [];
  const candidates = [req.toolsUsed, req.toolCalls, req.result?.toolCalls, req.response];
  for (const c of candidates) {
    if (!Array.isArray(c)) continue;
    for (const t of c) {
      if (typeof t === 'string') tools.push(t);
      else if (t?.name) tools.push(String(t.name));
      else if (t?.toolName) tools.push(String(t.toolName));
    }
  }
  return [...new Set(tools)];
}

export function parseVsCodeSessions(storageRoots: string[]): Session[] {
  const sessions: Session[] = [];
  for (const root of storageRoots) {
    const harness = harnessFromPath(root);
    for (const entry of listDirs(root)) {
      const workspaceName = readWorkspaceName(entry);
      const workspaceId = `vscode:${path.basename(entry)}`;
      const chatDir = path.join(entry, 'chatSessions');
      if (!existsDir(chatDir)) continue;
      for (const file of walkFiles(chatDir, (n) => n.endsWith('.json'))) {
        try {
          const session = parseChatSessionFile(file, workspaceId, workspaceName, harness);
          if (session) sessions.push(session);
        } catch {
          /* continue */
        }
      }
    }
  }
  return sessions;
}
