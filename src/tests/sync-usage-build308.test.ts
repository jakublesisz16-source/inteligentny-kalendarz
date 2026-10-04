import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  isSyncUsageSoftWarning,
  readLocalSyncUsage,
  recordLocalSyncUsage,
  SYNC_USAGE_SOFT_DELETE_WARNING,
  SYNC_USAGE_SOFT_READ_WARNING,
  SYNC_USAGE_SOFT_WRITE_WARNING,
} from '../sync/sync-usage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function installTestWindow(): void {
  const target = new EventTarget();
  Object.defineProperty(target, 'localStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: target as unknown as Window,
  });
}

beforeEach(() => installTestWindow());

afterEach(() => {
  if (originalWindowDescriptor) Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  else delete (globalThis as { window?: Window }).window;
});

describe('Build308 sync diagnostics and quota guard', () => {
  it('accumulates local operation counters without network work', () => {
    recordLocalSyncUsage('firebase-google', 'account-a', {
      firestoreReads: 1,
      manifestChecks: 1,
      payloadBytes: 1_260_000,
      chunkCount: 3,
    });
    recordLocalSyncUsage('firebase-google', 'account-a', {
      firestoreReads: 3,
      chunkReads: 3,
      firestoreWrites: 4,
      chunkWrites: 3,
      firestoreDeletes: 2,
      lastPushAt: '2026-10-04T15:00:00.000Z',
      lastPullAt: '2026-10-04T15:01:00.000Z',
    });

    const usage = readLocalSyncUsage('firebase-google', 'account-a');
    expect(usage.firestoreReads).toBe(4);
    expect(usage.firestoreWrites).toBe(4);
    expect(usage.firestoreDeletes).toBe(2);
    expect(usage.manifestChecks).toBe(1);
    expect(usage.chunkReads).toBe(3);
    expect(usage.chunkWrites).toBe(3);
    expect(usage.payloadBytes).toBe(1_260_000);
    expect(usage.chunkCount).toBe(3);
    expect(usage.lastPushAt).toBe('2026-10-04T15:00:00.000Z');
    expect(usage.lastPullAt).toBe('2026-10-04T15:01:00.000Z');
  });

  it('uses conservative soft warnings without blocking synchronization', () => {
    const base = readLocalSyncUsage('firebase-google', 'account-a');
    expect(isSyncUsageSoftWarning(base)).toBe(false);
    expect(isSyncUsageSoftWarning({ ...base, firestoreReads: SYNC_USAGE_SOFT_READ_WARNING })).toBe(true);
    expect(isSyncUsageSoftWarning({ ...base, firestoreWrites: SYNC_USAGE_SOFT_WRITE_WARNING })).toBe(true);
    expect(isSyncUsageSoftWarning({ ...base, firestoreDeletes: SYNC_USAGE_SOFT_DELETE_WARNING })).toBe(true);
  });

  it('keeps the slower Build308 cadence and zero-cost diagnostics source contract', () => {
    const coordinator = readFileSync('src/sync/SyncCoordinator.tsx', 'utf8');
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    const settings = readFileSync('src/sync/SyncSettingsPanel.tsx', 'utf8');

    expect(coordinator).toContain('AUTO_SYNC_INTERVAL_MS = 60_000');
    expect(coordinator).toContain('LOCAL_CHANGE_DEBOUNCE_MS = 2_500');
    expect(provider).toContain('recordLocalSyncUsage');
    expect(provider).toContain('manifestChecks: 1');
    expect(provider).toContain('firestoreDeletes: deletedCount');
    expect(settings).toContain('Diagnostyka synchronizacji');
    expect(settings).toContain('Sprawdzanie chmury co 60 s');
    expect(settings).toContain('nie zastępują panelu Firebase');
  });
});
