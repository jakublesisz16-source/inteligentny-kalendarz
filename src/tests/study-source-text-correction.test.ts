import { describe, expect, it } from 'vitest';
import {
  VERIFIED_STUDY_MANUAL_AUDIT_2026_10_06,
  VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_06,
} from '../study/verified-study-plan-manual';

describe('study source text correction audit metadata', () => {
  it('keeps the AY9 source typo separate from the canonical external address', () => {
    expect(VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_06).toEqual([
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
    expect(VERIFIED_STUDY_MANUAL_AUDIT_2026_10_06).toMatchObject({
      candidateCount: 77,
      importableCount: 74,
      incompleteCount: 3,
      conflictCount: 0,
      candidatesSha256: '6c18a0eafb6fcca3d89b5ba09f9276bb4709fddd2b7a6d744f2b22052804aada',
    });
  });
});
