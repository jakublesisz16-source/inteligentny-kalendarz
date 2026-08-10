import type { AvailabilitySentSnapshot } from '../availability/availability.types';

export type AvailabilityWorkStatus = 'WITHIN_AVAILABILITY' | 'PARTIALLY_OUTSIDE_AVAILABILITY' | 'OUTSIDE_AVAILABILITY';

export interface WorkShiftForAvailabilityComparison {
  id: string;
  startDateTime: string;
  endDateTime: string;
}

export interface ComparisonInterval {
  startDateTime: string;
  endDateTime: string;
  minutes: number;
}

export interface WorkShiftAvailabilityComparison {
  workShiftId: string;
  startDateTime: string;
  endDateTime: string;
  shiftMinutes: number;
  coveredMinutes: number;
  outsideMinutes: number;
  uncoveredIntervals: ComparisonInterval[];
  matchingAvailabilityIntervals: ComparisonInterval[];
  status: AvailabilityWorkStatus;
}

export interface UnusedAvailabilityBlock {
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  unusedMinutes: number;
}

export interface AvailabilityWorkComparison {
  snapshotId: string;
  snapshotVersion: number;
  shiftCount: number;
  fullyWithinCount: number;
  partiallyOutsideCount: number;
  fullyOutsideCount: number;
  totalWorkMinutes: number;
  totalCoveredMinutes: number;
  totalOutsideMinutes: number;
  unusedAvailabilityMinutes: number;
  perShift: WorkShiftAvailabilityComparison[];
  unusedAvailabilityBlocks: UnusedAvailabilityBlock[];
}

interface MinuteInterval {
  start: number;
  end: number;
}

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOrdinal(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Nieprawidłowa data: ${date}`);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function ordinalToDate(ordinal: number): string {
  return new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10);
}

function timeMinute(time: string): number {
  const [hours = Number.NaN, minutes = Number.NaN] = time.slice(0, 5).split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Nieprawidłowa godzina: ${time}`);
  }
  return hours * 60 + minutes;
}

function localDateTimeMinute(value: string): number {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  return dateOrdinal(date) * MINUTES_PER_DAY + timeMinute(time);
}

function minuteToLocalDateTime(value: number): string {
  const ordinal = Math.floor(value / MINUTES_PER_DAY);
  const minute = ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${ordinalToDate(ordinal)}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function snapshotInterval(block: AvailabilitySentSnapshot['blocks'][number]): MinuteInterval {
  const start = dateOrdinal(block.date) * MINUTES_PER_DAY + timeMinute(block.startTime);
  let end = dateOrdinal(block.date) * MINUTES_PER_DAY + timeMinute(block.endTime);
  if (end <= start) end += MINUTES_PER_DAY;
  return { start, end };
}

function shiftInterval(shift: WorkShiftForAvailabilityComparison): MinuteInterval {
  const start = localDateTimeMinute(shift.startDateTime);
  let end = localDateTimeMinute(shift.endDateTime);
  if (end <= start) end += MINUTES_PER_DAY;
  return { start, end };
}

function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const sorted = intervals.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteInterval[] = [];
  for (const item of sorted) {
    const last = merged[merged.length - 1];
    if (!last || item.start > last.end) merged.push({ ...item });
    else last.end = Math.max(last.end, item.end);
  }
  return merged;
}

function intersect(interval: MinuteInterval, bounds: MinuteInterval): MinuteInterval | undefined {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : undefined;
}

function intersectionMinutes(bounds: MinuteInterval, intervals: MinuteInterval[]): number {
  return mergeIntervals(intervals.map((item) => intersect(item, bounds)).filter((item): item is MinuteInterval => Boolean(item)))
    .reduce((sum, item) => sum + item.end - item.start, 0);
}

function subtractIntervals(bounds: MinuteInterval, covered: MinuteInterval[]): MinuteInterval[] {
  const clipped = mergeIntervals(covered.map((item) => intersect(item, bounds)).filter((item): item is MinuteInterval => Boolean(item)));
  const result: MinuteInterval[] = [];
  let cursor = bounds.start;
  for (const item of clipped) {
    if (item.start > cursor) result.push({ start: cursor, end: item.start });
    cursor = Math.max(cursor, item.end);
  }
  if (cursor < bounds.end) result.push({ start: cursor, end: bounds.end });
  return result;
}

function publicInterval(interval: MinuteInterval): ComparisonInterval {
  return {
    startDateTime: minuteToLocalDateTime(interval.start),
    endDateTime: minuteToLocalDateTime(interval.end),
    minutes: interval.end - interval.start,
  };
}

export function selectDefaultSentSnapshot(
  snapshots: AvailabilitySentSnapshot[],
  workImportedAt?: string,
): AvailabilitySentSnapshot | undefined {
  if (!snapshots.length) return undefined;
  const ordered = [...snapshots].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.version - b.version);
  if (workImportedAt) {
    const beforeImport = ordered.filter((snapshot) => snapshot.createdAt <= workImportedAt);
    if (beforeImport.length) return beforeImport[beforeImport.length - 1];
  }
  return ordered[ordered.length - 1];
}

export function compareAvailabilityWithWorkSchedule(
  snapshot: AvailabilitySentSnapshot,
  workShifts: WorkShiftForAvailabilityComparison[],
): AvailabilityWorkComparison {
  const availabilityIntervals = snapshot.blocks.map(snapshotInterval);
  const availabilityUnion = mergeIntervals(availabilityIntervals);
  const shiftIntervals = workShifts.map((shift) => ({ shift, interval: shiftInterval(shift) }));

  const perShift = shiftIntervals.map(({ shift, interval }) => {
    const shiftMinutes = interval.end - interval.start;
    const matching = mergeIntervals(availabilityUnion.map((candidate) => intersect(candidate, interval)).filter((item): item is MinuteInterval => Boolean(item)));
    const coveredMinutes = matching.reduce((sum, item) => sum + item.end - item.start, 0);
    const outsideMinutes = Math.max(0, shiftMinutes - coveredMinutes);
    const status: AvailabilityWorkStatus = outsideMinutes === 0
      ? 'WITHIN_AVAILABILITY'
      : coveredMinutes > 0
        ? 'PARTIALLY_OUTSIDE_AVAILABILITY'
        : 'OUTSIDE_AVAILABILITY';
    return {
      workShiftId: shift.id,
      startDateTime: shift.startDateTime,
      endDateTime: shift.endDateTime,
      shiftMinutes,
      coveredMinutes,
      outsideMinutes,
      uncoveredIntervals: subtractIntervals(interval, availabilityUnion).map(publicInterval),
      matchingAvailabilityIntervals: matching.map(publicInterval),
      status,
    };
  }).sort((a, b) => {
    const rank = (value: AvailabilityWorkStatus) => value === 'OUTSIDE_AVAILABILITY' ? 0 : value === 'PARTIALLY_OUTSIDE_AVAILABILITY' ? 1 : 2;
    return rank(a.status) - rank(b.status) || a.startDateTime.localeCompare(b.startDateTime);
  });

  const workUnion = mergeIntervals(shiftIntervals.map((item) => item.interval));
  const availabilityTotal = availabilityUnion.reduce((sum, item) => sum + item.end - item.start, 0);
  const availabilityUsed = availabilityUnion.reduce((sum, interval) => sum + intersectionMinutes(interval, workUnion), 0);

  const unusedAvailabilityBlocks = snapshot.blocks.map((block, index) => {
    const interval = availabilityIntervals[index]!;
    const unusedMinutes = Math.max(0, interval.end - interval.start - intersectionMinutes(interval, workUnion));
    return { date: block.date, startTime: block.startTime, endTime: block.endTime, minutes: interval.end - interval.start, unusedMinutes };
  }).filter((item) => item.unusedMinutes > 0);

  return {
    snapshotId: snapshot.id,
    snapshotVersion: snapshot.version,
    shiftCount: perShift.length,
    fullyWithinCount: perShift.filter((item) => item.status === 'WITHIN_AVAILABILITY').length,
    partiallyOutsideCount: perShift.filter((item) => item.status === 'PARTIALLY_OUTSIDE_AVAILABILITY').length,
    fullyOutsideCount: perShift.filter((item) => item.status === 'OUTSIDE_AVAILABILITY').length,
    totalWorkMinutes: perShift.reduce((sum, item) => sum + item.shiftMinutes, 0),
    totalCoveredMinutes: perShift.reduce((sum, item) => sum + item.coveredMinutes, 0),
    totalOutsideMinutes: perShift.reduce((sum, item) => sum + item.outsideMinutes, 0),
    unusedAvailabilityMinutes: Math.max(0, availabilityTotal - availabilityUsed),
    perShift,
    unusedAvailabilityBlocks,
  };
}
