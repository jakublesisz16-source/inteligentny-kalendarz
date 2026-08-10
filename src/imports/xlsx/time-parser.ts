export interface ParsedTimeRange {
  start: string;
  end: string;
}

const DASH = '[-–—]';
const TIME_RANGE_PATTERN = new RegExp(`(\\d{1,2})[.:](\\d{2})\\s*${DASH}\\s*(\\d{1,2})[.:](\\d{2})`);
const STRICT_TIME_RANGE_PATTERN = new RegExp(`^\\s*\\d{1,2}[.:]\\d{2}\\s*${DASH}\\s*\\d{1,2}[.:]\\d{2}\\s*$`);

function toTime(hour: string, minute: string): string | null {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function timeRangeDuration(range: ParsedTimeRange): number | null {
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

export function parseTimeRange(text: string): ParsedTimeRange | null {
  const match = TIME_RANGE_PATTERN.exec(text.replace(/\s+/g, ' '));
  if (!match) return null;
  const [startHour, startMinute, endHour, endMinute] = [match[1], match[2], match[3], match[4]];
  if (!startHour || !startMinute || !endHour || !endMinute) return null;
  const start = toTime(startHour, startMinute);
  const end = toTime(endHour, endMinute);
  if (!start || !end || start >= end) return null;
  return { start, end };
}

export function isTimeRange(text: string): boolean {
  return parseTimeRange(text) !== null && STRICT_TIME_RANGE_PATTERN.test(text);
}

export function inferGridIntervalMinutes(ranges: ParsedTimeRange[]): number | undefined {
  const durations = ranges.map(timeRangeDuration).filter((value): value is number => value !== null);
  if (!durations.length) return undefined;
  const counts = new Map<number, number>();
  for (const duration of durations) counts.set(duration, (counts.get(duration) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
}
