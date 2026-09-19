import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';
import { auditSelectedStudyProfile, buildStudySourceAudit } from '../study/study-source-audit';

const sourcePath = process.env.IK_STUDY_XLS_PATH;
const expectedHash = process.env.IK_STUDY_XLS_SHA256?.toLowerCase();

function summary(report: ReturnType<typeof buildStudySourceAudit>) {
  return {
    adapterId: report.adapterId,
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

describe('optional real study source QA audit', () => {
  const sourceTest = sourcePath ? it : it.skip;
  sourceTest('prints a deterministic production-parser audit for the supplied XLS/XLSX', async () => {
    const bytes = await readFile(sourcePath!);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (expectedHash) expect(hash).toBe(expectedHash);

    const file = new File([bytes], basename(sourcePath!));
    const workbook = await readSpreadsheetFile(file);
    const analysis = analyzeScheduleWorkbook(workbook);
    expect(analysis).not.toBeNull();
    const report = buildStudySourceAudit(analysis!, workbook);
    expect(report.completenessSafe).toBe(true);
    expect(report.unparsedAssignmentCellCount).toBe(0);
    expect(report.unappliedDateExceptionCount).toBe(0);
    expect(report.groupKinds.GENERIC).toBe(0);

    // Jeżeli testujemy dokładnie aktywne źródło bieżącego checkpointu, raport musi
    // pozostać zgodny z zapisaną bazą QA. Sam XLS nie trafia do repozytorium -
    // test korzysta z pliku podanego przez IK_STUDY_XLS_PATH.
    const state = existsSync('CURRENT_STATE.json') ? JSON.parse(await readFile('CURRENT_STATE.json', 'utf8')) as {
      activeStudySourceFingerprint?: { sha256?: string };
      activeStudyAudit?: Record<string, unknown>;
      activeStudyQaProfile?: {
        selectedGroups: string[];
        candidateCount: number;
        importableCount: number;
        readyCount: number;
        warningCount: number;
        incompleteCount: number;
        blockingCount: number;
        conflictCount: number;
        importableMonthCounts: Record<string, number>;
      };
    } : null;
    if (state?.activeStudySourceFingerprint?.sha256?.toLowerCase() === hash) {
      expect(summary(report)).toEqual(state.activeStudyAudit);
      if (state.activeStudyQaProfile) {
        const profile = auditSelectedStudyProfile(analysis!, state.activeStudyQaProfile.selectedGroups);
        expect(profile).toEqual({
          selectedGroups: state.activeStudyQaProfile.selectedGroups,
          valid: true,
          validationErrors: [],
          candidateCount: state.activeStudyQaProfile.candidateCount,
          importableCount: state.activeStudyQaProfile.importableCount,
          readyCount: state.activeStudyQaProfile.readyCount,
          warningCount: state.activeStudyQaProfile.warningCount,
          incompleteCount: state.activeStudyQaProfile.incompleteCount,
          blockingCount: state.activeStudyQaProfile.blockingCount,
          conflictCount: state.activeStudyQaProfile.conflictCount,
          importableMonthCounts: state.activeStudyQaProfile.importableMonthCounts,
        });
      }
    }

    console.log(JSON.stringify({ file: basename(sourcePath!), sha256: hash, bytes: bytes.byteLength, ...summary(report) }, null, 2));
  });
});
