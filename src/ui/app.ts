import { html, render } from './dom';
import { onHostRefresh, rpc } from './rpc';

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

const state = {
  page: 'overview' as PageId,
  filter: { workspaceId: '', harness: '' },
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

function filterParams() {
  return {
    workspaceId: state.filter.workspaceId || undefined,
    harness: state.filter.harness || undefined,
  };
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

function shell(content: ReturnType<typeof html>) {
  const themeIcon = state.theme === 'light' ? '☀' : state.theme === 'dark' ? '☾' : '◐';
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
        <label>
          Workspace
          <select
            value=${state.filter.workspaceId}
            onChange=${(e: Event) => {
              state.filter.workspaceId = (e.target as HTMLSelectElement).value;
              state.cache.clear();
              void refresh();
            }}
          >
            <option value="">All workspaces</option>
            ${(state.meta?.workspaces || []).map((w: any) => html`<option value=${w.id}>${w.name}</option>`)}
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
  const maxReq = Math.max(1, ...(data.activity || []).map((a: any) => a.requests));

  return html`
    <div class="page">
      ${header('Dashboard', 'Practice scores, activity, and where your agent hours go.', `Score ${data.practiceScore}`)}
      ${state.notice ? html`<div class="banner">${state.notice}</div>` : null}
      <div class="grid-4">
        ${(data.practice || []).slice(0, 4).map((p: any) => {
          const st = practiceStatus(p.score);
          const tip = p.findings?.find((f: any) => f.triggered)?.improvement || 'Keep this streak.';
          return html`
            <div class="practice-card">
              <div class="ring-wrap">
                <div class="ring" style=${`--p:${p.score};--ring-color:${st.color}`} data-score=${p.score}></div>
                <div class="meta">
                  <strong>${p.label}</strong>
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
      <section class="panel">
        <h2>Daily activity</h2>
        <div class="metric-row" style="margin-bottom:8px">
          <div class="metric"><div class="label">Requests</div><div class="value mono">${data.requests}</div></div>
          <div class="metric"><div class="label">Sessions</div><div class="value mono">${data.sessions}</div></div>
          <div class="metric"><div class="label">AI LOC</div><div class="value mono">${fmtLoc(data.aiLoc)}</div></div>
          <div class="metric"><div class="label">Flow</div><div class="value mono">${data.flowScore}</div></div>
        </div>
        <div class="spark">
          ${(data.activity || []).slice(-28).map(
            (a: any) => html`<span style=${`height:${Math.max(6, (a.requests / maxReq) * 100)}%`} title=${`${a.date}: ${a.requests} req`}></span>`,
          )}
        </div>
      </section>
      <div class="grid-2">
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
        <section class="panel">
          <h2>Harness mix</h2>
          <table>
            <thead><tr><th>Harness</th><th>Sessions</th></tr></thead>
            <tbody>
              ${Object.entries(data.byHarness || {}).map(
                ([name, count]) => html`<tr><td>${name}</td><td class="mono">${count as number}</td></tr>`,
              )}
            </tbody>
          </table>
        </section>
      </div>
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
  state.badges = { ...state.badges, sessions: rows.length };
  return html`
    <div class="page">
      ${header('Timeline', 'Session timeline across harnesses — click a row for turn detail.', `${rows.length} sessions`)}
      <section class="panel">
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
      </section>
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
  const data = await query<any>('getThroughput');
  const compare = await query<any[]>('getHarnessComparison');
  state.badges = { ...state.badges, aiLoc: data.aiLoc };
  return html`
    <div class="page">
      ${header('Output', 'AI-generated code volume by language, model, and harness.')}
      <div class="banner ok">${data.estimateNote}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">AI LOC</div><div class="value mono">${fmtLoc(data.aiLoc)}</div></div>
        <div class="metric"><div class="label">User LOC</div><div class="value mono">${fmtLoc(data.userLoc)}</div></div>
        <div class="metric"><div class="label">Harnesses</div><div class="value mono">${compare.length}</div></div>
        <div class="metric"><div class="label">Languages</div><div class="value mono">${Object.keys(data.byLanguage || {}).length}</div></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>By language</h2>
          <table>
            <tbody>
              ${Object.entries(data.byLanguage || {})
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([k, v]) => html`<tr><td>${k}</td><td class="mono">${v as number}</td></tr>`)}
            </tbody>
          </table>
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
      <section class="panel">
        <h2>By model</h2>
        <table>
          <thead><tr><th>Model</th><th>Req</th><th>LOC</th></tr></thead>
          <tbody>
            ${Object.entries(data.byModel || {}).map(
              ([k, v]: any) => html`<tr><td>${k}</td><td class="mono">${v.requests}</td><td class="mono">${v.aiLoc}</td></tr>`,
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
  const maxDay = Math.max(1, ...(data.daily || []).map((d: any) => d.credits));
  return html`
    <div class="page">
      ${header('Burndown', 'Local credit and token estimates for the selected range.', `${data.pct}% used`)}
      <div class="banner">${data.disclaimer}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">Credits used</div><div class="value mono">${data.creditsUsed}</div></div>
        <div class="metric"><div class="label">Budget</div><div class="value mono">${data.budget}</div></div>
        <div class="metric"><div class="label">Remaining</div><div class="value mono">${data.remaining}</div></div>
        <div class="metric"><div class="label">USD est.</div><div class="value mono">$${data.usdEstimate}</div></div>
      </div>
      <section class="panel">
        <h2>Daily burn</h2>
        <div class="spark">
          ${(data.daily || []).map(
            (d: any) => html`<span style=${`height:${Math.max(6, (d.credits / maxDay) * 100)}%;background:var(--chart-3)`} title=${`${d.date}: ${d.credits}`}></span>`,
          )}
        </div>
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
  const data = await query<any>('getRhythm');
  const max = Math.max(1, ...data.heatmap.flat());
  return html`
    <div class="page">
      ${header('Patterns', 'When you work with agents — heatmap and balance.', `Balance ${data.balanceScore}`)}
      <div class="metric-row">
        <div class="metric"><div class="label">Late-night</div><div class="value mono">${Math.round(data.lateNightRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Weekend</div><div class="value mono">${Math.round(data.weekendRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Samples</div><div class="value mono">${data.total}</div></div>
        <div class="metric"><div class="label">Balance</div><div class="value mono">${data.balanceScore}</div></div>
      </div>
      <section class="panel">
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
      </section>
    </div>
  `;
}

async function pageInquiry() {
  const data = await query<any>('getInquiry');
  return html`
    <div class="page">
      ${header('Curiosity', 'Questions and investigation patterns in your sessions.')}
      <div class="metric-row">
        <div class="metric"><div class="label">Inquiry sessions</div><div class="value mono">${data.inquirySessions}</div></div>
        <div class="metric"><div class="label">Questions</div><div class="value mono">${data.questionRequests}</div></div>
        <div class="metric"><div class="label">Investigations</div><div class="value mono">${data.investigationRequests}</div></div>
        <div class="metric"><div class="label">Langs touched</div><div class="value mono">${Object.keys(data.languages || {}).length}</div></div>
      </div>
      <section class="panel">
        <h2>Recent questions</h2>
        <div class="list">
          ${(data.topQuestions || []).length === 0
            ? html`<article class="muted">No question-shaped prompts in range.</article>`
            : data.topQuestions.map((q: string) => html`<article>${q}</article>`)}
        </div>
      </section>
    </div>
  `;
}

async function pageFlow() {
  const data = await query<any>('getFlowState');
  const maxH = Math.max(1, ...data.hourlyFlow);
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
        <div class="spark">
          ${data.hourlyFlow.map(
            (v: number, h: number) => html`<span style=${`height:${Math.max(4, (v / maxH) * 100)}%;background:var(--chart-1)`} title=${`${h}:00 → ${v}`}></span>`,
          )}
        </div>
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
  const triggered = findings.filter((f) => f.triggered);
  state.badges = { ...state.badges, habits: triggered.length };
  return html`
    <div class="page">
      ${header('Anti-Patterns', 'Signals that help you refine agentic engineering practice.', `${triggered.length} active`)}
      <section class="panel">
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
      </section>
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
      ${header('Rule Studio', 'Author, live-test, and save personal SignalSpec files.', `${catalog.length} signals`)}
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

  const view = () => html`
    <div class="page">
      ${header('Signal Lab', 'Run predicates over a live sample of request fields.')}
      <section class="panel">
        <label class="muted">Expression</label>
        <input
          class="editor-input"
          value=${expression}
          onInput=${(e: Event) => {
            expression = (e.target as HTMLInputElement).value;
          }}
        />
        <p class="muted" style="margin-top:.5rem">Fields: ${(fields.fields || []).join(', ')}. Use AND / OR.</p>
        <button
          class="btn"
          style="margin-top:.75rem"
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
    </div>
  `;
  return view();
}

async function pageHub() {
  const data = await query<any>('getHub');
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
        <table>
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
  const rows = await query<any[]>('getSkillCandidates');
  state.badges = { ...state.badges, skills: rows.length };
  return html`
    <div class="page">
      ${header('Skill Finder', 'Repeated prompts with draft SKILL.md you can copy and refine.')}
      <section class="panel list">
        ${rows.length === 0
          ? html`<div class="empty"><h2>No repeats yet</h2><p>As prompts recur, Cadence will suggest skill drafts here.</p></div>`
          : rows.map(
              (r) => html`<article>
                <strong>${r.count}×</strong> ${r.sample}
                <div class="muted">${r.suggestion}</div>
                <pre class="codeblock">${r.draftMarkdown}</pre>
              </article>`,
            )}
      </section>
    </div>
  `;
}

async function pageContext() {
  const data = await query<any>('getContextHealth');
  return html`
    <div class="page">
      ${header('Context Health', 'Agentic readiness of your prompting and instruction habits.', `Score ${data.score}`)}
      <section class="panel">
        <div class="score-list">
          ${data.checks.map(
            (c: any) => html`<div class="score-item">
              <strong>${c.label}</strong>
              <span class=${c.pass ? 'sev sev-low' : 'sev sev-medium'}>${c.pass ? 'pass' : 'gap'}</span>
              <div class="muted">Observed ${c.value}</div>
              <div class="bar"><span style=${`width:${c.pass ? 100 : 35}%`}></span></div>
            </div>`,
          )}
        </div>
      </section>
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
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return html`
    <div class="page">
      ${header('Lifecycle', 'How your AI turns distribute across the software lifecycle.')}
      <section class="panel">
        <div class="spark" style="height:160px">
          ${entries.map(
            ([k, v]) => html`<span style=${`height:${Math.max(8, (v / max) * 100)}%;background:var(--chart-4)`} title=${`${k}: ${v}`}></span>`,
          )}
        </div>
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
