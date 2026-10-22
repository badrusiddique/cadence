import { describe, expect, it } from 'vitest';
import { evaluateSignals, parseSignalMarkdown } from './engine';
import { BUILTIN_SIGNALS } from './catalog';
import { buildFixtureSessions } from '../ingest/fixtures';

describe('SignalSpec engine', () => {
  it('evaluates built-in catalog against fixtures', () => {
    const findings = evaluateSignals(BUILTIN_SIGNALS, buildFixtureSessions());
    expect(findings.length).toBeGreaterThan(20);
    expect(findings.every((f) => typeof f.triggered === 'boolean')).toBe(true);
  });

  it('parses markdown signal front matter', () => {
    const md = `---
id: demo-thin
name: Demo Thin
group: prompt-quality
severity: medium
scope: requests
version: 1
tags: [demo]
thresholds:
  minChars: 20
  maxRatio: 0.5
  minSample: 1
---

# Description
Demo

# When Triggered
{{count}} thin prompts

# How to Improve
Write more
`;
    const signal = parseSignalMarkdown(md);
    expect(signal?.id).toBe('demo-thin');
    expect(signal?.thresholds.minChars).toBe(20);
  });
});
