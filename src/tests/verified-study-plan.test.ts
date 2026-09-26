import { describe, expect, it } from 'vitest';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';
import {
  candidateSemanticFingerprint,
  VERIFIED_STUDY_PLAN_2026_09_25,
  verifyStudyPlanAgainstReference,
  verifyStudyPlanSource,
} from '../study/verified-study-plan';

function candidate(overrides: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id: 'candidate-1',
    adapterId: 'test-adapter',
    sourceSheet: 'PLAN',
    sourceRange: 'A1',
    sourceKey: 'PLAN|A1',
    originalText: 'Test',
    subject: 'Test przedmiot',
    date: '2026-10-05',
    startTime: '08:00',
    endTime: '09:30',
    groupScope: 'ALL',
    groupTags: [],
    address: 'ul. Testowa 1',
    status: 'READY',
    warnings: [],
    include: true,
    ...overrides,
  };
}

function analysis(candidates: StudyScheduleCandidate[] = [candidate()]): ScheduleAnalysis {
  return {
    adapterId: 'test-adapter',
    sheetNames: ['PLAN'],
    groups: ['MAIN:7', 'G12:7A', 'G4:7B2'],
    candidates,
    information: [],
    warnings: [],
    sourceBlocks: [],
    completeness: {
      safe: true,
      sourceBlockCount: 0,
      completeBlockCount: 0,
      incompleteSourceBlockCount: 0,
      blockingBlockCount: 0,
      hourAudits: [],
      reasons: [],
    },
    diagnostics: { unparsedAssignmentCellCount: 0, unappliedDateExceptionCount: 0 },
  };
}

async function syntheticReference(source: ScheduleAnalysis) {
  const allCandidatesSha256 = await candidateSemanticFingerprint(source.candidates);
  return {
    id: 'synthetic-reference',
    sourceName: 'synthetic.xls',
    sizeBytes: 123,
    sha256: 'synthetic-hash',
    adapterId: 'test-adapter',
    allCandidatesSha256,
    selectedProfile: {
      selectedGroups: ['MAIN:7', 'G12:7A', 'G4:7B2'],
      candidatesSha256: allCandidatesSha256,
      candidateCount: 1,
      importableCount: 1,
      readyCount: 1,
      warningCount: 0,
      incompleteCount: 0,
      blockingCount: 0,
      conflictCount: 0,
      importableMonthCounts: { '2026-10': 1 },
    },
    audit: {
      candidateCount: 1,
      readyCount: 1,
      reviewRequiredCount: 0,
      groupCount: 3,
      groupKinds: { MAIN: 1, G12: 1, G8: 0, G4: 1, GENERIC: 0 },
      sourceBlockCount: 0,
      completenessSafe: true,
      incompleteSourceBlockCount: 0,
      hourAnomalyCount: 0,
      profileCombinationCount: 1,
      affectedProfileCombinationCount: 0,
      uniqueConflictSignatureCount: 0,
      weekdayMismatchCount: 0,
      unparsedAssignmentCellCount: 0,
      unappliedDateExceptionCount: 0,
    },
  };
}

describe('Verified Study Plan', () => {
  it('fingerprint semantyczny jest niezależny od kolejności kandydatów i tagów grup', async () => {
    const left = [
      candidate({ id: 'a', sourceKey: 'a', groupTags: ['G4:7B2', 'MAIN:7'] }),
      candidate({ id: 'b', sourceKey: 'b', subject: 'Drugi', groupTags: ['G12:7A'] }),
    ];
    const right = [
      { ...left[1]!, groupTags: [...left[1]!.groupTags].reverse() },
      { ...left[0]!, groupTags: [...left[0]!.groupTags].reverse() },
    ];
    expect(await candidateSemanticFingerprint(left)).toBe(await candidateSemanticFingerprint(right));
  });

  it('przepuszcza tylko analizę zgodną z pełną referencją', async () => {
    const source = analysis();
    const reference = await syntheticReference(source);
    const result = await verifyStudyPlanAgainstReference({ fileName: 'synthetic.xls', fileSize: 123, analysis: source }, reference);
    expect(result.state).toBe('VERIFIED_REFERENCE');
    expect(result.reasons).toEqual([]);
  });

  it('blokuje cichą zmianę semantyki nawet gdy liczby audytu pozostają takie same', async () => {
    const baseline = analysis();
    const reference = await syntheticReference(baseline);
    const drifted = analysis([candidate({ subject: 'Zmieniony przedmiot' })]);
    const result = await verifyStudyPlanAgainstReference({ fileName: 'synthetic.xls', fileSize: 123, analysis: drifted }, reference);
    expect(result.state).toBe('BLOCKED_REFERENCE_DRIFT');
    expect(result.reasons.some((reason) => reason.includes('fingerprint semantyczny pełnego planu'))).toBe(true);
  });

  it('nie dziedziczy statusu verified po samej nazwie pliku', async () => {
    const result = await verifyStudyPlanSource({
      fileName: VERIFIED_STUDY_PLAN_2026_09_25.sourceName,
      fileSize: VERIFIED_STUDY_PLAN_2026_09_25.sizeBytes,
      fileHash: '0'.repeat(64),
      analysis: analysis(),
    });
    expect(result.state).toBe('NEW_SOURCE');
    expect(result.reasons[0]).toContain('inny SHA-256');
  });
});
