import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEvent, deleteDatabaseForTests, initializeDatabase } from '../storage/database';
import { SyncPayloadHashMismatchError } from '../sync/sync-errors';
import { SyncService } from '../sync/sync-service';
import type { SyncProvider, SyncRecoveryConflict, SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

function seedProvider(): SyncProvider {
  return {
    id: 'seed-build302',
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

function damagedProvider(
  mismatch: SyncPayloadHashMismatchError,
  pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }>,
): SyncProvider {
  return {
    id: 'build302-cloud',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'account-build302' }),
    signIn: async () => ({ id: 'account-build302' }),
    signOut: async () => undefined,
    pullLatest: async () => { throw mismatch; },
    pushSnapshot: async (snapshot, expectedRevision = undefined) => {
      if (expectedRevision === undefined) pushes.push({ snapshot });
      else pushes.push({ snapshot, expectedRevision });
    },
  };
}

describe('Build302 explicit source-of-truth recovery', () => {
  it('returns a recoverable conflict instead of overwriting substantive user-data differences', async () => {
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
            events: [{ id: 'cloud-plan', title: 'Inny plan' }],
            studyProfile: [{ id: 'university', selectedGroups: ['MAIN:9'] }],
            universityImportEntries: [{ id: 'entry-cloud' }],
            universityImports: [{ id: 'import-cloud' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;
    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '1'.repeat(64), '2'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(damagedProvider(mismatch, pushes));

    const result = await service.reconcile();
    expect(result.phase).toBe('recovery-required');
    if (result.phase !== 'recovery-required') throw new Error('Expected recovery-required');
    expect(result.recovery.differingStores).toEqual(expect.arrayContaining([
      'events', 'studyProfile', 'universityImportEntries', 'universityImports',
    ]));
    expect(pushes).toHaveLength(0);
  });

  it('replaces the exact damaged cloud only after an explicit local-source decision', async () => {
    await initializeDatabase();
    await createEvent({
      title: 'Plan z tego urządzenia',
      startDateTime: '2026-10-05T12:00',
      endDateTime: '2026-10-05T15:45',
      category: 'STUDY',
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
            events: [{ id: 'stale-cloud-plan', title: 'Stary plan' }],
          },
        },
      },
    } satisfies SyncSnapshotEnvelope;
    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '3'.repeat(64), '4'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(damagedProvider(mismatch, pushes));

    const detected = await service.reconcile();
    expect(detected.phase).toBe('recovery-required');
    if (detected.phase !== 'recovery-required') throw new Error('Expected recovery-required');

    const resolved = await service.replaceDamagedCloudWithLocal(detected.recovery);
    expect(resolved.phase).toBe('pushed');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.expectedRevision).toBe(cloudCandidate.revision);
    expect(pushes[0]?.snapshot.revision).toBe(local.revision);
    expect(pushes[0]?.snapshot.document.data.stores.events).toEqual(local.document.data.stores.events);
  });

  it('refuses a stale confirmation when the damaged remote payload changed after the user reviewed it', async () => {
    await initializeDatabase();
    const seed = new SyncService(seedProvider());
    const local = await seed.captureLocalSnapshot('local-device');
    const firstCandidate = {
      ...local,
      document: { ...local.document, data: { ...local.document.data, stores: { ...local.document.data.stores, events: [{ id: 'first' }] } } },
    } satisfies SyncSnapshotEnvelope;
    const secondCandidate = {
      ...local,
      document: { ...local.document, data: { ...local.document.data, stores: { ...local.document.data.stores, events: [{ id: 'second' }] } } },
    } satisfies SyncSnapshotEnvelope;
    const firstMismatch = new SyncPayloadHashMismatchError(firstCandidate, '5'.repeat(64), '6'.repeat(64));
    const secondMismatch = new SyncPayloadHashMismatchError(secondCandidate, '5'.repeat(64), '7'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    let pulls = 0;
    const provider: SyncProvider = {
      ...damagedProvider(firstMismatch, pushes),
      pullLatest: async () => {
        pulls += 1;
        throw pulls === 1 ? firstMismatch : secondMismatch;
      },
    };
    const service = new SyncService(provider);

    const detected = await service.reconcile();
    expect(detected.phase).toBe('recovery-required');
    if (detected.phase !== 'recovery-required') throw new Error('Expected recovery-required');
    const refreshed = await service.replaceDamagedCloudWithLocal(detected.recovery);
    expect(refreshed.phase).toBe('recovery-required');
    expect(pushes).toHaveLength(0);
  });

  it('keeps the mobile Settings recovery explicit and explains one-import cross-device behavior', () => {
    const settings = readFileSync('src/sync/SyncSettingsPanel.tsx', 'utf8');
    expect(settings).toContain('Jednorazowe ustawienie wspólnej wersji');
    expect(settings).toContain('Użyj danych z tego urządzenia');
    expect(settings).toContain('Potwierdź i ustaw jako wspólne');
    expect(settings).toContain('Plik planu nie musi być wgrywany ponownie na drugim urządzeniu');
    expect(settings).toContain('events: \'wydarzenia\'');
    expect(settings).toContain('studyProfile: \'profil studiów\'');
    expect(settings).toContain('universityImportEntries: \'dane planu zajęć\'');
    expect(settings).toContain('universityImports: \'historia importów planu\'');
  });
});
