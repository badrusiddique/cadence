import { describe, expect, it } from 'vitest';
import { approve, hashContent, isApproved, listApproved, type TrustStore } from './trust';

function memoryStore(): TrustStore {
  const map = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue: T): T {
      return (map.has(key) ? map.get(key) : defaultValue) as T;
    },
    async update(key: string, value: unknown) {
      map.set(key, value);
    },
  };
}

describe('signal trust', () => {
  it('approves exact content hashes and revokes on edit', async () => {
    const store = memoryStore();
    const file = '/tmp/demo.signal.md';
    const content = 'hello';
    expect(isApproved(store, file, content)).toBe(false);
    await approve(store, file, content);
    expect(isApproved(store, file, content)).toBe(true);
    expect(isApproved(store, file, content + '!')).toBe(false);
    const entry = Object.values(listApproved(store))[0];
    expect(entry?.hash).toBe(hashContent(content));
  });
});
