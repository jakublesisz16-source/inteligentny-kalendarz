import { describe, expect, it } from 'vitest';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';
import {
  VERIFIED_STUDY_PLAN_CURRENT,
  VERIFIED_STUDY_PLAN_2026_10_09,
  VERIFIED_STUDY_PLAN_2026_10_13,
} from '../study/verified-study-plan';
import {
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_13,
  applyVerifiedStudyPlanManualCorrections,
  applyVerifiedStudyPlanManualCorrectionsToAnalysis,
  verifiedStudyPlanManualEvidence,
} from '../study/verified-study-plan-manual';
import {
  VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_09,
  VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13,
} from '../study/verified-study-current-schedule';

const dd8Key = 'PLAN ZAJĘĆ|DD8|2026-10-15|16:45|20:30|INTERNA (seminaria)|MAIN:11';
const find = (set: readonly StudyScheduleCandidate[]) => set.find((candidate) => candidate.sourceKey === dd8Key)!;

function analysis(candidates: StudyScheduleCandidate[]): ScheduleAnalysis {
  return {
    adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN ZAJĘĆ', 'WYKŁADY'],
    groups: ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'],
    candidates, information: [], warnings: [],
  };
}

describe('WUM 13.10.2026 manual, exact-source permanent snapshot', () => {
  it('changes the current reference only when SHA-256 and complete exact profile were audited', () => {
    expect(VERIFIED_STUDY_PLAN_CURRENT).toBe(VERIFIED_STUDY_PLAN_2026_10_13);
    expect(VERIFIED_STUDY_PLAN_2026_10_13).toMatchObject({
      sourceName: 'licencjat-ii-rok-piel.-13.10.2026.xls',
      sizeBytes: 148480,
      sha256: '939acba2ad6646464b7612a25f8800fcfbb65e5691b34bcd6c70056ee1aaf4be',
      allCandidatesSha256: '9a28c77f69de8e2cccca96839c285b18098e2e4364e1f9b5df223f67adbf5628',
      selectedProfile: { candidateCount: 77, importableCount: 74, incompleteCount: 3, conflictCount: 0 },
    });
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_13).toMatchObject({
      candidateCount: 77, importableCount: 74, incompleteCount: 3, conflictCount: 0,
      candidatesSha256: '1519240c382b2785c2fc10cd61e99fe56ed198023b552d6ada1a793c57893ef9',
    });
    expect(verifiedStudyPlanManualEvidence(VERIFIED_STUDY_PLAN_2026_10_13.sha256)).toHaveLength(34);
  });

  it('is identical to 09.10 for 76 source positions and only changes DD8 fields explicitly', () => {
    expect(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13).toHaveLength(77);
    const prev = new Map(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_09.map((item) => [item.sourceKey, item]));
    const newKeys = new Set(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13.map((item) => item.sourceKey));
    expect(newKeys.size).toBe(77);
    expect(newKeys).toEqual(new Set(prev.keys()));
    for (const candidate of VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13) {
      const old = prev.get(candidate.sourceKey)!;
      if (candidate.sourceKey === dd8Key) {
        expect(old).toMatchObject({ room: 'Aula A', address: 'ul. Trojdena 2a' });
        expect(candidate).toMatchObject({ room: 'sala 203', address: 'ul. Ciołka 27' });
        expect(candidate.locationLabel).toBeUndefined();
        expect(candidate.originalText).not.toBe(old.originalText);
        expect(candidate.originalGroupText).not.toBe(old.originalGroupText);
      } else {
        // Only the source provenance date in warnings may be updated, while
        // all source facts and operational fields are frozen.
        expect({ ...candidate, warnings: old.warnings }).toEqual(old);
        if (candidate.include === false) {
          expect(candidate.warnings.join(' ')).toContain('Plan z 13.10.2026');
        }
      }
    }
  });

  it('overrides a stale parser result for DD8, while 09.10 remains historically separate', () => {
    const old = find(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_09);
    const newEntry = find(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13);
    const parserResult: StudyScheduleCandidate = {
      ...old,
      room: 'Aula A',
      address: 'ul. Trojdena 2a',
      originalText: newEntry.originalText,
      ...(newEntry.originalGroupText === undefined ? {} : { originalGroupText: newEntry.originalGroupText }),
    };
    const reviewed = applyVerifiedStudyPlanManualCorrectionsToAnalysis(
      analysis([parserResult]), VERIFIED_STUDY_PLAN_2026_10_13.sha256,
    ).candidates[0]!;
    expect(reviewed).toEqual(newEntry);
    expect(applyVerifiedStudyPlanManualCorrections([old], VERIFIED_STUDY_PLAN_2026_10_09.sha256)
      .candidates[0]).toMatchObject({ room: 'Aula A', address: 'ul. Trojdena 2a' });
  });

  it('rejects inheritance to a modified XLS with an unknown hash', () => {
    const source = find(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_13);
    expect(applyVerifiedStudyPlanManualCorrections([source], 'unknown-source-hash').appliedOverrideCount).toBe(0);
  });
});