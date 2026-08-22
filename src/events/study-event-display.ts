import type { CalendarEvent } from './event.types';
import type { StudyGroupScope } from '../study/study.types';

export interface StudyEventGroupMetadata {
  groupTags: string[];
  groupScope: StudyGroupScope;
}

export interface StudyEventDisplay {
  groupLabel?: string;
  description?: string;
}

const LEGACY_GROUP_SEGMENT = /^Grup(a|y)\s+(\d{1,2}[ABC]?(?:\s*,\s*\d{1,2}[ABC]?)*?)$/i;

function uniqueGroups(groups: string[] | undefined): string[] {
  if (!groups?.length) return [];
  return [...new Set(groups.map((group) => group.trim()).filter(Boolean))];
}

function legacyGroupInfo(description: string | undefined): { groups: string[]; description?: string } {
  if (!description) return { groups: [] };
  const segments = description.split(' - ').map((segment) => segment.trim()).filter(Boolean);
  const groups: string[] = [];
  const kept: string[] = [];

  for (const segment of segments) {
    const match = segment.match(LEGACY_GROUP_SEGMENT);
    if (!match?.[2]) {
      kept.push(segment);
      continue;
    }
    const parsed = match[2].split(',').map((group) => group.trim()).filter(Boolean);
    if (!parsed.length) kept.push(segment);
    else groups.push(...parsed);
  }

  return {
    groups: uniqueGroups(groups),
    ...(kept.length ? { description: kept.join(' - ') } : {}),
  };
}

export function studyEventDisplay(event: CalendarEvent, metadata?: StudyEventGroupMetadata): StudyEventDisplay {
  if (event.source !== 'UNIVERSITY_XLSX') return event.description ? { description: event.description } : {};

  const legacy = legacyGroupInfo(event.description);
  const explicitGroups = uniqueGroups(metadata?.groupTags);
  const groups = explicitGroups.length ? explicitGroups : legacy.groups;
  const groupLabel = groups.length
    ? `${groups.length === 1 ? 'Grupa' : 'Grupy'} ${groups.join(', ')}`
    : metadata?.groupScope === 'ALL'
      ? 'Wspólne'
      : undefined;

  return {
    ...(groupLabel ? { groupLabel } : {}),
    ...(legacy.description ? { description: legacy.description } : {}),
  };
}
