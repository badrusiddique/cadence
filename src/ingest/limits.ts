/** Hard caps so large home directories cannot hang or OOM the extension host. */

export interface IngestLimits {
  maxSessions: number;
  maxFilesPerWalk: number;
  maxFileBytes: number;
  maxWalkDepth: number;
}

export const DEFAULT_INGEST_LIMITS: IngestLimits = {
  maxSessions: 5_000,
  maxFilesPerWalk: 8_000,
  maxFileBytes: 8 * 1024 * 1024,
  maxWalkDepth: 12,
};

export function resolveIngestLimits(partial?: Partial<IngestLimits>): IngestLimits {
  return {
    maxSessions: clamp(partial?.maxSessions, 100, 50_000, DEFAULT_INGEST_LIMITS.maxSessions),
    maxFilesPerWalk: clamp(partial?.maxFilesPerWalk, 100, 100_000, DEFAULT_INGEST_LIMITS.maxFilesPerWalk),
    maxFileBytes: clamp(partial?.maxFileBytes, 64 * 1024, 64 * 1024 * 1024, DEFAULT_INGEST_LIMITS.maxFileBytes),
    maxWalkDepth: clamp(partial?.maxWalkDepth, 2, 32, DEFAULT_INGEST_LIMITS.maxWalkDepth),
  };
}

function clamp(n: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function truncateSessions<T>(sessions: T[], max: number): { sessions: T[]; truncated: number } {
  if (sessions.length <= max) return { sessions, truncated: 0 };
  return { sessions: sessions.slice(0, max), truncated: sessions.length - max };
}
