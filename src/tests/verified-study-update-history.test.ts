import { describe, expect, it } from 'vitest';
import type { ScheduleDiffSummary, UniversityScheduleImport } from '../study/study.types';
import { VERIFIED_STUDY_PLAN_2026_10_05, VERIFIED_STUDY_PLAN_2026_10_06 } from '../study/verified-study-plan';
import { verifiedLegacyScheduleUpdateHistory } from '../study/verified-study-update-history';

function importRecord(fileHash: string, fileName: string): UniversityScheduleImport {
  return {
    id: `import-${fileHash.slice(0, 8)}`,
    fileName,
    fileSize: 1,
    fileHash,
    importedAt: '2026-10-06T18:36:00.000Z',
    adapterId: 'nursing-week-matrix-v2',
    sheetNames: ['PLAN ZAJĘĆ', 'WYKŁADY'],
    selectedGroups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
    availableGroups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
    importedEventCount: 74,
    warningCount: 4,
    status: 'COMPLETED',
  };
}

const oneAdded: ScheduleDiffSummary = { added: 1, removed: 0, changed: 0, conflicts: 0, unchanged: 73, ambiguous: 0 };

describe('Build341 verified legacy Study update history', () => {
  it('recovers the exact audited 05.10 -> 06.10 addition after historical entries were compacted', () => {
    const items = verifiedLegacyScheduleUpdateHistory(
      importRecord(VERIFIED_STUDY_PLAN_2026_10_05.sha256, VERIFIED_STUDY_PLAN_2026_10_05.sourceName),
      importRecord(VERIFIED_STUDY_PLAN_2026_10_06.sha256, VERIFIED_STUDY_PLAN_2026_10_06.sourceName),
      oneAdded,
    );

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'ADDED',
        subject: 'FARMAKOLOGIA',
        activityType: 'Seminaria',
        date: '2026-11-12',
        startTime: '10:15',
        endTime: '14:00',
        groupTags: ['MAIN:11'],
        room: 'sala komputerowa, sala 234 w CD',
        address: 'ul. Trojdena 2a',
        locationLabel: 'Centrum Dydaktyczne',
      }),
    ]);
  });

  it('does not invent details for an unverified source pair', () => {
    expect(verifiedLegacyScheduleUpdateHistory(
      importRecord('other-old', 'old.xls'),
      importRecord('other-new', 'new.xls'),
      oneAdded,
    )).toBeUndefined();
  });
});
