import type { CalendarEvent } from '../events/event.types';
import { toLocalDateKey } from './date.utils';

export interface WeekTimedEventOverlapSegment {
  topPercent: number;
  heightPercent: number;
}

export interface WeekTimedOverlapMarker {
  top: number;
  height: number;
}

export interface WeekTimedEventLayout {
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  overlapping: boolean;
  overlapSegments: WeekTimedEventOverlapSegment[];
  stackIndex: number;
  sameStartIndex: number;
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

function buildCandidates(
  events: CalendarEvent[],
  dateKey: string,
  startHour: number,
  endHour: number,
  hourHeight: number,
): LayoutCandidate[] {
  return events
    .map((event) => candidateForDay(event, dateKey, startHour, endHour, hourHeight))
    .filter((candidate): candidate is LayoutCandidate => Boolean(candidate))
    .sort((a, b) => a.start - b.start || b.end - a.end || a.event.title.localeCompare(b.event.title, 'pl'));
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

function overlapRangesForGroup(group: LayoutCandidate[]): MinuteRange[] {
  const ranges: MinuteRange[] = [];
  for (let left = 0; left < group.length; left += 1) {
    for (let right = left + 1; right < group.length; right += 1) {
      const start = Math.max(group[left]!.start, group[right]!.start);
      const end = Math.min(group[left]!.end, group[right]!.end);
      if (end > start) ranges.push({ start, end });
    }
  }
  return mergeRanges(ranges);
}

function groupedCandidates(candidates: LayoutCandidate[]): LayoutCandidate[][] {
  const groups: LayoutCandidate[][] = [];
  let group: LayoutCandidate[] = [];
  let groupMaxEnd = -1;
  for (const candidate of candidates) {
    if (group.length && candidate.start >= groupMaxEnd) {
      groups.push(group);
      group = [];
      groupMaxEnd = -1;
    }
    group.push(candidate);
    groupMaxEnd = Math.max(groupMaxEnd, candidate.end);
  }
  if (group.length) groups.push(group);
  return groups;
}

function commitOverlapGroup(group: LayoutCandidate[], result: Map<string, WeekTimedEventLayout>): void {
  if (!group.length) return;
  for (const [stackIndex, candidate] of group.entries()) {
    const overlapSegments = overlapSegmentsForCandidate(candidate, group);
    const sameStartIndex = group.filter((other) => other.start === candidate.start).findIndex((other) => other.event.id === candidate.event.id);
    result.set(candidate.event.id, {
      top: candidate.top,
      height: candidate.height,
      leftPercent: 0,
      widthPercent: 100,
      overlapping: overlapSegments.length > 0,
      overlapSegments,
      stackIndex,
      sameStartIndex: Math.max(0, sameStartIndex),
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
  const candidates = buildCandidates(events, dateKey, startHour, endHour, hourHeight);
  const result = new Map<string, WeekTimedEventLayout>();
  for (const group of groupedCandidates(candidates)) commitOverlapGroup(group, result);
  return result;
}

export function buildWeekTimedOverlapMarkers(
  events: CalendarEvent[],
  dateKey: string,
  startHour: number,
  endHour: number,
  hourHeight: number,
): WeekTimedOverlapMarker[] {
  const dayStart = startHour * 60;
  const candidates = buildCandidates(events, dateKey, startHour, endHour, hourHeight);
  return groupedCandidates(candidates).flatMap((group) => overlapRangesForGroup(group).map((range) => ({
    top: ((range.start - dayStart) / 60) * hourHeight,
    height: ((range.end - range.start) / 60) * hourHeight,
  })));
}
