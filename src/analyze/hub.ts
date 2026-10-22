import type { DateFilter, Session } from '../domain/types';
import { allRequests, filterSessions } from './filter';

/**
 * Best-effort “Hub” analytics from local session text — gap fill for GitHub Copilot App
 * productivity / issue-credit style views without requiring a private app DB.
 */
export function getHubDelivery(sessions: Session[], filter: DateFilter = {}) {
  const scoped = filterSessions(sessions, filter);
  const issueRe = /(?:github\.com\/[^/\s]+\/[^/\s]+\/issues\/|#)(\d+)/gi;
  const prRe = /(?:github\.com\/[^/\s]+\/[^/\s]+\/pull\/|PR\s*#?)(\d+)/gi;

  let withIssue = 0;
  let withPr = 0;
  const issueCredits = new Map<string, { issue: string; sessions: number; requests: number; credits: number }>();

  for (const s of scoped) {
    const blob = s.requests
      .slice(0, 2)
      .map((r) => r.messageText)
      .join('\n');
    const issues = [...blob.matchAll(issueRe)].map((m) => m[0]);
    const prs = [...blob.matchAll(prRe)].map((m) => m[0]);
    if (issues.length) withIssue += 1;
    if (prs.length) withPr += 1;
    for (const issue of issues.slice(0, 1)) {
      const key = issue;
      if (!issueCredits.has(key)) issueCredits.set(key, { issue: key, sessions: 0, requests: 0, credits: 0 });
      const row = issueCredits.get(key)!;
      row.sessions += 1;
      row.requests += s.requests.length;
      row.credits += s.requests.length; // relative units, not billing
    }
  }

  const credits = [...issueCredits.values()];
  const totalCredits = credits.reduce((n, c) => n + c.credits, 0) || 1;
  const issueRows = credits
    .map((c) => ({
      ...c,
      pct: Number(((c.credits / totalCredits) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 20);

  const harnessApp = scoped.filter((s) => /GitHub Copilot App/i.test(s.harness)).length;

  return {
    sessions: scoped.length,
    withIssue,
    withPr,
    issueLinkRate: scoped.length ? withIssue / scoped.length : 0,
    prLinkRate: scoped.length ? withPr / scoped.length : 0,
    copilotAppSessions: harnessApp,
    issueRows,
    disclaimer:
      'Issue percentages are rough relative estimates from local text links in early turns — not GitHub billing AI Credits.',
    evidence: { state: 'derived' as const, confidence: 'medium' as const, authority: 'session-log' as const },
  };
}

export function getSkillDrafts(sessions: Session[], filter: DateFilter = {}) {
  const map = new Map<string, { count: number; sample: string }>();
  for (const r of allRequests(filterSessions(sessions, filter))) {
    const key = r.messageText.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);
    if (key.length < 16) continue;
    if (!map.has(key)) map.set(key, { count: 0, sample: r.messageText.trim().slice(0, 160) });
    map.get(key)!.count += 1;
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([key, v], i) => {
      const id = `recurring-${i + 1}`;
      const markdown = `---
name: ${id}
description: Recurring prompt detected by Cadence (${v.count}×). Refine before installing.
---

# ${id}

## When to use
When you need: ${v.sample}

## Steps
1. Restate the goal and constraints.
2. Attach only the relevant files.
3. Ask for tests or a verification checklist.
`;
      return {
        id,
        prompt: key,
        count: v.count,
        sample: v.sample,
        suggestion: `Promote to a skill (${v.count} repeats)`,
        draftMarkdown: markdown,
      };
    });
}
