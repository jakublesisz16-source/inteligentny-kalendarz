import type { CalendarEvent } from '../events/event.types';
import { toLocalDateKey } from './date.utils';

export interface WeekTimedEventLayout {
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  overlapping: boolean;
}

interface LayoutCandidate {
  event: CalendarEvent;
  start: number;
  end: number;
  top: number;
  height: number;
}

function minuteOfDay(value: string): number {
  const timeMatch = value.match(/T(\d{2}):(\d{2})/);
  if (timeMatch) return Number(timeMatch[1] ?? '0') * 60 + Number(timeMatch[2] ?? '0');
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function candidateForDay(
  event: CalendarEvent,
  dateKey: string,
  startHour: number,
  endHour: number,
  hourHeight: number,
): LayoutCandidate | null {
  if (event.allDay) return null;
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const eventStartKey = toLocalDateKey(event.startDateTime);
  const eventEndKey = toLocalDateKey(event.endDateTime);
  const rawStart = dateKey === eventStartKey ? minuteOfDay(event.startDateTime) : dayStart;
  const rawEnd = dateKey === eventEndKey ? minuteOfDay(event.endDateTime) : dayEnd;
  if (rawEnd <= dayStart || rawStart >= dayEnd) return null;
  const start = Math.max(dayStart, rawStart);
  const end = Math.min(dayEnd, rawEnd);
  if (end <= start) return null;
  return {
    event,
    start,
    end,
    top: ((start - dayStart) / 60) * hourHeight,
    height: Math.max(26, ((end - start) / 60) * hourHeight),
  };
}

function commitOverlapGroup(group: LayoutCandidate[], result: Map<string, WeekTimedEventLayout>): void {
  if (!group.length) return;
  const columnEnds: number[] = [];
  const assignments: Array<{ candidate: LayoutCandidate; column: number }> = [];

  for (const candidate of group) {
    let column = columnEnds.findIndex((end) => end <= candidate.start);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(candidate.end);
    } else {
      columnEnds[column] = candidate.end;
    }
    assignments.push({ candidate, column });
  }

  const columnCount = Math.max(1, columnEnds.length);
  const widthPercent = 100 / columnCount;
  for (const { candidate, column } of assignments) {
    result.set(candidate.event.id, {
      top: candidate.top,
      height: candidate.height,
      leftPercent: column * widthPercent,
      widthPercent,
      overlapping: columnCount > 1,
    });
  }
}

export function buildWeekTimedEventLayout(
  events: CalendarEvent[],
  dateKey: string,
  startHour: number,
  endHour: number,
  hourHeight: number,
): Map<string, WeekTimedEventLayout> {
  const candidates = events
    .map((event) => candidateForDay(event, dateKey, startHour, endHour, hourHeight))
    .filter((candidate): candidate is LayoutCandidate => Boolean(candidate))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.event.title.localeCompare(b.event.title, 'pl'));

  const result = new Map<string, WeekTimedEventLayout>();
  let group: LayoutCandidate[] = [];
  let groupMaxEnd = -1;

  for (const candidate of candidates) {
    if (group.length && candidate.start >= groupMaxEnd) {
      commitOverlapGroup(group, result);
      group = [];
      groupMaxEnd = -1;
    }
    group.push(candidate);
    groupMaxEnd = Math.max(groupMaxEnd, candidate.end);
  }
  commitOverlapGroup(group, result);
  return result;
}
