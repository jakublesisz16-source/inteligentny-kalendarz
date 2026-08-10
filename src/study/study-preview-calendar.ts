import { createMonthGrid, localDateFromKey, sameMonth, toLocalDateKey } from '../calendar/date.utils';
import type { StudyScheduleCandidate } from './study.types';

export type StudyPreviewEventsByDate = Map<string, StudyScheduleCandidate[]>;

function candidateSortKey(candidate: StudyScheduleCandidate): string {
  return `${candidate.startTime ?? '99:99'}|${candidate.endTime ?? '99:99'}|${candidate.subject}|${candidate.id}`;
}

export function groupStudyPreviewEventsByDate(candidates: StudyScheduleCandidate[]): StudyPreviewEventsByDate {
  const grouped: StudyPreviewEventsByDate = new Map();
  for (const candidate of candidates) {
    if (!candidate.date || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) continue;
    const current = grouped.get(candidate.date) ?? [];
    current.push(candidate);
    grouped.set(candidate.date, current);
  }
  for (const [date, values] of grouped) {
    grouped.set(date, [...values].sort((a, b) => candidateSortKey(a).localeCompare(candidateSortKey(b), 'pl')));
  }
  return grouped;
}

export function getStudyPreviewDayEvents(grouped: StudyPreviewEventsByDate, dateKey: string): StudyScheduleCandidate[] {
  return grouped.get(dateKey) ?? [];
}

export function getStudyPreviewMonthGrid(month: Date): Date[] {
  return createMonthGrid(month);
}

export function selectStudyPreviewDateForMonth(
  month: Date,
  grouped: StudyPreviewEventsByDate,
  today: Date = new Date(),
): string {
  const monthDates = [...grouped.keys()]
    .filter((key) => sameMonth(localDateFromKey(key), month))
    .sort();
  if (monthDates.length) return monthDates[0] ?? toLocalDateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  if (sameMonth(today, month)) return toLocalDateKey(today);
  return toLocalDateKey(new Date(month.getFullYear(), month.getMonth(), 1));
}

export function initialStudyPreviewMonth(candidates: StudyScheduleCandidate[], today: Date = new Date()): Date {
  const grouped = groupStudyPreviewEventsByDate(candidates);
  const todayKey = toLocalDateKey(today);
  if (grouped.has(todayKey) || [...grouped.keys()].some((key) => sameMonth(localDateFromKey(key), today))) {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
  const first = [...grouped.keys()].sort()[0];
  if (first) {
    const date = localDateFromKey(first);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

export function undatedStudyPreviewCount(candidates: StudyScheduleCandidate[]): number {
  return candidates.filter((candidate) => !candidate.date || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)).length;
}
