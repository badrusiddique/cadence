import { html, render } from './dom';
import { rpc } from './rpc';

type PageId =
  | 'overview'
  | 'sessions'
  | 'moments'
  | 'throughput'
  | 'budget'
  | 'rhythm'
  | 'inquiry'
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

interface NavItem { id: PageId; label: string; icon: string }
interface NavGroup { title: string; items: NavItem[] }

const NAV: NavGroup[] = [
  {
    title: 'Watch',
    items: [
      { id: 'overview', label: 'Overview', icon: '◉' },
      { id: 'sessions', label: 'Sessions', icon: '▭' },
      { id: 'moments', label: 'Moments', icon: '◎' },
    ],
  },
  {
    title: 'Quantify',
    items: [
      { id: 'throughput', label: 'Throughput', icon: '↗' },
      { id: 'budget', label: 'Budget', icon: '◌' },
      { id: 'rhythm', label: 'Rhythm', icon: '▦' },
      { id: 'inquiry', label: 'Inquiry', icon: '?' },
      { id: 'hub', label: 'Hub', icon: '⌘' },
    ],
  },
  {
    title: 'Refine',
    items: [
      { id: 'habits', label: 'Habits', icon: '!' },
      { id: 'studio', label: 'Rule Studio', icon: '✎' },
      { id: 'lab', label: 'Signal Lab', icon: 'λ' },
      { id: 'fields', label: 'Field Browser', icon: '▤' },
      { id: 'skills', label: 'Skill Match', icon: '∿' },
      { id: 'context', label: 'Context Score', icon: '▣' },
    ],
  },
  {
    title: 'Grow',
    items: [
      { id: 'practice', label: 'Practice', icon: '✦' },
      { id: 'marks', label: 'Marks', icon: '★' },
      { id: 'lifecycle', label: 'Lifecycle', icon: '↻' },
      { id: 'snapshot', label: 'Snapshot', icon: '⇪' },
    ],
  },
];

const state = {
  page: 'overview' as PageId,
  filter: { workspaceId: '', harness: '' },
  meta: null as any,
  loading: true,
  error: '' as string,
  notice: '' as string,
  cache: new Map<string, unknown>(),
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function filterParams() {
  return {
    workspaceId: state.filter.workspaceId || undefined,
    harness: state.filter.harness || undefined,
  };
}

async function loadMeta() {
  state.meta = await rpc('getMeta');
}

async function query<T>(method: string): Promise<T> {
  const key = `${method}:${JSON.stringify(filterParams())}`;
  if (state.cache.has(key)) return state.cache.get(key) as T;
  const result = await rpc<T>(method, filterParams());
  state.cache.set(key, result);
  return result;
}

function setPage(page: PageId) {
  state.page = page;
  void refresh();
}

async function refresh() {
  state.loading = true;
  state.error = '';
  paint();
  try {
    if (!state.meta) await loadMeta();
    state.cache.clear();
    await renderPage();
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    paint();
  } finally {
    state.loading = false;
  }
}

function shell(content: ReturnType<typeof html>) {
  return html`
    <aside id="rail">
      <div class="brand">
        <div class="brand-mark">Cadence<span>.</span></div>
        <div class="brand-tag">Steady your AI coding practice</div>
      </div>
      ${NAV.map(
        (group) => html`
          <div class="nav-group">${group.title}</div>
          ${group.items.map(
            (item) => html`
              <button class=${`nav-link${state.page === item.id ? ' active' : ''}`} onClick=${() => setPage(item.id)}>
                <span class="nav-ico">${item.icon}</span>${item.label}
              </button>
            `,
          )}
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
  state.notice = data.sessions === 0 ? 'No sessions in range.' : '';
  return html`
    <div class="page">
      ${header('Overview', 'Practice scores, activity, and where your agent hours go.', `Score ${data.practiceScore}`)}
      ${state.notice ? html`<div class="banner">${state.notice}</div>` : null}
      <div class="metric-row">
        <div class="metric"><div class="label">Sessions</div><div class="value mono">${data.sessions}</div></div>
        <div class="metric"><div class="label">Requests</div><div class="value mono">${data.requests}</div></div>
        <div class="metric"><div class="label">AI LOC</div><div class="value mono">${data.aiLoc}</div></div>
        <div class="metric"><div class="label">Cancel rate</div><div class="value mono">${Math.round(data.cancelRate * 100)}%</div></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>Practice</h2>
          <div class="score-list">
            ${data.practice.map(
              (p: any) => html`
                <div class="score-item">
                  <strong>${p.label}</strong>
                  <span class="mono">${p.score}</span>
                  <div class="bar"><span style=${`width:${p.score}%`}></span></div>
                </div>
              `,
            )}
          </div>
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
  const rows = await query<any[]>('getTimeline');
  return html`
    <div class="page">
      ${header('Sessions', 'Timeline of agent sessions across harnesses.')}
      <section class="panel">
        <table>
          <thead><tr><th>When</th><th>Workspace</th><th>Harness</th><th>Turns</th><th>Title</th></tr></thead>
          <tbody>
            ${rows.map(
              (r) => html`<tr>
                <td class="mono">${r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                <td>${r.workspaceName}</td>
                <td>${r.harness}</td>
                <td class="mono">${r.requestCount}</td>
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
      ${header('Moments', 'High-signal coding moments inferred from substantial AI edits.')}
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
  return html`
    <div class="page">
      ${header('Throughput', 'AI-generated code volume by language, model, and harness.')}
      <div class="banner ok">${data.estimateNote}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">AI LOC</div><div class="value mono">${data.aiLoc}</div></div>
        <div class="metric"><div class="label">User LOC</div><div class="value mono">${data.userLoc}</div></div>
      </div>
      <div class="grid-2">
        <section class="panel">
          <h2>By language</h2>
          <table>
            <tbody>
              ${Object.entries(data.byLanguage || {}).map(
                ([k, v]) => html`<tr><td>${k}</td><td class="mono">${v as number}</td></tr>`,
              )}
            </tbody>
          </table>
        </section>
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
    </div>
  `;
}

async function pageBudget() {
  const data = await query<any>('getBudget');
  return html`
    <div class="page">
      ${header('Budget', 'Local credit and token estimates for the selected range.', `${data.pct}% used`)}
      <div class="banner">${data.disclaimer}</div>
      <div class="metric-row">
        <div class="metric"><div class="label">Credits used</div><div class="value mono">${data.creditsUsed}</div></div>
        <div class="metric"><div class="label">Budget</div><div class="value mono">${data.budget}</div></div>
        <div class="metric"><div class="label">Remaining</div><div class="value mono">${data.remaining}</div></div>
        <div class="metric"><div class="label">USD est.</div><div class="value mono">$${data.usdEstimate}</div></div>
      </div>
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
      ${header('Rhythm', 'When you work with agents — heatmap and balance.', `Balance ${data.balanceScore}`)}
      <div class="metric-row">
        <div class="metric"><div class="label">Late-night</div><div class="value mono">${Math.round(data.lateNightRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Weekend</div><div class="value mono">${Math.round(data.weekendRatio * 100)}%</div></div>
        <div class="metric"><div class="label">Samples</div><div class="value mono">${data.total}</div></div>
      </div>
      <section class="panel">
        <h2>7×24 activity</h2>
        <div class="heatmap">
          ${data.heatmap.map(
            (row: number[], dow: number) => html`
              <div class="hm-label">${DOW[dow]}</div>
              ${row.map((v) => {
                const alpha = 0.08 + (v / max) * 0.85;
                return html`<div class="hm-cell" style=${`background: rgba(13,143,111,${alpha})`} title=${String(v)}></div>`;
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
      ${header('Inquiry', 'Curiosity and investigation patterns in your sessions.')}
      <div class="metric-row">
        <div class="metric"><div class="label">Inquiry sessions</div><div class="value mono">${data.inquirySessions}</div></div>
        <div class="metric"><div class="label">Questions</div><div class="value mono">${data.questionRequests}</div></div>
        <div class="metric"><div class="label">Investigations</div><div class="value mono">${data.investigationRequests}</div></div>
      </div>
      <section class="panel">
        <h2>Recent questions</h2>
        <div class="list">
          ${(data.topQuestions || []).map((q: string) => html`<article>${q}</article>`)}
        </div>
      </section>
    </div>
  `;
}

async function pageHabits() {
  const findings = await query<any[]>('getHabits');
  const triggered = findings.filter((f) => f.triggered);
  return html`
    <div class="page">
      ${header('Habits', 'Signals that help you refine agentic engineering practice.', `${triggered.length} active`)}
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
                (s) => html`<tr><td>${s.name}</td><td>${s.group}</td><td class="mono">${s.layer}</td></tr>`,
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
            </div>`
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
      ${header('Field Browser', 'Sample request fields for authoring signals.', `${data.count} rows`)}
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
  return html`
    <div class="page">
      ${header('Skill Match', 'Repeated prompts with draft SKILL.md you can copy and refine.')}
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
      ${header('Context Score', 'Agentic readiness of your prompting and instruction habits.', `Score ${data.score}`)}
      <section class="panel">
        <div class="score-list">
          ${data.checks.map(
            (c: any) => html`<div class="score-item">
              <strong>${c.label}</strong>
              <span class=${c.pass ? 'sev sev-low' : 'sev sev-medium'}>${c.pass ? 'pass' : 'gap'}</span>
              <div class="muted">Observed ${c.value}</div>
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
                      style="justify-self:start;border-radius:10px"
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
      ${header('Marks', 'XP and badges for consistent agentic craft.', data.tier)}
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
  return html`
    <div class="page">
      ${header('Lifecycle', 'How your AI turns distribute across the software lifecycle.')}
      <section class="panel">
        <table>
          <thead><tr><th>Phase</th><th>Requests</th></tr></thead>
          <tbody>
            ${Object.entries(data.phases || {}).map(
              ([k, v]) => html`<tr><td>${k}</td><td class="mono">${v as number}</td></tr>`,
            )}
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
      ${header('Snapshot', 'Export a shareable card and markdown/JSON summary.')}
      <section class="panel">
        <h2>${share.title}</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Sessions</div><div class="value mono">${share.sessions}</div></div>
          <div class="metric"><div class="label">Requests</div><div class="value mono">${share.requests}</div></div>
          <div class="metric"><div class="label">AI LOC</div><div class="value mono">${share.aiLoc}</div></div>
          <div class="metric"><div class="label">Score</div><div class="value mono">${share.practiceScore}</div></div>
        </div>
        <pre style="white-space:pre-wrap;margin-top:1rem;font-size:0.85rem;color:var(--ink-soft)">${data.markdown}</pre>
        <button
          class="btn"
          style="margin-top:1rem"
          onClick=${async () => {
            await rpc('copyMarkdown', {});
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

export function startUi() {
  paint();
  void refresh();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => startUi());
  // Auto-start when script loads after DOM ready (preview & webview).
  if (document.readyState !== 'loading') startUi();
}
