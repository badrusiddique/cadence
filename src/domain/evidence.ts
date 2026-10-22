/**
 * Evidence provenance — inspired by REA’s observed / derived / inferred discipline.
 * Cadence uses this so agents and UI never confuse raw session facts with scores.
 */

export type EvidenceState = 'observed' | 'derived' | 'inferred' | 'unknown';
export type EvidenceConfidence = 'exact' | 'high' | 'medium' | 'low' | 'unknown';
export type EvidenceAuthority = 'session-log' | 'fixture' | 'signal-engine' | 'estimate' | 'user-config';

export interface EvidenceMeta {
  state: EvidenceState;
  confidence: EvidenceConfidence;
  authority: EvidenceAuthority;
  limitations?: string[];
}

export function observed(authority: EvidenceAuthority = 'session-log'): EvidenceMeta {
  return { state: 'observed', confidence: 'exact', authority };
}

export function derived(authority: EvidenceAuthority = 'signal-engine', limitations: string[] = []): EvidenceMeta {
  return { state: 'derived', confidence: 'high', authority, limitations };
}

export function estimated(limitations: string[] = ['Local estimate only — not billing.']): EvidenceMeta {
  return { state: 'inferred', confidence: 'medium', authority: 'estimate', limitations };
}
