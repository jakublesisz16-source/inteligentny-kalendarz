import type { CalendarEvent } from '../events/event.types';

const polishMonths = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

const polishShortMonths = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function toLocalDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    const direct = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1] ?? '';
  }
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDateFromKey(key: string): Date {
  const [year = '0', month = '1', day = '1'] = key.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function addDaysToDateKey(key: string, amount: number): string {
  const date = localDateFromKey(key);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
}

export function dateKeysBetweenInclusive(startKey: string, endKey: string, maxDays = 3660): string[] {
  if (!startKey || !endKey || endKey < startKey) return [];
  const result: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey && result.length < maxDays) {
    result.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return result;
}

export function uniqueSortedDateKeys(values: string[]): string[] {
  return [...new Set(values.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
}

export function areDateKeysContiguous(values: string[]): boolean {
  const keys = uniqueSortedDateKeys(values);
  if (keys.length < 2) return true;
  return keys.every((key, index) => index === 0 || key === addDaysToDateKey(keys[index - 1] ?? key, 1));
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function formatMonthLabel(date: Date): string {
  return `${polishMonths[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatTime(value: string, format: '24h' | '12h' = '24h'): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit', minute: '2-digit', hour12: format === '12h',
  }).format(date);
}

export function startOfMonthGrid(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const mondayBasedDay = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - mondayBasedDay);
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function createMonthGrid(date: Date): Date[] {
  const start = startOfMonthGrid(date);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export function dateKeyToInputDate(date: Date): string {
  return toLocalDateKey(date);
}

export function combineDateAndTime(date: string, time: string): string {
  return `${date}T${time}`;
}

export function splitLocalDateTime(value: string): { date: string; time: string } {
  const [date = '', timePart = ''] = value.split('T');
  return { date, time: timePart.slice(0, 5) };
}

export function inferSpanType(startDateTime: string, endDateTime: string): 'SINGLE_DAY' | 'MULTI_DAY' {
  return toLocalDateKey(startDateTime) === toLocalDateKey(endDateTime) ? 'SINGLE_DAY' : 'MULTI_DAY';
}

export function eventDateKeys(event: CalendarEvent): string[] {
  return dateKeysBetweenInclusive(toLocalDateKey(event.startDateTime), toLocalDateKey(event.endDateTime));
}

export function eventOccursOnDate(event: CalendarEvent, dateKey: string): boolean {
  const start = toLocalDateKey(event.startDateTime);
  const end = toLocalDateKey(event.endDateTime);
  return dateKey >= start && dateKey <= end;
}

export function eventDayCount(event: CalendarEvent): number {
  return eventDateKeys(event).length;
}

export function formatShortDateKey(key: string): string {
  const date = localDateFromKey(key);
  return `${date.getDate()} ${polishShortMonths[date.getMonth()]}`;
}

export function formatEventDateRange(event: CalendarEvent): string {
  const start = toLocalDateKey(event.startDateTime);
  const end = toLocalDateKey(event.endDateTime);
  if (start === end) return formatShortDateKey(start);
  const startDate = localDateFromKey(start);
  const endDate = localDateFromKey(end);
  if (startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.getDate()}-${endDate.getDate()} ${polishShortMonths[startDate.getMonth()]}`;
  }
  return `${formatShortDateKey(start)} - ${formatShortDateKey(end)}`;
}

export function sortEventsForDay(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.startDateTime.localeCompare(b.startDateTime) || a.title.localeCompare(b.title, 'pl');
  });
}
