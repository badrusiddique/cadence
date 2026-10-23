import { html, render } from './dom';
import { onHostRefresh, rpc } from './rpc';
import {
  destroyAllCharts,
  renderBarChart,
  renderDoughnut,
  renderLineChart,
} from './charts';

/** Nav mirrors AEC Observe / Measure / Improve / Level-up structure with Cadence naming. */
type PageId =
  | 'overview'
  | 'sessions'
  | 'moments'
  | 'throughput'
  | 'budget'
  | 'rhythm'
  | 'inquiry'
  | 'flow'
  | 'hub'
  | 'habits'
  | 'studio'
  | 'lab'
  | 'fields'
  | 'skills'
  | 'context'
  | 'practice'
  | 'marks'
  | 'lifecycle'
  | 'snapshot';

interface NavItem { id: PageId; label: string; icon: string; badge?: keyof Badges }
interface NavGroup { title: string; items: NavItem[] }
interface Badges {
  sessions?: number;
  aiLoc?: number;
  habits?: number;
  skills?: number;
  budgetPct?: number;
}

type ChartJob =
  | { kind: 'bar'; id: string; labels: string[]; datasets: Array<{ label: string; data: number[]; color?: string }>; stacked?: boolean }
  | { kind: 'line'; id: string; labels: string[]; datasets: Array<{ label: string; data: number[]; color?: string }> }
  | { kind: 'doughnut'; id: string; labels: string[]; values: number[] };

const NAV: NavGroup[] = [
  {
    title: 'Observe',
    items: [
      { id: 'overview', label: 'Dashboard', icon: '▣' },
      { id: 'sessions', label: 'Timeline', icon: '—', badge: 'sessions' },
      { id: 'moments', label: 'Moments', icon: '◎' },
    ],
  },
  {
    title: 'Measure',
    items: [
      { id: 'throughput', label: 'Output', icon: '↗', badge: 'aiLoc' },
      { id: 'budget', label: 'Burndown', icon: '◌', badge: 'budgetPct' },
      { id: 'rhythm', label: 'Patterns', icon: '▦' },
      { id: 'inquiry', label: 'Curiosity', icon: '?' },
      { id: 'flow', label: 'Flow', icon: '∿' },
      { id: 'hub', label: 'Hub', icon: '⌘' },
    ],
  },
  {
    title: 'Improve',
    items: [
      { id: 'habits', label: 'Anti-Patterns', icon: '!', badge: 'habits' },
      { id: 'studio', label: 'Rule Studio', icon: '✎' },
      { id: 'lab', label: 'Signal Lab', icon: 'λ' },
      { id: 'fields', label: 'Data Explorer', icon: '▤' },
      { id: 'skills', label: 'Skill Finder', icon: '◈', badge: 'skills' },
      { id: 'context', label: 'Context Health', icon: '▣' },
    ],
  },
  {
    title: 'Level Up',
    items: [
      { id: 'practice', label: 'Practice', icon: '✦' },
      { id: 'marks', label: 'Achievements', icon: '★' },
      { id: 'lifecycle', label: 'Lifecycle', icon: '↻' },
      { id: 'snapshot', label: 'Share', icon: '⇪' },
    ],
  },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const OUTPUT_MODES = [
  { id: 'code-output', label: 'Code output' },
  { id: 'by-workspace', label: 'By workspace' },
  { id: 'by-harness', label: 'By harness' },
  { id: 'by-model', label: 'By model' },
  { id: 'by-language', label: 'By language' },
  { id: 'net-output', label: 'Net output' },
  { id: 'daily-model', label: 'Daily × model' },
  { id: 'daily-harness', label: 'Daily × harness' },
] as const;

const DATE_RANGES = [
  { id: '7d', label: '7d', days: 7 },
  { id: '28d', label: '28d', days: 28 },
  { id: '90d', label: '90d', days: 90 },
  { id: '180d', label: '180d', days: 180 },
  { id: 'all', label: 'All', days: 0 },
] as const;

const state = {
  page: 'overview' as PageId,
  filter: { workspaceId: '', harness: '' },
  wsScope: 'all' as 'current' | 'all',
  wsSearch: '',
  dateRange: '28d' as (typeof DATE_RANGES)[number]['id'],
  timelineView: 'day' as 'day' | 'list',
  outputMode: 'code-output' as string,
  patternsTab: 'work-hours' as 'work-hours' | 'calendar' | 'projects',
  habitsTab: 'findings' as 'findings' | 'rules',
  skillsTab: 'custom' as 'custom' | 'community',
  meta: null as any,
  badges: {} as Badges,
  topPattern: null as string | null,
  loading: true,
  error: '' as string,
  notice: '' as string,
  selectedSessionId: '' as string,
  theme: 'system' as 'system' | 'light' | 'dark',
  cache: new Map<string, unknown>(),
};

let chartJobs: ChartJob[] = [];

function queueCharts(jobs: ChartJob[]) {
  chartJobs = jobs;
}

function flushCharts() {
  const jobs = chartJobs;
  chartJobs = [];
  requestAnimationFrame(() => {
    destroyAllCharts();
    for (const job of jobs) {
      if (job.kind === 'bar') renderBarChart(job.id, job.labels, job.datasets, { stacked: job.stacked });
      else if (job.kind === 'line') renderLineChart(job.id, job.labels, job.datasets);
      else renderDoughnut(job.id, job.labels, job.values);
    }
  });
}

function readStoredTheme(): 'system' | 'light' | 'dark' {
  try {
    const v = localStorage.getItem('cadence-theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* webview storage may be unavailable */
  }
  return 'system';
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
}

function cycleTheme() {
  state.theme = state.theme === 'system' ? 'dark' : state.theme === 'dark' ? 'light' : 'system';
  try {
    localStorage.setItem('cadence-theme', state.theme);
  } catch {
    /* ignore */
  }
  applyTheme();
  paint();
}

function rangeBounds(): { fromDate?: string; toDate?: string } {
  if (state.dateRange === 'all') return {};
  const spec = DATE_RANGES.find((r) => r.id === state.dateRange);
  const days = spec?.days || 28;
  const anchor = state.meta?.latestActivityAt || Date.now();
  const to = new Date(anchor);
  const from = new Date(anchor);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function filterParams() {
  let workspaceId = state.filter.workspaceId || undefined;
  if (state.wsScope === 'current' && !workspaceId) {
    workspaceId = state.meta?.currentWorkspaceId || undefined;
  }
  return {
    workspaceId,
    harness: state.filter.harness || undefined,
    ...rangeBounds(),
  };
}

function filteredWorkspaces() {
  const list = state.meta?.workspaces || [];
  const q = state.wsSearch.trim().toLowerCase();
  if (!q) return list;
  return list.filter((w: any) => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
}

async function loadMeta() {
  state.meta = await rpc('getMeta');
}

async function query<T>(method: string, extra: Record<string, unknown> = {}): Promise<T> {
  const key = `${method}:${JSON.stringify({ ...filterParams(), ...extra })}`;
  if (state.cache.has(key)) return state.cache.get(key) as T;
  const result = await rpc<T>(method, { ...filterParams(), ...extra });
  state.cache.set(key, result);
  return result;
}

function setPage(page: PageId) {
  state.page = page;
  state.selectedSessionId = '';
  void refresh();
}

async function refresh() {
  state.loading = true;
  state.error = '';
  paint();
  try {
    await loadMeta();
    state.cache.clear();
    await renderPage();
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    paint();
  } finally {
    state.loading = false;
  }
}

function fmtLoc(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

function practiceStatus(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'var(--ok)' };
  if (score >= 60) return { label: 'Good', color: 'var(--chart-1)' };
  if (score >= 40) return { label: 'Needs work', color: 'var(--warn)' };
  return { label: 'At risk', color: 'var(--danger)' };
}

function wowSpan(wowPct: number | null | undefined) {
  if (wowPct == null) return html`<span class="wow flat">WoW —</span>`;
  if (wowPct > 0) return html`<span class="wow up">WoW +${wowPct}%</span>`;
  if (wowPct < 0) return html`<span class="wow down">WoW ${wowPct}%</span>`;
  return html`<span class="wow flat">WoW 0%</span>`;
}

function seg(options: Array<{ id: string; label: string }>, active: string, onPick: (id: string) => void) {
  return html`
    <div class="seg">
      ${options.map(
        (o) => html`<button class=${o.id === active ? 'active' : ''} onClick=${() => onPick(o.id)}>${o.label}</button>`,
      )}
    </div>
  `;
}

function shell(content: ReturnType<typeof html>) {
  const themeIcon = state.theme === 'light' ? '☀' : state.theme === 'dark' ? '☾' : '◐';
  const workspaces = filteredWorkspaces();
  return html`
    <aside id="rail">
      <div class="brand">
        <div>
          <div class="brand-mark">Cadence<span>.</span></div>
          <div class="brand-tag">${state.topPattern ? `Top: ${state.topPattern}` : 'Steady your AI practice'}</div>
        </div>
        <button class="theme-toggle" title="Theme: ${state.theme}" onClick=${cycleTheme}>${themeIcon}</button>
      </div>
      ${NAV.map(
        (group) => html`
          <div class="nav-group">${group.title}</div>
          ${group.items.map((item) => {
            const badgeVal = item.badge ? state.badges[item.badge] : undefined;
            const badgeText =
              item.badge === 'aiLoc' && typeof badgeVal === 'number'
                ? fmtLoc(badgeVal)
                : item.badge === 'budgetPct' && typeof badgeVal === 'number'
                  ? `${badgeVal}%`
                  : badgeVal != null
                    ? String(badgeVal)
                    : '';
            return html`
              <button class=${`nav-link${state.page === item.id ? ' active' : ''}`} onClick=${() => setPage(item.id)}>
                <span class="nav-ico">${item.icon}</span>${item.label}
                ${badgeText ? html`<span class="nav-badge">${badgeText}</span>` : null}
              </button>
            `;
          })}
        `,
      )}
      <div class="filters">
        <div class="ws-toggle">
          <button
            class=${state.wsScope === 'current' ? 'active' : ''}
            onClick=${() => {
              state.wsScope = 'current';
              state.filter.workspaceId = '';
              state.cache.clear();
              void refresh();
            }}
          >Current</button>
          <button
            class=${state.wsScope === 'all' ? 'active' : ''}
            onClick=${() => {
              state.wsScope = 'all';
              state.cache.clear();
              void refresh();
            }}
          >All</button>
        </div>
        <div class="range-chips" title="Anchored to latest local activity">
          ${DATE_RANGES.map(
            (r) => html`<button
              class=${state.dateRange === r.id ? 'active' : ''}
              onClick=${() => {
                state.dateRange = r.id;
                state.cache.clear();
                void refresh();
              }}
            >${r.label}</button>`,
          )}
        </div>
        <input
          class="search-input"
          placeholder="Search workspaces…"
          value=${state.wsSearch}
          onInput=${(e: Event) => {
            state.wsSearch = (e.target as HTMLInputElement).value;
            paint();
          }}
        />
        <label>
          Workspace
          <select
            value=${state.filter.workspaceId}
            onChange=${(e: Event) => {
              state.filter.workspaceId = (e.target as HTMLSelectElement).value;
              if (state.filter.workspaceId) state.wsScope = 'all';
              state.cache.clear();
              void refresh();
            }}
          >
            <option value="">
              ${state.wsScope === 'current'
                ? `Current (${state.meta?.workspaces?.find((w: any) => w.id === state.meta?.currentWorkspaceId)?.name || 'workspace'})`
                : 'All workspaces'}
            </option>
            ${workspaces.map((w: any) => html`<option value=${w.id}>${w.name}</option>`)}
          </select>
        </label>
        <label>
          Harness
          <select
            value=${state.filter.harness}
            onChange=${(e: Event) => {
              state.filter.harness = (e.target as HTMLSelectElement).value;
              state.cache.clear();
              void refresh();
            }}
          >
            <option value="">All harnesses</option>
            ${(state.meta?.harnesses || []).map((h: string) => html`<option value=${h}>${h}</option>`)}
          </select>
        </label>
        <button class="btn secondary" onClick=${() => { state.cache.clear(); void refresh(); }}>Reload</button>
      </div>
    </aside>
    <main id="stage">${content}</main>
  `;
}

function header(title: string, subtitle: string, pill?: string) {
  return html`
    <div class="page-header">
      <div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      ${pill ? html`<div class="pill">${pill}</div>` : null}
    </div>
  `;
}

async function renderPage() {
  let body: ReturnType<typeof html> = html`<div class="loading"><h2>Listening for sessions…</h2></div>`;
  queueCharts([]);

  if (state.page === 'overview') body = await pageOverview();
  else if (state.page === 'sessions') body = await pageSessions();
  else if (state.page === 'moments') body = await pageMoments();
  else if (state.page === 'throughput') body = await pageThroughput();
  else if (state.page === 'budget') body = await pageBudget();
  else if (state.page === 'rhythm') body = await pageRhythm();
  else if (state.page === 'inquiry') body = await pageInquiry();
  else if (state.page === 'flow') body = await pageFlow();
  else if (state.page === 'hub') body = await pageHub();
  else if (state.page === 'habits') body = await pageHabits();
  else if (state.page === 'studio') body = await pageStudio();
  else if (state.page === 'lab') body = await pageLab();
  else if (state.page === 'fields') body = await pageFields();
  else if (state.page === 'skills') body = await pageSkills();
  else if (state.page === 'context') body = await pageContext();
  else if (state.page === 'practice') body = await pagePractice();
  else if (state.page === 'marks') body = await pageMarks();
  else if (state.page === 'lifecycle') body = await pageLifecycle();
  else if (state.page === 'snapshot') body = await pageSnapshot();

  state.loading = false;
  paint(body);
}

async function pageOverview() {
  const data = await query<any>('getOverview');
  state.badges = { ...(data.badges || {}) };
  state.topPattern = data.topPattern || null;
  state.notice = data.sessions === 0 ? 'No sessions in range — enable Demo Mode or sync local harness logs.' : '';

  const activity = data.activity || [];
  const harnessEntries = Object.entries(data.byHarness || {}) as [string, number][];
  queueCharts([
    {
      kind: 'bar',
      id: 'chart-overview-activity',
      labels: activity.slice(-28).map((a: any) => a.date.slice(5)),
      datasets: [
        { label: 'Requests', data: activity.slice(-28).map((a: any) => a.requests) },
        { label: 'AI LOC', data: activity.slice(-28).map((a: any) => a.aiLoc || 0), color: '#33cc94' },
      ],
    },
    {
      kind: 'doughnut',
      id: 'chart-overview-harness',
      labels: harnessEntries.map(([k]) => k),
      values: harnessEntries.map(([, v]) => v),
    },
  ]);

  return html`
    <div class="page">
      ${header('Dashboard', 'Practice scores with week-over-week deltas, activity, and harness mix.', `Score ${data.practiceScore}`)}
      ${state.notice ? html`<div class="banner">${state.notice}</div>` : null}
      ${data.vibe
        ? html`<div class="vibe-banner">
            <div>
              <strong>${data.vibe.title}</strong>
              <div class="muted">${data.vibe.reason}</div>
            </div>
            <div class="pill">Vibe ${data.vibe.score}</div>
          </div>`
        : null}
      <div class="grid-4">
        ${(data.practice || []).slice(0, 4).map((p: any) => {
          const st = practiceStatus(p.score);
          const tip = p.findings?.find((f: any) => f.triggered)?.improvement || 'Keep this streak.';
          return html`
            <div class="practice-card">
              <div class="ring-wrap">
                <div class="ring" style=${`--p:${p.score};--ring-color:${st.color}`} data-score=${p.score}></div>
                <div class="meta">
                  <strong>${p.label} ${wowSpan(p.wowPct)}</strong>
                  <div class="status">${st.label}</div>
                </div>
              </div>
              <div class="tip">${tip}</div>
            </div>
          `;
        })}
      </div>
      ${(data.recommendations || []).length
        ? html`<section class="panel">
            <h2>Recommendations</h2>
            <ul class="recs">
              ${data.recommendations.map((r: string) => html`<li>${r}</li>`)}
            </ul>
          </section>`
        : null}
      <div class="grid-2">
        <section class="panel">
          <h2>Daily activity</h2>
          <div class="metric-row" style="margin-bottom:8px">
            <div class="metric"><div class="label">Requests</div><div class="value mono">${data.requests}</div></div>
            <div class="metric"><div class="label">Sessions</div><div class="value mono">${data.sessions}</div></div>
            <div class="metric"><div class="label">AI LOC</div><div class="value mono">${fmtLoc(data.aiLoc)}</div></div>
            <div class="metric"><div class="label">Flow</div><div class="value mono">${data.flowScore}</div></div>
          </div>
          <div class="chart-box"><canvas id="chart-overview-activity"></canvas></div>
        </section>
        <section class="panel">
          <h2>Harness mix</h2>
          <div class="chart-box short"><canvas id="chart-overview-harness"></canvas></div>
          ${(data.skillPreview || []).length
            ? html`<div class="list" style="margin-top:10px">
                ${data.skillPreview.map((s: any) => html`<article><strong>${s.count}×</strong> ${s.sample}</article>`)}
              </div>`
            : null}
        </section>
      </div>
      <section class="panel">
        <h2>Top workspaces</h2>
        <table>
          <thead><tr><th>Workspace</th><th>Sessions</th><th>Requests</th></tr></thead>
          <tbody>
            ${(data.topWorkspaces || []).map(
              (w: any) => html`<tr><td>${w.name}</td><td class="mono">${w.sessions}</td><td class="mono">${w.requests}</td></tr>`,
            )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageSessions() {
  if (state.selectedSessionId) {
    const detail = await query<any>('getSessionDetail', { sessionId: state.selectedSessionId });
    if (!detail) {
      state.selectedSessionId = '';
    } else {
      return html`
        <div class="page">
          ${header(detail.title, `${detail.workspaceName} · ${detail.harness}`, `${detail.requestCount} turns`)}
          <button class="btn secondary" style="margin-bottom:12px" onClick=${() => { state.selectedSessionId = ''; void refresh(); }}>← Back to timeline</button>
          <section class="panel">
            <table>
              <thead><tr><th>When</th><th>Model</th><th>LOC</th><th>Tools</th><th>Prompt</th></tr></thead>
              <tbody>
                ${detail.requests.map(
                  (r: any) => html`<tr>
                    <td class="mono">${r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}</td>
                    <td>${r.modelId || '—'}</td>
                    <td class="mono">${r.aiLoc}</td>
                    <td class="mono">${(r.toolsUsed || []).length}</td>
                    <td>${r.messageText}${r.isCanceled ? html` <span class="sev sev-high">canceled</span>` : null}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </section>
        </div>
      `;
    }
  }

  const rows = await query<any[]>('getTimeline');
  const days = await query<any[]>('getTimelineByDay');
  state.badges = { ...state.badges, sessions: rows.length };
  return html`
    <div class="page">
      ${header('Timeline', 'Day overview or flat list — click a session for turn detail.', `${rows.length} sessions`)}
      ${seg(
        [
          { id: 'day', label: 'By day' },
          { id: 'list', label: 'List' },
        ],
        state.timelineView,
        (id) => {
          state.timelineView = id as 'day' | 'list';
          void refresh();
        },
      )}
      ${state.timelineView === 'day'
        ? html`<div class="day-timeline">
            ${days.length === 0
              ? html`<section class="panel"><div class="empty"><h2>No sessions</h2><p>Widen the date range or sync harness logs.</p></div></section>`
              : days.map(
                  (d) => html`<section class="panel day-block">
                    <div class="day-head">
                      <strong>${d.date === 'unknown' ? 'Untimed' : d.date}</strong>
                      <span class="muted">${d.sessionCount} sessions · ${d.requests} turns · ${fmtLoc(d.aiLoc)} LOC · ${d.harnesses.join(', ')}</span>
                    </div>
                    <table>
                      <thead><tr><th>When</th><th>Workspace</th><th>Harness</th><th>Turns</th><th>LOC</th><th>Title</th></tr></thead>
                      <tbody>
                        ${d.sessions.map(
                          (r: any) => html`<tr class="clickable" onClick=${() => { state.selectedSessionId = r.sessionId; void refresh(); }}>
                            <td class="mono">${r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : '—'}</td>
                            <td>${r.workspaceName}</td>
                            <td>${r.harness}</td>
                            <td class="mono">${r.requestCount}</td>
                            <td class="mono">${r.aiLoc ?? '—'}</td>
                            <td>${r.title}</td>
                          </tr>`,
                        )}
                      </tbody>
                    </table>
                  </section>`,
                )}
          </div>`
        : html`<section class="panel">
            <table>
              <thead><tr><th>When</th><th>Workspace</th><th>Harness</th><th>Turns</th><th>LOC</th><th>Title</th></tr></thead>
              <tbody>
                ${rows.length === 0
                  ? html`<tr><td colspan="6" class="muted">No sessions in this filter.</td></tr>`
                  : rows.map(
                      (r) => html`<tr class="clickable" onClick=${() => { state.selectedSessionId = r.sessionId; void refresh(); }}>
                        <td class="mono">${r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                        <td>${r.workspaceName}</td>
                        <td>${r.harness}</td>
                        <td class="mono">${r.requestCount}</td>
                        <td class="mono">${r.aiLoc ?? '—'}</td>
                        <td>${r.title}</td>
                      </tr>`,
                    )}
              </tbody>
            </table>
          </section>`}
    </div>
  `;
}

async function pageMoments() {
  const rows = await query<any[]>('getMoments');
  return html`
    <div class="page">
      ${header('Coding Moments', 'High-signal turns inferred from substantial AI edits.')}
      <div class="list panel">
        ${rows.length === 0
          ? html`<div class="empty"><h2>No moments yet</h2><p>Substantial AI edits will appear here.</p></div>`
          : rows.map(
              (m) => html`<article>
                <strong>${m.workspaceName}</strong> · ${m.harness} · <span class="mono">${m.loc} LOC</span>
                <div class="muted">${m.caption}</div>
              </article>`,
            )}
      </div>
    </div>
  `;
}

async function pageThroughput() {
  const data = await query<any>('getCodeProduction');
  const compare = await query<any[]>('getHarnessComparison');
  state.badges = { ...state.badges, aiLoc: data.summary.totalAiLoc };

  const jobs: ChartJob[] = [];
  const mode = state.outputMode;
  if (mode === 'code-output' || mode === 'net-output') {
    jobs.push({
      kind: 'bar',
      id: 'chart-output',
      labels: data.dailyTimeline.labels.map((d: string) => d.slice(5)),
      datasets: [
        { label: 'AI LOC', data: data.dailyTimeline.aiLoc },
        { label: 'User LOC', data: data.dailyTimeline.userLoc, color: '#519eec' },
      ],
      stacked: mode === 'net-output',
    });
  } else if (mode === 'by-language') {
    jobs.push({
      kind: 'doughnut',
      id: 'chart-output',
      labels: data.byLanguage.labels,
      values: data.byLanguage.aiLoc,
    });
  } else if (mode === 'by-workspace') {
    jobs.push({
      kind: 'bar',
      id: 'chart-output',
      labels: data.byWorkspace.labels,
      datasets: [{ label: 'AI LOC', data: data.byWorkspace.aiLoc }],
    });
  } else if (mode === 'by-harness') {
    jobs.push({
      kind: 'bar',
      id: 'chart-output',
      labels: data.byHarness.labels,
      datasets: [{ label: 'AI LOC', data: data.byHarness.aiLoc }],
    });
  } else if (mode === 'by-model') {
    jobs.push({
      kind: 'doughnut',
      id: 'chart-output',
      labels: data.byModel.labels,
      values: data.byModel.aiLoc,
    });
  } else if (mode === 'daily-model') {
    jobs.push({
      kind: 'line',
      id: 'chart-output',
      labels: data.dailyByModel.labels.map((d: string) => d.slice(5)),
      datasets: data.dailyByModel.series.map((s: any) => ({ label: s.name, data: s.values })),
    });
  } else if (mode === 'daily-harness') {
    jobs.push({
      kind: 'line',
      id: 'chart-output',
      labels: data.dailyByHarness.labels.map((d: string) => d.slice(5)),
      datasets: data.dailyByHarness.series.map((s: any) => ({ label: s.name, data: s.values })),
    });
  }
  queueCharts(jobs);

  return html`
    <div class="page">
      ${header('Output', 'Multi-mode code production — AI vs user, workspace, harness, model, language.', `${fmtLoc(data.summary.totalAiLoc)} AI LOC`)}
      <div class="banner ok">Local LOC estimates from session transcripts — not billing data.</div>
      <div class="metric-row">
        <div class="metric"><div class="label">AI LOC</div><div class="value mono">${fmtLoc(data.summary.totalAiLoc)}</div></div>
        <div class="metric"><div class="label">User LOC</div><div class="value mono">${fmtLoc(data.summary.totalUserLoc)}</div></div>
        <div class="metric"><div class="label">AI ratio</div><div class="value mono">${Math.round(data.summary.aiRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Blocks</div><div class="value mono">${data.summary.aiBlocks}</div></div>
      </div>
      ${seg(
        OUTPUT_MODES.map((m) => ({ id: m.id, label: m.label })),
        state.outputMode,
        (id) => {
          state.outputMode = id;
          void refresh();
        },
      )}
      <section class="panel">
        <h2>${OUTPUT_MODES.find((m) => m.id === state.outputMode)?.label || 'Output'}</h2>
        <div class="chart-box tall"><canvas id="chart-output"></canvas></div>
      </section>
      <section class="panel">
        <h2>Harness comparison</h2>
        <table>
          <thead><tr><th>Harness</th><th>Req</th><th>LOC</th><th>Cancel</th></tr></thead>
          <tbody>
            ${compare.map(
              (r: any) => html`<tr>
                <td>${r.harness}</td>
                <td class="mono">${r.requests}</td>
                <td class="mono">${fmtLoc(r.aiLoc)}</td>
                <td class="mono">${Math.round(r.cancelRate * 100)}%</td>
              </tr>`,
            )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageBudget() {
  const data = await query<any>('getBudget');
  state.badges = { ...state.badges, budgetPct: data.pct };
  const daily = data.daily || [];
  queueCharts([
    {
      kind: 'bar',
      id: 'chart-budget',
      labels: daily.map((d: any) => String(d.date).slice(5)),
      datasets: [{ label: 'Credits', data: daily.map((d: any) => d.credits), color: '#eb6847' }],
    },
  ]);
  return html`
    <div class="page">
      ${header('Burndown', 'Local credit and token estimates for the selected range — always on.', `${data.pct}% used`)}
      <div class="banner">${data.disclaimer}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">Credits used</div><div class="value mono">${data.creditsUsed}</div></div>
        <div class="metric"><div class="label">Budget</div><div class="value mono">${data.budget}</div></div>
        <div class="metric"><div class="label">Remaining</div><div class="value mono">${data.remaining}</div></div>
        <div class="metric"><div class="label">USD est.</div><div class="value mono">$${data.usdEstimate}</div></div>
      </div>
      <section class="panel">
        <h2>Daily burn</h2>
        <div class="chart-box"><canvas id="chart-budget"></canvas></div>
      </section>
      <section class="panel">
        <h2>By model</h2>
        <table>
          <thead><tr><th>Model</th><th>Credits</th><th>USD</th><th>Requests</th></tr></thead>
          <tbody>
            ${Object.entries(data.byModel || {}).map(
              ([k, v]: any) => html`<tr><td>${k}</td><td class="mono">${v.credits.toFixed?.(2) ?? v.credits}</td><td class="mono">${v.usd.toFixed?.(4) ?? v.usd}</td><td class="mono">${v.requests}</td></tr>`,
            )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageRhythm() {
  const data = await query<any>('getPatternsDeep');
  const max = Math.max(1, ...data.heatmap.flat());
  const jobs: ChartJob[] = [];
  if (state.patternsTab === 'work-hours') {
    jobs.push({
      kind: 'bar',
      id: 'chart-patterns',
      labels: data.hourly.map((_: number, h: number) => `${h}`),
      datasets: [{ label: 'Requests', data: data.hourly, color: '#f59e0b' }],
    });
  } else if (state.patternsTab === 'calendar') {
    jobs.push({
      kind: 'line',
      id: 'chart-patterns',
      labels: data.calendar.map((c: any) => c.date.slice(5)),
      datasets: [
        { label: 'Requests', data: data.calendar.map((c: any) => c.requests) },
        { label: 'AI LOC', data: data.calendar.map((c: any) => c.aiLoc), color: '#33cc94' },
      ],
    });
  } else {
    jobs.push({
      kind: 'bar',
      id: 'chart-patterns',
      labels: data.projects.map((p: any) => p.workspace),
      datasets: [
        { label: 'Requests', data: data.projects.map((p: any) => p.requests) },
        { label: 'Sessions', data: data.projects.map((p: any) => p.sessions), color: '#519eec' },
      ],
    });
  }
  queueCharts(jobs);

  return html`
    <div class="page">
      ${header('Patterns', 'Work-hours heatmap, calendar intensity, and project mix.', `Balance ${data.balanceScore}`)}
      <div class="metric-row">
        <div class="metric"><div class="label">Late-night</div><div class="value mono">${Math.round(data.lateNightRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Weekend</div><div class="value mono">${Math.round(data.weekendRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Peak hour</div><div class="value mono">${data.peakHour != null ? `${data.peakHour}:00` : '—'}</div></div>
        <div class="metric"><div class="label">Balance</div><div class="value mono">${data.balanceScore}</div></div>
      </div>
      ${seg(
        [
          { id: 'work-hours', label: 'Work hours' },
          { id: 'calendar', label: 'Calendar' },
          { id: 'projects', label: 'Projects' },
        ],
        state.patternsTab,
        (id) => {
          state.patternsTab = id as typeof state.patternsTab;
          void refresh();
        },
      )}
      ${state.patternsTab === 'work-hours'
        ? html`<section class="panel">
            <h2>7×24 activity</h2>
            <div class="heatmap">
              ${data.heatmap.map(
                (row: number[], dow: number) => html`
                  <div class="hm-label">${DOW[dow]}</div>
                  ${row.map((v) => {
                    const alpha = 0.08 + (v / max) * 0.9;
                    return html`<div class="hm-cell" style=${`background: rgba(245,158,11,${alpha})`} title=${String(v)}></div>`;
                  })}
                `,
              )}
            </div>
            <div class="chart-box" style="margin-top:14px"><canvas id="chart-patterns"></canvas></div>
          </section>`
        : html`<section class="panel">
            <h2>${state.patternsTab === 'calendar' ? 'Calendar intensity' : 'Projects'}</h2>
            <div class="chart-box tall"><canvas id="chart-patterns"></canvas></div>
            ${state.patternsTab === 'projects'
              ? html`<table style="margin-top:12px">
                  <thead><tr><th>Workspace</th><th>Sessions</th><th>Requests</th><th>AI LOC</th></tr></thead>
                  <tbody>
                    ${data.projects.map(
                      (p: any) => html`<tr>
                        <td>${p.workspace}</td>
                        <td class="mono">${p.sessions}</td>
                        <td class="mono">${p.requests}</td>
                        <td class="mono">${fmtLoc(p.aiLoc)}</td>
                      </tr>`,
                    )}
                  </tbody>
                </table>`
              : null}
          </section>`}
    </div>
  `;
}

async function pageInquiry() {
  const data = await query<any>('getCuriosityDeep');
  queueCharts([
    {
      kind: 'doughnut',
      id: 'chart-curiosity-mix',
      labels: ['Direct Q', 'Web', 'Repo', 'Action'],
      values: [data.counts.direct, data.counts.web, data.counts.repository, data.counts.action],
    },
    {
      kind: 'line',
      id: 'chart-curiosity-daily',
      labels: data.daily.map((d: any) => d.date.slice(5)),
      datasets: [
        { label: 'Direct', data: data.daily.map((d: any) => d.direct) },
        { label: 'Web', data: data.daily.map((d: any) => d.web), color: '#519eec' },
        { label: 'Repo', data: data.daily.map((d: any) => d.repository), color: '#33cc94' },
        { label: 'Action', data: data.daily.map((d: any) => d.action), color: '#eb6847' },
      ],
    },
  ]);
  return html`
    <div class="page">
      ${header('Curiosity', 'Inquiry vs action balance with research channels and language heat.', data.balance.label)}
      <div class="metric-row">
        <div class="metric"><div class="label">Inquiry sessions</div><div class="value mono">${data.inquirySessions}</div></div>
        <div class="metric"><div class="label">Questions</div><div class="value mono">${data.questionRequests}</div></div>
        <div class="metric"><div class="label">Investigations</div><div class="value mono">${data.investigationRequests}</div></div>
        <div class="metric"><div class="label">Balance</div><div class="value mono">${Math.round(data.balance.inquiryShare * 100)}% inquire</div></div>
      </div>
      ${(data.suggestions || []).length
        ? html`<section class="panel"><ul class="recs">${data.suggestions.map((s: string) => html`<li>${s}</li>`)}</ul></section>`
        : null}
      <div class="grid-2">
        <section class="panel">
          <h2>Channel mix</h2>
          <div class="chart-box short"><canvas id="chart-curiosity-mix"></canvas></div>
        </section>
        <section class="panel">
          <h2>Daily curiosity</h2>
          <div class="chart-box"><canvas id="chart-curiosity-daily"></canvas></div>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>Languages touched by inquiry</h2>
          <table>
            <thead><tr><th>Language</th><th>Inquiry</th><th>Sessions</th></tr></thead>
            <tbody>
              ${(data.languages || []).length === 0
                ? html`<tr><td colspan="3" class="muted">No language-tagged inquiry yet.</td></tr>`
                : data.languages.map(
                    (l: any) => html`<tr><td>${l.language}</td><td class="mono">${l.inquiry}</td><td class="mono">${l.sessions}</td></tr>`,
                  )}
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h2>Recent questions</h2>
          <div class="list">
            ${(data.topQuestions || []).length === 0
              ? html`<article class="muted">No question-shaped prompts in range.</article>`
              : data.topQuestions.map((q: string) => html`<article>${q}</article>`)}
          </div>
        </section>
      </div>
    </div>
  `;
}

async function pageFlow() {
  const data = await query<any>('getFlowState');
  queueCharts([
    {
      kind: 'bar',
      id: 'chart-flow',
      labels: data.hourlyFlow.map((_: number, h: number) => `${h}`),
      datasets: [{ label: 'Flow weight', data: data.hourlyFlow, color: '#3cb4dd' }],
    },
  ]);
  return html`
    <div class="page">
      ${header('Flow', 'Deep-work scoring from follow-up latency and session structure.', `Score ${data.overallFlowScore}`)}
      <div class="metric-row">
        <div class="metric"><div class="label">Flow score</div><div class="value mono">${data.overallFlowScore}</div></div>
        <div class="metric"><div class="label">Avg follow-up</div><div class="value mono">${data.avgFollowUpSec}s</div></div>
        <div class="metric"><div class="label">Avg block</div><div class="value mono">${data.avgBlockMin}m</div></div>
        <div class="metric"><div class="label">Deep days</div><div class="value mono">${data.deepFlowDays}/${data.totalDays}</div></div>
      </div>
      ${(data.suggestions || []).length
        ? html`<section class="panel"><h2>Suggestions</h2><ul class="recs">${data.suggestions.map((s: string) => html`<li>${s}</li>`)}</ul></section>`
        : null}
      <section class="panel">
        <h2>Hourly flow${data.bestHour != null ? ` · peak ${data.bestHour}:00` : ''}</h2>
        <div class="chart-box"><canvas id="chart-flow"></canvas></div>
      </section>
      <section class="panel">
        <h2>Days</h2>
        <table>
          <thead><tr><th>Date</th><th>Score</th><th>Label</th><th>Longest block</th><th>Hours</th></tr></thead>
          <tbody>
            ${(data.days || []).length === 0
              ? html`<tr><td colspan="5" class="muted">Need sessions with ≥3 timed turns to score flow.</td></tr>`
              : data.days.map(
                  (d: any) => html`<tr>
                    <td class="mono">${d.date}</td>
                    <td class="mono">${d.avgFlowScore}</td>
                    <td>${d.flowLabel}</td>
                    <td class="mono">${d.longestBlockMin}m</td>
                    <td class="mono">${d.totalHours}h</td>
                  </tr>`,
                )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageHabits() {
  const findings = await query<any[]>('getHabits');
  const coverage = await query<any>('getRuleCoverage');
  const catalog = await query<any[]>('listSignals');
  const triggered = findings.filter((f) => f.triggered);
  state.badges = { ...state.badges, habits: triggered.length };

  return html`
    <div class="page">
      ${header('Anti-Patterns', 'Findings plus a Rules catalog with coverage across workspaces.', `${triggered.length} active`)}
      ${seg(
        [
          { id: 'findings', label: 'Findings' },
          { id: 'rules', label: 'Rules' },
        ],
        state.habitsTab,
        (id) => {
          state.habitsTab = id as typeof state.habitsTab;
          void refresh();
        },
      )}
      ${state.habitsTab === 'findings'
        ? html`<section class="panel">
            <table>
              <thead><tr><th>Signal</th><th>Group</th><th>Severity</th><th>Finding</th><th>Improve</th></tr></thead>
              <tbody>
                ${findings.map(
                  (f) => html`<tr>
                    <td><strong>${f.name}</strong></td>
                    <td>${f.group}</td>
                    <td><span class=${`sev sev-${f.severity}`}>${f.severity}</span></td>
                    <td>${f.triggered ? f.message : html`<span class="muted">Clear</span>`}</td>
                    <td class="muted">${f.triggered ? f.improvement : '—'}</td>
                  </tr>`,
                )}
              </tbody>
            </table>
          </section>`
        : html`
            <section class="panel">
              <h2>Catalog actions</h2>
              <p class="muted" style="margin-bottom:10px">Open Rule Studio to author, live-test, or save SignalSpec files. Coverage below attributes findings across workspaces.</p>
              <button class="btn" onClick=${() => setPage('studio')}>Open Rule Studio</button>
              <button class="btn secondary" style="margin-left:8px" onClick=${() => setPage('lab')}>Signal Lab</button>
            </section>
            <section class="panel">
              <h2>Installed signals (${catalog.length})</h2>
              <table>
                <thead><tr><th>Name</th><th>Group</th><th>Layer</th><th>Triggered</th></tr></thead>
                <tbody>
                  ${catalog.map((s: any) => {
                    const f = findings.find((x) => x.id === s.id);
                    return html`<tr>
                      <td>${s.name}</td>
                      <td>${s.group}</td>
                      <td class="mono">${s.layer}</td>
                      <td>${f?.triggered ? html`<span class="sev sev-medium">yes</span>` : html`<span class="muted">no</span>`}</td>
                    </tr>`;
                  })}
                </tbody>
              </table>
            </section>
            <section class="panel">
              <h2>Coverage matrix</h2>
              <div class="matrix">
                <table>
                  <thead>
                    <tr>
                      <th>Rule</th>
                      ${(coverage.workspaces || []).map((w: string) => html`<th>${w}</th>`)}
                    </tr>
                  </thead>
                  <tbody>
                    ${(coverage.rules || []).map(
                      (r: any) => html`<tr>
                        <td>${r.name}</td>
                        ${(coverage.workspaces || []).map(
                          (w: string) => html`<td class="mono">${coverage.matrix?.[r.id]?.[w] ?? 0}</td>`,
                        )}
                      </tr>`,
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          `}
    </div>
  `;
}

async function pageStudio() {
  const catalog = await query<any[]>('listSignals');
  const template = await rpc<{ markdown: string }>('getSignalTemplate', { id: 'my-signal', name: 'My Signal' });
  let draft = template.markdown;
  let status = '';
  let finding: any = null;

  const view = () => html`
    <div class="page">
      ${header('Rule Studio', 'Author, live-test, and save personal SignalSpec files. Durable rules live under ~/.cadence.', `${catalog.length} signals`)}
      <div class="banner ok">Adapt path: explore in Signal Lab → paste a SignalSpec here → Live test → Save (local trust gate). Full authoring guide in docs/SIGNALS.md.</div>
      <div class="grid-2">
        <section class="panel">
          <h2>Catalog</h2>
          <table>
            <thead><tr><th>Name</th><th>Group</th><th>Layer</th></tr></thead>
            <tbody>
              ${catalog.map(
                (s) => html`<tr
                  class="clickable"
                  onClick=${async () => {
                    if (s.markdown) draft = s.markdown;
                    else {
                      const t = await rpc<{ markdown: string }>('getSignalTemplate', { id: s.id, name: s.name });
                      draft = t.markdown;
                    }
                    paint(view());
                  }}
                ><td>${s.name}</td><td>${s.group}</td><td class="mono">${s.layer}</td></tr>`,
              )}
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h2>Editor</h2>
          <textarea
            class="editor"
            rows="18"
            value=${draft}
            onInput=${(e: Event) => {
              draft = (e.target as HTMLTextAreaElement).value;
            }}
          >${draft}</textarea>
          <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
            <button
              class="btn secondary"
              onClick=${async () => {
                try {
                  const res = await rpc<any>('testSignalMarkdown', { markdown: draft, ...filterParams() });
                  finding = res.finding;
                  status = finding?.triggered ? `Triggered: ${finding.message}` : 'Clean against current sample.';
                  paint(view());
                } catch (err) {
                  status = err instanceof Error ? err.message : String(err);
                  paint(view());
                }
              }}
            >Live test</button>
            <button
              class="btn"
              onClick=${async () => {
                try {
                  const res = await rpc<any>('savePersonalSignal', { markdown: draft });
                  status = `Saved & approved ${res.filePath}`;
                  state.cache.clear();
                  paint(view());
                } catch (err) {
                  status = err instanceof Error ? err.message : String(err);
                  paint(view());
                }
              }}
            >Save to ~/.cadence</button>
          </div>
          ${status ? html`<p class="muted" style="margin-top:.75rem">${status}</p>` : null}
          ${finding ? html`<pre class="codeblock">${JSON.stringify(finding, null, 2)}</pre>` : null}
        </section>
      </div>
    </div>
  `;
  return view();
}

async function pageLab() {
  let expression = 'messageLength < 30 AND messageLength > 0';
  let result: any = null;
  let error = '';
  const fields = await query<any>('getFieldBrowser');
  const ref = await query<any>('getLabReference');

  const view = () => html`
    <div class="page">
      ${header('Signal Lab', 'Safe predicates over live request fields — explore before promoting to SignalSpec.')}
      <div class="grid-2">
        <section class="panel">
          <label class="muted">Expression</label>
          <input
            class="editor-input"
            value=${expression}
            onInput=${(e: Event) => {
              expression = (e.target as HTMLInputElement).value;
            }}
          />
          <p class="muted" style="margin-top:.5rem">Sample fields: ${(fields.fields || []).join(', ')}.</p>
          <div style="display:flex;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
            <button
              class="btn"
              onClick=${async () => {
                try {
                  result = await rpc('evaluateLab', { expression, ...filterParams() });
                  error = '';
                } catch (err) {
                  error = err instanceof Error ? err.message : String(err);
                  result = null;
                }
                paint(view());
              }}
            >Evaluate</button>
            ${(ref.examples || []).slice(0, 3).map(
              (ex: string) => html`<button
                class="btn secondary"
                onClick=${() => {
                  expression = ex;
                  paint(view());
                }}
              >Use: ${ex.length > 28 ? `${ex.slice(0, 28)}…` : ex}</button>`,
            )}
          </div>
          ${error ? html`<div class="banner" style="margin-top:1rem">${error}</div>` : null}
          ${result
            ? html`<div class="metric-row" style="margin-top:1rem">
                <div class="metric"><div class="label">Matched</div><div class="value mono">${result.matched}</div></div>
                <div class="metric"><div class="label">Sample size</div><div class="value mono">${result.total}</div></div>
                <div class="metric"><div class="label">Ratio</div><div class="value mono">${Math.round(result.ratio * 100)}%</div></div>
              </div>
              ${result.samples?.length
                ? html`<pre class="codeblock">${JSON.stringify(result.samples, null, 2)}</pre>`
                : null}`
            : null}
        </section>
        <section class="panel">
          <h2>Predicate reference</h2>
          <p class="muted">${ref.tip}</p>
          <h2 style="margin-top:12px">Operators</h2>
          <p class="mono" style="font-size:12px">${(ref.operators || []).join('  ')}</p>
          <h2 style="margin-top:12px">Fields</h2>
          <table>
            <thead><tr><th>Field</th><th>Type</th><th>Note</th></tr></thead>
            <tbody>
              ${(ref.fields || []).map(
                (f: any) => html`<tr><td class="mono">${f.name}</td><td>${f.type}</td><td class="muted">${f.note}</td></tr>`,
              )}
            </tbody>
          </table>
          <h2 style="margin-top:12px">Examples</h2>
          <div class="list">
            ${(ref.examples || []).map((ex: string) => html`<article class="mono" style="font-size:12px">${ex}</article>`)}
          </div>
        </section>
      </div>
    </div>
  `;
  return view();
}

async function pageHub() {
  const data = await query<any>('getHub');
  queueCharts([
    {
      kind: 'bar',
      id: 'chart-hub',
      labels: (data.issueRows || []).slice(0, 8).map((r: any) => r.issue),
      datasets: [{ label: 'Requests', data: (data.issueRows || []).slice(0, 8).map((r: any) => r.requests), color: '#b675d7' }],
    },
  ]);
  return html`
    <div class="page">
      ${header('Hub', 'Issue/PR linkage and Copilot App signals from local session text.')}
      <div class="banner">${data.disclaimer}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">Sessions</div><div class="value mono">${data.sessions}</div></div>
        <div class="metric"><div class="label">With issue link</div><div class="value mono">${data.withIssue}</div></div>
        <div class="metric"><div class="label">With PR link</div><div class="value mono">${data.withPr}</div></div>
        <div class="metric"><div class="label">Copilot App</div><div class="value mono">${data.copilotAppSessions}</div></div>
      </div>
      <section class="panel">
        <h2>Relative issue spend</h2>
        ${(data.issueRows || []).length
          ? html`<div class="chart-box short"><canvas id="chart-hub"></canvas></div>`
          : null}
        <table style="margin-top:12px">
          <thead><tr><th>Issue</th><th>Sessions</th><th>Requests</th><th>%</th></tr></thead>
          <tbody>
            ${(data.issueRows || []).length === 0
              ? html`<tr><td colspan="4" class="muted">No early-turn issue links found in range.</td></tr>`
              : data.issueRows.map(
                  (r: any) => html`<tr><td class="mono">${r.issue}</td><td class="mono">${r.sessions}</td><td class="mono">${r.requests}</td><td class="mono">${r.pct}%</td></tr>`,
                )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageFields() {
  const data = await query<any>('getFieldBrowser');
  return html`
    <div class="page">
      ${header('Data Explorer', 'Sample request fields for authoring signals.', `${data.count} rows`)}
      <section class="panel">
        <p class="muted">Fields: ${(data.fields || []).join(', ')}</p>
        <table style="margin-top:0.75rem">
          <thead><tr><th>Harness</th><th>Model</th><th>Len</th><th>Tools</th><th>LOC</th><th>Type</th></tr></thead>
          <tbody>
            ${(data.sample || []).map(
              (r: any) => html`<tr>
                <td>${r.harness}</td><td>${r.modelId}</td><td class="mono">${r.messageLength}</td>
                <td class="mono">${r.tools}</td><td class="mono">${r.aiLoc}</td><td>${r.workType}</td>
              </tr>`,
            )}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageSkills() {
  const data = await query<any>('getSkillCatalog');
  state.badges = { ...state.badges, skills: data.custom.length };
  return html`
    <div class="page">
      ${header('Skill Finder', 'Recurring prompts plus an offline community skill catalog with matches.', `${data.custom.length} drafts`)}
      ${seg(
        [
          { id: 'custom', label: `Your repeats (${data.custom.length})` },
          { id: 'community', label: `Community (${data.totalScanned})` },
        ],
        state.skillsTab,
        (id) => {
          state.skillsTab = id as typeof state.skillsTab;
          void refresh();
        },
      )}
      ${state.skillsTab === 'custom'
        ? html`<section class="panel list">
            ${data.custom.length === 0
              ? html`<div class="empty"><h2>No repeats yet</h2><p>As prompts recur, Cadence will suggest skill drafts here.</p></div>`
              : data.custom.map(
                  (r: any) => html`<article>
                    <strong>${r.count}×</strong> ${r.sample}
                    <div class="muted">${r.suggestion}</div>
                    ${(r.communityMatches || []).length
                      ? html`<div class="muted" style="margin-top:4px">Matches: ${r.communityMatches.map((m: any) => m.title).join(' · ')}</div>`
                      : null}
                    <pre class="codeblock">${r.draftMarkdown}</pre>
                  </article>`,
                )}
          </section>`
        : html`<section class="panel list">
            ${data.community.map(
              (c: any) => html`<article>
                <strong>${c.title}</strong>
                <span class=${c.matched ? 'sev sev-low' : 'sev sev-medium'}>${c.matched ? 'matched' : c.kind}</span>
                <div class="muted">${c.description}</div>
                <div class="muted" style="margin-top:4px">${c.category} · ${c.tags.join(', ')}</div>
              </article>`,
            )}
          </section>`}
    </div>
  `;
}

async function pageContext() {
  const data = await query<any>('getContextDeep');
  queueCharts([
    {
      kind: 'doughnut',
      id: 'chart-context-score',
      labels: ['Quality', 'Management'],
      values: [data.score, data.managementScore],
    },
    {
      kind: 'bar',
      id: 'chart-context-tree',
      labels: data.treemap.map((t: any) => t.label),
      datasets: [{ label: 'Context weight', data: data.treemap.map((t: any) => t.value), color: '#b675d7' }],
    },
  ]);
  return html`
    <div class="page">
      ${header('Context Health', 'Quality and management checks for agentic prompting.', `Overall ${data.overall}`)}
      <div class="metric-row">
        <div class="metric"><div class="label">Quality</div><div class="value mono">${data.score}</div></div>
        <div class="metric"><div class="label">Management</div><div class="value mono">${data.managementScore}</div></div>
        <div class="metric"><div class="label">Overall</div><div class="value mono">${data.overall}</div></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>Score mix</h2>
          <div class="chart-box short"><canvas id="chart-context-score"></canvas></div>
        </section>
        <section class="panel">
          <h2>Workspace context weight</h2>
          <div class="chart-box"><canvas id="chart-context-tree"></canvas></div>
        </section>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>Quality checks</h2>
          <div class="check-grid">
            ${data.qualityChecks.map(
              (c: any) => html`<div class="score-item">
                <strong>${c.label}</strong>
                <span class=${c.pass ? 'sev sev-low' : 'sev sev-medium'}>${c.pass ? 'pass' : 'gap'}</span>
                <div class="muted">${c.value} turns · ${Math.round(c.pct * 100)}%</div>
                <div class="bar"><span style=${`width:${Math.round(c.pct * 100)}%`}></span></div>
              </div>`,
            )}
          </div>
        </section>
        <section class="panel">
          <h2>Management checks</h2>
          <div class="check-grid">
            ${data.managementChecks.map(
              (c: any) => html`<div class="score-item">
                <strong>${c.label}</strong>
                <span class=${c.pass ? 'sev sev-low' : 'sev sev-medium'}>${c.pass ? 'pass' : 'watch'}</span>
                <div class="muted">${c.value} turns · ${Math.round(c.pct * 100)}%</div>
                <div class="bar"><span style=${`width:${Math.min(100, Math.round(c.pct * 100))}%`}></span></div>
              </div>`,
            )}
          </div>
        </section>
      </div>
    </div>
  `;
}

async function pagePractice() {
  const pack = await query<any>('getPracticePack');
  let quizIndex = 0;
  let score = 0;
  let answered = 0;
  let feedback = '';

  const view = () => {
    const q = pack.quiz[quizIndex];
    return html`
      <div class="page">
        ${header('Practice', `Focus: ${pack.focusLabel}`, `Score ${pack.score}`)}
        <section class="panel">
          <h2>Drills</h2>
          <div class="list">
            ${(pack.drills || []).map((d: string) => html`<article>${d}</article>`)}
          </div>
        </section>
        <section class="panel">
          <h2>Quiz ${answered ? `· ${score}/${answered} correct` : ''}</h2>
          ${!q
            ? html`<p class="muted">No quiz items for this range — keep coding and reload.</p>`
            : html`
                <p><strong>${q.prompt}</strong></p>
                <div class="list" style="margin-top:.75rem">
                  ${q.choices.map(
                    (c: string, i: number) => html`<button
                      class="btn secondary"
                      style="justify-self:start"
                      onClick=${() => {
                        answered += 1;
                        if (i === q.answerIndex) {
                          score += 1;
                          feedback = `Correct. ${q.explain}`;
                        } else {
                          feedback = `Not quite. Better: ${q.choices[q.answerIndex]}`;
                        }
                        quizIndex = Math.min(quizIndex + 1, pack.quiz.length);
                        paint(view());
                      }}
                    >${c}</button>`,
                  )}
                </div>
                ${feedback ? html`<p class="muted" style="margin-top:.75rem">${feedback}</p>` : null}
              `}
        </section>
      </div>
    `;
  };
  return view();
}

async function pageMarks() {
  const data = await query<any>('getAchievements');
  return html`
    <div class="page">
      ${header('Achievements', 'XP and badges for consistent agentic craft.', data.tier)}
      <div class="metric-row">
        <div class="metric"><div class="label">XP</div><div class="value mono">${data.xp}</div></div>
        <div class="metric"><div class="label">Tier</div><div class="value">${data.tier}</div></div>
      </div>
      <section class="panel list">
        ${data.badges.map(
          (b: any) => html`<article>
            <strong>${b.name}</strong>
            <span class=${b.earned ? 'sev sev-low' : 'sev sev-medium'}>${b.earned ? 'earned' : 'locked'}</span>
          </article>`,
        )}
      </section>
    </div>
  `;
}

async function pageLifecycle() {
  const data = await query<any>('getSdlc');
  const entries = Object.entries(data.phases || {}) as [string, number][];
  queueCharts([
    {
      kind: 'doughnut',
      id: 'chart-lifecycle',
      labels: entries.map(([k]) => k),
      values: entries.map(([, v]) => v),
    },
  ]);
  return html`
    <div class="page">
      ${header('Lifecycle', 'How your AI turns distribute across the software lifecycle.')}
      <section class="panel">
        <div class="chart-box"><canvas id="chart-lifecycle"></canvas></div>
        <table style="margin-top:12px">
          <thead><tr><th>Phase</th><th>Requests</th></tr></thead>
          <tbody>
            ${entries.map(([k, v]) => html`<tr><td>${k}</td><td class="mono">${v}</td></tr>`)}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

async function pageSnapshot() {
  const data = await query<any>('exportSummary');
  const share = data.json.share;
  return html`
    <div class="page">
      ${header('Share', 'Export a shareable card and markdown/JSON summary.')}
      <section class="panel">
        <h2>${share.title}</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Sessions</div><div class="value mono">${share.sessions}</div></div>
          <div class="metric"><div class="label">Requests</div><div class="value mono">${share.requests}</div></div>
          <div class="metric"><div class="label">AI LOC</div><div class="value mono">${share.aiLoc}</div></div>
          <div class="metric"><div class="label">Score</div><div class="value mono">${share.practiceScore}</div></div>
        </div>
        <pre style="white-space:pre-wrap;margin-top:1rem;font-size:0.85rem;color:var(--text-secondary)">${data.markdown}</pre>
        <button
          class="btn"
          style="margin-top:1rem"
          onClick=${async () => {
            await rpc('copyMarkdown', {});
            if (typeof navigator !== 'undefined' && navigator.clipboard && data.markdown) {
              try { await navigator.clipboard.writeText(data.markdown); } catch { /* vscode path handles it */ }
            }
          }}
        >Copy markdown</button>
      </section>
    </div>
  `;
}

function paint(body?: ReturnType<typeof html>) {
  const root = document.getElementById('app');
  if (!root) return;
  const content =
    state.error
      ? html`<div class="page"><div class="error"><h2>Something went wrong</h2><p>${state.error}</p><button class="btn" onClick=${() => void refresh()}>Retry</button></div></div>`
      : body || html`<div class="loading"><h2>Loading Cadence…</h2></div>`;
  render(shell(content), root);
  flushCharts();
}

let started = false;

export function startUi() {
  if (started) return;
  started = true;
  state.theme = readStoredTheme();
  applyTheme();
  onHostRefresh(() => {
    state.cache.clear();
    void refresh();
  });
  paint();
  void refresh();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => startUi());
  if (document.readyState !== 'loading') startUi();
}
