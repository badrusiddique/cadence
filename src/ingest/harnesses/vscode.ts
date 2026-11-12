import * as fs from 'fs';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir, listDirs, walkFiles } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps, readJsonl } from '../text';
import { parseCLIEventsFile } from './copilot-cli';

const VS_EDITIONS = ['Code', 'Code - Insiders', 'VSCodium', 'Cursor'];

function candidateVsCodeUserDirs(): string[] {
  const home = homeDir();
  const platform = process.platform;
  if (platform === 'darwin') {
    return VS_EDITIONS.map((edition) =>
      path.join(home, 'Library', 'Application Support', edition, 'User'),
    );
  }
  if (platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return VS_EDITIONS.map((edition) => path.join(appdata, edition, 'User'));
  }
  return VS_EDITIONS.map((edition) => path.join(home, '.config', edition, 'User'));
}

/** Discover VS Code-family User dirs; `extra` wins for portable/--user-data-dir hosts. */
export function findVsCodeUserDirs(extra: string[] = []): string[] {
  const merged = [...extra, ...candidateVsCodeUserDirs()];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dir of merged) {
    if (!dir) continue;
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (existsDir(resolved)) out.push(resolved);
  }
  return out;
}

/** workspaceStorage roots under discovered User dirs (+ remote server data dirs). */
export function findVsCodeDirs(extra: string[] = []): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const resolved = path.resolve(p);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    if (existsDir(resolved)) dirs.push(resolved);
  };

  for (const userDir of findVsCodeUserDirs(extra)) {
    push(path.join(userDir, 'workspaceStorage'));
  }

  if (process.platform !== 'win32') {
    const home = homeDir();
    for (const serverDir of ['.vscode-server', '.vscode-server-insiders']) {
      push(path.join(home, serverDir, 'data', 'User', 'workspaceStorage'));
    }
  }

  return dirs;
}

export function harnessFromPath(storagePath: string): string {
  const p = storagePath.toLowerCase();
  if (p.includes('cursor')) return 'Cursor';
  if (p.includes('vscodium') || p.includes('code')) return 'GitHub Copilot';
  if (p.includes('insiders') && p.includes('server')) return 'GitHub Copilot';
  if (p.includes('server')) return 'GitHub Copilot';
  return 'GitHub Copilot';
}

function isChatSessionFile(name: string): boolean {
  return name.endsWith('.json') || name.endsWith('.jsonl');
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

function rebuildSessionFromJsonl(filePath: string): Record<string, unknown> | null {
  const rows = readJsonl(filePath);
  if (rows.length === 0) return null;

  let session: Record<string, unknown> | null = null;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const kind = r.kind;

    if (kind === 0 && r.v && typeof r.v === 'object') {
      session = { ...(r.v as Record<string, unknown>) };
      continue;
    }

    if (kind === 2 && session) {
      const k = r.k;
      const v = r.v;
      if (Array.isArray(k) && k.length === 1 && k[0] === 'requests' && Array.isArray(v)) {
        const existing = Array.isArray(session.requests) ? (session.requests as unknown[]) : [];
        session.requests = existing.length === 0 ? v : [...existing, ...v];
      } else if (Array.isArray(k) && k.length === 1 && typeof k[0] === 'string') {
        session[k[0]] = v as unknown;
      }
    }
  }

  return session;
}

function parseChatSessionObject(
  raw: Record<string, unknown>,
  filePath: string,
  workspaceId: string,
  workspaceName: string,
  harness: string,
): Session | null {
  const sessionId = String(
    raw.sessionId || raw.id || path.basename(filePath, path.extname(filePath)),
  );
  const requests = [];
  const requestsArr: any[] = (raw.requests as any[]) || (raw.turns as any[]) || [];

  for (let i = 0; i < requestsArr.length; i++) {
    const req = requestsArr[i];
    const messageText = extractUserText(req);
    const responseText = extractAssistantText(req);
    const modelId = String(req.modelId || req.model || raw.model || '');
    const tools = extractTools(req);
    const ts = req.timestamp
      ? Date.parse(String(req.timestamp))
      : raw.creationDate
        ? Date.parse(String(raw.creationDate))
        : null;

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
        promptTokens: num(req.promptTokens ?? req.metadata?.promptTokens ?? req.tokenUsage?.promptTokens),
        completionTokens: num(
          req.completionTokens ?? req.metadata?.outputTokens ?? req.tokenUsage?.completionTokens,
        ),
        cacheReadTokens: num(req.cacheReadTokens ?? req.metadata?.cacheReadTokens ?? req.tokenUsage?.cacheReadTokens),
        cacheWriteTokens: num(
          req.cacheWriteTokens ?? req.metadata?.cacheWriteTokens ?? req.tokenUsage?.cacheWriteTokens,
        ),
        billedCredits: billedCreditsFrom(req),
        premiumRequests: num(req.premiumRequests ?? req.metadata?.premiumRequests),
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

/** Parse a chat session from a filesystem path or an already-loaded object. */
export function parseChatSessionFile(
  source: string | Record<string, unknown>,
  workspaceId: string,
  workspaceName: string,
  harness: string,
): Session | null {
  if (typeof source === 'string') {
    if (source.endsWith('.jsonl')) {
      return parseChatSessionJsonl(source, workspaceId, workspaceName, harness);
    }
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(fs.readFileSync(source, 'utf8')) as Record<string, unknown>;
    } catch {
      return null;
    }
    return parseChatSessionObject(raw, source, workspaceId, workspaceName, harness);
  }
  return parseChatSessionObject(source, 'inline.json', workspaceId, workspaceName, harness);
}

/** Rebuild an append-log `.jsonl` chat session (kind 0 base + kind 2 patches) then parse. */
export function parseChatSessionJsonl(
  filePath: string,
  workspaceId: string,
  workspaceName: string,
  harness: string,
): Session | null {
  const rebuilt = rebuildSessionFromJsonl(filePath);
  if (!rebuilt) return null;
  return parseChatSessionObject(rebuilt, filePath, workspaceId, workspaceName, harness);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Copilot Chat may log credits directly or as nano AIU (1e9 = 1 credit). */
function billedCreditsFrom(req: any): number | null {
  const credits = num(req.copilotCredits ?? req.metadata?.copilotCredits ?? req.billedCredits);
  if (credits != null && credits > 0) return credits;
  const nano = num(
    req.copilotUsageNanoAiu ??
      req.metadata?.copilotUsageNanoAiu ??
      req.totalNanoAiu ??
      req.metadata?.totalNanoAiu,
  );
  if (nano != null && nano > 0) return nano / 1_000_000_000;
  return null;
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

function parseTranscriptSessions(
  entryPath: string,
  workspaceId: string,
  workspaceName: string,
): Session[] {
  const txDir = path.join(entryPath, 'GitHub.copilot-chat', 'transcripts');
  if (!existsDir(txDir)) return [];
  const sessions: Session[] = [];
  for (const file of walkFiles(txDir, (n) => n.endsWith('.jsonl') || n.endsWith('.json'))) {
    try {
      const session = parseCLIEventsFile(file, workspaceId, workspaceName);
      if (!session) continue;
      session.harness = 'GitHub Copilot';
      for (const req of session.requests) {
        req.agentName = 'GitHub Copilot';
      }
      sessions.push(session);
    } catch {
      /* continue */
    }
  }
  return sessions;
}

export function parseVsCodeSessions(storageRoots: string[]): Session[] {
  const sessions: Session[] = [];
  for (const root of storageRoots) {
    const harness = harnessFromPath(root);
    for (const entry of listDirs(root)) {
      const workspaceName = readWorkspaceName(entry);
      const workspaceId = `vscode:${path.basename(entry)}`;
      const chatDir = path.join(entry, 'chatSessions');
      if (existsDir(chatDir)) {
        for (const file of walkFiles(chatDir, isChatSessionFile)) {
          try {
            const session = parseChatSessionFile(file, workspaceId, workspaceName, harness);
            if (session) sessions.push(session);
          } catch {
            /* continue */
          }
        }
      }
      try {
        sessions.push(...parseTranscriptSessions(entry, workspaceId, workspaceName));
      } catch {
        /* continue */
      }
    }
  }
  return sessions;
}

/** Global (no-folder / transferred) Copilot Chat sessions under User/globalStorage. */
export function parseVsCodeGlobalChatSessions(userDirs: string[]): Session[] {
  const sessions: Session[] = [];
  for (const userDir of userDirs) {
    const harness = harnessFromPath(userDir);
    const globalStorage = path.join(userDir, 'globalStorage');
    if (!existsDir(globalStorage)) continue;

    const emptyDir = path.join(globalStorage, 'emptyWindowChatSessions');
    if (existsDir(emptyDir)) {
      for (const file of walkFiles(emptyDir, isChatSessionFile)) {
        try {
          const session = parseChatSessionFile(
            file,
            `vscode-global:emptyWindow`,
            'Empty Window',
            harness,
          );
          if (session) sessions.push(session);
        } catch {
          /* continue */
        }
      }
    }

    const transferredDir = path.join(globalStorage, 'transferredChatSessions');
    if (existsDir(transferredDir)) {
      for (const file of walkFiles(transferredDir, (n) => n.endsWith('.json'))) {
        try {
          const session = parseChatSessionFile(
            file,
            `vscode-global:transferred`,
            'Transferred',
            harness,
          );
          if (session) sessions.push(session);
        } catch {
          /* continue */
        }
      }
    }
  }
  return sessions;
}

/** Count chatSessions files under workspaceStorage roots (doctor probe). */
export function countChatSessionFiles(storageRoots: string[]): { json: number; jsonl: number } {
  let json = 0;
  let jsonl = 0;
  for (const root of storageRoots) {
    for (const entry of listDirs(root)) {
      const chatDir = path.join(entry, 'chatSessions');
      if (!existsDir(chatDir)) continue;
      for (const file of walkFiles(chatDir, isChatSessionFile)) {
        if (file.endsWith('.jsonl')) jsonl += 1;
        else json += 1;
      }
    }
  }
  return { json, jsonl };
}
