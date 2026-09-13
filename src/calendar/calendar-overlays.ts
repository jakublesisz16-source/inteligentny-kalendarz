export type CalendarOverlayKind = 'POLISH_HOLIDAY' | 'WUM_BREAK' | 'WUM_RECTOR_DAY';

export interface CalendarOverlayMarker {
  kind: CalendarOverlayKind;
  label: string;
  shortLabel: string;
}

interface DateRangeMarker {
  start: string;
  end: string;
  label: string;
  shortLabel: string;
  kind: Extract<CalendarOverlayKind, 'WUM_BREAK' | 'WUM_RECTOR_DAY'>;
}

// Ustawa o dniach wolnych od pracy - tekst jednolity Dz.U. 2025 poz. 296.
const FIXED_POLISH_HOLIDAYS: Array<[number, number, string]> = [
  [1, 1, 'Nowy Rok'],
  [1, 6, 'Święto Trzech Króli'],
  [5, 1, 'Święto Państwowe'],
  [5, 3, 'Święto Narodowe Trzeciego Maja'],
  [8, 15, 'Wniebowzięcie Najświętszej Maryi Panny'],
  [11, 1, 'Wszystkich Świętych'],
  [11, 11, 'Narodowe Święto Niepodległości'],
  [12, 24, 'Wigilia Bożego Narodzenia'],
  [12, 25, 'Boże Narodzenie'],
  [12, 26, 'Drugi dzień Bożego Narodzenia'],
];

// WUM 2026/2027 - Zarządzenie Rektora nr 90/2026; dzień rektorski 05.10.2026 - Zarządzenie nr 156/2026.
const WUM_2026_2027: DateRangeMarker[] = [
  { start: '2026-10-05', end: '2026-10-05', kind: 'WUM_RECTOR_DAY', label: 'WUM - dzień rektorski', shortLabel: 'WUM' },
  { start: '2026-12-21', end: '2027-01-03', kind: 'WUM_BREAK', label: 'WUM - przerwa świąteczna', shortLabel: 'WUM' },
  { start: '2027-02-08', end: '2027-02-14', kind: 'WUM_BREAK', label: 'WUM - przerwa semestralna', shortLabel: 'WUM' },
  { start: '2027-03-25', end: '2027-03-31', kind: 'WUM_BREAK', label: 'WUM - przerwa świąteczna', shortLabel: 'WUM' },
  { start: '2027-06-14', end: '2027-06-20', kind: 'WUM_BREAK', label: 'WUM - przerwa na przygotowanie do sesji', shortLabel: 'WUM' },
  { start: '2027-07-12', end: '2027-09-30', kind: 'WUM_BREAK', label: 'WUM - przerwa wakacyjna', shortLabel: 'WUM' },
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(key: string, days: number): string {
  const [year = '0', month = '1', day = '1'] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

// Meeus/Jones/Butcher Gregorian Easter algorithm.
function easterSundayKey(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateKey(year, month, day);
}

function movablePolishHolidays(year: number): Map<string, string> {
  const easter = easterSundayKey(year);
  return new Map([
    [easter, 'Wielkanoc'],
    [addDays(easter, 1), 'Poniedziałek Wielkanocny'],
    [addDays(easter, 49), 'Zielone Świątki'],
    [addDays(easter, 60), 'Boże Ciało'],
  ]);
}

export function polishHolidayForDate(key: string): CalendarOverlayMarker | undefined {
  const [yearText = '', monthText = '', dayText = ''] = key.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  const fixed = FIXED_POLISH_HOLIDAYS.find(([holidayMonth, holidayDay]) => holidayMonth === month && holidayDay === day);
  const label = fixed?.[2] ?? movablePolishHolidays(year).get(key);
  return label ? { kind: 'POLISH_HOLIDAY', label, shortLabel: 'Święto' } : undefined;
}

export function wumAcademicMarkerForDate(key: string): CalendarOverlayMarker | undefined {
  const marker = WUM_2026_2027.find((entry) => key >= entry.start && key <= entry.end);
  return marker ? { kind: marker.kind, label: marker.label, shortLabel: marker.shortLabel } : undefined;
}

export function calendarOverlayMarkersForDate(
  key: string,
  options: { showPolishHolidays: boolean; showWumAcademicCalendar: boolean },
): CalendarOverlayMarker[] {
  const result: CalendarOverlayMarker[] = [];
  if (options.showPolishHolidays) {
    const holiday = polishHolidayForDate(key);
    if (holiday) result.push(holiday);
  }
  if (options.showWumAcademicCalendar) {
    const wum = wumAcademicMarkerForDate(key);
    if (wum) result.push(wum);
  }
  return result;
}
