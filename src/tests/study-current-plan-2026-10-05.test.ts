import { describe, expect, it } from 'vitest';
import type { StudyScheduleCandidate } from '../study/study.types';
import {
  applyVerifiedStudyPlanManualCorrections,
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05,
  VERIFIED_STUDY_PROFILE_2026_10_05,
  verifiedStudyPlanManualEvidence,
} from '../study/verified-study-plan-manual';
import { VERIFIED_STUDY_PLAN_2026_10_05, VERIFIED_STUDY_PLAN_CURRENT } from '../study/verified-study-plan';

function candidate(patch: Partial<StudyScheduleCandidate>): StudyScheduleCandidate {
  return {
    id: 'candidate-current-plan',
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: 'DD8',
    sourceKey: 'current-plan',
    originalText: 'current-plan',
    subject: 'INTERNA (seminaria)',
    date: '2026-10-15',
    startTime: '16:45',
    endTime: '20:30',
    groupScope: 'SPECIFIC',
    groupTags: ['MAIN:11'],
    address: 'ul. Ciołka 27',
    locationLabel: 'Zakład Rozwoju Pielęgniarstwa',
    status: 'READY',
    warnings: [],
    include: true,
    ...patch,
  };
}

describe('current verified WUM plan 05.10.2026', () => {
  it('pins the exact source and manually audited user profile', () => {
    expect(VERIFIED_STUDY_PLAN_CURRENT).toBe(VERIFIED_STUDY_PLAN_2026_10_05);
    expect(VERIFIED_STUDY_PLAN_2026_10_05).toMatchObject({
      sourceName: 'licencjat-ii-rok-piel.-05.10.2026-a.xls',
      sizeBytes: 150528,
      sha256: 'd1c9b755b439014b1ad4da429b27d7c575cb953b75582765cf5eefd7ab521702',
      allCandidatesSha256: '99e1bac2ed84e51956092ef8ef1115987fddaa8ccdc92cef6f632f83ad5fe811',
    });
    expect(VERIFIED_STUDY_PROFILE_2026_10_05).toEqual(['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2']);
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05).toMatchObject({
      candidateCount: 76,
      importableCount: 73,
      readyCount: 72,
      warningCount: 1,
      incompleteCount: 3,
      conflictCount: 0,
      candidatesSha256: '34ced58eff09d97809aca986928f3bd0465a3ea3185f66ed5451100178dcaf70',
    });
    expect(verifiedStudyPlanManualEvidence(VERIFIED_STUDY_PLAN_2026_10_05.sha256)).toHaveLength(33);
  });

  it('maps the shifted 15 October INTERNA range to Aula A without touching its time', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({})], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      date: '2026-10-15', startTime: '16:45', endTime: '20:30',
      room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne',
    });
  });

  it('uses the newly explicit pediatrics unit from the 05.10 workbook', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'AM14', subject: 'PEDIATRIA', date: '2026-11-23',
      groupTags: ['G4:11B2'], address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
    })], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Pediatrii i Nefrologii',
      address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
    });
  });

  it('keeps the incomplete POZ week source-only after its range shifted to AY9', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'AY9', subject: 'POZ', date: undefined, startTime: undefined, endTime: undefined,
      groupTags: ['G4:11B2'], address: 'ul. Jadżwingów 9', status: 'REVIEW_REQUIRED', include: false,
      sourceWeekStart: '2026-10-19', sourceWeekEnd: '2026-10-23',
    })], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;
    expect(corrected.include).toBe(false);
    expect(corrected.date).toBeUndefined();
    expect(corrected.startTime).toBeUndefined();
    expect(corrected.endTime).toBeUndefined();
    expect(corrected.warnings.join(' ')).toContain('nie podaje jednoznacznego dnia ani pełnego zakresu godzin');
  });

  it('keeps the Słodkowski surgery block at the verified Banacha 1a unit even on Friday rows', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'D20', subject: 'CHIRURGIA I BLOK OPERACYJNY', date: '2027-01-22',
      groupTags: ['G8:11B'], address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład NZS',
    })], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej',
      address: 'ul. Banacha 1a',
      locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej',
    });
  });
});
