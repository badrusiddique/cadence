/**
 * Cursor Composer / Agent chats from state.vscdb (primary IDE store).
 * Local Agent chats the user sees in Cursor live here more reliably than JSONL.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { emptyRequest, emptySession, type Session } from '../../domain/types';
import { existsDir, homeDir } from '../paths';
import { classifyWorkType, hasProfanity, isAllCaps } from '../text';

/** Resolve User dir from extension host globalStorageUri.fsPath (.../User/globalStorage/<extId>). */
export function userDirFromExtensionStorage(globalStorageFsPath: string): string {
  return path.resolve(globalStorageFsPath, '..', '..');
}

function candidateCursorUserDirs(): string[] {
  const home = homeDir();
  const brands = ['Cursor', 'Cursor Nightly', 'Cursor Dev'];
  if (process.platform === 'darwin') {
    return brands.map((b) => path.join(home, 'Library', 'Application Support', b, 'User'));
  }
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return brands.map((b) => path.join(appdata, b, 'User'));
  }
  return brands.map((b) => path.join(home, '.config', b, 'User'));
}

/** Discover Cursor User dirs; `extra` wins for portable/--user-data-dir hosts. */
export function findCursorUserDirs(extra: string[] = []): string[] {
  const merged = [...extra, ...candidateCursorUserDirs()];
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

function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* spin */
    }
  }
}

function snapshotDb(dbPath: string): string | null {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!fs.existsSync(dbPath)) return null;
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-cursor-'));
      const base = path.basename(dbPath);
      fs.copyFileSync(dbPath, path.join(tmp, base));
      for (const side of [`${base}-wal`, `${base}-shm`]) {
        const src = path.join(path.dirname(dbPath), side);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, side));
      }
      return path.join(tmp, base);
    } catch {
      if (attempt < 2) sleepSync(50);
    }
  }
  return null;
}

/** Decode cursorDiskKV.value — Cursor stores UTF-8 JSON as BLOB, not TEXT. */
export function decodeKvValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value)).toString('utf8');
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('utf8');
  }
  return String(value ?? '');
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function bubbleText(bubble: Record<string, unknown>): string {
  if (typeof bubble.text === 'string' && bubble.text.trim()) return bubble.text;
  if (typeof bubble.richText === 'string' && bubble.richText.trim()) {
    try {
      const rich = JSON.parse(bubble.richText);
      const walk = (node: unknown): string => {
        if (typeof node === 'string') return node;
        if (!node || typeof node !== 'object') return '';
        const n = node as Record<string, unknown>;
        if (typeof n.text === 'string') return n.text;
        if (Array.isArray(n.children)) return n.children.map(walk).join('');
        return '';
      };
      const t = walk(rich);
      if (t.trim()) return t;
    } catch {
      /* ignore */
    }
  }
  return '';
}

export function composerToSession(
  composerId: string,
  meta: Record<string, unknown>,
  bubbles: Map<string, Record<string, unknown>>,
): Session | null {
  const headerList = Array.isArray(meta.fullConversationHeadersOnly)
    ? (meta.fullConversationHeadersOnly as Array<Record<string, unknown>>)
    : Array.isArray(meta.conversation)
      ? (meta.conversation as Array<Record<string, unknown>>)
      : [];
  const map = (meta.conversationMap as Record<string, Record<string, unknown>> | undefined) || {};
  const modelConfig = meta.modelConfig as { modelName?: string } | undefined;
  const model = typeof modelConfig?.modelName === 'string' ? modelConfig.modelName : '';
  const workspaceName =
    typeof meta.name === 'string' && meta.name.trim()
      ? meta.name.trim().slice(0, 80)
      : `cursor-${composerId.slice(0, 8)}`;

  const requests = [];
  let pending: { text: string; ts: number | null } | null = null;

  for (const header of headerList) {
    const bubbleId = String(header.bubbleId || '');
    const type = Number(header.type);
    // Prefer dedicated bubble rows / conversationMap; conversation entries may embed text.
    const bubble = bubbles.get(bubbleId) || map[bubbleId] || header;
    const text = bubbleText(bubble);
    const createdAt = bubble.createdAt != null ? Number(bubble.createdAt) : null;
    const ts = Number.isFinite(createdAt) ? createdAt : null;

    if (type === 1 && text) {
      if (pending) {
        requests.push(
          emptyRequest({
            requestId: `${composerId}:${requests.length}`,
            timestamp: pending.ts,
            messageText: pending.text,
            messageLength: pending.text.length,
            agentName: 'Cursor',
            agentMode: String(meta.unifiedMode || 'agent'),
            modelId: model,
            workType: classifyWorkType(pending.text),
            endState: 'pending',
            isAllCaps: isAllCaps(pending.text),
            hasProfanity: hasProfanity(pending.text),
          }),
        );
      }
      pending = { text, ts };
    } else if (type === 2 && pending) {
      const tools: string[] = [];
      if (Array.isArray(bubble.toolResults)) {
        for (const t of bubble.toolResults as Array<Record<string, unknown>>) {
          tools.push(String(t.name || t.toolName || 'tool'));
        }
      }
      requests.push(
        emptyRequest({
          requestId: `${composerId}:${requests.length}`,
          timestamp: pending.ts,
          messageText: pending.text,
          responseText: text,
          messageLength: pending.text.length,
          responseLength: text.length,
          agentName: 'Cursor',
          agentMode: String(meta.unifiedMode || 'agent'),
          modelId: model,
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
        requestId: `${composerId}:pending`,
        timestamp: pending.ts,
        messageText: pending.text,
        messageLength: pending.text.length,
        agentName: 'Cursor',
        agentMode: String(meta.unifiedMode || 'agent'),
        modelId: model,
        workType: classifyWorkType(pending.text),
        endState: 'pending',
      }),
    );
  }

  if (requests.length === 0) return null;
  const started = typeof meta.createdAt === 'number' ? meta.createdAt : requests[0]?.timestamp ?? null;
  return emptySession({
    sessionId: composerId,
    workspaceId: `cursor-db:${composerId}`,
    workspaceName,
    harness: 'Cursor',
    startedAt: started,
    requests,
  });
}

type KvRow = { key: string; value: unknown };

function sessionsFromKvRows(composerRows: KvRow[], allBubbleRows: KvRow[]): Session[] {
  const sessions: Session[] = [];
  const bubblesByComposer = new Map<string, Map<string, Record<string, unknown>>>();
  for (const b of allBubbleRows) {
    const parts = String(b.key).split(':');
    // bubbleId:{composerId}:{bubbleId}
    if (parts.length < 3) continue;
    const composerId = parts[1];
    const bubbleId = parts.slice(2).join(':');
    const parsed = parseJson(decodeKvValue(b.value));
    if (!parsed) continue;
    if (!bubblesByComposer.has(composerId)) bubblesByComposer.set(composerId, new Map());
    bubblesByComposer.get(composerId)!.set(bubbleId, parsed);
  }

  for (const row of composerRows) {
    const composerId = String(row.key).replace(/^composerData:/, '');
    if (!composerId || composerId.includes('/')) continue;
    const meta = parseJson(decodeKvValue(row.value));
    if (!meta) continue;
    const session = composerToSession(composerId, meta, bubblesByComposer.get(composerId) || new Map());
    if (session) sessions.push(session);
  }
  return sessions;
}

function countKvPrefix(dbPath: string, prefix: string): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (
        path: string,
        opts?: { readOnly?: boolean },
      ) => {
        prepare: (sql: string) => { all: (...params: unknown[]) => Array<{ n: number }> };
        close: () => void;
      };
    };
    const snap = snapshotDb(dbPath);
    if (!snap) return null;
    const db = new DatabaseSync(snap, { readOnly: true });
    try {
      const rows = db.prepare(`SELECT COUNT(*) AS n FROM cursorDiskKV WHERE key LIKE ?`).all(`${prefix}%`);
      return Number(rows[0]?.n ?? 0);
    } finally {
      db.close();
      try {
        fs.rmSync(path.dirname(snap), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

export interface ComposerProbeEntry {
  userDir: string;
  dbPath: string;
  exists: boolean;
  size: number | null;
  composerRows: number | null;
  bubbleRows: number | null;
  sessionsParsed: number;
  error?: string;
}

export interface ComposerProbe {
  userDirs: string[];
  databases: ComposerProbeEntry[];
}

/** Diagnostics for which state.vscdb paths were probed and what they contain. */
export function probeComposerDatabases(userDirs: string[]): ComposerProbe {
  const databases: ComposerProbeEntry[] = [];
  for (const userDir of userDirs) {
    const dbPath = path.join(userDir, 'globalStorage', 'state.vscdb');
    const entry: ComposerProbeEntry = {
      userDir,
      dbPath,
      exists: false,
      size: null,
      composerRows: null,
      bubbleRows: null,
      sessionsParsed: 0,
    };
    try {
      if (fs.existsSync(dbPath)) {
        entry.exists = true;
        entry.size = fs.statSync(dbPath).size;
        entry.composerRows = countKvPrefix(dbPath, 'composerData:');
        entry.bubbleRows = countKvPrefix(dbPath, 'bubbleId:');
        entry.sessionsParsed = loadCursorComposerSessions([userDir]).length;
      }
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
    }
    databases.push(entry);
  }
  return { userDirs: [...userDirs], databases };
}

function loadWithNodeSqlite(userDirs: string[]): Session[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (
        path: string,
        opts?: { readOnly?: boolean },
      ) => {
        prepare: (sql: string) => { all: (...params: unknown[]) => KvRow[] };
        close: () => void;
      };
    };
    const sessions: Session[] = [];
    for (const userDir of userDirs) {
      const globalDb = path.join(userDir, 'globalStorage', 'state.vscdb');
      const snap = snapshotDb(globalDb);
      if (!snap) continue;
      // VS Code / non-Cursor User dirs often have state.vscdb without cursorDiskKV.
      // Fail one dir; never abort the whole batch (that zeroed sessions when host was Code).
      try {
        const db = new DatabaseSync(snap, { readOnly: true });
        try {
          const composers = db.prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE ?`).all('composerData:%');
          const bubbles = db.prepare(`SELECT key, value FROM cursorDiskKV WHERE key LIKE ?`).all('bubbleId:%');
          sessions.push(...sessionsFromKvRows(composers, bubbles));
        } finally {
          db.close();
        }
      } catch {
        /* skip this dir */
      } finally {
        try {
          fs.rmSync(path.dirname(snap), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
    return sessions;
  } catch {
    return null;
  }
}

async function loadWithSqlJs(userDirs: string[]): Promise<Session[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js');
  const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: (file: string) => (file.endsWith('.wasm') && fs.existsSync(wasmPath) ? wasmPath : file),
  });
  const sessions: Session[] = [];
  for (const userDir of userDirs) {
    const globalDb = path.join(userDir, 'globalStorage', 'state.vscdb');
    const snap = snapshotDb(globalDb);
    if (!snap) continue;
    try {
      const db = new SQL.Database(fs.readFileSync(snap));
      try {
        const composers: KvRow[] = [];
        const bubbles: KvRow[] = [];
        for (const table of db.exec(`SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'`)) {
          for (const row of table.values) composers.push({ key: String(row[0]), value: row[1] });
        }
        for (const table of db.exec(`SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'`)) {
          for (const row of table.values) bubbles.push({ key: String(row[0]), value: row[1] });
        }
        sessions.push(...sessionsFromKvRows(composers, bubbles));
      } finally {
        db.close();
      }
    } catch {
      /* skip this dir — missing cursorDiskKV is normal for VS Code User DBs */
    } finally {
      try {
        fs.rmSync(path.dirname(snap), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
  return sessions;
}

/** Sync path used by ingest (node:sqlite when available). */
export function loadCursorComposerSessions(userDirs = findCursorUserDirs()): Session[] {
  return loadWithNodeSqlite(userDirs) ?? [];
}

/** Async path with sql.js fallback for hosts without node:sqlite. */
export async function loadCursorComposerSessionsAsync(userDirs = findCursorUserDirs()): Promise<Session[]> {
  const sync = loadWithNodeSqlite(userDirs);
  if (sync) return sync;
  try {
    return await loadWithSqlJs(userDirs);
  } catch {
    return [];
  }
}
