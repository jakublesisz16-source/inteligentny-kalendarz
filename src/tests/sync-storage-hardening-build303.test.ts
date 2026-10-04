import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sha256Hex } from '../core/sha256';
import {
  compactTechnicalStorage,
  createCanonicalDataTransferDocument,
  deleteDatabaseForTests,
  importDataTransfer,
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
import type { BackupDocument } from '../safety/safety.types';
import type { SyncSnapshotEnvelope } from '../sync/sync.types';

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

async function signedDocument(document: BackupDocument): Promise<BackupDocument> {
  const unsigned = {
    format: document.format,
    backupVersion: document.backupVersion,
    appVersion: document.appVersion,
    databaseSchemaVersion: document.databaseSchemaVersion,
    createdAt: document.createdAt,
    data: document.data,
  };
  return { ...document, checksum: await sha256Hex(JSON.stringify(unsigned)) };
}

describe('Build303/304 sync storage hardening', () => {
  it('compacts historical study payloads while keeping the active plan complete', async () => {
    const document = await createCanonicalDataTransferDocument();
    document.data.stores.universityImports = [
      {
        id: 'old-import', fileName: 'old.xls', fileSize: 100, fileHash: 'old-hash',
        importedAt: '2026-09-01T10:00:00.000Z', adapterId: 'test', sheetNames: ['PLAN'],
        selectedGroups: ['MAIN:11'], importedEventCount: 1, warningCount: 0, status: 'COMPLETED',
        lifecycleStatus: 'HISTORICAL', sourceDataComplete: true,
        sourceBlocks: [{ id: 'old-source-block', text: 'large historical parser payload' }],
      },
      {
        id: 'active-import', fileName: 'active.xls', fileSize: 100, fileHash: 'active-hash',
        importedAt: '2026-10-01T10:00:00.000Z', adapterId: 'test', sheetNames: ['PLAN'],
        selectedGroups: ['MAIN:11'], importedEventCount: 1, warningCount: 0, status: 'COMPLETED',
        lifecycleStatus: 'ACTIVE', sourceDataComplete: true,
        sourceBlocks: [{ id: 'active-source-block', text: 'needed for future plan diff' }],
      },
    ];
    document.data.stores.universityImportEntries = [
      { id: 'old-entry', importId: 'old-import', sourceKey: 'old', sourceSheet: 'PLAN', sourceRange: 'A1', originalText: 'OLD', subject: 'Old', groupTags: ['MAIN:11'], warnings: [] },
      { id: 'active-entry', importId: 'active-import', sourceKey: 'active', sourceSheet: 'PLAN', sourceRange: 'A2', originalText: 'ACTIVE', subject: 'Active', groupTags: ['MAIN:11'], warnings: [] },
    ];

    await importDataTransfer(await signedDocument(document));
    const result = await compactTechnicalStorage();
    const compacted = await createCanonicalDataTransferDocument();

    expect(result.historicalStudyEntriesDeleted).toBe(1);
    expect(result.historicalStudySourceBlocksDropped).toBe(1);
    expect(compacted.data.stores.universityImportEntries ?? []).toEqual([
      expect.objectContaining({ id: 'active-entry', importId: 'active-import' }),
    ]);

    const imports = (compacted.data.stores.universityImports ?? []) as Array<Record<string, unknown>>;
    const oldImport = imports.find((item) => item.id === 'old-import');
    const activeImport = imports.find((item) => item.id === 'active-import');
    expect(oldImport).toBeTruthy();
    expect(oldImport).not.toHaveProperty('sourceBlocks');
    expect(activeImport).toHaveProperty('sourceBlocks');
  });

  it('encodes and decodes a multi-chunk snapshot without retaining a full base64 chunk array', async () => {
    const document = await createCanonicalDataTransferDocument();
    document.data.stores.events = [{ id: 'memory-test', title: 'x'.repeat(1_050_000) }];
    const snapshot: SyncSnapshotEnvelope = {
      format: 'inteligentny-kalendarz-sync-snapshot', version: 1, revision: 'a'.repeat(64),
      updatedAt: '2026-10-04T08:00:00.000Z', sourceDeviceId: 'build304-test', document,
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
    expect(database).toContain('AUTOMATIC_RESTORE_POINT_LIMIT = 5');
    expect(database).toContain('AUTOMATIC_RESTORE_POINT_TOTAL_BYTES = 40 * 1024 * 1024');
    expect(database).toContain('SCHEDULE_UPDATE_SESSION_LIMIT = 20');
  });
});
