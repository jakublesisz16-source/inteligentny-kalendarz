import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyUniversityScheduleUpdate,
  commitUniversityImport,
  commitWorkScheduleImport,
  compactTechnicalStorage,
  createRestorePoint,
  deleteDatabaseForTests,
  initializeDatabase,
  listRestorePoints,
  listRestorePointSummaries,
  listUniversityImportEntries,
  listUniversityImports,
  listWorkCoworkerShifts,
  listWorkScheduleEntries,
  listWorkScheduleImports,
  prepareUniversityScheduleUpdate,
  saveWorkProfile,
} from '../storage/database';
import { SyncService } from '../sync/sync-service';
import {
  FIRESTORE_SYNC_IO_CONCURRENCY,
  FIRESTORE_SYNC_MAX_PAYLOAD_BYTES,
  FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES,
  prepareSnapshotPayload,
} from '../sync/providers/firebase-google-chunks';
import type { SyncProvider } from '../sync/sync.types';
import type { StudyScheduleCandidate, StudySourceBlock } from '../study/study.types';

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

function candidate(id: string, date: string, sourceKey = `source-${id}`): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN',
    sourceRange: `A${id}`,
    sourceKey,
    originalText: `Test ${date}`,
    subject: 'Test planu',
    activityType: 'Ćwiczenia',
    date,
    startTime: '08:00',
    endTime: '09:30',
    groupScope: 'SPECIFIC',
    groupTags: ['11B'],
    status: 'READY',
    warnings: [],
    include: true,
  };
}

function block(id: string, candidateId: string, date: string): StudySourceBlock {
  return {
    id,
    sourceSheet: 'PLAN',
    sourceRange: 'A1',
    sourceSectionKey: `PLAN|${id}`,
    subject: 'Test planu',
    activityType: 'Ćwiczenia',
    groupTags: ['11B'],
    weekStart: date,
    weekEnd: date,
    weekdays: ['PONIEDZIAŁEK'],
    excludedDates: [],
    sourceHasFullTimeRange: true,
    candidateIds: [candidateId],
  };
}

function localProvider(): SyncProvider {
  return {
    id: 'build303-test',
    mode: 'cloud',
    capabilities: { cloud: true, authentication: true },
    isConfigured: () => true,
    getAccount: async () => ({ id: 'build303' }),
    signIn: async () => ({ id: 'build303' }),
    signOut: async () => undefined,
    pullLatest: async () => null,
    pushSnapshot: async () => undefined,
  };
}

describe('Build303 storage compaction', () => {
  it('keeps the active study payload but removes full parser payloads from historical plans', async () => {
    await initializeDatabase();
    const firstCandidate = candidate('first', '2026-10-05');
    await commitUniversityImport({
      fileName: 'plan-1.xls', fileSize: 100, fileHash: 'build303-plan-1', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [firstCandidate], allCandidates: [firstCandidate],
      sourceBlocks: [block('block-first', 'first', '2026-10-05')],
    });

    const secondCandidate = candidate('second', '2026-10-12', 'source-first');
    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'plan-2.xls', fileSize: 101, fileHash: 'build303-plan-2', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [secondCandidate], allCandidates: [secondCandidate],
      sourceBlocks: [block('block-second', 'second', '2026-10-12')],
    });
    await applyUniversityScheduleUpdate(preview);

    const beforeImports = await listUniversityImports();
    const historicalBefore = beforeImports.find((item) => item.lifecycleStatus === 'HISTORICAL');
    const activeBefore = beforeImports.find((item) => item.lifecycleStatus === 'ACTIVE');
    expect(historicalBefore?.sourceBlocks?.length).toBeGreaterThan(0);
    expect(activeBefore?.sourceBlocks?.length).toBeGreaterThan(0);
    expect(await listUniversityImportEntries(historicalBefore!.id)).not.toHaveLength(0);
    expect(await listUniversityImportEntries(activeBefore!.id)).not.toHaveLength(0);

    const result = await compactTechnicalStorage();
    expect(result.historicalStudyEntriesDeleted).toBeGreaterThan(0);
    expect(result.historicalStudySourceBlocksDropped).toBe(1);

    const afterImports = await listUniversityImports();
    const historicalAfter = afterImports.find((item) => item.id === historicalBefore!.id);
    const activeAfter = afterImports.find((item) => item.id === activeBefore!.id);
    expect(historicalAfter?.sourceBlocks).toBeUndefined();
    expect(activeAfter?.sourceBlocks?.length).toBeGreaterThan(0);
    expect(await listUniversityImportEntries(historicalBefore!.id)).toHaveLength(0);
    expect(await listUniversityImportEntries(activeBefore!.id)).not.toHaveLength(0);
  });

  it('removes historical work parser payloads while preserving the active month and lightweight import history', async () => {
    await initializeDatabase();
    await saveWorkProfile({
      employeeMatchName: 'MIKI',
      employerName: 'Tezenis',
      workplaceName: 'Test',
      storeCoworkerSchedule: true,
    });
    const first = await commitWorkScheduleImport({
      profileId: 'primary-work', fileName: 'grafik-v1.pdf', fileHash: 'build303-work-1', adapterId: 'test-work',
      periodStart: '2026-10-01', periodEnd: '2026-10-31',
      shifts: [{ date: '2026-10-05', startTime: '08:00', endTime: '16:00', minutes: 480, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: '2026-10-05' }],
      coworkerShifts: [{ date: '2026-10-05', displayName: 'ADA', normalizedName: 'ADA', startTime: '09:00', endTime: '15:00', minutes: 360, sourcePage: 1 }],
    });
    const second = await commitWorkScheduleImport({
      profileId: 'primary-work', fileName: 'grafik-v2.pdf', fileHash: 'build303-work-2', adapterId: 'test-work',
      periodStart: '2026-10-01', periodEnd: '2026-10-31',
      shifts: [{ date: '2026-10-05', startTime: '10:00', endTime: '18:00', minutes: 480, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: '2026-10-05' }],
      coworkerShifts: [{ date: '2026-10-05', displayName: 'ADA', normalizedName: 'ADA', startTime: '10:00', endTime: '16:00', minutes: 360, sourcePage: 1 }],
      conflictDecision: 'USE_NEW',
    });

    expect((await listWorkScheduleImports()).find((item) => item.id === first.workImport.id)?.lifecycleStatus).toBe('HISTORICAL');
    expect(await listWorkScheduleEntries(first.workImport.id)).not.toHaveLength(0);
    expect(await listWorkCoworkerShifts(first.workImport.id)).not.toHaveLength(0);

    const compacted = await compactTechnicalStorage();
    expect(compacted.historicalWorkEntriesDeleted).toBeGreaterThan(0);
    expect(compacted.historicalCoworkerShiftsDeleted).toBeGreaterThan(0);
    expect(await listWorkScheduleEntries(first.workImport.id)).toHaveLength(0);
    expect(await listWorkCoworkerShifts(first.workImport.id)).toHaveLength(0);
    expect(await listWorkScheduleEntries(second.workImport.id)).not.toHaveLength(0);
    expect(await listWorkCoworkerShifts(second.workImport.id)).not.toHaveLength(0);
    expect((await listWorkScheduleImports()).some((item) => item.id === first.workImport.id)).toBe(true);
  });

  it('compacts before sync capture and keeps raw spreadsheet bytes out of the canonical snapshot', async () => {
    await initializeDatabase();
    const firstCandidate = candidate('first-sync', '2026-10-05');
    await commitUniversityImport({
      fileName: 'plan-source.xls', fileSize: 123456, fileHash: 'build303-sync-plan-1', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [firstCandidate], allCandidates: [firstCandidate],
      sourceBlocks: [block('block-sync-first', 'first-sync', '2026-10-05')],
    });
    const secondCandidate = candidate('second-sync', '2026-10-12', 'source-first-sync');
    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'plan-source-v2.xls', fileSize: 223456, fileHash: 'build303-sync-plan-2', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [secondCandidate], allCandidates: [secondCandidate],
      sourceBlocks: [block('block-sync-second', 'second-sync', '2026-10-12')],
    });
    await applyUniversityScheduleUpdate(preview);

    const historical = (await listUniversityImports()).find((item) => item.lifecycleStatus === 'HISTORICAL');
    expect(await listUniversityImportEntries(historical!.id)).not.toHaveLength(0);

    const snapshot = await new SyncService(localProvider()).captureLocalSnapshot('build303-device');
    expect(snapshot.document.data.stores.universityImportEntries.some((entry: any) => entry.importId === historical!.id)).toBe(false);
    const serialized = JSON.stringify(snapshot.document.data.stores);
    expect(serialized).toContain('plan-source-v2.xls');
    expect(serialized).not.toContain('fileBytes');
    expect(serialized).not.toContain('arrayBuffer');
    expect(serialized).not.toContain('data:application/vnd.ms-excel');
  });

  it('keeps spreadsheet imports idempotent by file hash', async () => {
    await initializeDatabase();
    const item = candidate('duplicate', '2026-10-05');
    await commitUniversityImport({
      fileName: 'same.xls', fileSize: 100, fileHash: 'build303-same-file', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [item], allCandidates: [item],
    });
    await expect(prepareUniversityScheduleUpdate({
      fileName: 'same-copy.xls', fileSize: 100, fileHash: 'build303-same-file', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['11B'], availableGroups: ['11B'], candidates: [item], allCandidates: [item],
    })).rejects.toThrow(/już wcześniej zaimportowany/);
  });

  it('retains at most five unpinned automatic restore points and lists lightweight summaries', async () => {
    await initializeDatabase();
    for (let index = 0; index < 7; index += 1) {
      await createRestorePoint(`Auto ${index}`, 'BEFORE_CLOUD_SYNC_APPLY', true);
    }
    const automatic = (await listRestorePoints()).filter((point) => point.automatic && !point.pinned);
    expect(automatic).toHaveLength(5);
    const summaries = await listRestorePointSummaries();
    expect(summaries).toHaveLength(5);
    expect(Object.keys(summaries[0] ?? {})).not.toContain('snapshot');
  });
});

describe('Build303 sync memory budget', () => {
  it('keeps a bounded 24 MB payload budget with an earlier warning threshold and bounded network concurrency', () => {
    expect(FIRESTORE_SYNC_MAX_PAYLOAD_BYTES).toBe(24_000_000);
    expect(FIRESTORE_SYNC_WARNING_PAYLOAD_BYTES).toBe(18_000_000);
    expect(FIRESTORE_SYNC_IO_CONCURRENCY).toBe(3);
  });

  it('encodes chunks on demand instead of retaining all base64 chunks in the production provider', () => {
    const provider = readFileSync('src/sync/providers/firebase-google.ts', 'utf8');
    expect(provider).toContain('prepareSnapshotPayload(snapshot)');
    expect(provider).toContain('encodePreparedSnapshotChunk(encoded, index)');
    expect(provider).toContain('createSnapshotDecodeBuffer(manifest.payloadBytes)');
    expect(provider).toContain('decodeSnapshotChunkInto(payloadBuffer');
    expect(provider).toContain('deleteChunkSetIfUnreferenced');
    expect(provider).toContain('retryPendingChunkCleanup');
    expect(provider).toContain('CHUNK_CLEANUP_QUEUE_LIMIT = 24');
    expect(provider).toContain('WeakRef<SyncSnapshotEnvelope>');
    expect(provider).not.toContain('Promise.all(encoded.chunks.map');
  });

  it('refuses payloads above the safety budget before any cloud write', async () => {
    const huge = 'x'.repeat(FIRESTORE_SYNC_MAX_PAYLOAD_BYTES + 1024);
    const snapshot = {
      format: 'inteligentny-kalendarz-sync-snapshot' as const,
      version: 1 as const,
      revision: 'a'.repeat(64),
      updatedAt: '2026-10-04T09:00:00.000Z',
      sourceDeviceId: 'build303',
      document: {
        format: 'inteligentny-kalendarz-backup' as const,
        backupVersion: 1 as const,
        appVersion: '1.2.0.303',
        databaseSchemaVersion: 14,
        createdAt: '2026-10-04T09:00:00.000Z',
        checksum: 'b'.repeat(64),
        data: {
          format: 'inteligentny-kalendarz-snapshot' as const,
          snapshotVersion: 1 as const,
          appVersion: '1.2.0.303',
          databaseSchemaVersion: 14,
          capturedAt: '2026-10-04T09:00:00.000Z',
          stores: { events: [{ id: 'oversized', description: huge }] },
        },
      },
    };
    await expect(prepareSnapshotPayload(snapshot)).rejects.toThrow(/bezpieczny limit 24 MB/);
  });
});
