import type { AvailabilityBlockedInterval, AvailabilityDayRule } from './availability.types';

export function timeToMinute(value: string | undefined, fallback = 0): number {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h! < 0 || h! > 23 || m! < 0 || m! > 59) return fallback;
  return h! * 60 + m!;
}

export function minuteToTime(value: number): string {
  const safe = Math.max(0, Math.min(1440, Math.round(value)));
  if (safe === 1440) return '24:00';
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function makeIntervalId(startTime: string, endTime: string, index: number): string {
  return `blocked-${startTime.replace(':', '')}-${endTime.replace(':', '')}-${index + 1}`;
}

export function normalizeBlockedIntervals(intervals: Array<Pick<AvailabilityBlockedInterval, 'startTime' | 'endTime'> & Partial<Pick<AvailabilityBlockedInterval, 'id'>>>): AvailabilityBlockedInterval[] {
  const ranges = intervals.map((item) => ({
    start: timeToMinute(item.startTime, -1),
    end: timeToMinute(item.endTime, -1),
  })).filter((item) => item.start >= 0 && item.end > item.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged.map((item, index) => ({ id: makeIntervalId(minuteToTime(item.start), minuteToTime(item.end), index), startTime: minuteToTime(item.start), endTime: minuteToTime(item.end) }));
}

export function validateDayRule(rule: AvailabilityDayRule, globalStart?: string, globalEnd?: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.date)) throw new Error('Nieprawidłowa data ograniczenia dyspozycyjności.');
  if (rule.earliestTime && !/^\d{2}:\d{2}$/.test(rule.earliestTime)) throw new Error('Nieprawidłowa godzina „od”.');
  if (rule.latestTime && !/^\d{2}:\d{2}$/.test(rule.latestTime)) throw new Error('Nieprawidłowa godzina „do”.');
  if (rule.earliestTime && rule.latestTime && timeToMinute(rule.earliestTime) >= timeToMinute(rule.latestTime)) throw new Error('Godzina „od” musi być wcześniejsza niż „do”.');
  const normalized = normalizeBlockedIntervals(rule.blockedIntervals);
  if (normalized.length !== rule.blockedIntervals.filter((item) => timeToMinute(item.endTime, -1) > timeToMinute(item.startTime, -1)).length) {
    // Merging is expected, invalid zero/reversed ranges are not.
    const invalid = rule.blockedIntervals.some((item) => timeToMinute(item.startTime, -1) < 0 || timeToMinute(item.endTime, -1) <= timeToMinute(item.startTime, -1));
    if (invalid) throw new Error('Każdy niedostępny przedział musi mieć prawidłowy początek i koniec.');
  }
  if (globalStart && rule.earliestTime && timeToMinute(rule.earliestTime) < timeToMinute(globalStart)) throw new Error(`Dla tego dnia nie można zacząć wcześniej niż globalnie ustawione ${globalStart}.`);
  if (globalEnd && rule.latestTime && timeToMinute(rule.latestTime) > timeToMinute(globalEnd)) throw new Error(`Dla tego dnia nie można skończyć później niż globalnie ustawione ${globalEnd}.`);
}

export function effectiveBounds(globalStart: number, globalEnd: number, rule?: AvailabilityDayRule): { start: number; end: number } {
  return {
    start: Math.max(globalStart, rule?.earliestTime ? timeToMinute(rule.earliestTime, globalStart) : globalStart),
    end: Math.min(globalEnd, rule?.latestTime ? timeToMinute(rule.latestTime, globalEnd) : globalEnd),
  };
}

export function ruleLabel(rule?: AvailabilityDayRule): string | undefined {
  if (!rule) return undefined;
  if (rule.excluded) return 'wykluczony';
  if (rule.earliestTime && rule.latestTime) return `${rule.earliestTime}-${rule.latestTime}`;
  if (rule.earliestTime) return `od ${rule.earliestTime}`;
  if (rule.latestTime) return `do ${rule.latestTime}`;
  if (rule.blockedIntervals.length) return `${rule.blockedIntervals.length} blok.`;
  return undefined;
}
