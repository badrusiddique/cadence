#!/usr/bin/env node
/**
 * Cadence CLI — same analytics as the extension, usable from a terminal or agents.
 * Dual surface (CLI + host) mirrors the REA pattern of shared workflows.
 */
import * as fs from 'fs';
import { Analyzer } from '../analyze/analyzer';
import { ingestAll } from '../ingest';
import { BUILTIN_SIGNALS } from '../signals/catalog';
import { runDoctor } from './doctor';
import { estimated } from '../domain/evidence';

function usage(): never {
  console.log(`Cadence CLI — local AI coding insights

Usage:
  cadence doctor [--json]
  cadence overview [--demo] [--json]
  cadence habits [--demo] [--json]
  cadence export [--demo] [--out snapshot.md]
  cadence mcp              # stdio MCP server for agents

Privacy: read-only session logs, no telemetry.
`);
  process.exit(1);
}

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function opt(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function loadAnalyzer(demo: boolean): Analyzer {
  const result = ingestAll({ demoMode: demo });
  return new Analyzer(result.sessions, result.workspaces, BUILTIN_SIGNALS);
}

function print(data: unknown, asJson: boolean): void {
  if (asJson) console.log(JSON.stringify(data, null, 2));
  else if (typeof data === 'string') console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (!cmd || cmd === '-h' || cmd === '--help') usage();
  const json = flag(args, '--json');
  const demo = flag(args, '--demo');

  if (cmd === 'doctor') {
    print(runDoctor(), json);
    return;
  }

  if (cmd === 'overview') {
    const a = loadAnalyzer(demo);
    const overview = a.getOverview();
    print(
      {
        ...overview,
        evidence: { state: 'derived', confidence: 'high', authority: demo ? 'fixture' : 'session-log' },
      },
      json || true,
    );
    return;
  }

  if (cmd === 'habits') {
    const a = loadAnalyzer(demo);
    print(
      {
        findings: a.getHabits(),
        evidence: { state: 'derived', confidence: 'high', authority: 'signal-engine' },
      },
      true,
    );
    return;
  }

  if (cmd === 'export') {
    const a = loadAnalyzer(demo);
    const summary = a.exportSummary();
    const out = opt(args, '--out');
    if (out) {
      fs.writeFileSync(out, summary.markdown, 'utf8');
      console.log(`Wrote ${out}`);
    } else {
      print(summary.markdown, false);
    }
    return;
  }

  if (cmd === 'budget') {
    const a = loadAnalyzer(demo);
    print({ ...a.getBudget(), evidence: estimated() }, true);
    return;
  }

  if (cmd === 'mcp') {
    const { startMcpStdio } = await import('../mcp/server');
    await startMcpStdio({ demoDefault: demo });
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
