import type { DateFilter, Session, SessionRequest } from '../domain/types';

export function filterSessions(sessions: Session[], filter: DateFilter = {}): Session[] {
  const from = filter.fromDate ? Date.parse(filter.fromDate) : null;
  const to = filter.toDate ? Date.parse(filter.toDate) + 86_400_000 - 1 : null;

  return sessions
    .filter((s) => {
      if (filter.workspaceId && s.workspaceId !== filter.workspaceId) return false;
      if (filter.harness && s.harness !== filter.harness) return false;
      return true;
    })
    .map((s) => {
      if (from == null && to == null) return s;
      const requests = s.requests.filter((r) => {
        if (r.timestamp == null) return true;
        if (from != null && r.timestamp < from) return false;
        if (to != null && r.timestamp > to) return false;
        return true;
      });
      return { ...s, requests, requestCount: requests.length };
    })
    .filter((s) => s.requests.length > 0);
}

export function allRequests(sessions: Session[]): Array<SessionRequest & { session: Session }> {
  const out: Array<SessionRequest & { session: Session }> = [];
  for (const session of sessions) {
    for (const request of session.requests) out.push(Object.assign({}, request, { session }));
  }
  return out;
}

export function dayKey(ts: number | null): string {
  if (ts == null) return 'unknown';
  return new Date(ts).toISOString().slice(0, 10);
}
