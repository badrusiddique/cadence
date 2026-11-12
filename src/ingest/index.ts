import type { EditLocIndex, IngestResult, Session, Workspace } from '../domain/types';
import { discoverSources, type DiscoveredSources } from './discover';
import { parseClaudeSessions } from './harnesses/claude';
import { parseCodexSessions } from './harnesses/codex';
import { parseCopilotCliSessions } from './harnesses/copilot-cli';
import { parseCursorSessions } from './harnesses/cursor';
import { findCursorUserDirs, loadCursorComposerSessions } from './harnesses/cursor-composer';
import { parseOpenCodeSessions } from './harnesses/opencode';
import { parseVsCodeSessions } from './harnesses/vscode';
import { buildFixtureSessions } from './fixtures';
import { readIngestCache, writeIngestCache } from './cache';
import { resolveIngestLimits, truncateSessions, type IngestLimits } from './limits';
import * as path from 'path';

export type ProgressFn = (update: { phase: string; detail?: string; ratio?: number }) => void;

function indexWorkspaces(sessions: Session[]): Map<string, Workspace> {
  const map = new Map<string, Workspace>();
  for (const s of sessions) {
    if (!map.has(s.workspaceId)) {
      map.set(s.workspaceId, {
        id: s.workspaceId,
        name: s.workspaceName,
        path: s.workspaceRootPath || '',
      });
    }
  }
  return map;
}

export function ingestAll(options?: {
  demoMode?: boolean;
  sources?: DiscoveredSources;
  onProgress?: ProgressFn;
  useCache?: boolean;
  limits?: Partial<IngestLimits>;
}): IngestResult {
  const limits = resolveIngestLimits(options?.limits);

  if (options?.demoMode) {
    options.onProgress?.({ phase: 'fixtures', detail: 'Loading demo fixtures', ratio: 1 });
    const sessions = buildFixtureSessions();
    return {
      sessions,
      workspaces: indexWorkspaces(sessions),
      editLocIndex: new Map(),
      sources: ['fixtures'],
      errors: [],
    };
  }

  if (options?.useCache !== false) {
    const cached = readIngestCache();
    if (cached && cached.sessions.length > 0) {
      options?.onProgress?.({ phase: 'cache', detail: 'Loaded cached sessions', ratio: 1 });
      const capped = truncateSessions(cached.sessions, limits.maxSessions);
      if (!capped.truncated) return cached;
      return {
        ...cached,
        sessions: capped.sessions,
        workspaces: indexWorkspaces(capped.sessions),
        errors: [
          ...cached.errors,
          {
            source: 'limits',
            message: `Cache truncated to ${limits.maxSessions} sessions (${capped.truncated} omitted). Raise cadence.maxSessions if needed.`,
          },
        ],
      };
    }
  }

  const sources = options?.sources ?? discoverSources();
  const sessions: Session[] = [];
  const editLocIndex: EditLocIndex = new Map();
  const errors: IngestResult['errors'] = [];
  const sourcePaths: string[] = [];
  const report = options?.onProgress;

  const steps: Array<{ name: string; run: () => Session[] }> = [
    {
      name: 'VS Code / Cursor storage',
      run: () => {
        sourcePaths.push(...sources.vscode);
        return parseVsCodeSessions(sources.vscode);
      },
    },
    {
      name: 'Claude Code',
      run: () => {
        sourcePaths.push(...sources.claude);
        return sources.claude.flatMap((d) => parseClaudeSessions(d, editLocIndex));
      },
    },
    {
      name: 'Codex CLI',
      run: () => {
        sourcePaths.push(...sources.codex);
        return sources.codex.flatMap((d) => parseCodexSessions(d, editLocIndex));
      },
    },
    {
      name: 'OpenCode',
      run: () => {
        sourcePaths.push(...sources.opencode);
        return parseOpenCodeSessions(sources.opencode);
      },
    },
    {
      name: 'Copilot CLI',
      run: () => {
        sourcePaths.push(...sources.copilotCli);
        return parseCopilotCliSessions(sources.copilotCli);
      },
    },
    {
      name: 'Cursor transcripts',
      run: () => {
        sourcePaths.push(...sources.cursor);
        return parseCursorSessions(sources.cursor);
      },
    },
    {
      name: 'Cursor Composer DB',
      run: () => {
        const userDirs = findCursorUserDirs();
        for (const d of userDirs) sourcePaths.push(path.join(d, 'globalStorage', 'state.vscdb'));
        return loadCursorComposerSessions(userDirs);
      },
    },
  ];

  steps.forEach((step, i) => {
    report?.({ phase: 'ingest', detail: step.name, ratio: i / steps.length });
    try {
      sessions.push(...step.run());
    } catch (err) {
      errors.push({ source: step.name, message: err instanceof Error ? err.message : String(err) });
    }
  });

  report?.({ phase: 'done', detail: `${sessions.length} sessions`, ratio: 1 });

  // Empty install stays empty. Demo fixtures are opt-in via cadence.demoMode only.
  if (sessions.length === 0) {
    return {
      sessions: [],
      workspaces: new Map(),
      editLocIndex,
      sources: [],
      errors: [
        ...errors,
        {
          source: 'discover',
          message:
            'No local AI session logs found. Use Copilot, Cursor, Claude Code, Codex, or OpenCode, then Reload. Or enable cadence.demoMode for sample data.',
        },
      ],
    };
  }

  const capped = truncateSessions(sessions, limits.maxSessions);
  if (capped.truncated) {
    errors.push({
      source: 'limits',
      message: `Ingest truncated to ${limits.maxSessions} sessions (${capped.truncated} omitted for host safety).`,
    });
  }

  const result: IngestResult = {
    sessions: capped.sessions,
    workspaces: indexWorkspaces(capped.sessions),
    editLocIndex,
    sources: [...new Set(sourcePaths)],
    errors,
  };
  writeIngestCache(result);
  return result;
}

export { discoverSources, hasAnySources } from './discover';
export { buildFixtureSessions } from './fixtures';
