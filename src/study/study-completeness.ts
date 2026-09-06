import { groupSetsIntersect } from '../imports/xlsx/group-normalizer';
import { studyTimeMinutes } from '../imports/xlsx/import-validation';
import type {
  ScheduleAnalysis,
  StudyCompletenessAudit,
  StudyHourAudit,
  StudyScheduleCandidate,
  StudySourceBlock,
} from './study.types';

const WEEKDAY_INDEX: Record<string, number> = {
  PONIEDZIAŁEK: 1,
  WTOREK: 2,
  ŚRODA: 3,
  CZWARTEK: 4,
  PIĄTEK: 5,
  SOBOTA: 6,
  NIEDZIELA: 0,
};

function dateAtNoon(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function expectedDatesForSourceBlock(block: StudySourceBlock): string[] {
  if (!block.weekdays.length) return block.exceptionDate ? [block.exceptionDate] : [];
  const indexes = new Set(block.weekdays.map((label) => WEEKDAY_INDEX[label]).filter((value): value is number => value !== undefined));
  const excluded = new Set(block.excludedDates);
  const cursor = dateAtNoon(block.weekStart);
  const end = dateAtNoon(block.weekEnd);
  const result: string[] = [];
  while (cursor <= end) {
    const key = dateKey(cursor);
    if (indexes.has(cursor.getDay()) && !excluded.has(key)) result.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!result.length && block.exceptionDate) return [block.exceptionDate];
  return result;
}

function candidateMinutes(candidate: StudyScheduleCandidate): number | null {
  if (!candidate.date) return null;
  const start = studyTimeMinutes(candidate.startTime);
  const end = studyTimeMinutes(candidate.endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

function candidateMap(candidates: StudyScheduleCandidate[]): Map<string, StudyScheduleCandidate> {
  return new Map(candidates.map((candidate) => [candidate.id, candidate]));
}

function auditBlock(block: StudySourceBlock, byId: Map<string, StudyScheduleCandidate>): { blocking: string[]; incomplete: boolean; complete: boolean } {
  const expected = expectedDatesForSourceBlock(block);
  const candidates = block.candidateIds.map((id) => byId.get(id)).filter((candidate): candidate is StudyScheduleCandidate => Boolean(candidate));
  const actualDates = new Set(candidates.flatMap((candidate) => candidate.date ? [candidate.date] : []));
  const blocking: string[] = [];

  if (block.weekdays.length) {
    const missing = expected.filter((date) => !actualDates.has(date));
    const unexpected = [...actualDates].filter((date) => !expected.includes(date));
    if (missing.length) blocking.push(`${block.subject} (${block.sourceRange}) - brakuje ${missing.length} oczekiwanych dni: ${missing.join(', ')}.`);
    if (unexpected.length) blocking.push(`${block.subject} (${block.sourceRange}) - utworzono dni spoza semantyki bloku: ${unexpected.join(', ')}.`);
  }

  const sourceDateIncomplete = !block.weekdays.length && !block.exceptionDate;
  const sourceTimeIncomplete = !block.sourceHasFullTimeRange;
  const candidateIncomplete = candidates.some((candidate) => !candidate.date || candidateMinutes(candidate) === null);
  const incomplete = sourceDateIncomplete || sourceTimeIncomplete || candidateIncomplete;
  return { blocking, incomplete, complete: blocking.length === 0 && !incomplete };
}

function buildHourAudits(blocks: StudySourceBlock[], candidates: StudyScheduleCandidate[]): StudyHourAudit[] {
  const byId = candidateMap(candidates);
  const groups = new Map<string, { blocks: StudySourceBlock[]; subject: string; activityType?: string; sectionKey: string; groupTag: string; declared: number }>();

  for (const block of blocks) {
    if (!block.declaredTeachingHours) continue;
    const groupTags = block.groupTags.length ? block.groupTags : ['ALL'];
    for (const groupTag of groupTags) {
      const key = `${block.sourceSectionKey}|${groupTag}|${block.declaredTeachingHours}`;
      const existing = groups.get(key);
      if (existing) existing.blocks.push(block);
      else groups.set(key, {
        blocks: [block],
        subject: block.subject,
        ...(block.activityType ? { activityType: block.activityType } : {}),
        sectionKey: block.sourceSectionKey,
        groupTag,
        declared: block.declaredTeachingHours,
      });
    }
  }

  const audits: StudyHourAudit[] = [];
  for (const [id, group] of groups.entries()) {
    const ids = new Set<string>();
    let incompleteSourceCount = 0;
    for (const block of group.blocks) {
      const expectedDates = expectedDatesForSourceBlock(block);
      if (!block.sourceHasFullTimeRange || !expectedDates.length) incompleteSourceCount += 1;
      for (const candidateId of block.candidateIds) ids.add(candidateId);
    }

    let confirmedMinutes = 0;
    for (const candidateId of ids) {
      const candidate = byId.get(candidateId);
      if (!candidate) continue;
      const minutes = candidateMinutes(candidate);
      if (minutes === null) {
        incompleteSourceCount += 1;
        continue;
      }
      confirmedMinutes += minutes;
    }

    const expectedMinutes = group.declared * 45;
    const enforcement: StudyHourAudit['enforcement'] = group.declared >= 20 && (group.activityType === 'Zajęcia praktyczne' || group.activityType === 'Ćwiczenia') ? 'STRICT' : 'ADVISORY';
    let status: StudyHourAudit['status'];
    if (confirmedMinutes === expectedMinutes && incompleteSourceCount === 0) status = 'MATCH';
    else if (incompleteSourceCount > 0) status = 'SOURCE_INCOMPLETE';
    else if (enforcement === 'ADVISORY') status = 'SOURCE_INCONSISTENT';
    else if (confirmedMinutes > expectedMinutes) status = 'OVERFLOW';
    else status = 'MISMATCH';

    audits.push({
      id,
      sourceSectionKey: group.sectionKey,
      subject: group.subject,
      ...(group.activityType ? { activityType: group.activityType } : {}),
      groupTag: group.groupTag,
      declaredTeachingHours: group.declared,
      expectedMinutes,
      confirmedMinutes,
      confirmedTeachingHours: Number((confirmedMinutes / 45).toFixed(2)),
      incompleteSourceCount,
      enforcement,
      status,
    });
  }
  return audits.sort((a, b) => `${a.subject}|${a.groupTag}`.localeCompare(`${b.subject}|${b.groupTag}`, 'pl'));
}

export function auditStudyScheduleCompleteness(analysis: Pick<ScheduleAnalysis, 'candidates' | 'sourceBlocks'>): StudyCompletenessAudit {
  const blocks = analysis.sourceBlocks ?? [];
  if (!blocks.length) {
    return { safe: true, sourceBlockCount: 0, completeBlockCount: 0, incompleteSourceBlockCount: 0, blockingBlockCount: 0, hourAudits: [], reasons: [] };
  }
  const byId = candidateMap(analysis.candidates);
  const reasons: string[] = [];
  let completeBlockCount = 0;
  let incompleteSourceBlockCount = 0;
  let blockingBlockCount = 0;

  for (const block of blocks) {
    const result = auditBlock(block, byId);
    if (result.complete) completeBlockCount += 1;
    if (result.incomplete) incompleteSourceBlockCount += 1;
    if (result.blocking.length) {
      blockingBlockCount += 1;
      reasons.push(...result.blocking);
    }
  }

  const hourAudits = buildHourAudits(blocks, analysis.candidates);
  for (const audit of hourAudits) {
    if (audit.enforcement === 'STRICT' && audit.status === 'MISMATCH') {
      reasons.push(`${audit.subject} / ${audit.groupTag}: źródło deklaruje ${audit.declaredTeachingHours} godz. dydaktycznych, a kompletny odczyt daje ${audit.confirmedTeachingHours}.`);
    }
    if (audit.enforcement === 'STRICT' && audit.status === 'OVERFLOW') {
      reasons.push(`${audit.subject} / ${audit.groupTag}: odczyt przekracza deklarację źródła (${audit.confirmedTeachingHours} > ${audit.declaredTeachingHours} godz. dydaktycznych).`);
    }
  }

  return {
    safe: reasons.length === 0,
    sourceBlockCount: blocks.length,
    completeBlockCount,
    incompleteSourceBlockCount,
    blockingBlockCount,
    hourAudits,
    reasons: [...new Set(reasons)],
  };
}

export function completenessForSelectedGroups(analysis: ScheduleAnalysis, selectedGroups: string[]): StudyCompletenessAudit {
  const relevantBlocks = (analysis.sourceBlocks ?? []).filter((block) => !block.groupTags.length || groupSetsIntersect(block.groupTags, selectedGroups));
  const relevantIds = new Set(relevantBlocks.flatMap((block) => block.candidateIds));
  const relevantCandidates = analysis.candidates.filter((candidate) => relevantIds.has(candidate.id) || candidate.groupScope === 'ALL');
  return auditStudyScheduleCompleteness({ candidates: relevantCandidates, sourceBlocks: relevantBlocks });
}
