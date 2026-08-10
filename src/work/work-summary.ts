import type { AvailabilityWorkComparison } from './availability-work-comparison';

export interface WorkSummaryShift {
  id: string;
  startDateTime: string;
  endDateTime: string;
  source: 'MANUAL' | 'WORK_PDF';
}

export interface WorkWeeklyBucket {
  startDate: string;
  endDate: string;
  minutes: number;
  shiftCount: number;
}

export interface WorkAvailabilityComparisonSummary {
  fullyWithinCount: number;
  partiallyOutsideCount: number;
  fullyOutsideCount: number;
  comparedShiftCount: number;
}

export interface WorkMonthlySummary {
  monthKey: string;
  totalMinutes: number;
  shiftCount: number;
  workDayCount: number;
  averageShiftMinutes?: number;
  longestShiftMinutes?: number;
  saturdayCount: number;
  sundayCount: number;
  weeklyBuckets: WorkWeeklyBucket[];
}

interface MinuteInterval {
  start: number;
  end: number;
}

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateOrdinal(date: string): number {
  const [yearText = '', monthText = '', dayText = ''] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Nieprawidłowa data: ${date}`);
  }
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function ordinalToDateKey(ordinal: number): string {
  return new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10);
}

function timeMinute(time: string): number {
  const [hourText = '', minuteText = ''] = time.slice(0, 5).split(':');
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Nieprawidłowa godzina: ${time}`);
  }
  return hours * 60 + minutes;
}

function dateTimeMinute(value: string): number {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  return dateOrdinal(date) * MINUTES_PER_DAY + timeMinute(time);
}

function intervalForShift(shift: WorkSummaryShift): MinuteInterval {
  const start = dateTimeMinute(shift.startDateTime);
  let end = dateTimeMinute(shift.endDateTime);
  if (end <= start) end += MINUTES_PER_DAY;
  return { start, end };
}

function monthBounds(monthKey: string): MinuteInterval {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error(`Nieprawidłowy miesiąc: ${monthKey}`);
  const [yearText = '', monthText = ''] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error(`Nieprawidłowy miesiąc: ${monthKey}`);
  const startDate = `${yearText}-${monthText}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start: dateOrdinal(startDate) * MINUTES_PER_DAY, end: dateOrdinal(nextDate) * MINUTES_PER_DAY };
}

function overlap(interval: MinuteInterval, bounds: MinuteInterval): MinuteInterval | undefined {
  const start = Math.max(interval.start, bounds.start);
  const end = Math.min(interval.end, bounds.end);
  return end > start ? { start, end } : undefined;
}

function mondayOrdinal(ordinal: number): number {
  const date = new Date(ordinal * MS_PER_DAY);
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  return ordinal - offset;
}

function splitByDay(interval: MinuteInterval): MinuteInterval[] {
  const result: MinuteInterval[] = [];
  let cursor = interval.start;
  while (cursor < interval.end) {
    const ordinal = Math.floor(cursor / MINUTES_PER_DAY);
    const nextMidnight = (ordinal + 1) * MINUTES_PER_DAY;
    const end = Math.min(interval.end, nextMidnight);
    result.push({ start: cursor, end });
    cursor = end;
  }
  return result;
}

function sourcePriority(source: WorkSummaryShift['source']): number {
  return source === 'WORK_PDF' ? 2 : 1;
}

export function dedupeConfirmedWorkShifts(shifts: WorkSummaryShift[]): WorkSummaryShift[] {
  const byInterval = new Map<string, WorkSummaryShift>();
  for (const shift of shifts) {
    const key = `${shift.startDateTime}|${shift.endDateTime}`;
    const current = byInterval.get(key);
    if (!current || sourcePriority(shift.source) > sourcePriority(current.source) || (sourcePriority(shift.source) === sourcePriority(current.source) && shift.id.localeCompare(current.id) < 0)) {
      byInterval.set(key, shift);
    }
  }
  return [...byInterval.values()].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime) || a.endDateTime.localeCompare(b.endDateTime) || a.id.localeCompare(b.id));
}

export function formatWorkSummaryMinutes(value: number): string {
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export function buildWorkMonthlySummary(monthKey: string, inputShifts: WorkSummaryShift[]): WorkMonthlySummary {
  const bounds = monthBounds(monthKey);
  const shifts = dedupeConfirmedWorkShifts(inputShifts);
  const clipped = shifts.flatMap((shift) => {
    const clippedInterval = overlap(intervalForShift(shift), bounds);
    return clippedInterval ? [{ shift, interval: clippedInterval }] : [];
  });

  const totalMinutes = clipped.reduce((sum, item) => sum + item.interval.end - item.interval.start, 0);
  const shiftCount = clipped.length;
  const workDayOrdinals = new Set<number>();
  const saturdayOrdinals = new Set<number>();
  const sundayOrdinals = new Set<number>();
  const weeklyMap = new Map<number, { minutes: number; shiftIds: Set<string> }>();

  for (const item of clipped) {
    for (const dayPart of splitByDay(item.interval)) {
      const dayOrdinal = Math.floor(dayPart.start / MINUTES_PER_DAY);
      const weekday = new Date(dayOrdinal * MS_PER_DAY).getUTCDay();
      const minutes = dayPart.end - dayPart.start;
      workDayOrdinals.add(dayOrdinal);
      if (weekday === 6) saturdayOrdinals.add(dayOrdinal);
      if (weekday === 0) sundayOrdinals.add(dayOrdinal);
      const weekStart = mondayOrdinal(dayOrdinal);
      const bucket = weeklyMap.get(weekStart) ?? { minutes: 0, shiftIds: new Set<string>() };
      bucket.minutes += minutes;
      bucket.shiftIds.add(item.shift.id);
      weeklyMap.set(weekStart, bucket);
    }
  }

  const weeklyBuckets = [...weeklyMap.entries()].sort(([a], [b]) => a - b).map(([weekStart, bucket]) => ({
    startDate: ordinalToDateKey(weekStart),
    endDate: ordinalToDateKey(weekStart + 6),
    minutes: bucket.minutes,
    shiftCount: bucket.shiftIds.size,
  }));

  const durations = clipped.map((item) => item.interval.end - item.interval.start);
  return {
    monthKey,
    totalMinutes,
    shiftCount,
    workDayCount: workDayOrdinals.size,
    ...(shiftCount ? { averageShiftMinutes: Math.round(totalMinutes / shiftCount) } : {}),
    ...(durations.length ? { longestShiftMinutes: Math.max(...durations) } : {}),
    saturdayCount: saturdayOrdinals.size,
    sundayCount: sundayOrdinals.size,
    weeklyBuckets,
  };
}

export function aggregateAvailabilityComparisonResults(comparisons: AvailabilityWorkComparison[]): WorkAvailabilityComparisonSummary {
  return comparisons.reduce<WorkAvailabilityComparisonSummary>((summary, comparison) => ({
    fullyWithinCount: summary.fullyWithinCount + comparison.fullyWithinCount,
    partiallyOutsideCount: summary.partiallyOutsideCount + comparison.partiallyOutsideCount,
    fullyOutsideCount: summary.fullyOutsideCount + comparison.fullyOutsideCount,
    comparedShiftCount: summary.comparedShiftCount + comparison.shiftCount,
  }), { fullyWithinCount: 0, partiallyOutsideCount: 0, fullyOutsideCount: 0, comparedShiftCount: 0 });
}
