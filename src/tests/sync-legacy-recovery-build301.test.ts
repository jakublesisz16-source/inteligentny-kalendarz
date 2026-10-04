import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEvent, deleteDatabaseForTests, initializeDatabase } from '../storage/database';
import { SyncPayloadHashMismatchError } from '../sync/sync-errors';
import {
  calculateSyncContentFingerprint,
  calculateSyncRecoveryFingerprint,
  listSyncRecoveryStoreDifferences,
  SyncService,
} from '../sync/sync-service';
import type { SyncProvider, SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

function throwingCloudProvider(
  error: Error,
  pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }>,
): SyncProvider {
  return {
    id: 'build301-test-cloud',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'account-build301' }),
    signIn: async () => ({ id: 'account-build301' }),
    signOut: async () => undefined,
    pullLatest: async () => { throw error; },
    pushSnapshot: async (snapshot, expectedRevision = undefined) => {
      if (expectedRevision === undefined) pushes.push({ snapshot });
      else pushes.push({ snapshot, expectedRevision });
    },
  };
}

function seedProvider(): SyncProvider {
  return {
    id: 'seed-build301',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'seed' }),
    signIn: async () => ({ id: 'seed' }),
    signOut: async () => undefined,
    pullLatest: async () => null,
    pushSnapshot: async () => undefined,
  };
}

describe('Build301 bounded legacy chunks-v1 recovery', () => {
  it('treats changeJournal as recovery-only technical history while strict fingerprint still detects it', async () => {
    await initializeDatabase();
    const service = new SyncService(seedProvider());
    const local = await service.captureLocalSnapshot('local-device');
    const cloud = {
      ...local,
      document: {
        ...local.document,
        data: {
          ...local.document.data,
          stores: {
            ...local.document.data.stores,
            changeJournal: [{ id: 'legacy-cloud-history-only' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;

    expect(await calculateSyncContentFingerprint(local.document.data))
      .not.toBe(await calculateSyncContentFingerprint(cloud.document.data));
    expect(await calculateSyncRecoveryFingerprint(local.document.data))
      .toBe(await calculateSyncRecoveryFingerprint(cloud.document.data));
    expect(listSyncRecoveryStoreDifferences(local.document.data, cloud.document.data)).toEqual([]);
  });

  it('self-heals a parseable legacy payload mismatch when only changeJournal differs', async () => {
    await initializeDatabase();
    await createEvent({
      title: 'Bezpieczny test Build301',
      startDateTime: '2026-10-03T18:00',
      endDateTime: '2026-10-03T19:00',
      category: 'OTHER',
    });

    const seed = new SyncService(seedProvider());
    const local = await seed.captureLocalSnapshot('local-device');
    const cloudCandidate = {
      ...local,
      document: {
        ...local.document,
        data: {
          ...local.document.data,
          stores: {
            ...local.document.data.stores,
            changeJournal: [{ id: 'different-legacy-history' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;

    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '1'.repeat(64), '2'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(throwingCloudProvider(mismatch, pushes));

    const result = await service.reconcile();
    expect(result.phase).toBe('pushed');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.expectedRevision).toBe(cloudCandidate.revision);
    expect(pushes[0]?.snapshot.document.data.stores.events).toEqual(local.document.data.stores.events);
  });

  it('remains fail-closed and exposes a recovery-required state when real data differs', async () => {
    await initializeDatabase();
    const seed = new SyncService(seedProvider());
    const local = await seed.captureLocalSnapshot('local-device');
    const cloudCandidate = {
      ...local,
      document: {
        ...local.document,
        data: {
          ...local.document.data,
          stores: {
            ...local.document.data.stores,
            events: [{ id: 'cloud-only', title: 'Inna zawartość' }],
            changeJournal: [{ id: 'also-different-history' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;

    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '1'.repeat(64), '2'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(throwingCloudProvider(mismatch, pushes));

    const result = await service.reconcile();
    expect(result.phase).toBe('recovery-required');
    if (result.phase === 'recovery-required') expect(result.recovery.differingStores).toContain('events');
    expect(listSyncRecoveryStoreDifferences(local.document.data, cloudCandidate.document.data)).toContain('events');
    expect(pushes).toHaveLength(0);
  });
});
