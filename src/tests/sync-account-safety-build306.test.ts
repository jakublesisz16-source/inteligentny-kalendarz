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
  resetLocalDatabaseForAccountSwitch,
} from '../storage/database';
import { SyncAccountChangedError, SyncAccountOwnershipError } from '../sync/sync-errors';
import { writeLocalSyncState } from '../sync/sync-config';
import { calculateSyncRevision, SyncService } from '../sync/sync-service';
import { sha256Hex } from '../core/sha256';
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

  it('refuses a cross-account switch when another tab answers the presence probe', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'A stays', startDateTime: '2026-10-04T09:00', endDateTime: '2026-10-04T10:00', category: 'OTHER' });
    let remoteReads = 0;
    const channelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
    class RespondingChannel {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(payload: unknown) {
        if ((payload as { type?: string })?.type === 'account-switch-probe') {
          queueMicrotask(() => this.onmessage?.({
            data: { type: 'account-switch-present', sourceTabId: 'other-real-tab', sentAt: Date.now(), nonce: 'test' },
          }));
        }
      }
      close() {}
    }
    Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: RespondingChannel });
    try {
      const service = new SyncService(provider({
        accountId: 'account-b',
        onReadRemote: () => { remoteReads++; },
      }));
      await expect(service.switchToCurrentAccount()).rejects.toThrow(/zamknij pozostałe karty/u);
      expect(remoteReads).toBe(0);
      expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
      expect((await listEvents()).map((item) => item.title)).toContain('A stays');
    } finally {
      if (channelDescriptor) Object.defineProperty(globalThis, 'BroadcastChannel', channelDescriptor);
      else delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    }
  });

  it('keeps A data and ownership if the new account manifest is reachable but cloud payload fails', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Dane konta A', startDateTime: '2026-10-25T09:00', endDateTime: '2026-10-25T10:00', category: 'OTHER' });
    const service = new SyncService(provider({
      accountId: 'account-b',
      remoteState: { revision: 'new-account-revision' },
      onPull: () => { throw new Error('Pobieranie pakietu Firebase przerwane'); },
    }));

    await expect(service.switchToCurrentAccount()).rejects.toThrow('Pobieranie pakietu Firebase przerwane');
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Dane konta A']);
  });

  it('keeps A if the target snapshot has a valid revision but invalid backup checksum', async () => {
    await createEvent({ title: 'Źródło chmurowe B', startDateTime: '2026-10-25T11:00', endDateTime: '2026-10-25T12:00', category: 'OTHER' });
    const cloud = await cloudEnvelopeFromCurrentDatabase('device-b');
    cloud.document = { ...cloud.document, checksum: 'uszkodzony-checksum' };
    await deleteDatabaseForTests();
    await initializeDatabase();
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Dane konta A', startDateTime: '2026-10-25T09:00', endDateTime: '2026-10-25T10:00', category: 'OTHER' });

    const service = new SyncService(provider({
      accountId: 'account-b',
      remoteState: { revision: cloud.revision },
      cloud,
    }));
    await expect(service.switchToCurrentAccount()).rejects.toThrow(/uszkodzony|zmieniony/);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Dane konta A']);
  });

  it('preloads B snapshot only once before destroying A and applies that same revision', async () => {
    await createEvent({ title: 'Dane B', startDateTime: '2026-10-25T11:00', endDateTime: '2026-10-25T12:00', category: 'OTHER' });
    const cloud = await cloudEnvelopeFromCurrentDatabase('device-b');
    await deleteDatabaseForTests();
    await initializeDatabase();
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Dane A', startDateTime: '2026-10-25T09:00', endDateTime: '2026-10-25T10:00', category: 'OTHER' });
    let pulls = 0;
    const service = new SyncService(provider({
      accountId: 'account-b',
      remoteState: { revision: cloud.revision },
      cloud,
      onPull: () => { pulls += 1; },
    }));
    expect((await service.switchToCurrentAccount()).phase).toBe('pulled');
    expect(pulls).toBe(1);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-b');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Dane B']);
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

  it('atomically preserves real IndexedDB A on an invalid B unique-index write', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'A chronione', startDateTime: '2026-10-26T08:00', endDateTime: '2026-10-26T09:00', category: 'OTHER' });
    const document = await createCanonicalDataTransferDocument();
    document.data.stores.availabilityPlans = [
      { id: 'plan-1', weekStart: '2026-10-26', status: 'DRAFT' },
      { id: 'plan-2', weekStart: '2026-10-26', status: 'DRAFT' },
    ];
    const { checksum: _checksum, ...unsigned } = document;
    document.checksum = await sha256Hex(JSON.stringify(unsigned));

    await expect(resetLocalDatabaseForAccountSwitch('account-b', document, 'account-a')).rejects.toThrow();
    expect(await readLocalSyncOwnerAccountId()).toBe('account-a');
    expect((await listEvents()).map((event) => event.title)).toEqual(['A chronione']);
  });

  it('atomically switches the real IndexedDB owner and data when B is valid', async () => {
    await createEvent({ title: 'Dane B 530', startDateTime: '2026-10-27T11:00', endDateTime: '2026-10-27T12:00', category: 'OTHER' });
    const document = await createCanonicalDataTransferDocument();
    await deleteDatabaseForTests();
    await initializeDatabase();
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Dane A 530', startDateTime: '2026-10-27T09:00', endDateTime: '2026-10-27T10:00', category: 'OTHER' });
    await resetLocalDatabaseForAccountSwitch('account-b', document, 'account-a');
    expect(await readLocalSyncOwnerAccountId()).toBe('account-b');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Dane B 530']);
  });

  it('rejects stale account B after a peer committed account C to IndexedDB', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Tylko A', startDateTime: '2026-10-29T09:00', endDateTime: '2026-10-29T10:00', category: 'OTHER' });
    const staleB = await createCanonicalDataTransferDocument();
    // The other tab commits C after this tab captured owner A and downloaded B.
    await resetLocalDatabaseForAccountSwitch('account-c', null, 'account-a');
    await createEvent({ title: 'Tylko C', startDateTime: '2026-10-30T09:00', endDateTime: '2026-10-30T10:00', category: 'OTHER' });
    await expect(resetLocalDatabaseForAccountSwitch('account-b', staleB, 'account-a')).rejects.toThrow(/Właściciel lokalnych danych/);
    expect(await readLocalSyncOwnerAccountId()).toBe('account-c');
    expect((await listEvents()).map((event) => event.title)).toEqual(['Tylko C']);
  });

  it('creates a fresh empty B with defaults without exposing any account A data', async () => {
    await claimLocalSyncOwnerAccountId('account-a');
    await createEvent({ title: 'Prywatne A', startDateTime: '2026-10-28T09:00', endDateTime: '2026-10-28T10:00', category: 'OTHER' });
    await resetLocalDatabaseForAccountSwitch('account-b', null, 'account-a');
    expect(await readLocalSyncOwnerAccountId()).toBe('account-b');
    expect(await listEvents()).toEqual([]);
    const document = await createCanonicalDataTransferDocument();
    expect(document.data.stores.settings).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'app' })]));
    expect(document.data.stores.expenseCategories?.length).toBeGreaterThan(0);
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
