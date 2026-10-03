import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEvent, deleteDatabaseForTests, initializeDatabase } from '../storage/database';
import { SyncPayloadHashMismatchError } from '../sync/sync-errors';
import { SyncService } from '../sync/sync-service';
import { decodeSnapshotChunks, encodeSnapshotChunks } from '../sync/providers/firebase-google-chunks';
import type { SyncProvider, SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

function sameRevisionEnvelope(timestamp: string, sourceDeviceId = 'device-a'): SyncSnapshotEnvelope {
  return {
    format: 'inteligentny-kalendarz-sync-snapshot',
    version: 1,
    revision: 'a'.repeat(64),
    updatedAt: timestamp,
    sourceDeviceId,
    document: {
      format: 'inteligentny-kalendarz-backup',
      backupVersion: 1,
      appVersion: '1.2.0.298',
      databaseSchemaVersion: 14,
      createdAt: timestamp,
      checksum: 'b'.repeat(64),
      data: {
        format: 'inteligentny-kalendarz-snapshot',
        snapshotVersion: 1,
        appVersion: '1.2.0.298',
        databaseSchemaVersion: 14,
        capturedAt: timestamp,
        stores: { events: [{ id: 'same-logical-data', title: 'Test' }] },
      },
    },
  };
}

function throwingCloudProvider(
  error: Error,
  pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }>,
): SyncProvider {
  return {
    id: 'build298-test-cloud',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'account-build298' }),
    signIn: async () => ({ id: 'account-build298' }),
    signOut: async () => undefined,
    pullLatest: async () => { throw error; },
    pushSnapshot: async (snapshot, expectedRevision = undefined) => {
      if (expectedRevision === undefined) pushes.push({ snapshot });
      else pushes.push({ snapshot, expectedRevision });
    },
  };
}

describe('Build298 immutable Firestore chunk sets', () => {
  it('proves why revision cannot be used as the physical chunk-set id', async () => {
    const first = sameRevisionEnvelope('2026-10-03T21:16:13.084Z', 'device-a');
    const second = sameRevisionEnvelope('2026-10-03T21:16:14.084Z', 'device-b');
    expect(first.revision).toBe(second.revision);

    const firstEncoded = await encodeSnapshotChunks(first);
    const secondEncoded = await encodeSnapshotChunks(second);
    expect(firstEncoded.payloadBytes).toBe(secondEncoded.payloadBytes);
    expect(firstEncoded.payloadSha256).not.toBe(secondEncoded.payloadSha256);
  });

  it('surfaces a parseable legacy v1 chunk/hash mismatch as a repair candidate instead of accepting it', async () => {
    const manifestSnapshot = sameRevisionEnvelope('2026-10-03T21:16:13.084Z', 'device-a');
    const overwrittenChunksSnapshot = sameRevisionEnvelope('2026-10-03T21:16:14.084Z', 'device-b');
    const manifestEncoded = await encodeSnapshotChunks(manifestSnapshot);
    const overwrittenEncoded = await encodeSnapshotChunks(overwrittenChunksSnapshot);

    await expect(decodeSnapshotChunks(
      manifestSnapshot.revision,
      manifestEncoded.payloadBytes,
      manifestEncoded.payloadSha256,
      overwrittenEncoded.chunks,
    )).rejects.toMatchObject({
      name: 'SyncPayloadHashMismatchError',
      expectedPayloadSha256: manifestEncoded.payloadSha256,
      actualPayloadSha256: overwrittenEncoded.payloadSha256,
      snapshot: overwrittenChunksSnapshot,
    });
  });

  it('repairs a legacy hash mismatch only when the parsed cloud candidate is logically identical to local data', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Bezpieczny test', startDateTime: '2026-10-03T18:00', endDateTime: '2026-10-03T19:00', category: 'OTHER' });
    const seedProvider: SyncProvider = {
      id: 'seed-build298', mode: 'cloud', capabilities: { cloud: true, authentication: true }, isConfigured: () => true,
      getAccount: async () => ({ id: 'seed' }), signIn: async () => ({ id: 'seed' }), signOut: async () => undefined,
      pullLatest: async () => null, pushSnapshot: async () => undefined,
    };
    const seed = new SyncService(seedProvider);
    const local = await seed.captureLocalSnapshot('local-device');
    const cloudCandidate: SyncSnapshotEnvelope = {
      ...local,
      updatedAt: '2026-10-03T21:16:14.084Z',
      sourceDeviceId: 'old-cloud-device',
      document: {
        ...local.document,
        createdAt: '2026-10-03T21:16:14.084Z',
        data: { ...local.document.data, capturedAt: '2026-10-03T21:16:14.084Z' },
      },
    };
    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '1'.repeat(64), '2'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(throwingCloudProvider(mismatch, pushes));

    const result = await service.reconcile();
    expect(result.phase).toBe('pushed');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.expectedRevision).toBe(cloudCandidate.revision);
    expect(pushes[0]?.snapshot.revision).toBe(local.revision);
  });

  it('keeps a legacy hash mismatch fail-closed when parsed cloud content differs from local data', async () => {
    await initializeDatabase();
    const seedProvider: SyncProvider = {
      id: 'seed-build298-different', mode: 'cloud', capabilities: { cloud: true, authentication: true }, isConfigured: () => true,
      getAccount: async () => ({ id: 'seed' }), signIn: async () => ({ id: 'seed' }), signOut: async () => undefined,
      pullLatest: async () => null, pushSnapshot: async () => undefined,
    };
    const seed = new SyncService(seedProvider);
    const local = await seed.captureLocalSnapshot('local-device');
    const cloudCandidate: SyncSnapshotEnvelope = {
      ...local,
      document: {
        ...local.document,
        data: {
          ...local.document.data,
          stores: { ...local.document.data.stores, events: [{ id: 'cloud-only', title: 'Inna zawartość' }] },
        },
      },
    };
    const mismatch = new SyncPayloadHashMismatchError(cloudCandidate, '1'.repeat(64), '2'.repeat(64));
    const pushes: Array<{ snapshot: SyncSnapshotEnvelope; expectedRevision?: string | null }> = [];
    const service = new SyncService(throwingCloudProvider(mismatch, pushes));

    await expect(service.reconcile()).rejects.toBeInstanceOf(SyncPayloadHashMismatchError);
    expect(pushes).toHaveLength(0);
  });

  it('writes new chunks under payloadSha256 and switches a v3 manifest only after the chunk writes', () => {
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    expect(provider).toContain('const chunkSetId = encoded.payloadSha256;');
    expect(provider).toContain("version: 3");
    expect(provider).toContain("storage: 'chunks-v2'");
    expect(provider).toContain('chunkSetId,');
    expect(provider).toContain('cached.payloadSha256 === manifest.payloadSha256');
    expect(provider).toContain("data.version === 2 && data.storage === 'chunks-v1'");
    expect(provider).not.toContain('syncChunkReference(runtime, user.uid, snapshot.revision, index)');
    expect(provider.indexOf('await Promise.all(encoded.chunks.map')).toBeLessThan(provider.indexOf('runTransaction<ChunkSetCleanup[]>'));
  });
});
