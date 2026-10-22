/** Pricing and scoring constants for local estimates (not billing). */

export const MODEL_MULTIPLIERS: Record<string, number> = {
  'gpt-4.1': 0,
  'gpt-4.1-mini': 0,
  'gpt-5-mini': 0,
  'gpt-5.1': 1,
  'gpt-5.2': 1,
  'gpt-5.4': 1,
  'gpt-5.4-mini': 0.33,
  'claude-sonnet-4': 1,
  'claude-sonnet-4.5': 1,
  'claude-sonnet-4.6': 1,
  'claude-opus-4.5': 3,
  'claude-opus-4.6': 3,
  'claude-haiku-4.5': 0.33,
  'gemini-2.5-pro': 1,
  'gemini-3-flash': 0.33,
  'gemini-3-pro': 1,
  'grok-code-fast-1': 0.25,
  auto: 1,
};

export interface TokenRate {
  input: number;
  cached: number;
  output: number;
  cacheWrite?: number;
}

export const MODEL_TOKEN_RATES: Record<string, TokenRate> = {
  'gpt-4.1': { input: 2.0, cached: 0.5, output: 8.0 },
  'gpt-5.1': { input: 1.75, cached: 0.175, output: 14.0 },
  'gpt-5.2': { input: 1.75, cached: 0.175, output: 14.0 },
  'gpt-5.4': { input: 2.5, cached: 0.25, output: 15.0 },
  'claude-haiku-4.5': { input: 1.0, cached: 0.1, output: 5.0, cacheWrite: 1.25 },
  'claude-sonnet-4.5': { input: 3.0, cached: 0.3, output: 15.0, cacheWrite: 3.75 },
  'claude-opus-4.6': { input: 5.0, cached: 0.5, output: 25.0, cacheWrite: 6.25 },
  'gemini-2.5-pro': { input: 1.25, cached: 0.125, output: 10.0 },
  'gemini-3-pro': { input: 2.0, cached: 0.2, output: 12.0 },
};

export const SKU_AI_CREDITS: Record<string, number> = {
  pro: 1000,
  'pro-plus': 3900,
  business: 1900,
  enterprise: 3900,
};

export const LATE_NIGHT_START = 22;
export const LATE_NIGHT_END = 5;
export const FLOW_RAPID_FOLLOWUP_SEC = 30;
export const FLOW_BLOCK_GAP_MIN = 15;
export const FLOW_SESSION_MIN_REQS = 3;
export const FLOW_DEEP_SCORE = 75;
export const FLOW_MODERATE_SCORE = 55;
export const FLOW_SHALLOW_SCORE = 35;
export const LONG_SESSION_REQS = 30;

export const PRACTICE_LABELS: Record<string, string> = {
  'prompt-quality': 'Prompt Craft',
  'session-hygiene': 'Session Hygiene',
  'code-review': 'Review Discipline',
  'tool-mastery': 'Tool Mastery',
  'context-management': 'Context Stewardship',
};

export function modelMultiplier(modelId: string): number {
  const key = Object.keys(MODEL_MULTIPLIERS).find((k) => modelId.toLowerCase().includes(k));
  return key ? MODEL_MULTIPLIERS[key] : 1;
}

export function tokenRateFor(modelId: string): TokenRate {
  const key = Object.keys(MODEL_TOKEN_RATES).find((k) => modelId.toLowerCase().includes(k));
  return key ? MODEL_TOKEN_RATES[key] : { input: 2.0, cached: 0.2, output: 10.0 };
}
