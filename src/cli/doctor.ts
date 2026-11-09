import { discoverSources, hasAnySources } from '../ingest/discover';
import { homeDir, trustedRoots } from '../ingest/paths';
import { DEFAULT_INGEST_LIMITS } from '../ingest/limits';
import { RPC_ALLOWLIST } from '../host/rpc-guard';

export interface DoctorReport {
  ok: boolean;
  grade: 'enterprise-ready' | 'ready' | 'needs-setup';
  home: string;
  sources: ReturnType<typeof discoverSources>;
  totals: Record<string, number>;
  recommendations: string[];
  enterprise: {
    trustedRoots: number;
    rpcAllowlistSize: number;
    defaultMaxSessions: number;
    privacy: string[];
  };
  evidence: {
    state: 'observed';
    confidence: 'exact';
    authority: 'session-log' | 'fixture';
  };
}

/** Probe local harness roots without parsing session bodies (REA-style doctor). */
export function runDoctor(): DoctorReport {
  const sources = discoverSources();
  const totals = Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, v.length]));
  const any = hasAnySources(sources);
  const recommendations: string[] = [];

  if (!any) {
    recommendations.push('No harness log roots found. Enable cadence.demoMode or use an AI coding tool first.');
    recommendations.push(
      'Supported: VS Code/Cursor workspaceStorage, ~/.claude, ~/.codex, ~/.copilot, ~/.cursor/projects, OpenCode share dirs.',
    );
  }
  if (totals.cursor === 0) {
    recommendations.push('Cursor transcripts not detected under ~/.cursor/projects — optional gap fill vs older coaches.');
  }
  if (totals.claude === 0 && totals.codex === 0 && totals.vscode === 0) {
    recommendations.push('Run Cadence with --demo for fixture-backed overview while you generate real sessions.');
  }

  recommendations.push('For shared machines: enable cadence.redactSensitive and keep cadence.offlineUi=true.');
  recommendations.push('Approve personal signals explicitly (Save draft ≠ Approve). Review via Cadence: Review Local Signals.');

  const grade: DoctorReport['grade'] = !any ? 'needs-setup' : 'enterprise-ready';

  return {
    ok: any,
    grade,
    home: homeDir(),
    sources,
    totals,
    recommendations,
    enterprise: {
      trustedRoots: trustedRoots().length,
      rpcAllowlistSize: RPC_ALLOWLIST.size,
      defaultMaxSessions: DEFAULT_INGEST_LIMITS.maxSessions,
      privacy: [
        'no-telemetry',
        'read-only-session-logs',
        'rpc-allowlist',
        'signal-trust-gate',
        'offline-ui-default',
        'ingest-session-caps',
      ],
    },
    evidence: {
      state: 'observed',
      confidence: 'exact',
      authority: any ? 'session-log' : 'fixture',
    },
  };
}
