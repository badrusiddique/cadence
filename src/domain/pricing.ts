/** Local spend pricing — analytical aid, not billing reconciliation. */

import { modelMultiplier, tokenRateFor } from './constants';
import type { SessionRequest } from './types';

/** 1 AI Credit = $0.01 (GitHub dollar-normalized unit). */
export const USD_PER_CREDIT = 0.01;

/** Pre-June-2026 Copilot premium-request overage. */
export const USD_PER_PREMIUM_REQUEST = 0.04;

export type CostProvenance = 'billed' | 'token-priced' | 'estimated';

export interface PricedRequest {
  credits: number;
  usd: number;
  provenance: CostProvenance;
  cacheReadUsd: number;
  cacheWriteUsd: number;
  /** What cache reads saved vs pricing the same tokens as fresh input. */
  cacheSavedUsd: number;
}

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Price one request.
 * Precedence: billed credits → premium requests → tokens × rate → model-multiplier estimate.
 */
export function priceRequest(r: SessionRequest): PricedRequest {
  if (finite(r.billedCredits) && (r.billedCredits as number) > 0) {
    const credits = r.billedCredits as number;
    return {
      credits,
      usd: credits * USD_PER_CREDIT,
      provenance: 'billed',
      cacheReadUsd: 0,
      cacheWriteUsd: 0,
      cacheSavedUsd: 0,
    };
  }

  if (finite(r.premiumRequests) && (r.premiumRequests as number) > 0) {
    const usd = (r.premiumRequests as number) * USD_PER_PREMIUM_REQUEST;
    return {
      credits: usd / USD_PER_CREDIT,
      usd,
      provenance: 'billed',
      cacheReadUsd: 0,
      cacheWriteUsd: 0,
      cacheSavedUsd: 0,
    };
  }

  const input = r.promptTokens;
  const output = r.completionTokens;
  const cached = r.cacheReadTokens;
  const write = r.cacheWriteTokens;
  const hasTokens = [input, output, cached, write].some((v) => finite(v) && (v as number) > 0);

  if (hasTokens) {
    const rate = tokenRateFor(r.modelId || '');
    const M = 1e6;
    const fresh = Math.max(0, input ?? 0);
    const cacheRead = Math.max(0, cached ?? 0);
    const cacheWrite = Math.max(0, write ?? 0);
    const out = Math.max(0, output ?? 0);
    const cacheWriteRate = rate.cacheWrite ?? rate.input;

    const usd =
      (fresh / M) * rate.input +
      (cacheRead / M) * rate.cached +
      (cacheWrite / M) * cacheWriteRate +
      (out / M) * rate.output;

    const cacheReadUsd = (cacheRead / M) * rate.cached;
    const cacheWriteUsd = (cacheWrite / M) * cacheWriteRate;
    const cacheSavedUsd = (cacheRead / M) * Math.max(0, rate.input - rate.cached);

    return {
      credits: usd / USD_PER_CREDIT,
      usd,
      provenance: 'token-priced',
      cacheReadUsd,
      cacheWriteUsd,
      cacheSavedUsd,
    };
  }

  const credits = modelMultiplier(r.modelId || 'auto');
  return {
    credits,
    usd: credits * USD_PER_CREDIT,
    provenance: 'estimated',
    cacheReadUsd: 0,
    cacheWriteUsd: 0,
    cacheSavedUsd: 0,
  };
}
