import type { CalendarEvent } from '../events/event.types';
import type {
  CoworkerOverlap,
  ParsedEmployeeSchedule,
  WorkCollision,
  WorkCoworkerShift,
  WorkCoworkerShiftDraft,
  WorkImportCandidate,
  WorkScheduleDiff,
  WorkScheduleDiffItem,
  WorkScheduleEntry,
} from './work.types';
import { normalizeWorkPersonName } from '../imports/pdf/adapters/retail-roster-v1.adapter';

export function workMinutes(startTime: string, endTime: string): number {
  const [shText = '0', smText = '0'] = startTime.split(':');
  const [ehText = '0', emText = '0'] = endTime.split(':');
  const start = Number(shText) * 60 + Number(smText);
  let end = Number(ehText) * 60 + Number(emText);
  if (end <= start) end += 1440;
  return end - start;
}

export function workDateTimes(date: string, startTime: string, endTime: string): { startDateTime: string; endDateTime: string; crossesMidnight: boolean } {
  const startDateTime = `${date}T${startTime}`;
  const crossesMidnight = endTime <= startTime;
  if (!crossesMidnight) return { startDateTime, endDateTime: `${date}T${endTime}`, crossesMidnight: false };
  const noon = new Date(`${date}T12:00:00`);
  noon.setDate(noon.getDate() + 1);
  const nextDate = `${noon.getFullYear()}-${String(noon.getMonth() + 1).padStart(2, '0')}-${String(noon.getDate()).padStart(2, '0')}`;
  return { startDateTime, endDateTime: `${nextDate}T${endTime}`, crossesMidnight: true };
}

export function formatWorkMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatPersonCount(count: number): string {
  const value = Math.max(0, Math.trunc(count));
  const lastTwo = value % 100;
  const last = value % 10;
  const noun = value === 1 ? 'osoba' : last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? 'osoby' : 'osób';
  return `${value} ${noun}`;
}

function stableText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function buildWorkOccurrenceKey(profileId: string, date: string, startTime: string, endTime: string): string {
  return `work|${stableText(profileId)}|${date}|${startTime}|${endTime}`;
}

export function employeeForProfile(employees: ParsedEmployeeSchedule[], employeeMatchName: string): ParsedEmployeeSchedule | undefined {
  const target = normalizeWorkPersonName(employeeMatchName);
  if (!target) return undefined;
  const matches = employees.filter((employee) => employee.normalizedName === target);
  return matches.length === 1 ? matches[0] : undefined;
}

export function candidatesFromEmployee(profileId: string, employee: ParsedEmployeeSchedule): WorkImportCandidate[] {
  return employee.shifts.map((shift) => ({
    ...shift,
    status: 'READY' as const,
    issues: [],
    workOccurrenceKey: buildWorkOccurrenceKey(profileId, shift.date, shift.startTime, shift.endTime),
  }));
}

export function coworkerDrafts(employees: ParsedEmployeeSchedule[], targetName: string): WorkCoworkerShiftDraft[] {
  const target = normalizeWorkPersonName(targetName);
  const targetSchedule = employees.find((employee) => employee.normalizedName === target);
  if (!targetSchedule) return [];
  return employees.flatMap((employee) => employee.normalizedName === target ? [] : employee.shifts
    .filter((shift) => {
      const other = interval(shift.date, shift.startTime, shift.endTime);
      return targetSchedule.shifts.some((ownShift) => {
        const own = interval(ownShift.date, ownShift.startTime, ownShift.endTime);
        return own.start < other.end && other.start < own.end;
      });
    })
    .map((shift) => ({
      date: shift.date,
      displayName: employee.displayName,
      normalizedName: employee.normalizedName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      minutes: shift.minutes,
      sourcePage: shift.sourcePage,
    })));
}

function interval(date: string, startTime: string, endTime: string): { start: number; end: number } {
  const start = Date.parse(`${date}T${startTime}:00`);
  let end = Date.parse(`${date}T${endTime}:00`);
  if (end <= start) end += 24 * 60 * 60 * 1000;
  return { start, end };
}

export function detectCandidateCollisions(candidates: WorkImportCandidate[], events: CalendarEvent[], ignoredWorkImportId?: string): WorkCollision[] {
  const collisions: WorkCollision[] = [];
  for (const candidate of candidates) {
    const incoming = interval(candidate.date, candidate.startTime, candidate.endTime);
    for (const event of events) {
      if (ignoredWorkImportId && event.sourceWorkImportId === ignoredWorkImportId) continue;
      if (event.allDay) continue;
      const eventStart = Date.parse(event.startDateTime);
      const eventEnd = Date.parse(event.endDateTime);
      const exact = event.category === 'WORK' && eventStart === incoming.start && eventEnd === incoming.end;
      const overlap = incoming.start < eventEnd && eventStart < incoming.end;
      const touching = incoming.start === eventEnd || incoming.end === eventStart;
      if (!exact && !overlap && !touching) continue;
      collisions.push({
        candidate,
        eventId: event.id,
        eventTitle: event.title,
        kind: exact ? 'POTENTIAL_DUPLICATE' : overlap ? 'OVERLAP' : 'TOUCHING',
        eventStart: event.startDateTime,
        eventEnd: event.endDateTime,
      });
    }
  }
  return collisions;
}

export function pairWorkScheduleUpdates(oldEntries: WorkScheduleEntry[], newShifts: WorkImportCandidate[]): Map<number, WorkScheduleEntry> {
  const oldShifts = oldEntries.filter((entry) => entry.type === 'SHIFT');
  const unmatchedOld = new Set(oldShifts.map((entry) => entry.id));
  const unmatchedNew = new Set(newShifts.map((_, index) => index));
  const result = new Map<number, WorkScheduleEntry>();

  function pairSingletons(oldKey: (entry: WorkScheduleEntry) => string | undefined, newKey: (shift: WorkImportCandidate) => string | undefined): void {
    const oldGroups = new Map<string, WorkScheduleEntry[]>();
    const newGroups = new Map<string, number[]>();
    for (const entry of oldShifts) {
      if (!unmatchedOld.has(entry.id)) continue;
      const key = oldKey(entry);
      if (!key) continue;
      oldGroups.set(key, [...(oldGroups.get(key) ?? []), entry]);
    }
    for (const index of unmatchedNew) {
      const key = newKey(newShifts[index]!);
      if (!key) continue;
      newGroups.set(key, [...(newGroups.get(key) ?? []), index]);
    }
    for (const [key, oldGroup] of oldGroups) {
      const newGroup = newGroups.get(key);
      if (oldGroup.length !== 1 || newGroup?.length !== 1) continue;
      const old = oldGroup[0]!;
      const index = newGroup[0]!;
      result.set(index, old);
      unmatchedOld.delete(old.id);
      unmatchedNew.delete(index);
    }
  }

  // Najpierw stabilna tożsamość źródłowa, potem jednoznaczny dzień, a na końcu
  // konserwatywne 1:1 po identycznych godzinach. Ostatni krok pozwala rozpoznać
  // przesunięcie tej samej zmiany na inny dzień, ale nie zgaduje przy powtórzeniach.
  pairSingletons((entry) => entry.workOccurrenceKey, (shift) => shift.workOccurrenceKey);
  pairSingletons((entry) => entry.date, (shift) => shift.date);
  pairSingletons(
    (entry) => entry.startTime && entry.endTime ? `${entry.startTime}|${entry.endTime}` : undefined,
    (shift) => `${shift.startTime}|${shift.endTime}`,
  );

  return result;
}

export function buildWorkScheduleDiff(oldEntries: WorkScheduleEntry[], newShifts: WorkImportCandidate[], eventById = new Map<string, CalendarEvent>()): WorkScheduleDiff {
  const items: WorkScheduleDiffItem[] = [];
  const pairings = pairWorkScheduleUpdates(oldEntries, newShifts);
  const matchedOld = new Set([...pairings.values()].map((entry) => entry.id));
  newShifts.forEach((shift, index) => {
    const old = pairings.get(index);
    if (!old) {
      items.push({ id: `work-diff-${items.length}`, kind: 'ADDED_SHIFT', newShift: shift, apply: true });
      return;
    }
    const exact = old.workOccurrenceKey === shift.workOccurrenceKey;
    if (exact) {
      items.push({ id: `work-diff-${items.length}`, kind: old.userDeleted ? 'CONFLICT_USER_DELETED' : 'UNCHANGED', oldEntry: old, newShift: shift, ...(old.eventId ? { eventId: old.eventId } : {}), apply: !old.userDeleted });
      return;
    }
    const event = old.eventId ? eventById.get(old.eventId) : undefined;
    const conflict = old.userDeleted ? 'CONFLICT_USER_DELETED' : event?.userModified ? 'CONFLICT_USER_MODIFIED' : 'CHANGED_TIME';
    items.push({ id: `work-diff-${items.length}`, kind: conflict, oldEntry: old, newShift: shift, ...(old.eventId ? { eventId: old.eventId } : {}), apply: conflict === 'CHANGED_TIME' });
  });
  for (const old of oldEntries.filter((entry) => entry.type === 'SHIFT' && !matchedOld.has(entry.id))) {
    const event = old.eventId ? eventById.get(old.eventId) : undefined;
    const kind = old.userDeleted ? 'CONFLICT_USER_DELETED' : event?.userModified ? 'CONFLICT_USER_MODIFIED' : 'REMOVED_SHIFT';
    items.push({ id: `work-diff-${items.length}`, kind, oldEntry: old, ...(old.eventId ? { eventId: old.eventId } : {}), apply: kind === 'REMOVED_SHIFT' });
  }
  return {
    items,
    summary: {
      unchanged: items.filter((item) => item.kind === 'UNCHANGED').length,
      added: items.filter((item) => item.kind === 'ADDED_SHIFT').length,
      removed: items.filter((item) => item.kind === 'REMOVED_SHIFT').length,
      changed: items.filter((item) => item.kind === 'CHANGED_TIME').length,
      conflicts: items.filter((item) => item.kind.startsWith('CONFLICT_')).length,
    },
  };
}

export function sortCoworkerOverlaps(items: CoworkerOverlap[]): CoworkerOverlap[] {
  return [...items].sort((a, b) => b.overlapMinutes - a.overlapMinutes || a.overlapStartTime.localeCompare(b.overlapStartTime) || a.displayName.localeCompare(b.displayName, 'pl'));
}

export function coworkerOverlaps(date: string, startTime: string, endTime: string, shifts: WorkCoworkerShift[]): CoworkerOverlap[] {
  const target = interval(date, startTime, endTime);
  const overlaps = shifts.flatMap((shift) => {
    const other = interval(shift.date, shift.startTime, shift.endTime);
    const start = Math.max(target.start, other.start);
    const end = Math.min(target.end, other.end);
    if (end <= start) return [];
    const toClock = (value: number) => new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false });
    return [{
      displayName: shift.displayName,
      coworkerStartTime: shift.startTime,
      coworkerEndTime: shift.endTime,
      overlapStartTime: toClock(start),
      overlapEndTime: toClock(end),
      overlapMinutes: Math.round((end - start) / 60000),
    }];
  });
  return sortCoworkerOverlaps(overlaps);
}
