import type { ScheduleDiffSummary, ScheduleUpdateHistoryItem, UniversityScheduleImport } from './study.types';
import { verifiedStudyCurrentScheduleCandidates } from './verified-study-current-schedule';
import { VERIFIED_STUDY_PLAN_2026_10_05, VERIFIED_STUDY_PLAN_2026_10_06 } from './verified-study-plan';

function sameSelection(actual: string[], expected: readonly string[]): boolean {
  return [...actual].sort().join('|') === [...expected].sort().join('|');
}

export function verifiedLegacyScheduleUpdateHistory(
  baseImport: UniversityScheduleImport,
  appliedImport: UniversityScheduleImport,
  summary: ScheduleDiffSummary,
): ScheduleUpdateHistoryItem[] | undefined {
  const isAuditedPair = baseImport.fileHash === VERIFIED_STUDY_PLAN_2026_10_05.sha256
    && appliedImport.fileHash === VERIFIED_STUDY_PLAN_2026_10_06.sha256
    && sameSelection(baseImport.selectedGroups, VERIFIED_STUDY_PLAN_2026_10_05.selectedProfile.selectedGroups)
    && sameSelection(appliedImport.selectedGroups, VERIFIED_STUDY_PLAN_2026_10_06.selectedProfile.selectedGroups);
  const isExpectedDelta = summary.added === 1
    && summary.changed === 0
    && summary.removed === 0
    && summary.conflicts === 0;
  if (!isAuditedPair || !isExpectedDelta) return undefined;

  const candidate = verifiedStudyCurrentScheduleCandidates().find((item) => (
    item.sourceSheet === 'PLAN ZAJĘĆ'
    && item.sourceRange === 'DA12'
    && item.date === '2026-11-12'
    && item.startTime === '10:15'
    && item.endTime === '14:00'
    && item.subject === 'FARMAKOLOGIA'
    && item.include
  ));
  if (!candidate) return undefined;

  return [{
    id: 'verified-history-2026-10-05-to-2026-10-06-da12',
    kind: 'ADDED',
    subject: candidate.subject,
    ...(candidate.activityType ? { activityType: candidate.activityType } : {}),
    ...(candidate.date ? { date: candidate.date } : {}),
    ...(candidate.startTime ? { startTime: candidate.startTime } : {}),
    ...(candidate.endTime ? { endTime: candidate.endTime } : {}),
    groupTags: [...candidate.groupTags],
    ...(candidate.clinic ? { clinic: candidate.clinic } : {}),
    ...(candidate.room ? { room: candidate.room } : {}),
    ...(candidate.address ? { address: candidate.address } : {}),
    ...(candidate.locationLabel ? { locationLabel: candidate.locationLabel } : {}),
    changes: [],
  }];
}
