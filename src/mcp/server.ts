/**
 * Minimal stdio MCP server for Cadence.
 * Compact tool schemas (REA-inspired) keep agent context small.
 */
import { createInterface } from 'readline';
import { Analyzer } from '../analyze/analyzer';
import { ingestAll } from '../ingest';
import { BUILTIN_SIGNALS } from '../signals/catalog';
import { runDoctor } from '../cli/doctor';
import { estimated } from '../domain/evidence';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface RpcReq {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

const TOOLS = [
  {
    name: 'cadence_doctor',
    description: 'Probe local AI harness log roots. Observed facts only — no session parsing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'cadence_overview',
    description: 'Derived usage overview: sessions, requests, practice scores, harness mix.',
    inputSchema: {
      type: 'object',
      properties: {
        demo: { type: 'boolean', description: 'Use fixture sessions' },
        harness: { type: 'string' },
        workspaceId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'cadence_habits',
    description: 'Derived habit findings from SignalSpec evaluation.',
    inputSchema: {
      type: 'object',
      properties: {
        demo: { type: 'boolean' },
        triggeredOnly: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'cadence_budget',
    description: 'Inferred credit/token budget estimates. Not billing.',
    inputSchema: {
      type: 'object',
      properties: { demo: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'cadence_export',
    description: 'Markdown snapshot of current Cadence summary.',
    inputSchema: {
      type: 'object',
      properties: { demo: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
] as const;

function analyzer(demo: boolean): Analyzer {
  const result = ingestAll({ demoMode: demo });
  return new Analyzer(result.sessions, result.workspaces, BUILTIN_SIGNALS);
}

function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function callTool(name: string, args: Record<string, unknown>): unknown {
  const demo = Boolean(args.demo);
  switch (name) {
    case 'cadence_doctor':
      return toolResult(runDoctor());
    case 'cadence_overview': {
      const a = analyzer(demo);
      return toolResult({
        ...a.getOverview({
          harness: typeof args.harness === 'string' ? args.harness : undefined,
          workspaceId: typeof args.workspaceId === 'string' ? args.workspaceId : undefined,
        }),
        evidence: { state: 'derived', confidence: 'high', authority: demo ? 'fixture' : 'session-log' },
      });
    }
    case 'cadence_habits': {
      const findings = analyzer(demo).getHabits();
      const filtered = args.triggeredOnly ? findings.filter((f) => f.triggered) : findings;
      return toolResult({
        findings: filtered,
        evidence: { state: 'derived', confidence: 'high', authority: 'signal-engine' },
      });
    }
    case 'cadence_budget':
      return toolResult({ ...analyzer(demo).getBudget(), evidence: estimated() });
    case 'cadence_export':
      return toolResult(analyzer(demo).exportSummary());
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function startMcpStdio(_opts?: { demoDefault?: boolean }): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  const send = (msg: Record<string, Json>) => {
    process.stdout.write(JSON.stringify(msg) + '\n');
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let req: RpcReq;
    try {
      req = JSON.parse(trimmed) as RpcReq;
    } catch {
      continue;
    }

    const id = req.id ?? null;

    try {
      if (req.method === 'initialize') {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'cadence', version: '0.1.0' },
          },
        });
        continue;
      }
      if (req.method === 'notifications/initialized' || req.method === 'initialized') {
        continue;
      }
      if (req.method === 'tools/list') {
        send({ jsonrpc: '2.0', id, result: { tools: TOOLS as unknown as Json } });
        continue;
      }
      if (req.method === 'tools/call') {
        const params = (req.params || {}) as { name?: string; arguments?: Record<string, unknown> };
        const result = callTool(String(params.name), params.arguments || {});
        send({ jsonrpc: '2.0', id, result: result as Json });
        continue;
      }
      if (req.method === 'ping') {
        send({ jsonrpc: '2.0', id, result: {} });
        continue;
      }
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}
