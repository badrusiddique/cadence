/** Core domain types for Cadence session analytics. */

export interface CodeBlock {
  language: string;
  lineCount: number;
  filePath?: string;
}

export interface TodoItem {
  id: number;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed';
}

export interface CompactionEvent {
  mode: 'full' | 'simple';
  contextLengthBefore: number;
  durationMs: number;
  model: string;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens?: number;
}

export type ReasoningEffort = 'max' | 'high' | 'medium' | 'low';

export interface SessionRequest {
  requestId: string;
  timestamp: number | null;
  messageText: string;
  responseText: string;
  isCanceled: boolean;
  agentName: string;
  agentMode: string;
  modelId: string;
  toolsUsed: string[];
  editedFiles: string[];
  referencedFiles: string[];
  slashCommand: string;
  variableKinds: Record<string, number>;
  customInstructions: string[];
  skillsUsed: string[];
  firstProgress: number | null;
  totalElapsed: number | null;
  messageLength: number;
  responseLength: number;
  userCode: CodeBlock[];
  aiCode: CodeBlock[];
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  compaction: CompactionEvent | null;
  todoSnapshot: TodoItem[] | null;
  workType: string;
  reasoningEffort?: ReasoningEffort | null;
  endState?: 'completed' | 'canceled' | 'error' | 'pending';
  isAllCaps?: boolean;
  hasProfanity?: boolean;
}

export interface Session {
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceRootPath?: string;
  harness: string;
  startedAt: number | null;
  endedAt: number | null;
  requestCount: number;
  requests: SessionRequest[];
  modelUsage?: Record<string, ModelUsage>;
  title?: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export type EditLocIndex = Map<string, Map<string, { added: number; removed: number }>>;

export interface DateFilter {
  fromDate?: string;
  toDate?: string;
  workspaceId?: string;
  harness?: string;
}

export type PracticeGroup =
  | 'prompt-quality'
  | 'session-hygiene'
  | 'code-review'
  | 'tool-mastery'
  | 'context-management';

export type Severity = 'low' | 'medium' | 'high';

export interface HabitFinding {
  id: string;
  name: string;
  group: PracticeGroup;
  severity: Severity;
  triggered: boolean;
  count: number;
  total: number;
  pct: number;
  message: string;
  improvement: string;
  examples: string[];
  /** Provenance — derived from session rows via SignalSpec (not a raw log field). */
  evidence?: {
    state: 'derived';
    confidence: 'high' | 'medium';
    authority: 'signal-engine';
  };
}

export interface PracticeScore {
  group: PracticeGroup;
  label: string;
  score: number;
  previousScore: number | null;
  findings: HabitFinding[];
}

export interface DailyActivity {
  date: string;
  requests: number;
  sessions: number;
  aiLoc: number;
  userLoc: number;
  harnesses: Record<string, number>;
}

export interface IngestResult {
  sessions: Session[];
  workspaces: Map<string, Workspace>;
  editLocIndex: EditLocIndex;
  sources: string[];
  errors: Array<{ source: string; message: string }>;
}

export function emptyRequest(partial: Partial<SessionRequest> & Pick<SessionRequest, 'requestId'>): SessionRequest {
  return {
    timestamp: null,
    messageText: '',
    responseText: '',
    isCanceled: false,
    agentName: '',
    agentMode: '',
    modelId: '',
    toolsUsed: [],
    editedFiles: [],
    referencedFiles: [],
    slashCommand: '',
    variableKinds: {},
    customInstructions: [],
    skillsUsed: [],
    firstProgress: null,
    totalElapsed: null,
    messageLength: 0,
    responseLength: 0,
    userCode: [],
    aiCode: [],
    promptTokens: null,
    completionTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    compaction: null,
    todoSnapshot: null,
    workType: 'unknown',
    ...partial,
  };
}

export function emptySession(partial: Partial<Session> & Pick<Session, 'sessionId' | 'workspaceId' | 'workspaceName' | 'harness'>): Session {
  const requests = partial.requests ?? [];
  return {
    startedAt: requests[0]?.timestamp ?? null,
    endedAt: requests[requests.length - 1]?.timestamp ?? null,
    requestCount: requests.length,
    requests,
    ...partial,
  };
}
