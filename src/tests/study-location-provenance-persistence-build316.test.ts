import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitUniversityImport,
  deleteDatabaseForTests,
  initializeDatabase,
  listUniversityImportEntries,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('Build316 study location provenance persistence', () => {
  it('persists provenance with the import entry without a schema bump', async () => {
    const candidate: StudyScheduleCandidate = {
      id: 'build316-provenance',
      adapterId: 'nursing-week-matrix-v2',
      sourceSheet: 'PLAN ZAJĘĆ',
      sourceRange: 'DE8',
      sourceKey: 'build316-provenance',
      originalText: 'build316 provenance',
      subject: 'INTERNA (seminaria)',
      date: '2026-10-15',
      startTime: '16:45',
      endTime: '20:30',
      groupScope: 'SPECIFIC',
      groupTags: ['MAIN:11'],
      room: 'Aula A',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Centrum Dydaktyczne',
      status: 'READY',
      warnings: [],
      include: true,
      locationProvenance: [
        { field: 'room', source: 'SOURCE_CROSS_REFERENCE', evidence: 'DE4: czwartek - aula A w CD' },
        { field: 'address', source: 'OFFICIAL_EXTERNAL', evidence: 'oficjalny adres CD: ul. Księcia Trojdena 2a' },
      ],
    };

    const result = await commitUniversityImport({
      fileName: 'build316.xls',
      fileSize: 1,
      fileHash: 'build316',
      adapterId: candidate.adapterId,
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['MAIN:11'],
      availableGroups: ['MAIN:11'],
      allowScheduleConflicts: true,
      candidates: [candidate],
      allCandidates: [candidate],
    });

    const entries = await listUniversityImportEntries(result.importRecord.id);
    expect(entries).toHaveLength(2);
    const eventEntry = entries.find((entry) => !entry.sourceOnly && Boolean(entry.eventId));
    const sourceEntry = entries.find((entry) => entry.sourceOnly);
    expect(eventEntry?.locationProvenance).toEqual(candidate.locationProvenance);
    expect(sourceEntry?.locationProvenance).toEqual(candidate.locationProvenance);
  });
});
