import { describe, expect, it } from 'vitest';
import type { StudyScheduleCandidate } from '../study/study.types';
import {
  applyVerifiedStudyPlanManualCorrections,
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_06,
  VERIFIED_STUDY_PROFILE_2026_10_06,
  verifiedStudyPlanManualEvidence,
} from '../study/verified-study-plan-manual';
import { VERIFIED_STUDY_PLAN_2026_10_06, VERIFIED_STUDY_PLAN_CURRENT } from '../study/verified-study-plan';

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

describe('current verified WUM plan 06.10.2026', () => {
  it('pins the exact source and manually audited user profile', () => {
    expect(VERIFIED_STUDY_PLAN_CURRENT).toBe(VERIFIED_STUDY_PLAN_2026_10_06);
    expect(VERIFIED_STUDY_PLAN_2026_10_06).toMatchObject({
      sourceName: 'licencjat-ii-rok-piel.-06.10.2026.xls',
      sizeBytes: 151040,
      sha256: '5e5ea210abbcc972b2928372505eaee5d9a58ffeba6c7d7162eb3514bb9570b9',
      allCandidatesSha256: 'e7178d5ec23bca44d43084bd7b945429daa4c9568201ad6d710cce16c8cf4b95',
    });
    expect(VERIFIED_STUDY_PROFILE_2026_10_06).toEqual(['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2']);
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_06).toMatchObject({
      candidateCount: 77,
      importableCount: 74,
      readyCount: 70,
      warningCount: 4,
      incompleteCount: 3,
      conflictCount: 0,
      candidatesSha256: '6c18a0eafb6fcca3d89b5ba09f9276bb4709fddd2b7a6d744f2b22052804aada',
    });
    expect(verifiedStudyPlanManualEvidence(VERIFIED_STUDY_PLAN_2026_10_06.sha256)).toHaveLength(34);
  });

  it('maps the shifted 15 October INTERNA range to Aula A without touching its time', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({})], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      date: '2026-10-15', startTime: '16:45', endTime: '20:30',
      room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne',
    });
  });

  it('uses the newly explicit pediatrics unit from the 06.10 workbook', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'AM14', subject: 'PEDIATRIA', date: '2026-11-23',
      groupTags: ['G4:11B2'], address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
    })], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Pediatrii i Nefrologii',
      address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
    });
  });

  it('adds the newly published Thursday Pharmacology seminar with the exact room and CD address', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'DA12', subject: 'FARMAKOLOGIA', date: '2026-11-12',
      startTime: '10:15', endTime: '14:00', groupTags: ['MAIN:11'],
      room: 'sala komputerowa sala 234 w CD', address: 'ul. Trojdena 2a',
    })], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      room: 'sala komputerowa, sala 234 w CD',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Centrum Dydaktyczne',
    });
  });

  it('keeps the incomplete POZ week source-only after its range shifted to AY9', () => {
    const incomplete = candidate({
      sourceRange: 'AY9', subject: 'POZ',
      groupTags: ['G4:11B2'], address: 'ul. Jadżwingów 9', status: 'REVIEW_REQUIRED', include: false,
      sourceWeekStart: '2026-10-19', sourceWeekEnd: '2026-10-23',
    });
    delete incomplete.date;
    delete incomplete.startTime;
    delete incomplete.endTime;
    const corrected = applyVerifiedStudyPlanManualCorrections([incomplete], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
    expect(corrected.include).toBe(false);
    expect(corrected.date).toBeUndefined();
    expect(corrected.startTime).toBeUndefined();
    expect(corrected.endTime).toBeUndefined();
    expect(corrected.warnings.join(' ')).toContain('nie podaje jednoznacznego dnia ani pełnego zakresu godzin');
  });

  it('keeps 27-29 October Health Promotion timed but without an invented place', () => {
    for (const date of ['2026-10-27', '2026-10-28', '2026-10-29']) {
      const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
        sourceRange: 'BC10', subject: 'PROM. ZDROWIA', date,
        startTime: '08:00', endTime: '11:00', groupTags: ['G8:11B'],
        room: 'sala odziedziczona', address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa',
      })], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
      expect(corrected).toMatchObject({
        date, startTime: '08:00', endTime: '11:00',
        clinic: 'Zakład Propedeutyki Pielęgniarstwa',
      });
      expect(corrected.room).toBeUndefined();
      expect(corrected.address).toBeUndefined();
      expect(corrected.locationLabel).toBeUndefined();
    }
  });

  it('keeps the Słodkowski surgery block at the verified Banacha 1a unit even on Friday rows', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([candidate({
      sourceRange: 'D20', subject: 'CHIRURGIA I BLOK OPERACYJNY', date: '2027-01-22',
      groupTags: ['G8:11B'], address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład NZS',
    })], VERIFIED_STUDY_PLAN_2026_10_06.sha256).candidates[0]!;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej',
      address: 'ul. Banacha 1a',
      locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej',
    });
  });
});
