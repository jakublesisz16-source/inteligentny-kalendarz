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

export function buildWorkScheduleDiff(oldEntries: WorkScheduleEntry[], newShifts: WorkImportCandidate[], eventById = new Map<string, CalendarEvent>()): WorkScheduleDiff {
  const items: WorkScheduleDiffItem[] = [];
  const unmatchedOld = new Set(oldEntries.filter((entry) => entry.type === 'SHIFT').map((entry) => entry.id));
  for (const shift of newShifts) {
    const exact = oldEntries.find((entry) => unmatchedOld.has(entry.id) && entry.workOccurrenceKey === shift.workOccurrenceKey);
    if (exact) {
      unmatchedOld.delete(exact.id);
      items.push({ id: `work-diff-${items.length}`, kind: exact.userDeleted ? 'CONFLICT_USER_DELETED' : 'UNCHANGED', oldEntry: exact, newShift: shift, ...(exact.eventId ? { eventId: exact.eventId } : {}), apply: !exact.userDeleted });
      continue;
    }
    const sameDate = oldEntries.filter((entry) => unmatchedOld.has(entry.id) && entry.type === 'SHIFT' && entry.date === shift.date);
    const old = sameDate.length === 1 ? sameDate[0] : undefined;
    if (old) {
      unmatchedOld.delete(old.id);
      const event = old.eventId ? eventById.get(old.eventId) : undefined;
      const conflict = old.userDeleted ? 'CONFLICT_USER_DELETED' : event?.userModified ? 'CONFLICT_USER_MODIFIED' : 'CHANGED_TIME';
      items.push({ id: `work-diff-${items.length}`, kind: conflict, oldEntry: old, newShift: shift, ...(old.eventId ? { eventId: old.eventId } : {}), apply: conflict === 'CHANGED_TIME' });
    } else {
      items.push({ id: `work-diff-${items.length}`, kind: 'ADDED_SHIFT', newShift: shift, apply: true });
    }
  }
  for (const id of unmatchedOld) {
    const old = oldEntries.find((entry) => entry.id === id)!;
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
