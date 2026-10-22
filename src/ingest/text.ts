/** Shared text helpers for ingest parsers. */

import * as fs from 'fs';

export function asText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const p = part as Record<string, unknown>;
        if (typeof p.text === 'string') return p.text;
        if (typeof p.input_text === 'string') return p.input_text;
        if (p.type === 'text' && typeof p.text === 'string') return p.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cs: 'csharp',
    md: 'markdown',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    css: 'css',
    html: 'html',
    sh: 'shell',
  };
  return map[ext] || ext || 'unknown';
}

export function classifyWorkType(message: string): string {
  const m = message.toLowerCase();
  if (/\b(fix|bug|crash|error|fail)\b/.test(m)) return 'bugfix';
  if (/\b(refactor|cleanup|rename|extract)\b/.test(m)) return 'refactor';
  if (/\b(test|spec|coverage)\b/.test(m)) return 'test';
  if (/\b(doc|readme|comment)\b/.test(m)) return 'docs';
  if (/\b(add|implement|create|feature|build)\b/.test(m)) return 'feature';
  return 'unknown';
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  return letters.length >= 8 && letters === letters.toUpperCase();
}

const PROFANITY = /\b(fuck|shit|damn|asshole|bastard)\b/i;

export function hasProfanity(text: string): boolean {
  return PROFANITY.test(text);
}

export function readJsonl(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      /* skip malformed */
    }
  }
  return out;
}
