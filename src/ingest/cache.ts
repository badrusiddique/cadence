import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { IngestResult, Session, Workspace } from '../domain/types';

const CACHE_DIR = path.join(os.homedir(), '.cadence', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'sessions.v1.json');

interface CachePayload {
  savedAt: number;
  sources: string[];
  sessions: Session[];
  workspaces: Array<[string, Workspace]>;
  errors: IngestResult['errors'];
}

export function readIngestCache(maxAgeMs = 30 * 60_000): IngestResult | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CachePayload;
    if (!raw.savedAt || Date.now() - raw.savedAt > maxAgeMs) return null;
    return {
      sessions: raw.sessions || [],
      workspaces: new Map(raw.workspaces || []),
      editLocIndex: new Map(),
      sources: raw.sources || [],
      errors: raw.errors || [],
    };
  } catch {
    return null;
  }
}

export function writeIngestCache(result: IngestResult): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const payload: CachePayload = {
      savedAt: Date.now(),
      sources: result.sources,
      sessions: result.sessions,
      workspaces: [...result.workspaces.entries()],
      errors: result.errors,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload), 'utf8');
  } catch {
    /* cache is best-effort */
  }
}

export function clearIngestCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch {
    /* ignore */
  }
}
