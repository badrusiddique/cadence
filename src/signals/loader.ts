import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BUILTIN_SIGNALS } from './catalog';
import { parseSignalMarkdown, type SignalDefinition } from './engine';
import { hashContent, isApproved, queuePending, type TrustStore } from './trust';

function listSignalFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.signal.md') || n.endsWith('.md'))
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

function loadLayer(
  dir: string,
  layer: 'personal' | 'project',
  store: TrustStore | null,
  trustedWorkspace: boolean,
): SignalDefinition[] {
  if (!fs.existsSync(dir)) return [];
  const out: SignalDefinition[] = [];
  for (const file of listSignalFiles(dir)) {
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Project layer requires workspace trust + approval; personal requires approval.
    if (layer === 'project' && !trustedWorkspace) {
      queuePending({ filePath: file, layer, content, hash: hashContent(content) });
      continue;
    }
    if (store && !isApproved(store, file, content)) {
      queuePending({ filePath: file, layer, content, hash: hashContent(content) });
      continue;
    }
    const parsed = parseSignalMarkdown(content);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function personalSignalsDir(): string {
  return path.join(os.homedir(), '.cadence', 'signals');
}

export function projectSignalsDir(workspaceRoot?: string): string | null {
  return workspaceRoot ? path.join(workspaceRoot, '.cadence', 'signals') : null;
}

export function loadAllSignals(options: {
  store?: TrustStore | null;
  workspaceRoot?: string;
  trustedWorkspace?: boolean;
}): SignalDefinition[] {
  const store = options.store ?? null;
  const personal = loadLayer(personalSignalsDir(), 'personal', store, true);
  const projectDir = projectSignalsDir(options.workspaceRoot);
  const project = projectDir
    ? loadLayer(projectDir, 'project', store, options.trustedWorkspace !== false)
    : [];

  // Built-ins win on id collisions with local for safety; locals with unique ids append.
  const byId = new Map<string, SignalDefinition>();
  for (const s of BUILTIN_SIGNALS) byId.set(s.id, s);
  for (const s of [...personal, ...project]) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  return [...byId.values()];
}

export function listSignalCatalog(options: {
  store?: TrustStore | null;
  workspaceRoot?: string;
}): Array<{ id: string; name: string; group: string; layer: 'builtin' | 'personal' | 'project'; filePath?: string }> {
  const rows: Array<{ id: string; name: string; group: string; layer: 'builtin' | 'personal' | 'project'; filePath?: string }> = [];
  for (const s of BUILTIN_SIGNALS) {
    rows.push({ id: s.id, name: s.name, group: s.group, layer: 'builtin' });
  }
  for (const file of listSignalFiles(personalSignalsDir())) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const parsed = parseSignalMarkdown(content);
      if (parsed) rows.push({ id: parsed.id, name: parsed.name, group: parsed.group, layer: 'personal', filePath: file });
    } catch {
      /* skip */
    }
  }
  const projectDir = projectSignalsDir(options.workspaceRoot);
  if (projectDir) {
    for (const file of listSignalFiles(projectDir)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = parseSignalMarkdown(content);
        if (parsed) rows.push({ id: parsed.id, name: parsed.name, group: parsed.group, layer: 'project', filePath: file });
      } catch {
        /* skip */
      }
    }
  }
  return rows;
}

export function writePersonalSignal(id: string, markdown: string): string {
  const dir = personalSignalsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.signal.md`);
  fs.writeFileSync(file, markdown, 'utf8');
  return file;
}

export function builtinSignalTemplate(partial?: { id?: string; name?: string }): string {
  const id = partial?.id || 'my-signal';
  const name = partial?.name || 'My Signal';
  return `---
id: ${id}
name: ${name}
group: prompt-quality
severity: medium
scope: requests
version: 1
tags: [custom]
thresholds:
  minChars: 30
  maxRatio: 0.3
  minSample: 5
---

# Description
Describe what this signal detects.

# When Triggered
{{count}} requests ({{pct}}%) match this signal.

# How to Improve
Give a concrete practice change.
`;
}
