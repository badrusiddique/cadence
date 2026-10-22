/**
 * Flow-state analysis — clean-room rewrite of the AEC flow scoring idea:
 * rapid follow-ups, median latency, sustained blocks, hourly peaks.
 */
import {
  FLOW_BLOCK_GAP_MIN,
  FLOW_DEEP_SCORE,
  FLOW_MODERATE_SCORE,
  FLOW_RAPID_FOLLOWUP_SEC,
  FLOW_SESSION_MIN_REQS,
  FLOW_SHALLOW_SCORE,
} from '../domain/constants';
import type { DateFilter, Session } from '../domain/types';
import { dayKey, filterSessions } from './filter';

export type FlowLabel = 'deep' | 'moderate' | 'shallow' | 'fragmented';

export interface FlowSessionRow {
  sessionId: string;
  workspaceName: string;
  harness: string;
  date: string;
  startTs: number;
  endTs: number;
  durationMin: number;
  requestCount: number;
  medianFollowUpSec: number;
  rapidFollowUpRate: number;
  flowScore: number;
  flowLabel: FlowLabel;
}

export interface FlowDayRow {
  date: string;
  longestBlockMin: number;
  totalHours: number;
  blockCount: number;
  avgFlowScore: number;
  flowLabel: FlowLabel;
  sessions: FlowSessionRow[];
}

export interface FlowStateData {
  days: FlowDayRow[];
  overallFlowScore: number;
  avgFollowUpSec: number;
  avgBlockMin: number;
  deepFlowDays: number;
  totalDays: number;
  weeklyTrend: { labels: string[]; scores: number[] };
  hourlyFlow: number[];
  suggestions: string[];
  bestHour: number | null;
}

function flowLabel(score: number): FlowLabel {
  if (score >= FLOW_DEEP_SCORE) return 'deep';
  if (score >= FLOW_MODERATE_SCORE) return 'moderate';
  if (score >= FLOW_SHALLOW_SCORE) return 'shallow';
  return 'fragmented';
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function computeSessionFlowScore(followUpGaps: number[], durationMin: number, requestCount: number): number {
  if (followUpGaps.length === 0) return 0;
  const rapidRate = followUpGaps.filter((g) => g <= FLOW_RAPID_FOLLOWUP_SEC).length / followUpGaps.length;
  const rapidScore = Math.min(100, rapidRate * 100);
  const med = median(followUpGaps);
  const latencyScore =
    med <= 10 ? 100 : med <= 30 ? 80 : med <= 60 ? 60 : med <= 120 ? 40 : med <= 300 ? 20 : 0;
  let durationScore: number;
  if (durationMin <= 5) durationScore = 20;
  else if (durationMin <= 15) durationScore = 50;
  else if (durationMin <= 40) durationScore = 90;
  else if (durationMin <= 90) durationScore = 80;
  else durationScore = 60;
  const rpm = durationMin > 0 ? requestCount / durationMin : 0;
  const densityScore = Math.min(100, rpm * 50);
  return Math.round(rapidScore * 0.4 + latencyScore * 0.3 + durationScore * 0.15 + densityScore * 0.15);
}

function followUpGaps(timed: Array<{ timestamp: number; totalElapsed: number | null }>): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i]!;
    const next = timed[i + 1]!;
    const responseEnd = cur.timestamp + (cur.totalElapsed || 0);
    const gapSec = (next.timestamp - responseEnd) / 1000;
    if (gapSec >= 0) gaps.push(gapSec);
  }
  return gaps;
}

function buildFlowSession(session: Session): FlowSessionRow | null {
  const timed = session.requests
    .filter((r): r is typeof r & { timestamp: number } => r.timestamp != null)
    .map((r) => ({ timestamp: r.timestamp, totalElapsed: r.totalElapsed }))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (timed.length < FLOW_SESSION_MIN_REQS) return null;

  const startTs = timed[0]!.timestamp;
  const endTs = timed[timed.length - 1]!.timestamp;
  const durationMin = (endTs - startTs) / 60_000;
  const gaps = followUpGaps(timed);
  const medianFollowUpSec = median(gaps);
  const rapidFollowUpRate =
    gaps.length > 0 ? gaps.filter((g) => g <= FLOW_RAPID_FOLLOWUP_SEC).length / gaps.length : 0;
  const flowScore = computeSessionFlowScore(gaps, durationMin, timed.length);

  return {
    sessionId: session.sessionId,
    workspaceName: session.workspaceName,
    harness: session.harness,
    date: dayKey(startTs),
    startTs,
    endTs,
    durationMin: Math.round(durationMin * 10) / 10,
    requestCount: timed.length,
    medianFollowUpSec: Math.round(medianFollowUpSec),
    rapidFollowUpRate: Math.round(rapidFollowUpRate * 100) / 100,
    flowScore,
    flowLabel: flowLabel(flowScore),
  };
}

function buildBlocks(daySessions: FlowSessionRow[]): Array<{ start: number; end: number }> {
  const sorted = [...daySessions].sort((a, b) => a.startTs - b.startTs);
  if (!sorted.length) return [];
  const blocks: Array<{ start: number; end: number }> = [];
  let current = { start: sorted[0]!.startTs, end: sorted[0]!.endTs };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    const gap = (s.startTs - current.end) / 60_000;
    if (gap > FLOW_BLOCK_GAP_MIN) {
      blocks.push(current);
      current = { start: s.startTs, end: s.endTs };
    } else {
      current.end = Math.max(current.end, s.endTs);
    }
  }
  blocks.push(current);
  return blocks;
}

function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function suggestionsFor(
  days: FlowDayRow[],
  sessions: FlowSessionRow[],
  hourlyFlow: number[],
  overallScore: number,
): string[] {
  const out: string[] = [];
  const peakHour = hourlyFlow.indexOf(Math.max(...hourlyFlow, 0));
  const peakScore = hourlyFlow[peakHour] ?? 0;
  if (peakScore > 0) {
    out.push(`Deepest flow clusters around ${peakHour}:00 (score ${peakScore}). Protect that hour.`);
  }
  const shortBlockDays = days.filter((d) => d.longestBlockMin < 30 && d.blockCount > 2);
  if (days.length && shortBlockDays.length > days.length * 0.3) {
    out.push(`${shortBlockDays.length} days had no block longer than 30 minutes. Batch meetings.`);
  }
  const fragmented = sessions.filter((s) => s.flowLabel === 'fragmented');
  if (sessions.length && fragmented.length > sessions.length * 0.3) {
    out.push(`${fragmented.length} sessions were fragmented — long pauses between prompts.`);
  }
  const slow = sessions.filter((s) => s.medianFollowUpSec > 120);
  if (sessions.length && slow.length > sessions.length * 0.2) {
    out.push(`${slow.length} sessions had >2 min median follow-up. Pre-plan the next prompt.`);
  }
  if (overallScore < FLOW_MODERATE_SCORE) {
    out.push('Overall flow is low. Protect one 2-hour uninterrupted block per day.');
  } else if (overallScore >= FLOW_DEEP_SCORE) {
    out.push('Strong flow patterns — keep protecting deep blocks.');
  }
  return out.slice(0, 5);
}

export function computeFlowState(sessions: Session[], filter: DateFilter = {}): FlowStateData {
  const flowSessions = filterSessions(sessions, filter)
    .map(buildFlowSession)
    .filter((s): s is FlowSessionRow => s !== null);

  const dayMap = new Map<string, FlowSessionRow[]>();
  for (const fs of flowSessions) {
    const arr = dayMap.get(fs.date) ?? [];
    arr.push(fs);
    dayMap.set(fs.date, arr);
  }

  const days: FlowDayRow[] = [...dayMap.entries()]
    .map(([date, daySessions]) => {
      const blocks = buildBlocks(daySessions);
      const longestBlockMin = blocks.length
        ? Math.round(Math.max(...blocks.map((b) => (b.end - b.start) / 60_000)))
        : 0;
      const totalHours =
        Math.round((blocks.reduce((sum, b) => sum + (b.end - b.start), 0) / 3_600_000) * 10) / 10;
      const avgFlowScore = Math.round(
        daySessions.reduce((sum, s) => sum + s.flowScore, 0) / Math.max(daySessions.length, 1),
      );
      return {
        date,
        longestBlockMin,
        totalHours,
        blockCount: blocks.length,
        avgFlowScore,
        flowLabel: flowLabel(avgFlowScore),
        sessions: daySessions,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const allFollowUps = flowSessions.map((s) => s.medianFollowUpSec);
  const avgFollowUpSec = allFollowUps.length
    ? Math.round(allFollowUps.reduce((s, v) => s + v, 0) / allFollowUps.length)
    : 0;
  const allBlocks = days.map((d) => d.longestBlockMin);
  const avgBlockMin = allBlocks.length
    ? Math.round(allBlocks.reduce((s, v) => s + v, 0) / allBlocks.length)
    : 0;
  const overallFlowScore = days.length
    ? Math.round(days.reduce((s, d) => s + d.avgFlowScore, 0) / days.length)
    : 0;

  const weekMap = new Map<string, { total: number; count: number }>();
  for (const day of days) {
    const wk = isoWeek(day.date);
    const entry = weekMap.get(wk) ?? { total: 0, count: 0 };
    entry.total += day.avgFlowScore;
    entry.count += 1;
    weekMap.set(wk, entry);
  }
  const labels = [...weekMap.keys()].sort();
  const weeklyTrend = {
    labels,
    scores: labels.map((l) => Math.round(weekMap.get(l)!.total / weekMap.get(l)!.count)),
  };

  const hourTotals = Array.from({ length: 24 }, () => 0);
  const hourCounts = Array.from({ length: 24 }, () => 0);
  for (const fs of flowSessions) {
    const hour = new Date(fs.startTs).getHours();
    hourTotals[hour]! += fs.flowScore;
    hourCounts[hour]! += 1;
  }
  const hourlyFlow = hourTotals.map((total, i) =>
    hourCounts[i]! > 0 ? Math.round(total / hourCounts[i]!) : 0,
  );
  const bestHour = hourlyFlow.some((v) => v > 0)
    ? hourlyFlow.indexOf(Math.max(...hourlyFlow))
    : null;

  return {
    days,
    overallFlowScore,
    avgFollowUpSec,
    avgBlockMin,
    deepFlowDays: days.filter((d) => d.flowLabel === 'deep').length,
    totalDays: days.length,
    weeklyTrend,
    hourlyFlow,
    suggestions: suggestionsFor(days, flowSessions, hourlyFlow, overallFlowScore),
    bestHour,
  };
}
