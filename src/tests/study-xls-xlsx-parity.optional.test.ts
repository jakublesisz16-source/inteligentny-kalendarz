import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';
import { candidatesForSelectedGroups } from '../study/study.service';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';

const xlsPath = process.env.IK_STUDY_XLS_PATH;
const xlsxPath = process.env.IK_STUDY_XLSX_PATH;
const selectedGroups = (process.env.IK_STUDY_GROUPS ?? '').split(',').map((value) => value.trim()).filter(Boolean);

async function analyzeFile(path: string): Promise<ScheduleAnalysis> {
  const bytes = await readFile(path);
  const file = new File([bytes], basename(path));
  const snapshot = await readSpreadsheetFile(file);
  const analysis = analyzeScheduleWorkbook(snapshot);
  if (!analysis) throw new Error(`Plan ${basename(path)} nie przeszedł produkcyjnej analizy.`);
  return analysis;
}

function semantic(candidate: StudyScheduleCandidate) {
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
    sourceWeekStart: candidate.sourceWeekStart ?? null,
    sourceWeekEnd: candidate.sourceWeekEnd ?? null,
    declaredTeachingHours: candidate.declaredTeachingHours ?? null,
  };
}

function canonical(analysis: ScheduleAnalysis) {
  const candidates = selectedGroups.length ? candidatesForSelectedGroups(analysis, selectedGroups) : analysis.candidates;
  return candidates.map(semantic).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'pl'));
}

describe('optional real XLS/XLSX semantic parity', () => {
  const parityTest = xlsPath && xlsxPath ? it : it.skip;
  parityTest('produces the same semantic schedule through both production readers', async () => {
    const [xls, xlsx] = await Promise.all([analyzeFile(xlsPath!), analyzeFile(xlsxPath!)]);
    expect(xls.groups).toEqual(xlsx.groups);
    expect(xls.completeness?.safe).toBe(true);
    expect(xlsx.completeness?.safe).toBe(true);
    expect(canonical(xls)).toEqual(canonical(xlsx));
  });
});
