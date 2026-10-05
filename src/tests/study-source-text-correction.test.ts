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
      candidatesSha256: '34ced58eff09d97809aca986928f3bd0465a3ea3185f66ed5451100178dcaf70',
    });
  });
});
