import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createCanonicalDataTransferDocument,
  deleteDatabaseForTests,
  initializeDatabase,
} from '../storage/database';
import {
  createSnapshotDecodeBuffer,
  decodeSnapshotChunkInto,
  encodePreparedSnapshotChunk,
  finalizeSnapshotDecodeBuffer,
  FIRESTORE_SYNC_IO_CONCURRENCY,
  FIRESTORE_SYNC_MAX_PAYLOAD_BYTES,
  FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES,
  prepareSnapshotPayload,
} from '../sync/providers/firebase-google-chunks';
import type { SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

describe('Build303-305 sync storage hardening', () => {
  it('keeps historical parser payload cleanup bounded to technical history', () => {
    const database = readFileSync('src/storage/database.ts', 'utf8');
    expect(database).toContain("imports.filter((item) => item.lifecycleStatus === 'HISTORICAL')");
    expect(database).toContain("deleteRowsByIndex(entryStore, 'importId', item.id)");
    expect(database).toContain('delete compacted.sourceBlocks');
    expect(database).toContain("item.lifecycleStatus === 'HISTORICAL' || item.lifecycleStatus === 'DELETED'");
    expect(database).toContain('SCHEDULE_UPDATE_SESSION_LIMIT = 20');
    expect(database).toContain('AUTOMATIC_RESTORE_POINT_LIMIT = 5');
    expect(database).toContain('AUTOMATIC_RESTORE_POINT_TOTAL_BYTES = 40 * 1024 * 1024');
  });

  it('encodes and decodes a multi-chunk snapshot without retaining a full base64 chunk array', async () => {
    const document = await createCanonicalDataTransferDocument();
    document.data.stores.events = [{ id: 'memory-test', title: 'x'.repeat(1_050_000) }];
    const snapshot: SyncSnapshotEnvelope = {
      format: 'inteligentny-kalendarz-sync-snapshot', version: 1, revision: 'a'.repeat(64),
      updatedAt: '2026-10-04T08:00:00.000Z', sourceDeviceId: 'build305-test', document,
    };

    const prepared = await prepareSnapshotPayload(snapshot);
    expect(prepared.chunkCount).toBeGreaterThan(2);
    expect(FIRESTORE_SYNC_IO_CONCURRENCY).toBe(3);
    expect(FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES).toBe(18_000_000);
    expect(FIRESTORE_SYNC_MAX_PAYLOAD_BYTES).toBe(24_000_000);

    const target = createSnapshotDecodeBuffer(prepared.payloadBytes);
    for (let index = 0; index < prepared.chunkCount; index += 1) {
      decodeSnapshotChunkInto(target, index, encodePreparedSnapshotChunk(prepared, index));
    }
    const decoded = await finalizeSnapshotDecodeBuffer(snapshot.revision, prepared.payloadSha256, target);
    expect(decoded.document.data.stores.events ?? []).toEqual(snapshot.document.data.stores.events ?? []);
  });

  it('keeps raw Excel bytes out of the synchronized data model and bounds cleanup queues', () => {
    const studyTypes = readFileSync('src/study/study.types.ts', 'utf8');
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    const database = readFileSync('src/storage/database.ts', 'utf8');

    expect(studyTypes).not.toMatch(/rawFile|fileBytes|arrayBuffer|Blob/);
    expect(provider).toContain('CHUNK_CLEANUP_QUEUE_LIMIT = 24');
    expect(provider).toContain('WeakRef<SyncSnapshotEnvelope>');
    expect(provider).toContain('FIRESTORE_SYNC_IO_CONCURRENCY');
    expect(provider).not.toContain('Promise.all(encoded.chunks.map');
    expect(database).toContain('compactTechnicalStorage');
  });
});
