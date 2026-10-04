import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StudyScheduleCandidate } from '../study/study.types';
import {
  applyVerifiedStudyPlanManualCorrections,
  applyVerifiedStudyPlanManualCorrectionsToAnalysis,
  VERIFIED_STUDY_PROFILE_2026_10_02,
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02,
  verifiedStudyPlanManualEvidence,
} from '../study/verified-study-plan-manual';
import { VERIFIED_STUDY_PLAN_2026_10_02 } from '../study/verified-study-plan';

function candidate(patch: Partial<StudyScheduleCandidate>): StudyScheduleCandidate {
  return {
    id: 'candidate-test',
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: 'DE8',
    sourceKey: 'test',
    originalText: 'test',
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

describe('Build310 manually verified current study plan', () => {
  it('pins the full manually audited profile, not only individual corrections', () => {
    expect(VERIFIED_STUDY_PROFILE_2026_10_02).toEqual(['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2']);
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02).toMatchObject({
      candidateCount: 77,
      importableCount: 74,
      readyCount: 73,
      incompleteCount: 3,
      conflictCount: 1,
      candidatesSha256: '3f39d3358e0d3f6423d5ae18ad41ea357d9a8d960e2f09af1d7d4e8ca1f5360a',
    });
  });

  it('binds the manual map to the exact source and the real user group profile', () => {
    expect(VERIFIED_STUDY_PROFILE_2026_10_02).toEqual(['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2']);
    expect(VERIFIED_STUDY_PLAN_2026_10_02.selectedProfile.selectedGroups).toEqual([...VERIFIED_STUDY_PROFILE_2026_10_02]);
    expect(verifiedStudyPlanManualEvidence().length).toBeGreaterThanOrEqual(25);
  });

  it('repairs 15 October INTERNA to Aula A, Trojdena instead of Ciołka', () => {
    const result = applyVerifiedStudyPlanManualCorrections([candidate({})], VERIFIED_STUDY_PLAN_2026_10_02.sha256);
    expect(result.candidates[0]).toMatchObject({
      room: 'Aula A',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Centrum Dydaktyczne',
    });
  });

  it('repairs the POZ weekday/group room table instead of using the generic subject address', () => {
    const input = candidate({
      sourceRange: 'BK7',
      subject: 'POZ seminaria',
      date: '2026-10-05',
      startTime: '12:00',
      endTime: '15:45',
      address: 'ul. Ciołka 27',
      locationLabel: 'Zakład Rozwoju Pielęgniarstwa',
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected).toMatchObject({ room: 's. 101 Pato', address: 'ul. Litewska 14/16' });
    expect(corrected?.locationLabel).toBeUndefined();
  });

  it('uses the correct clinic for profile 11B2 pediatrics at Żwirki i Wigury 63A', () => {
    const input = candidate({
      sourceRange: 'AM14',
      subject: 'PEDIATRIA',
      date: '2026-11-23',
      groupTags: ['G4:11B2'],
      address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Klinika Pediatrii z Oddziałem Obserwacyjnym',
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Pediatrii i Nefrologii',
      address: 'ul. Żwirki i Wigury 63A',
      locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii',
    });
  });

  it('keeps the clinical Lindleya 4 location for the Czyżewski INTERNA block', () => {
    const input = candidate({
      sourceRange: 'O16',
      subject: 'INTERNA',
      date: '2026-12-09',
      groupTags: ['G8:11B'],
      address: 'ul. Oczki 4',
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected).toMatchObject({
      clinic: 'Klinika Chorób Wewnętrznych i Kardiologii',
      address: 'ul. Lindleya 4',
    });
  });

  it('clears inherited Aula B data when the lecture row explicitly says TEAMS', () => {
    const input = candidate({
      sourceSheet: 'WYKŁADY',
      sourceRange: 'A14,B14',
      subject: 'POZ',
      date: '2027-01-05',
      groupScope: 'ALL',
      groupTags: [],
      room: 'AULA B',
      address: 'ul. Trojdena 2a',
      locationLabel: 'Microsoft Teams',
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected?.clinic).toBe('Microsoft Teams');
    expect(corrected?.room).toBeUndefined();
    expect(corrected?.address).toBeUndefined();
    expect(corrected?.locationLabel).toBeUndefined();
  });



  it('uses the current official Banacha 1a address for the Słodkowski surgery block', () => {
    const input = candidate({
      sourceRange: 'D20',
      subject: 'CHIRURGIA I BLOK OPERACYJNY',
      date: '2027-01-18',
      groupTags: ['G8:11B'],
      address: 'ul. Banacha 1',
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected).toMatchObject({
      clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej',
      address: 'ul. Banacha 1a',
    });
  });

  it('removes speculative hours from the two Stec days and keeps them source-only', () => {
    const input = candidate({
      sourceRange: 'S16',
      subject: 'INTERNA',
      date: '2026-12-07',
      startTime: '07:30',
      endTime: '14:00',
      groupTags: ['G8:11B'],
      address: 'ul. Banacha 1a',
      inferredFields: ['startTime', 'endTime'],
      inferenceNotes: ['old inference'],
    });
    const [corrected] = applyVerifiedStudyPlanManualCorrections([input], VERIFIED_STUDY_PLAN_2026_10_02.sha256).candidates;
    expect(corrected?.startTime).toBeUndefined();
    expect(corrected?.endTime).toBeUndefined();
    expect(corrected?.include).toBe(false);
    expect(corrected?.status).toBe('REVIEW_REQUIRED');
    expect(corrected?.inferredFields).toBeUndefined();
    expect(corrected?.warnings.join(' ')).toContain('nie podaje pełnego zakresu godzin');
  });

  it('never applies the old manual map to a different plan hash', () => {
    const input = candidate({});
    const result = applyVerifiedStudyPlanManualCorrections([input], 'different-plan-sha256');
    expect(result.appliedCandidateCount).toBe(0);
    expect(result.candidates[0]).toEqual(input);
  });

  it('hard-blocks a new plan source until a new manual audit exists', () => {
    const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
    expect(studyView).toContain("verification.state === 'NEW_SOURCE'");
    expect(studyView).toContain('Import do kalendarza jest zablokowany do czasu ręcznej weryfikacji całego planu');
    expect(studyView).toContain('isVerifiedStudyProfileSelection(selectedGroups)');
    expect(studyView).not.toContain('applyRecurringStudyPatternAssumptions(manuallyVerifiedResult)');
  });

  it('adds visible provenance information to the analyzed exact source', () => {
    const analysis = {
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      groups: ['MAIN:11'],
      candidates: [candidate({})],
      information: [],
      warnings: [],
    };
    const corrected = applyVerifiedStudyPlanManualCorrectionsToAnalysis(analysis, VERIFIED_STUDY_PLAN_2026_10_02.sha256);
    expect(corrected.information.some((item) => item.id === 'verified-manual-plan-2026-10-02')).toBe(true);
  });
});
