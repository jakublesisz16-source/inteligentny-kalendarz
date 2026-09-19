import { describe, expect, it } from 'vitest';
import { assessScheduleAnalysisIntegrity } from '../imports/xlsx/adapter-registry';
import type { ScheduleAnalysis, StudyScheduleCandidate, StudySourceBlock } from '../study/study.types';

function candidate(id: string, sourceKey = id): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN',
    sourceRange: id,
    sourceKey,
    originalText: id,
    subject: 'Test',
    date: '2026-10-05',
    startTime: '08:00',
    endTime: '09:30',
    groupScope: 'SPECIFIC',
    groupTags: ['MAIN:1'],
    status: 'READY',
    warnings: [],
  };
}

function block(id: string, candidateIds: string[]): StudySourceBlock {
  return {
    id, sourceSheet: 'PLAN', sourceRange: id, sourceSectionKey: id, subject: 'Test',
    groupTags: ['MAIN:1'], weekStart: '2026-10-05', weekEnd: '2026-10-09', weekdays: ['PONIEDZIAŁEK'],
    excludedDates: [], sourceHasFullTimeRange: true, candidateIds,
  };
}

function analysis(candidates: StudyScheduleCandidate[], sourceBlocks: StudySourceBlock[]): ScheduleAnalysis {
  return {
    adapterId: 'nursing-week-matrix-v2',
    sheetNames: ['PLAN'],
    groups: ['MAIN:1'],
    candidates,
    sourceBlocks,
    information: [],
    warnings: [],
    diagnostics: { weekRowCount: 5, unparsedAssignmentCellCount: 0, unappliedDateExceptionCount: 0 },
  };
}

describe('study import structural integrity hardening', () => {
  it('accepts one-to-one source block references with unique candidate identity', () => {
    const result = assessScheduleAnalysisIntegrity(analysis([candidate('a'), candidate('b')], [block('ba', ['a']), block('bb', ['b'])]));
    expect(result).toEqual({ safe: true, reasons: [] });
  });

  it('blocks duplicate candidate/source identity before it can corrupt a later plan diff', () => {
    const duplicateId = assessScheduleAnalysisIntegrity(analysis([candidate('same', 'key-a'), candidate('same', 'key-b')], [block('ba', ['same'])]));
    expect(duplicateId.safe).toBe(false);
    expect(duplicateId.reasons.join(' ')).toContain('zduplikowanych identyfikatorów');

    const duplicateKey = assessScheduleAnalysisIntegrity(analysis([candidate('a', 'same-key'), candidate('b', 'same-key')], [block('ba', ['a']), block('bb', ['b'])]));
    expect(duplicateKey.safe).toBe(false);
    expect(duplicateKey.reasons.join(' ')).toContain('zduplikowanych kluczy źródłowych');
  });

  it('blocks broken, repeated and orphaned source-block references', () => {
    const result = assessScheduleAnalysisIntegrity(analysis(
      [candidate('a'), candidate('b')],
      [block('ba', ['a', 'missing']), block('bb', ['a'])],
    ));
    expect(result.safe).toBe(false);
    const message = result.reasons.join(' ');
    expect(message).toContain('nieistniejących kandydatów');
    expect(message).toContain('więcej niż jednego bloku');
    expect(message).toContain('bez odpowiadającego bloku źródłowego');
  });
});
