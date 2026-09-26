import { parseStudyGroupKey } from '../imports/xlsx/group-normalizer';
import type { WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import { sha256Hex } from '../core/sha256';
import { candidatesForSelectedGroups } from './study.service';
import { auditSelectedStudyProfile, buildStudySourceAudit } from './study-source-audit';
import type { ScheduleAnalysis, StudyScheduleCandidate } from './study.types';

export const VERIFIED_STUDY_PLAN_2026_09_25 = {
  id: 'wum-nursing-year2-2026-09-25',
  sourceName: 'licencjat-ii-rok-piel.-25.09.2026.xls',
  sourceUpdatedAt: '2026-09-25T14:59:00+02:00',
  sizeBytes: 148_992,
  sha256: 'b6279b96e8cdfc7a95b9c7199686db424ef84e315215a03545957aee413964e4',
  adapterId: 'nursing-week-matrix-v2',
  allCandidatesSha256: 'ba9be8db4573567662b6fa2eba588e486b32709f68535c2fe4fcdeb903df443e',
  selectedProfile: {
    selectedGroups: ['MAIN:7', 'G12:7A', 'G4:7B2'],
    candidatesSha256: 'a2df44543641c2f699d8a053a981eb2a6cc25c9f5fa7584082b5ad6bbe0a66f6',
    candidateCount: 79,
    importableCount: 76,
    readyCount: 76,
    warningCount: 0,
    incompleteCount: 3,
    blockingCount: 0,
    conflictCount: 1,
    importableMonthCounts: {
      '2026-10': 21,
      '2026-11': 31,
      '2026-12': 14,
      '2027-01': 10,
    },
  },
  audit: {
    candidateCount: 2313,
    readyCount: 2145,
    reviewRequiredCount: 168,
    groupCount: 168,
    groupKinds: { MAIN: 14, G12: 28, G8: 42, G4: 84, GENERIC: 0 },
    sourceBlockCount: 861,
    completenessSafe: true,
    incompleteSourceBlockCount: 168,
    hourAnomalyCount: 16,
    profileCombinationCount: 168,
    affectedProfileCombinationCount: 52,
    uniqueConflictSignatureCount: 5,
    weekdayMismatchCount: 5,
    unparsedAssignmentCellCount: 0,
    unappliedDateExceptionCount: 0,
  },
} as const;

export type StudyPlanVerificationState = 'VERIFIED_REFERENCE' | 'NEW_SOURCE' | 'BLOCKED_REFERENCE_DRIFT';

export interface StudyPlanVerification {
  state: StudyPlanVerificationState;
  referenceId?: string;
  referenceSourceName?: string;
  reasons: string[];
  allCandidatesSha256?: string;
  selectedProfileCandidatesSha256?: string;
}

export interface VerifyStudyPlanInput {
  fileName: string;
  fileSize: number;
  fileHash: string;
  analysis: ScheduleAnalysis;
  workbook?: WorkbookSnapshot;
}

interface StudyPlanReference {
  id: string;
  sourceName: string;
  sizeBytes: number;
  sha256: string;
  adapterId: string;
  allCandidatesSha256: string;
  selectedProfile: {
    selectedGroups: readonly string[];
    candidatesSha256: string;
    candidateCount: number;
    importableCount: number;
    readyCount: number;
    warningCount: number;
    incompleteCount: number;
    blockingCount: number;
    conflictCount: number;
    importableMonthCounts: Readonly<Record<string, number>>;
  };
  audit: {
    candidateCount: number;
    readyCount: number;
    reviewRequiredCount: number;
    groupCount: number;
    groupKinds: Readonly<Record<'MAIN' | 'G12' | 'G8' | 'G4' | 'GENERIC', number>>;
    sourceBlockCount: number;
    completenessSafe: boolean;
    incompleteSourceBlockCount: number;
    hourAnomalyCount: number;
    profileCombinationCount: number;
    affectedProfileCombinationCount: number;
    uniqueConflictSignatureCount: number;
    weekdayMismatchCount: number;
    unparsedAssignmentCellCount: number;
    unappliedDateExceptionCount: number;
  };
}

function canonicalCandidate(candidate: StudyScheduleCandidate) {
  return {
    subject: candidate.subject,
    activityType: candidate.activityType ?? null,
    date: candidate.date ?? null,
    startTime: candidate.startTime ?? null,
    endTime: candidate.endTime ?? null,
    groupScope: candidate.groupScope,
    groupTags: [...candidate.groupTags].sort(),
    clinic: candidate.clinic ?? null,
    room: candidate.room ?? null,
    address: candidate.address ?? null,
    locationLabel: candidate.locationLabel ?? null,
    status: candidate.status,
    include: candidate.include,
    sourceSheet: candidate.sourceSheet,
    sourceRange: candidate.sourceRange,
    sourceKey: candidate.sourceKey,
    warnings: [...candidate.warnings].sort(),
  };
}

export async function candidateSemanticFingerprint(candidates: StudyScheduleCandidate[]): Promise<string> {
  const canonical = candidates
    .map(canonicalCandidate)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'));
  return sha256Hex(JSON.stringify(canonical));
}

function currentAuditSummary(analysis: ScheduleAnalysis, workbook?: WorkbookSnapshot) {
  const report = buildStudySourceAudit(analysis, workbook);
  return {
    candidateCount: report.candidateCount,
    readyCount: report.readyCount,
    reviewRequiredCount: report.reviewRequiredCount,
    groupCount: report.groupCount,
    groupKinds: report.groupKinds,
    sourceBlockCount: report.sourceBlockCount,
    completenessSafe: report.completenessSafe,
    incompleteSourceBlockCount: report.incompleteSourceBlockCount,
    hourAnomalyCount: report.hourAnomalies.length,
    profileCombinationCount: report.profileAudit.profileCount,
    affectedProfileCombinationCount: report.profileAudit.affectedProfileCount,
    uniqueConflictSignatureCount: report.profileAudit.uniqueConflictCount,
    weekdayMismatchCount: report.weekdayMismatches.length,
    unparsedAssignmentCellCount: report.unparsedAssignmentCellCount,
    unappliedDateExceptionCount: report.unappliedDateExceptionCount,
  };
}

function pushMismatch(reasons: string[], label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) reasons.push(`${label}: otrzymano ${JSON.stringify(actual)}, oczekiwano ${JSON.stringify(expected)}.`);
}

function groupKindCounts(groups: string[]): Record<'MAIN' | 'G12' | 'G8' | 'G4' | 'GENERIC', number> {
  const counts = { MAIN: 0, G12: 0, G8: 0, G4: 0, GENERIC: 0 };
  for (const group of groups) counts[parseStudyGroupKey(group).kind] += 1;
  return counts;
}

export async function verifyStudyPlanAgainstReference(
  input: Omit<VerifyStudyPlanInput, 'fileHash'> & { fileHash?: string },
  reference: StudyPlanReference,
): Promise<StudyPlanVerification> {
  const reasons: string[] = [];
  pushMismatch(reasons, 'rozmiar pliku', input.fileSize, reference.sizeBytes);
  pushMismatch(reasons, 'adapter', input.analysis.adapterId, reference.adapterId);

  const audit = currentAuditSummary(input.analysis, input.workbook);
  pushMismatch(reasons, 'pełny audyt źródła', audit, reference.audit);
  pushMismatch(reasons, 'liczebność poziomów grup MAIN/G12/G8/G4', groupKindCounts(input.analysis.groups), reference.audit.groupKinds);

  const allCandidatesSha256 = await candidateSemanticFingerprint(input.analysis.candidates);
  pushMismatch(reasons, 'fingerprint semantyczny pełnego planu', allCandidatesSha256, reference.allCandidatesSha256);

  const selectedGroups = [...reference.selectedProfile.selectedGroups];
  const selectedProfile = auditSelectedStudyProfile(input.analysis, selectedGroups);
  const expectedProfileAudit = {
    selectedGroups,
    valid: true,
    validationErrors: [],
    candidateCount: reference.selectedProfile.candidateCount,
    importableCount: reference.selectedProfile.importableCount,
    readyCount: reference.selectedProfile.readyCount,
    warningCount: reference.selectedProfile.warningCount,
    incompleteCount: reference.selectedProfile.incompleteCount,
    blockingCount: reference.selectedProfile.blockingCount,
    conflictCount: reference.selectedProfile.conflictCount,
    importableMonthCounts: reference.selectedProfile.importableMonthCounts,
  };
  pushMismatch(reasons, 'audyt profilu 7/7A/7B2', selectedProfile, expectedProfileAudit);

  const selectedProfileCandidatesSha256 = await candidateSemanticFingerprint(candidatesForSelectedGroups(input.analysis, selectedGroups));
  pushMismatch(reasons, 'fingerprint semantyczny profilu 7/7A/7B2', selectedProfileCandidatesSha256, reference.selectedProfile.candidatesSha256);

  return {
    state: reasons.length ? 'BLOCKED_REFERENCE_DRIFT' : 'VERIFIED_REFERENCE',
    referenceId: reference.id,
    referenceSourceName: reference.sourceName,
    reasons,
    allCandidatesSha256,
    selectedProfileCandidatesSha256,
  };
}

export async function verifyStudyPlanSource(input: VerifyStudyPlanInput): Promise<StudyPlanVerification> {
  const normalizedHash = input.fileHash.toLowerCase();
  const reference = VERIFIED_STUDY_PLAN_2026_09_25;
  if (normalizedHash !== reference.sha256) {
    return {
      state: 'NEW_SOURCE',
      reasons: input.fileName.toLowerCase() === reference.sourceName.toLowerCase()
        ? ['Nazwa odpowiada zweryfikowanej wersji 25.09.2026, ale zawartość pliku ma inny SHA-256. Traktuję go jako nową wersję i nie dziedziczę statusu zweryfikowanego.']
        : [],
    };
  }
  return verifyStudyPlanAgainstReference(input, reference);
}
