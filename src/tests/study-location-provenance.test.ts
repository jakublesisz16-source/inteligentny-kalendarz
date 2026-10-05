import { describe, expect, it } from 'vitest';
import type { StudyScheduleCandidate } from '../study/study.types';
import {
  applyVerifiedStudyPlanManualCorrections,
  verifiedStudyPlanManualEvidence,
} from '../study/verified-study-plan-manual';
import { VERIFIED_STUDY_PLAN_2026_10_05 } from '../study/verified-study-plan';

function candidate(patch: Partial<StudyScheduleCandidate>): StudyScheduleCandidate {
  return {
    id: 'candidate-build316',
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: 'DD8',
    sourceKey: 'build316',
    originalText: 'build316',
    subject: 'INTERNA (seminaria)',
    date: '2026-10-15',
    startTime: '16:45',
    endTime: '20:30',
    groupScope: 'SPECIFIC',
    groupTags: ['MAIN:11'],
    status: 'READY',
    warnings: [],
    include: true,
    ...patch,
  };
}

describe('study location provenance contract', () => {
  it('marks each manual location patch field with an explicit provenance class', () => {
    for (const override of verifiedStudyPlanManualEvidence()) {
      for (const field of Object.keys(override.patch)) {
        const source = override.provenance?.[field as keyof typeof override.patch] ?? 'SOURCE_CROSS_REFERENCE';
        expect(['SOURCE_DIRECT', 'SOURCE_CROSS_REFERENCE', 'OFFICIAL_EXTERNAL']).toContain(source);
      }
      for (const field of Object.keys(override.provenance ?? {})) {
        expect(field in override.patch).toBe(true);
      }
      expect(override.evidence.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps Excel-derived and external address evidence separate for Centrum Dydaktyczne', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections(
      [candidate({})],
      VERIFIED_STUDY_PLAN_2026_10_05.sha256,
    ).candidates[0]!;
    expect(corrected.locationProvenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'room', source: 'SOURCE_CROSS_REFERENCE' }),
      expect.objectContaining({ field: 'locationLabel', source: 'SOURCE_CROSS_REFERENCE' }),
      expect.objectContaining({ field: 'address', source: 'OFFICIAL_EXTERNAL' }),
    ]));
  });

  it('marks the January surgery unit and Banacha 1a correction as external enrichment', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([
      candidate({
        sourceRange: 'D20',
        subject: 'CHIRURGIA I BLOK OPERACYJNY',
        date: '2027-01-18',
        groupTags: ['G8:11B'],
        address: 'ul. Banacha 1',
      }),
    ], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;

    expect(corrected.locationProvenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'clinic', source: 'SOURCE_CROSS_REFERENCE' }),
      expect.objectContaining({ field: 'address', source: 'OFFICIAL_EXTERNAL' }),
      expect.objectContaining({ field: 'locationLabel', source: 'SOURCE_CROSS_REFERENCE' }),
    ]));
  });

  it('marks the Teams lecture correction as direct evidence from the lecture cell', () => {
    const corrected = applyVerifiedStudyPlanManualCorrections([
      candidate({
        sourceSheet: 'WYKŁADY',
        sourceRange: 'A14,B14',
        subject: 'POZ',
        date: '2027-01-05',
        startTime: '15:00',
        endTime: '18:45',
      }),
    ], VERIFIED_STUDY_PLAN_2026_10_05.sha256).candidates[0]!;

    expect(corrected.clinic).toBe('Microsoft Teams');
    expect(corrected.locationProvenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'clinic', source: 'SOURCE_DIRECT' }),
      expect.objectContaining({ field: 'room', source: 'SOURCE_DIRECT' }),
      expect.objectContaining({ field: 'address', source: 'SOURCE_DIRECT' }),
      expect.objectContaining({ field: 'locationLabel', source: 'SOURCE_DIRECT' }),
    ]));
  });
});
