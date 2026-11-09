import { describe, expect, it } from 'vitest';
import { buildSafePredicate } from './predicate';

describe('buildSafePredicate', () => {
  const row = {
    messageLength: 12,
    aiLoc: 90,
    toolCount: 1,
    isCanceled: false,
    workType: 'test',
    harness: 'Cursor',
  };

  it('evaluates comparisons and boolean logic without Function', () => {
    expect(buildSafePredicate('messageLength < 30 AND messageLength > 0')(row)).toBe(true);
    expect(buildSafePredicate('aiLoc > 80 AND toolCount < 2')(row)).toBe(true);
    expect(buildSafePredicate('isCanceled == true')(row)).toBe(false);
    expect(buildSafePredicate('workType == "test" OR workType == "docs"')(row)).toBe(true);
    expect(buildSafePredicate('(aiLoc > 100) OR (toolCount == 1)')(row)).toBe(true);
  });

  it('rejects unsafe characters and free JS', () => {
    expect(() => buildSafePredicate('messageLength; process.exit(1)')).toThrow();
    expect(() => buildSafePredicate('constructor.constructor("return 1")()')).toThrow();
    expect(() => buildSafePredicate('foo()')).toThrow();
    expect(() => buildSafePredicate('a[0] == 1')).toThrow();
  });
});
