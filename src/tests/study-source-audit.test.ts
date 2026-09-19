import { describe, expect, it } from 'vitest';
import type { WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import { auditStudyProfiles, findStudySourceWeekdayMismatches } from '../study/study-source-audit';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, date: string, startTime: string, endTime: string, groupTags: string[], subject: string): StudyScheduleCandidate {
  return {
    id, adapterId: 'test', sourceSheet: 'PLAN', sourceRange: id, sourceKey: id, originalText: id,
    subject, date, startTime, endTime, groupScope: 'SPECIFIC', groupTags, status: 'READY', warnings: [], include: true,
  };
}

function analysis(): ScheduleAnalysis {
  return {
    adapterId: 'test', sheetNames: ['PLAN'], detectedAcademicYear: '2026/2027',
    groups: ['MAIN:2', 'G12:2A', 'G12:2B', 'G8:2B', 'G4:2B1', 'G4:2B2'], information: [], warnings: [],
    candidates: [
      candidate('main', '2026-10-08', '12:00', '15:45', ['MAIN:2'], 'Seminarium'),
      candidate('lecture-a', '2026-10-08', '15:00', '16:30', ['G12:2A'], 'Wykład A'),
      candidate('lecture-b', '2026-10-08', '15:00', '16:30', ['G12:2B'], 'Wykład B'),
    ],
  };
}

describe('study source audit', () => {
  it('enumerates valid person profiles and summarizes unique conflict signatures', () => {
    const result = auditStudyProfiles(analysis());
    expect(result.profileCount).toBe(4);
    expect(result.affectedProfileCount).toBe(4);
    expect(result.uniqueConflictCount).toBe(2);
    expect(result.conflicts.map((entry) => entry.affectedProfileCount).sort()).toEqual([2, 2]);
  });

  it('detects a date placed under the wrong weekday header without changing the source', () => {
    const workbook: WorkbookSnapshot = {
      sheetNames: ['WYKŁADY'],
      sheets: [{
        name: 'WYKŁADY', usedRange: 'A1:C4', minRow: 1, minCol: 1, maxRow: 4, maxCol: 3, merges: [],
        cells: [
          { row: 1, col: 1, address: 'A1', value: 'WTORKI' },
          { row: 2, col: 1, address: 'A2', value: '13.10.' },
          { row: 3, col: 1, address: 'A3', value: '21.10.' },
        ],
      }],
    };
    const mismatches = findStudySourceWeekdayMismatches(workbook, '2026/2027');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ address: 'A3', date: '2026-10-21', expectedWeekday: 'WTOREK', actualWeekday: 'ŚRODA' });
  });
});
