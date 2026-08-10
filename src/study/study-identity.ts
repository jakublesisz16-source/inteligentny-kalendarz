import { normalizeClinicLabel } from '../imports/xlsx/parser-normalization';
import type { StudyScheduleCandidate, UniversityImportEntry } from './study.types';

function normalized(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedGroups(groups: string[]): string {
  return [...new Set(groups.map((group) => group.trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')).join(',');
}

function stableToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export interface StudyIdentityInput {
  adapterId?: string;
  sourceSheet: string;
  subject: string;
  activityType?: string;
  groupTags: string[];
  clinic?: string;
  date?: string;
  startTime?: string;
}

export function buildSeriesKey(input: StudyIdentityInput): string {
  const raw = [
    normalized(input.adapterId || 'nursing-plan-v1'),
    normalized(input.sourceSheet),
    normalized(input.subject),
    normalized(input.activityType),
    normalizedGroups(input.groupTags),
    normalized(normalizeClinicLabel(input.clinic ?? '') ?? input.clinic),
  ].join('|');
  return `series-${stableToken(raw)}`;
}

export function buildOccurrenceKey(input: StudyIdentityInput): string | undefined {
  if (!input.date) return undefined;
  const seriesKey = buildSeriesKey(input);
  const raw = `${seriesKey}|${input.date}|${input.startTime ?? ''}`;
  return `occ-${stableToken(raw)}`;
}

export function identifyCandidate(candidate: StudyScheduleCandidate): StudyScheduleCandidate {
  const seriesKey = buildSeriesKey(candidate);
  const occurrenceKey = buildOccurrenceKey(candidate);
  return {
    ...candidate,
    seriesKey,
    ...(occurrenceKey ? { occurrenceKey } : {}),
  };
}

export function identifyEntry(entry: UniversityImportEntry, adapterId = entry.adapterId ?? 'nursing-plan-v1'): UniversityImportEntry {
  const input: StudyIdentityInput = { ...entry, adapterId };
  const seriesKey = buildSeriesKey(input);
  const occurrenceKey = buildOccurrenceKey(input);
  return {
    ...entry,
    adapterId,
    seriesKey,
    ...(occurrenceKey ? { occurrenceKey } : {}),
  };
}

export function sameSeries(a: StudyIdentityInput, b: StudyIdentityInput): boolean {
  return buildSeriesKey(a) === buildSeriesKey(b);
}
