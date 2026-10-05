import { describe, expect, it } from 'vitest';
import {
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02,
  VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_02,
} from '../study/verified-study-plan-manual';

describe('study source text correction audit metadata', () => {
  it('keeps the AZ9 source typo separate from the canonical external address', () => {
    expect(VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_02).toEqual([
      expect.objectContaining({
        sourceRange: 'AZ9',
        field: 'address',
        sourceValue: 'ul. Jadżwingów 9',
        canonicalValue: 'ul. Jadźwingów 9',
        provenance: 'OFFICIAL_EXTERNAL',
        appliedToSchedule: false,
      }),
    ]);
  });

  it('does not change the frozen operational plan counts', () => {
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02).toMatchObject({
      candidateCount: 77,
      importableCount: 74,
      incompleteCount: 3,
      conflictCount: 1,
      candidatesSha256: '3f39d3358e0d3f6423d5ae18ad41ea357d9a8d960e2f09af1d7d4e8ca1f5360a',
    });
  });
});
