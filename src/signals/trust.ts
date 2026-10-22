import { createHash } from 'crypto';
import * as path from 'path';

/** Minimal storage surface (VS Code Memento or Map-backed test fake). */
export interface TrustStore {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export interface ApprovedEntry {
  hash: string;
  approvedAt: number;
}

export type ApprovalMap = Record<string, ApprovedEntry>;

const STORAGE_KEY = 'cadence.signalTrust.v1';

export interface PendingSignal {
  filePath: string;
  layer: 'personal' | 'project';
  content: string;
  hash: string;
}

const pending: PendingSignal[] = [];

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function canonicalApprovalKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function listApproved(store: TrustStore): ApprovalMap {
  return { ...store.get<ApprovalMap>(STORAGE_KEY, {}) };
}

export function isApproved(store: TrustStore, filePath: string, content: string): boolean {
  const approvals = listApproved(store);
  const entry = approvals[canonicalApprovalKey(filePath)] ?? approvals[filePath];
  return Boolean(entry && entry.hash === hashContent(content));
}

export async function approve(store: TrustStore, filePath: string, content: string): Promise<void> {
  const approvals = listApproved(store);
  approvals[canonicalApprovalKey(filePath)] = {
    hash: hashContent(content),
    approvedAt: Date.now(),
  };
  await store.update(STORAGE_KEY, approvals);
  clearPending(filePath);
}

export async function revoke(store: TrustStore, filePath: string): Promise<void> {
  const approvals = listApproved(store);
  delete approvals[canonicalApprovalKey(filePath)];
  delete approvals[filePath];
  await store.update(STORAGE_KEY, approvals);
}

export function getPending(): PendingSignal[] {
  return [...pending];
}

export function clearPending(filePath?: string): void {
  if (!filePath) {
    pending.length = 0;
    return;
  }
  const key = canonicalApprovalKey(filePath);
  for (let i = pending.length - 1; i >= 0; i--) {
    if (canonicalApprovalKey(pending[i].filePath) === key) pending.splice(i, 1);
  }
}

export function queuePending(entry: PendingSignal): void {
  clearPending(entry.filePath);
  pending.push(entry);
}
