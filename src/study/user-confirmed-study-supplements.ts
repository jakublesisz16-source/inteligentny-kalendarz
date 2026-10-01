import { isKnownStudyDayOff } from '../calendar/calendar-overlays';
import type { StudyScheduleCandidate, UniversityImportEntry } from './study.types';

export const ENGLISH_MONDAY_SUPPLEMENT_SERIES_ID = 'study-user-confirmed-english-monday-v1';
export const ENGLISH_MONDAY_SUPPLEMENT_META_KEY = 'studySupplement.englishMonday.v1';
export const ENGLISH_MONDAY_SUPPLEMENT_TITLE = 'Język angielski';
export const ENGLISH_MONDAY_SUPPLEMENT_START = '17:15';
export const ENGLISH_MONDAY_SUPPLEMENT_END = '18:45';
export const ENGLISH_MONDAY_SUPPLEMENT_PROFILE = ['MAIN:11'] as const;

function canonicalGroups(groups: readonly string[]): string[] {
  return [...new Set(groups.map((group) => group.trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
}

export function matchesEnglishMondaySupplementProfile(selectedGroups: readonly string[]): boolean {
  const actual = new Set(canonicalGroups(selectedGroups));
  return ENGLISH_MONDAY_SUPPLEMENT_PROFILE.every((group) => actual.has(group));
}

function validDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayKeysBetween(startKey: string, endKey: string): string[] {
  const current = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  while (current.getDay() !== 1) current.setDate(current.getDate() + 1);
  const dates: string[] = [];
  while (current <= end) {
    dates.push(dateKey(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

export interface EnglishMondaySupplementDates {
  sourceStart?: string;
  sourceEnd?: string;
  dates: string[];
  skippedDaysOff: string[];
}

export function englishMondaySupplementDates(
  candidates: Array<Pick<StudyScheduleCandidate | UniversityImportEntry, 'date'>>,
): EnglishMondaySupplementDates {
  const dated = candidates.map((candidate) => candidate.date).filter(validDateKey).sort();
  if (!dated.length) return { dates: [], skippedDaysOff: [] };
  const sourceStart = dated[0]!;
  const sourceEnd = dated[dated.length - 1]!;
  const mondays = mondayKeysBetween(sourceStart, sourceEnd);
  const skippedDaysOff = mondays.filter(isKnownStudyDayOff);
  const dates = mondays.filter((key) => !isKnownStudyDayOff(key));
  return { sourceStart, sourceEnd, dates, skippedDaysOff };
}
