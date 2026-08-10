import type { CalendarEvent } from '../events/event.types';
import { reviewCandidate } from './import-review';
import { identifyCandidate, identifyEntry } from './study-identity';
import type {
  ScheduleDiffFieldChange,
  ScheduleDiffItem,
  ScheduleDiffSummary,
  StudyScheduleCandidate,
  UniversityImportEntry,
} from './study.types';

function asText(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function groupsText(groups: string[]): string | undefined {
  const normalized = [...new Set(groups.map((group) => group.trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
  return normalized.length ? normalized.join(', ') : undefined;
}

function change(
  field: ScheduleDiffFieldChange['field'],
  label: string,
  before: string | undefined,
  after: string | undefined,
  changeType: ScheduleDiffFieldChange['changeType'],
): ScheduleDiffFieldChange | undefined {
  if ((before ?? '') === (after ?? '')) return undefined;
  return { field, label, ...(before ? { before } : {}), ...(after ? { after } : {}), changeType };
}

export function changesBetweenEntryAndCandidate(entry: UniversityImportEntry, candidate: StudyScheduleCandidate): ScheduleDiffFieldChange[] {
  const changes = [
    change('subject', 'Przedmiot', asText(entry.subject), asText(candidate.subject), 'CHANGED_DETAILS'),
    change('activityType', 'Rodzaj zajęć', asText(entry.activityType), asText(candidate.activityType), 'CHANGED_DETAILS'),
    change('date', 'Data', asText(entry.date), asText(candidate.date), 'CHANGED_DATE'),
    change('startTime', 'Początek', asText(entry.startTime), asText(candidate.startTime), 'CHANGED_TIME'),
    change('endTime', 'Koniec', asText(entry.endTime), asText(candidate.endTime), 'CHANGED_TIME'),
    change('groupTags', 'Grupy', groupsText(entry.groupTags), groupsText(candidate.groupTags), 'CHANGED_GROUP'),
    change('clinic', 'Klinika', asText(entry.clinic), asText(candidate.clinic), 'CHANGED_LOCATION'),
    change('room', 'Sala', asText(entry.room), asText(candidate.room), 'CHANGED_LOCATION'),
    change('address', 'Adres', asText(entry.address), asText(candidate.address), 'CHANGED_LOCATION'),
    change('locationLabel', 'Lokalizacja', asText(entry.locationLabel), asText(candidate.locationLabel), 'CHANGED_LOCATION'),
  ].filter((item): item is ScheduleDiffFieldChange => Boolean(item));
  return changes;
}

function eventFieldsForChange(change: ScheduleDiffFieldChange): string[] {
  switch (change.field) {
    case 'subject': return ['title'];
    case 'date':
    case 'startTime': return ['startDateTime'];
    case 'endTime': return ['endDateTime'];
    case 'address':
    case 'locationLabel': return ['locationId'];
    case 'room':
    case 'clinic':
    case 'activityType':
    case 'groupTags': return ['description'];
    default: return [];
  }
}

function hasUserConflict(event: CalendarEvent | undefined, changes: ScheduleDiffFieldChange[], removal = false): boolean {
  if (!event?.userModified) return false;
  if (removal) return true;
  const modifiedFields = event.userModifiedFields;
  if (!modifiedFields?.length) return changes.length > 0;
  const relevant = new Set(changes.flatMap(eventFieldsForChange));
  return modifiedFields.some((field) => relevant.has(field));
}

function daysBetween(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const left = Date.parse(`${a}T12:00:00`);
  const right = Date.parse(`${b}T12:00:00`);
  if (Number.isNaN(left) || Number.isNaN(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right) / 86_400_000;
}

function timeDistance(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 1_000_000;
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  };
  return Math.abs(toMinutes(a) - toMinutes(b));
}

function diffId(prefix: string, oldEntry?: UniversityImportEntry, candidate?: StudyScheduleCandidate): string {
  return `${prefix}:${oldEntry?.occurrenceKey ?? oldEntry?.id ?? 'none'}:${candidate?.occurrenceKey ?? candidate?.id ?? 'none'}`;
}

function summarize(items: ScheduleDiffItem[]): ScheduleDiffSummary {
  return items.reduce<ScheduleDiffSummary>((summary, item) => {
    if (item.kind === 'ADDED') summary.added += 1;
    else if (item.kind === 'REMOVED') summary.removed += 1;
    else if (item.kind === 'CHANGED') summary.changed += 1;
    else if (item.kind === 'CONFLICT_USER_MODIFIED') summary.conflicts += 1;
    else if (item.kind === 'UNCHANGED') summary.unchanged += 1;
    else if (item.kind === 'AMBIGUOUS') summary.ambiguous += 1;
    return summary;
  }, { added: 0, removed: 0, changed: 0, conflicts: 0, unchanged: 0, ambiguous: 0 });
}

export interface BuildScheduleDiffInput {
  oldEntries: UniversityImportEntry[];
  oldEvents: CalendarEvent[];
  newCandidates: StudyScheduleCandidate[];
  adapterId: string;
}

export interface BuildScheduleDiffResult {
  items: ScheduleDiffItem[];
  summary: ScheduleDiffSummary;
}

export function buildScheduleDiff(input: BuildScheduleDiffInput): BuildScheduleDiffResult {
  const oldEntries = input.oldEntries
    .filter((entry) => Boolean(entry.eventId))
    .map((entry) => identifyEntry(entry, input.adapterId));
  const newCandidates = input.newCandidates.map(identifyCandidate);
  const eventById = new Map(input.oldEvents.map((event) => [event.id, event]));
  const unmatchedOld = new Map(oldEntries.map((entry) => [entry.id, entry]));
  const unmatchedNew = new Map(newCandidates.map((candidate) => [candidate.id, candidate]));
  const items: ScheduleDiffItem[] = [];

  const oldByOccurrence = new Map<string, UniversityImportEntry[]>();
  for (const entry of oldEntries) {
    if (!entry.occurrenceKey) continue;
    const list = oldByOccurrence.get(entry.occurrenceKey) ?? [];
    list.push(entry);
    oldByOccurrence.set(entry.occurrenceKey, list);
  }

  for (const candidate of newCandidates) {
    if (!candidate.occurrenceKey) continue;
    const matches = (oldByOccurrence.get(candidate.occurrenceKey) ?? []).filter((entry) => unmatchedOld.has(entry.id));
    if (matches.length !== 1) continue;
    const oldEntry = matches[0]!;
    unmatchedOld.delete(oldEntry.id);
    unmatchedNew.delete(candidate.id);
    const changes = changesBetweenEntryAndCandidate(oldEntry, candidate);
    const event = oldEntry.eventId ? eventById.get(oldEntry.eventId) : undefined;
    const blocking = !reviewCandidate(candidate).canImport;
    const conflict = hasUserConflict(event, changes);
    items.push({
      id: diffId(blocking ? 'ambiguous' : conflict ? 'conflict' : changes.length ? 'changed' : 'unchanged', oldEntry, candidate),
      kind: blocking ? 'AMBIGUOUS' : conflict ? 'CONFLICT_USER_MODIFIED' : changes.length ? 'CHANGED' : 'UNCHANGED',
      changeTypes: [...new Set(changes.map((entry) => entry.changeType))],
      changes,
      oldEntry,
      newCandidate: candidate,
      ...(oldEntry.eventId ? { oldEventId: oldEntry.eventId } : {}),
      ...(event?.userModified ? { oldEventUserModified: true } : {}),
      ...(event?.userModifiedFields?.length ? { oldEventUserModifiedFields: [...event.userModifiedFields] } : {}),
      resolution: blocking ? 'SKIP' : conflict ? 'SKIP' : 'APPLY',
      ...(blocking ? { note: 'Nowy wpis ma nierozwiązany brak krytyczny i nie zostanie zastosowany automatycznie.' } : {}),
    });
  }

  // Second pass: sourceKey from the adapter can stay stable when group, clinic or
  // location details change while the source block itself remains the same.
  const oldBySourceKey = new Map<string, UniversityImportEntry[]>();
  for (const entry of unmatchedOld.values()) {
    if (!entry.sourceKey) continue;
    const list = oldBySourceKey.get(entry.sourceKey) ?? [];
    list.push(entry);
    oldBySourceKey.set(entry.sourceKey, list);
  }
  for (const candidate of [...unmatchedNew.values()]) {
    if (!candidate.sourceKey) continue;
    const matches = (oldBySourceKey.get(candidate.sourceKey) ?? []).filter((entry) => unmatchedOld.has(entry.id));
    if (matches.length !== 1) continue;
    const oldEntry = matches[0]!;
    unmatchedOld.delete(oldEntry.id);
    unmatchedNew.delete(candidate.id);
    const changes = changesBetweenEntryAndCandidate(oldEntry, candidate);
    const event = oldEntry.eventId ? eventById.get(oldEntry.eventId) : undefined;
    const blocking = !reviewCandidate(candidate).canImport;
    const conflict = hasUserConflict(event, changes);
    items.push({
      id: diffId(blocking ? 'ambiguous-source' : conflict ? 'conflict-source' : changes.length ? 'changed-source' : 'unchanged-source', oldEntry, candidate),
      kind: blocking ? 'AMBIGUOUS' : conflict ? 'CONFLICT_USER_MODIFIED' : changes.length ? 'CHANGED' : 'UNCHANGED',
      changeTypes: [...new Set(changes.map((entry) => entry.changeType))],
      changes,
      oldEntry,
      newCandidate: candidate,
      ...(oldEntry.eventId ? { oldEventId: oldEntry.eventId } : {}),
      ...(event?.userModified ? { oldEventUserModified: true } : {}),
      ...(event?.userModifiedFields?.length ? { oldEventUserModifiedFields: [...event.userModifiedFields] } : {}),
      resolution: blocking ? 'SKIP' : conflict ? 'SKIP' : 'APPLY',
      ...(blocking ? { note: 'Nowy wpis ma nierozwiązany brak krytyczny i wymaga ręcznej kontroli.' } : {}),
    });
  }

  // Conservative third pass: same series, with an unambiguous closest date/time candidate.
  const seriesKeys = new Set([...unmatchedOld.values()].map((entry) => entry.seriesKey).filter(Boolean));
  for (const seriesKey of seriesKeys) {
    if (!seriesKey) continue;
    const olds = [...unmatchedOld.values()].filter((entry) => entry.seriesKey === seriesKey);
    const news = [...unmatchedNew.values()].filter((candidate) => candidate.seriesKey === seriesKey);
    if (!olds.length || !news.length) continue;

    const pairs = news.flatMap((candidate) => olds.map((entry) => ({
      candidate,
      entry,
      days: daysBetween(entry.date, candidate.date),
      time: timeDistance(entry.startTime, candidate.startTime),
    }))).sort((a, b) => a.days - b.days || a.time - b.time);

    while (pairs.length) {
      const pair = pairs.shift()!;
      if (!unmatchedOld.has(pair.entry.id) || !unmatchedNew.has(pair.candidate.id)) continue;
      const competing = pairs.filter((other) => unmatchedOld.has(other.entry.id) && unmatchedNew.has(other.candidate.id) && (other.entry.id === pair.entry.id || other.candidate.id === pair.candidate.id));
      const equalBest = competing.some((other) => other.days === pair.days && other.time === pair.time);
      if (equalBest || pair.days > 31) continue;

      unmatchedOld.delete(pair.entry.id);
      unmatchedNew.delete(pair.candidate.id);
      const changes = changesBetweenEntryAndCandidate(pair.entry, pair.candidate);
      const event = pair.entry.eventId ? eventById.get(pair.entry.eventId) : undefined;
      const blocking = !reviewCandidate(pair.candidate).canImport;
      const conflict = hasUserConflict(event, changes);
      items.push({
        id: diffId(blocking ? 'ambiguous' : conflict ? 'conflict' : 'changed', pair.entry, pair.candidate),
        kind: blocking ? 'AMBIGUOUS' : conflict ? 'CONFLICT_USER_MODIFIED' : changes.length ? 'CHANGED' : 'UNCHANGED',
        changeTypes: [...new Set(changes.map((entry) => entry.changeType))],
        changes,
        oldEntry: pair.entry,
        newCandidate: pair.candidate,
        ...(pair.entry.eventId ? { oldEventId: pair.entry.eventId } : {}),
        ...(event?.userModified ? { oldEventUserModified: true } : {}),
        ...(event?.userModifiedFields?.length ? { oldEventUserModifiedFields: [...event.userModifiedFields] } : {}),
        resolution: blocking ? 'SKIP' : conflict ? 'SKIP' : 'APPLY',
        ...(blocking ? { note: 'Nowy wpis ma nierozwiązany brak krytyczny i wymaga ręcznej kontroli.' } : {}),
      });
    }
  }

  for (const candidate of unmatchedNew.values()) {
    const blocking = !reviewCandidate(candidate).canImport;
    items.push({
      id: diffId(blocking ? 'ambiguous-new' : 'added', undefined, candidate),
      kind: blocking ? 'AMBIGUOUS' : 'ADDED',
      changeTypes: [],
      changes: [],
      newCandidate: candidate,
      resolution: blocking ? 'SKIP' : 'APPLY',
      ...(blocking ? { note: 'Nowy wpis wymaga uzupełnienia danych krytycznych przed dodaniem.' } : {}),
    });
  }

  for (const oldEntry of unmatchedOld.values()) {
    const event = oldEntry.eventId ? eventById.get(oldEntry.eventId) : undefined;
    const conflict = hasUserConflict(event, [], true);
    items.push({
      id: diffId(conflict ? 'conflict-removed' : 'removed', oldEntry),
      kind: conflict ? 'CONFLICT_USER_MODIFIED' : 'REMOVED',
      changeTypes: [],
      changes: [],
      oldEntry,
      ...(oldEntry.eventId ? { oldEventId: oldEntry.eventId } : {}),
      ...(event?.userModified ? { oldEventUserModified: true } : {}),
      ...(event?.userModifiedFields?.length ? { oldEventUserModifiedFields: [...event.userModifiedFields] } : {}),
      resolution: conflict ? 'SKIP' : 'APPLY',
      ...(conflict ? { note: 'Wydarzenie zostało ręcznie zmienione, a w nowym planie już go nie ma.' } : {}),
    });
  }

  items.sort((a, b) => {
    const aDate = a.newCandidate?.date ?? a.oldEntry?.date ?? '';
    const bDate = b.newCandidate?.date ?? b.oldEntry?.date ?? '';
    return `${aDate}${a.newCandidate?.startTime ?? a.oldEntry?.startTime ?? ''}`.localeCompare(`${bDate}${b.newCandidate?.startTime ?? b.oldEntry?.startTime ?? ''}`);
  });
  return { items, summary: summarize(items) };
}

export function recalculateDiffSummary(items: ScheduleDiffItem[]): ScheduleDiffSummary {
  return summarize(items);
}
