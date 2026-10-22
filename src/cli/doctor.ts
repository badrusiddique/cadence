import { discoverSources, hasAnySources } from '../ingest/discover';
import { homeDir } from '../ingest/paths';

export interface DoctorReport {
  ok: boolean;
  home: string;
  sources: ReturnType<typeof discoverSources>;
  totals: Record<string, number>;
  recommendations: string[];
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
    recommendations.push('Supported: VS Code/Cursor workspaceStorage, ~/.claude, ~/.codex, ~/.copilot, ~/.cursor/projects, OpenCode share dirs.');
  }
  if (totals.cursor === 0) recommendations.push('Cursor transcripts not detected under ~/.cursor/projects — optional gap fill vs older coaches.');
  if (totals.claude === 0 && totals.codex === 0 && totals.vscode === 0) {
    recommendations.push('Run Cadence with --demo for fixture-backed overview while you generate real sessions.');
  }

  return {
    ok: any,
    home: homeDir(),
    sources,
    totals,
    recommendations,
    evidence: {
      state: 'observed',
      confidence: 'exact',
      authority: any ? 'session-log' : 'fixture',
    },
  };
}
