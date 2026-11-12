import { describe, expect, it } from 'vitest';
import { priceRequest, USD_PER_CREDIT, USD_PER_PREMIUM_REQUEST } from './pricing';
import { emptyRequest } from './types';

describe('priceRequest', () => {
  it('prefers billed credits over tokens', () => {
    const r = emptyRequest({
      requestId: '1',
      modelId: 'gpt-5.2',
      billedCredits: 2.5,
      promptTokens: 100000,
      completionTokens: 100000,
    });
    const p = priceRequest(r);
    expect(p.provenance).toBe('billed');
    expect(p.credits).toBe(2.5);
    expect(p.usd).toBeCloseTo(2.5 * USD_PER_CREDIT, 6);
  });

  it('converts premium requests to credits', () => {
    const r = emptyRequest({
      requestId: '2',
      modelId: 'auto',
      premiumRequests: 3,
    });
    const p = priceRequest(r);
    expect(p.provenance).toBe('billed');
    expect(p.credits).toBeCloseTo((3 * USD_PER_PREMIUM_REQUEST) / USD_PER_CREDIT, 6);
  });

  it('prices exact tokens when no billed units', () => {
    const r = emptyRequest({
      requestId: '3',
      modelId: 'claude-sonnet-4.5',
      promptTokens: 1_000_000,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    const p = priceRequest(r);
    expect(p.provenance).toBe('token-priced');
    expect(p.usd).toBeCloseTo(3.0, 4);
    expect(p.credits).toBeCloseTo(3.0 / USD_PER_CREDIT, 4);
  });

  it('falls back to model-multiplier estimate', () => {
    const r = emptyRequest({
      requestId: '4',
      modelId: 'claude-opus-4.5',
    });
    const p = priceRequest(r);
    expect(p.provenance).toBe('estimated');
    expect(p.credits).toBe(3);
    expect(p.usd).toBeCloseTo(3 * USD_PER_CREDIT, 6);
  });

  it('computes cache economics buckets', () => {
    const r = emptyRequest({
      requestId: '5',
      modelId: 'claude-sonnet-4.5',
      promptTokens: 100_000,
      cacheReadTokens: 900_000,
      cacheWriteTokens: 50_000,
      completionTokens: 10_000,
    });
    const p = priceRequest(r);
    expect(p.cacheReadUsd).toBeGreaterThan(0);
    expect(p.cacheWriteUsd).toBeGreaterThan(0);
    expect(p.cacheSavedUsd).toBeGreaterThan(0);
  });
});
