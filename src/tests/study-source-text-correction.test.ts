import { describe, expect, it } from 'vitest';
import {
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05,
  VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_05,
} from '../study/verified-study-plan-manual';

describe('study source text correction audit metadata', () => {
  it('keeps the AY9 source typo separate from the canonical external address', () => {
    expect(VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_05).toEqual([
      expect.objectContaining({
        sourceRange: 'AY9',
        field: 'address',
        sourceValue: 'ul. Jadżwingów 9',
        canonicalValue: 'ul. Jadźwingów 9',
        provenance: 'OFFICIAL_EXTERNAL',
        appliedToSchedule: false,
      }),
    ]);
  });

  it('does not change the frozen operational plan counts', () => {
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05).toMatchObject({
      candidateCount: 76,
      importableCount: 73,
      incompleteCount: 3,
      conflictCount: 0,
      candidatesSha256: 'e04f8b7c71030c9df81633845f544c4f9d5543f7087b4ef1723cf775a09156b4',
    });
  });
});
