import type { CalendarEvent } from '../events/event.types';
import { toLocalDateKey } from './date.utils';

export interface WeekTimedEventOverlapSegment {
  topPercent: number;
  heightPercent: number;
}

export interface WeekTimedEventLayout {
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  overlapping: boolean;
  overlapSegments: WeekTimedEventOverlapSegment[];
  stackIndex: number;
}

interface LayoutCandidate {
  event: CalendarEvent;
  start: number;
  end: number;
  top: number;
  height: number;
}

interface MinuteRange {
  start: number;
  end: number;
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

function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
  }
  return merged;
}

function overlapSegmentsForCandidate(candidate: LayoutCandidate, group: LayoutCandidate[]): WeekTimedEventOverlapSegment[] {
  const ranges = mergeRanges(group
    .filter((other) => other.event.id !== candidate.event.id)
    .map((other) => ({ start: Math.max(candidate.start, other.start), end: Math.min(candidate.end, other.end) }))
    .filter((range) => range.end > range.start));
  const duration = Math.max(1, candidate.end - candidate.start);
  return ranges.map((range) => ({
    topPercent: ((range.start - candidate.start) / duration) * 100,
    heightPercent: ((range.end - range.start) / duration) * 100,
  }));
}

function commitOverlapGroup(group: LayoutCandidate[], result: Map<string, WeekTimedEventLayout>): void {
  if (!group.length) return;
  for (const [stackIndex, candidate] of group.entries()) {
    const overlapSegments = overlapSegmentsForCandidate(candidate, group);
    result.set(candidate.event.id, {
      top: candidate.top,
      height: candidate.height,
      leftPercent: 0,
      widthPercent: 100,
      overlapping: overlapSegments.length > 0,
      overlapSegments,
      stackIndex,
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
