import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEvent, deleteDatabaseForTests, initializeDatabase } from '../storage/database';
import { SyncRevisionMismatchError } from '../sync/sync-errors';
import { calculateSyncContentFingerprint, SyncService } from '../sync/sync-service';
import { FIRESTORE_SYNC_MAX_PAYLOAD_BYTES } from '../sync/providers/firebase-google-chunks';
import type { SyncProvider, SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

function cloudProvider(snapshot: SyncSnapshotEnvelope, pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }>): SyncProvider {
  return {
    id: 'build296-test-cloud',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'account-build296' }),
    signIn: async () => ({ id: 'account-build296' }),
    signOut: async () => undefined,
    pullLatest: async () => snapshot,
    pushSnapshot: async (next, expectedRevision = undefined) => {
      if (expectedRevision === undefined) pushes.push({ snapshot: next });
      else pushes.push({ snapshot: next, expectedRevision });
    },
  };
}

describe('Build296 sync revision stability and safe metadata repair', () => {
  it('keeps enough bounded headroom above the real Build295 snapshot size', () => {
    expect(FIRESTORE_SYNC_MAX_PAYLOAD_BYTES).toBe(24_000_000);
  });
  it('pre-establishes snapshot store keys before asynchronous IndexedDB reads resolve', () => {
    const database = readFileSync('src/storage/database.ts', 'utf8');
    expect(database).toContain('for (const name of available) stores[name] = [];');
    expect(database.indexOf('for (const name of available) stores[name] = [];'))
      .toBeLessThan(database.indexOf('await Promise.all(available.map(async (name) => {'));
  });

  it('uses an order-independent content fingerprint only for safe equivalence checks', async () => {
    await initializeDatabase();
    const service = new SyncService(cloudProvider({} as SyncSnapshotEnvelope, []));
    const snapshot = await service.captureLocalSnapshot('device-a');
    const reversedStores = Object.fromEntries(Object.entries(snapshot.document.data.stores).reverse());
    expect(await calculateSyncContentFingerprint(snapshot.document.data)).toBe(await calculateSyncContentFingerprint({
      ...snapshot.document.data,
      stores: reversedStores,
    }));
  });

  it('repairs only revision metadata when local and cloud logical content are identical', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Bezpieczny test', startDateTime: '2026-10-03T18:00', endDateTime: '2026-10-03T19:00', category: 'OTHER' });

    const seed = new SyncService(cloudProvider({} as SyncSnapshotEnvelope, []));
    const valid = await seed.captureLocalSnapshot('seed-device');
    const badRevision = '0'.repeat(64);
    const inconsistentCloud = { ...valid, revision: badRevision } satisfies SyncSnapshotEnvelope;
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(cloudProvider(inconsistentCloud, pushes));

    const result = await service.reconcile();
    expect(result.phase).toBe('pushed');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.expectedRevision).toBe(badRevision);
    expect(pushes[0]?.snapshot.revision).toBe(valid.revision);
  });

  it('does not overwrite a mismatched cloud snapshot when its logical content differs from local data', async () => {
    await initializeDatabase();
    const seed = new SyncService(cloudProvider({} as SyncSnapshotEnvelope, []));
    const valid = await seed.captureLocalSnapshot('seed-device');
    const inconsistentCloud = {
      ...valid,
      revision: 'f'.repeat(64),
      document: {
        ...valid.document,
        data: {
          ...valid.document.data,
          stores: {
            ...valid.document.data.stores,
            events: [{ id: 'cloud-only', title: 'Inna zawartość' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(cloudProvider(inconsistentCloud, pushes));

    await expect(service.reconcile()).rejects.toBeInstanceOf(SyncRevisionMismatchError);
    expect(pushes).toHaveLength(0);
  });
});
