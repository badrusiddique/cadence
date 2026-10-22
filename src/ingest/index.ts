import type { EditLocIndex, IngestResult, Session, Workspace } from '../domain/types';
import { discoverSources, type DiscoveredSources } from './discover';
import { parseClaudeSessions } from './harnesses/claude';
import { parseCodexSessions } from './harnesses/codex';
import { parseCopilotCliSessions } from './harnesses/copilot-cli';
import { parseCursorSessions } from './harnesses/cursor';
import { parseOpenCodeSessions } from './harnesses/opencode';
import { parseVsCodeSessions } from './harnesses/vscode';
import { buildFixtureSessions } from './fixtures';
import { readIngestCache, writeIngestCache } from './cache';

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
}): IngestResult {
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
      return cached;
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

  // If nothing found, fall back to fixtures so first-run is useful.
  if (sessions.length === 0) {
    const fixtures = buildFixtureSessions();
    return {
      sessions: fixtures,
      workspaces: indexWorkspaces(fixtures),
      editLocIndex,
      sources: ['fixtures-fallback'],
      errors: [
        ...errors,
        {
          source: 'discover',
          message: 'No local AI session logs found. Showing demo fixtures — connect a harness or toggle Cadence: demo mode.',
        },
      ],
    };
  }

  const result: IngestResult = {
    sessions,
    workspaces: indexWorkspaces(sessions),
    editLocIndex,
    sources: [...new Set(sourcePaths)],
    errors,
  };
  writeIngestCache(result);
  return result;
}

export { discoverSources, hasAnySources } from './discover';
export { buildFixtureSessions } from './fixtures';
