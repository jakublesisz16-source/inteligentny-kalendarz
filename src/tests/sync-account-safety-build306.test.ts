import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyCloudSyncSnapshot,
  claimLocalSyncOwnerAccountId,
  createCanonicalDataTransferDocument,
  createEvent,
  deleteDatabaseForTests,
  initializeDatabase,
  listEvents,
  readLocalSyncOwnerAccountId,
} from '../storage/database';
import { SyncAccountChangedError, SyncAccountOwnershipError } from '../sync/sync-errors';
import { writeLocalSyncState } from '../sync/sync-config';
import { calculateSyncRevision, SyncService } from '../sync/sync-service';
import type { SyncProvider, SyncRemoteState, SyncSnapshotEnvelope } from '../sync/sync.types';

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
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: target as unknown as Window,
  });
}

beforeEach(async () => {
  await deleteDatabaseForTests();
  installTestWindow();
  await initializeDatabase();
});

afterEach(async () => {
  await deleteDatabaseForTests();
  if (originalWindowDescriptor) Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  else delete (globalThis as { window?: Window }).window;
});

function provider(input: {
  accountId: string;
  remoteState?: SyncRemoteState | null;
  cloud?: SyncSnapshotEnvelope | null;
  onReadRemote?: () => void;
  onPull?: () => void;
  onPush?: () => void;
  getAccount?: () => Promise<{ id: string } | null>;
}): SyncProvider {
  return {
    id: 'build306-cloud',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: input.getAccount ?? (async () => ({ id: input.accountId })),
    signIn: async () => ({ id: input.accountId }),
    signOut: async () => undefined,
    readRemoteState: async () => {
      input.onReadRemote?.();
      return input.remoteState ?? null;
    },
    pullLatest: async () => {
      input.onPull?.();
      return input.cloud ?? null;
    },
    pushSnapshot: async (snapshot) => {
      input.onPush?.();
      return { revision: snapshot.revision, payloadSha256: `sha-${snapshot.revision.slice(0, 8)}` };
    },
  };
}

async function cloudEnvelopeFromCurrentDatabase(sourceDeviceId = 'cloud-device'): Promise<SyncSnapshotEnvelope> {
  const document = await createCanonicalDataTransferDocument();
  return {
    format: 'inteligentny-kalendarz-sync-snapshot',
    version: 1,
    revision: await calculateSyncRevision(document.data),
    updatedAt: document.createdAt,
    sourceDeviceId,
    document,
  };
}

describe('Build306-308 account safety and bounded Firestore polling', () => {
  it('keeps ownerAccountId local-only and preserves it across a cloud apply', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'A', startDateTime: '2026-10-04T09:00', endDateTime: '2026-10-04T10:00', category: 'OTHER' });
    const document = await createCanonicalDataTransferDocument();
    const metaRows = document.data.stores.meta as Array<{ key?: string }>;

    expect(metaRows.some((row) => row.key === 'sync.ownerAccountId.v1')).toBe(false);
    await applyCloudSyncSnapshot(document);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
  });

  it('blocks A to B before any remote read or write', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    let reads = 0;
    let pushes = 0;
    const service = new SyncService(provider({
      accountId: 'account-b',
      onReadRemote: () => { reads += 1; },
      onPush: () => { pushes += 1; },
    }));

    await expect(service.reconcile()).rejects.toBeInstanceOf(SyncAccountOwnershipError);
    expect(reads).toBe(0);
    expect(pushes).toBe(0);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
  });

  it('explicit account switch clears A locally and pulls B after a successful cloud preflight', async () => {
    await createEvent({ title: 'Dane B', startDateTime: '2026-10-04T11:00', endDateTime: '2026-10-04T12:00', category: 'OTHER' });
    const cloud = await cloudEnvelopeFromCurrentDatabase('device-b');
    const remoteState = { revision: cloud.revision, payloadSha256: 'sha-b', updatedAt: cloud.updatedAt };

    await deleteDatabaseForTests();
    await initializeDatabase();
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Dane A', startDateTime: '2026-10-04T08:00', endDateTime: '2026-10-04T09:00', category: 'OTHER' });

    const service = new SyncService(provider({ accountId: 'account-b', remoteState, cloud }));
    const result = await service.switchToCurrentAccount();

    expect(result.phase).toBe('pulled');
    expect(await readLocalSyncOwnerAccountId()).toBe('account-b');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Dane B']);
  });

  it('uses only the manifest when local revision and remote revision/SHA are unchanged', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Bez zmian', startDateTime: '2026-10-04T13:00', endDateTime: '2026-10-04T14:00', category: 'OTHER' });
    const seedService = new SyncService(provider({ accountId: 'account-a' }));
    const local = await seedService.captureLocalSnapshot('seed');
    writeLocalSyncState({
      providerId: 'build306-cloud',
      accountId: 'account-a',
      lastSyncedRevision: local.revision,
      lastSyncedAt: '2026-10-04T12:00:00.000Z',
      lastRemotePayloadSha256: 'sha-stable',
    });
    let pulls = 0;
    let pushes = 0;
    const service = new SyncService(provider({
      accountId: 'account-a',
      remoteState: { revision: local.revision, payloadSha256: 'sha-stable' },
      cloud: local,
      onPull: () => { pulls += 1; },
      onPush: () => { pushes += 1; },
    }));

    const result = await service.reconcile();
    expect(result.phase).toBe('synced');
    expect(pulls).toBe(0);
    expect(pushes).toBe(0);
  });

  it('fails closed when the authenticated account changes during a push', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    let switched = false;
    const service = new SyncService(provider({
      accountId: 'account-a',
      remoteState: null,
      getAccount: async () => ({ id: switched ? 'account-b' : 'account-a' }),
      onPush: () => { switched = true; },
    }));

    await expect(service.reconcile()).rejects.toBeInstanceOf(SyncAccountChangedError);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
  });

  it('keeps cleanup and multi-tab traffic bounded by source contracts', () => {
    const firebase = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    const coordinator = readFileSync('src/sync/SyncCoordinator.tsx', 'utf8');
    const database = readFileSync('src/storage/database.ts', 'utf8');

    expect(firebase).toContain('const CHUNK_CLEANUP_DELETE_BUDGET = 12;');
    expect(firebase).toContain('withCrossTabSyncWriteLock');
    expect(firebase).toContain('readRemoteStateAndCache');
    expect(firebase).toContain('nextIndex');
    expect(coordinator).toContain("coordinator.announce('local-change')");
    expect(coordinator).toContain('AUTO_SYNC_INTERVAL_MS = 60_000');
    expect(coordinator).toContain('LOCAL_CHANGE_DEBOUNCE_MS = 2_500');
    expect(coordinator).toContain("document.visibilityState !== 'visible'");
    expect(database).toContain("const LOCAL_SYNC_OWNER_META_KEY = 'sync.ownerAccountId.v1';");
    expect(database).toContain('snapshotStoreRows');
  });
});
