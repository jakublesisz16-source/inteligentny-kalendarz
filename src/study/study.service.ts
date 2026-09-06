import { groupSetsIntersect, parseStudyGroupKey, studyGroupDisplayLabel } from '../imports/xlsx/group-normalizer';
import { isValidStudyDate, isValidStudyTime } from '../imports/xlsx/import-validation';
import type { CalendarEvent, UserModifiedEventField } from '../events/event.types';
import type { ScheduleAnalysis, ScheduleDiffItem, StudyScheduleCandidate, StudyScheduleConflict } from './study.types';

export async function hashFile(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function candidatesForSelectedGroups(analysis: ScheduleAnalysis, selectedGroups: string[]): StudyScheduleCandidate[] {
  const matching = analysis.candidates.filter((candidate) => {
    if (candidate.groupScope === 'ALL' || candidate.groupScope === 'UNKNOWN') return true;
    return groupSetsIntersect(candidate.groupTags, selectedGroups);
  });

  const deduped = new Map<string, StudyScheduleCandidate>();
  for (const candidate of matching) {
    const signature = [candidate.date, candidate.startTime, candidate.endTime, candidate.subject.toLowerCase(), candidate.address ?? candidate.locationLabel ?? '', candidate.clinic ?? '', candidate.room ?? ''].join('|');
    const existing = deduped.get(signature);
    if (!existing) {
      deduped.set(signature, { ...candidate, groupTags: [...candidate.groupTags], warnings: [...candidate.warnings] });
      continue;
    }
    existing.groupTags = [...new Set([...existing.groupTags, ...candidate.groupTags])];
    existing.warnings = [...new Set([...existing.warnings, ...candidate.warnings])];
    existing.sourceRange = `${existing.sourceRange}, ${candidate.sourceRange}`;
    existing.originalText = `${existing.originalText} || ${candidate.originalText}`;
    existing.sourceKey = `${existing.sourceKey}||${candidate.sourceKey}`;
  }
  return [...deduped.values()].sort((a, b) => `${a.date ?? ''}${a.startTime ?? ''}${a.subject}`.localeCompare(`${b.date ?? ''}${b.startTime ?? ''}${b.subject}`, 'pl'));
}

export interface StudyGroupSelectionValidation {
  valid: boolean;
  errors: string[];
  mainNumber?: number;
}

export function validateStudyGroupSelection(availableGroups: string[], selectedGroups: string[]): StudyGroupSelectionValidation {
  if (!availableGroups.length) return { valid: true, errors: [] };
  const errors: string[] = [];
  if (!selectedGroups.length) return { valid: false, errors: ['Wybierz swoje przypisania grupowe.'] };

  const availableSet = new Set(availableGroups);
  const unknown = selectedGroups.filter((group) => !availableSet.has(group));
  if (unknown.length) errors.push(`Wybrano grupę, której nie ma w tym planie: ${unknown.map(studyGroupDisplayLabel).join(', ')}.`);

  const available = availableGroups.map(parseStudyGroupKey);
  const selected = selectedGroups.map(parseStudyGroupKey);
  const hasStructuredGroups = available.some((group) => group.encoded && group.kind !== 'GENERIC');
  if (!hasStructuredGroups) return { valid: errors.length === 0, errors };

  const selectedStructured = selected.filter((group) => group.encoded && group.kind !== 'GENERIC' && group.number);
  const mainNumbers = [...new Set(selectedStructured.map((group) => group.number!))];
  if (!mainNumbers.length) {
    errors.push('Ten plan ma wielopoziomowy podział grup. Wybierz grupę z rozpoznanego podziału, nie tylko oznaczenie ogólne.');
    return { valid: false, errors };
  }
  if (mainNumbers.length > 1) {
    errors.push(`Wybrane grupy należą do różnych grup głównych (${mainNumbers.join(', ')}). Dla jednego kalendarza wybierz przypisania jednej osoby.`);
    return { valid: false, errors };
  }

  const mainNumber = mainNumbers[0]!;
  const availableForMain = available.filter((group) => group.number === mainNumber);
  const selectedForMain = selected.filter((group) => group.number === mainNumber);

  const requiredPartition = (kind: 'G12' | 'G8' | 'G4', label: string) => {
    if (!availableForMain.some((group) => group.kind === kind)) return;
    const count = selectedForMain.filter((group) => group.kind === kind).length;
    if (count === 0) errors.push(`Brakuje przypisania: ${label}.`);
    if (count > 1) errors.push(`Wybrano więcej niż jedną ${label.toLowerCase()}. Wybierz dokładnie jedną.`);
  };

  // Podział 4-osobowy jednoznacznie określa podział 8-osobowy, więc nie wymagamy osobnego kliknięcia G8.
  // Podział 12-osobowy przecina podział 8-osobowy i zawsze musi być wskazany niezależnie, jeżeli występuje w planie.
  requiredPartition('G12', 'grupa 12-osobowa');
  const hasG4 = availableForMain.some((group) => group.kind === 'G4');
  if (hasG4) requiredPartition('G4', 'grupa 4-osobowa');
  else requiredPartition('G8', 'grupa 8-osobowa');

  // G4 jednoznacznie wyznacza G8, dlatego przy planach z G4 wybór G8 jest opcjonalny.
  // Jeżeli użytkownik mimo to zaznaczy G8, może wskazać najwyżej jedną i musi ona być
  // zgodna z literą wybranej G4. Kilka G8 naraz oznaczałoby zajęcia różnych osób.
  if (hasG4) {
    const g8Count = selectedForMain.filter((group) => group.kind === 'G8').length;
    if (g8Count > 1) errors.push('Wybrano więcej niż jedną grupę 8-osobową. Wybierz najwyżej jedną.');
  }

  const chosenG4 = selectedForMain.find((group) => group.kind === 'G4');
  const chosenG8 = selectedForMain.find((group) => group.kind === 'G8');
  if (chosenG4?.letter && chosenG8?.letter && chosenG4.letter !== chosenG8.letter) {
    errors.push(`Grupa 4-osobowa ${chosenG4.label} należy do podgrupy ${mainNumber}${chosenG4.letter}, a wybrano inną grupę 8-osobową ${chosenG8.label}.`);
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)], mainNumber };
}

function minutes(value: string | undefined): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour! < 0 || hour! > 23 || minute! < 0 || minute! > 59) return null;
  return hour! * 60 + minute!;
}

export function findStudyScheduleConflicts(candidates: StudyScheduleCandidate[]): StudyScheduleConflict[] {
  const byDate = new Map<string, StudyScheduleCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.include === false || !candidate.date) continue;
    const start = minutes(candidate.startTime);
    const end = minutes(candidate.endTime);
    if (start === null || end === null || end <= start) continue;
    const list = byDate.get(candidate.date) ?? [];
    list.push(candidate);
    byDate.set(candidate.date, list);
  }

  const conflicts: StudyScheduleConflict[] = [];
  for (const [date, entries] of byDate.entries()) {
    const sorted = [...entries].sort((a, b) => (minutes(a.startTime) ?? 0) - (minutes(b.startTime) ?? 0) || a.id.localeCompare(b.id));
    for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
      const left = sorted[leftIndex]!;
      const leftEnd = minutes(left.endTime)!;
      for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
        const right = sorted[rightIndex]!;
        const rightStart = minutes(right.startTime)!;
        if (rightStart >= leftEnd) break;
        const rightEnd = minutes(right.endTime)!;
        const leftStart = minutes(left.startTime)!;
        if (leftStart < rightEnd && rightStart < leftEnd) {
          conflicts.push({ id: `${date}|${left.id}|${right.id}`, date, left, right });
        }
      }
    }
  }
  return conflicts;
}


function eventFieldDateTime(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match || !isValidStudyDate(match[1]) || !isValidStudyTime(match[2])) return null;
  return { date: match[1], time: match[2] };
}

function legacyPreservedFields(event: CalendarEvent): UserModifiedEventField[] {
  if (!event.userModified) return [];
  if (event.userModifiedFields?.length) return [...event.userModifiedFields];
  return ['title', 'startDateTime', 'endDateTime', 'locationId', 'description', 'category'];
}

function preservedFieldsForDecision(item: ScheduleDiffItem, event: CalendarEvent): Set<UserModifiedEventField> {
  if (item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution === 'USE_NEW') return new Set();
  const fields = new Set<UserModifiedEventField>(legacyPreservedFields(event));
  // Data wydarzenia jest wspólna dla początku i końca. Jeżeli nowy plan zmienia datę,
  // a użytkownik chce zachować własną zmianę jednego z pól datetime, zachowujemy oba.
  // Inaczej można utworzyć zakres przechodzący przypadkiem między dwoma dniami albo z końcem przed początkiem.
  if (item.resolution !== 'USE_NEW' && item.changes.some((change) => change.field === 'date')
    && (fields.has('startDateTime') || fields.has('endDateTime'))) {
    fields.add('startDateTime');
    fields.add('endDateTime');
  }
  if (item.kind === 'CHANGED' && item.resolution === 'SKIP') {
    for (const change of item.changes) {
      if (change.field === 'subject') fields.add('title');
      if (change.field === 'date') {
        fields.add('startDateTime');
        fields.add('endDateTime');
      }
      if (change.field === 'startTime') fields.add('startDateTime');
      if (change.field === 'endTime') fields.add('endDateTime');
      if (change.field === 'address' || change.field === 'locationLabel') fields.add('locationId');
      if (change.field === 'room' || change.field === 'clinic' || change.field === 'activityType' || change.field === 'groupTags') fields.add('description');
    }
  }
  return fields;
}

function candidateFromExistingEvent(event: CalendarEvent, item: ScheduleDiffItem): StudyScheduleCandidate | null {
  const start = eventFieldDateTime(event.startDateTime);
  const end = eventFieldDateTime(event.endDateTime);
  if (!start || !end || start.date !== end.date) return null;
  return {
    id: `existing:${event.id}`,
    adapterId: item.newCandidate?.adapterId ?? item.oldEntry?.adapterId ?? 'nursing-plan-v1',
    sourceSheet: item.newCandidate?.sourceSheet ?? item.oldEntry?.sourceSheet ?? 'calendar',
    sourceRange: item.newCandidate?.sourceRange ?? item.oldEntry?.sourceRange ?? event.id,
    sourceKey: item.newCandidate?.sourceKey ?? item.oldEntry?.sourceKey ?? event.id,
    originalText: item.newCandidate?.originalText ?? item.oldEntry?.originalText ?? event.title,
    subject: event.title,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    groupScope: item.newCandidate?.groupScope ?? item.oldEntry?.groupScope ?? event.studyGroupScope ?? 'UNKNOWN',
    groupTags: [...(item.newCandidate?.groupTags ?? item.oldEntry?.groupTags ?? event.studyGroupTags ?? [])],
    status: 'READY',
    warnings: [],
    include: true,
  };
}

function candidateForUpdateDecision(item: ScheduleDiffItem): StudyScheduleCandidate | null {
  const candidate = item.newCandidate;
  const oldEvent = item.oldEventSnapshot;

  if (item.kind === 'AMBIGUOUS') return oldEvent ? candidateFromExistingEvent(oldEvent, item) : null;

  if (item.kind === 'REMOVED' || (item.kind === 'CONFLICT_USER_MODIFIED' && !candidate)) {
    if (item.resolution === 'APPLY' || item.resolution === 'USE_NEW') return null;
    return oldEvent ? candidateFromExistingEvent(oldEvent, item) : null;
  }

  if (item.oldEntry?.userDeleted && !oldEvent) {
    if (item.resolution === 'KEEP_USER' || item.resolution === 'SKIP') return null;
    return candidate && isValidStudyDate(candidate.date) && isValidStudyTime(candidate.startTime) && isValidStudyTime(candidate.endTime) ? candidate : null;
  }

  if (!candidate) return null;
  if ((item.kind === 'ADDED' || !oldEvent) && item.resolution === 'SKIP') return null;
  if (!isValidStudyDate(candidate.date) || !isValidStudyTime(candidate.startTime) || !isValidStudyTime(candidate.endTime)) {
    return oldEvent ? candidateFromExistingEvent(oldEvent, item) : null;
  }
  if (!oldEvent) return candidate;

  const preserve = preservedFieldsForDecision(item, oldEvent);
  const result: StudyScheduleCandidate = { ...candidate, groupTags: [...candidate.groupTags], warnings: [...candidate.warnings] };
  const oldStart = eventFieldDateTime(oldEvent.startDateTime);
  const oldEnd = eventFieldDateTime(oldEvent.endDateTime);
  if (preserve.has('title')) result.subject = oldEvent.title;
  if (preserve.has('startDateTime') && oldStart) {
    result.date = oldStart.date;
    result.startTime = oldStart.time;
  }
  if (preserve.has('endDateTime') && oldEnd) {
    if (!preserve.has('startDateTime') && oldStart && oldStart.date !== oldEnd.date) return null;
    result.date = oldEnd.date;
    result.endTime = oldEnd.time;
  }
  return result;
}

export function findStudyUpdateDecisionConflicts(items: ScheduleDiffItem[]): StudyScheduleConflict[] {
  const candidates = items.map(candidateForUpdateDecision).filter((candidate): candidate is StudyScheduleCandidate => Boolean(candidate));
  return findStudyScheduleConflicts(candidates);
}
