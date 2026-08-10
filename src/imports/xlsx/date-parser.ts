import { foldPolishText, normalizeWeekdayLabel } from './parser-normalization';

const DATE_TOKEN_PATTERN = /(?<!\d)(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](20\d{2}))?\.?(?!\d)/g;
const RANGE_PATTERN = /^\s*(\d{1,2}[./]\d{1,2}\.?(?:[./]20\d{2})?)\s*[-–—]\s*(\d{1,2}[./]\d{1,2}\.?(?:[./]20\d{2})?)\s*$/;

const WEEKDAY_INDEX: Record<string, number> = {
  PONIEDZIAŁEK: 1,
  WTOREK: 2,
  ŚRODA: 3,
  CZWARTEK: 4,
  PIĄTEK: 5,
  SOBOTA: 6,
  NIEDZIELA: 0,
};

export interface AcademicYearContext {
  firstYear: number;
  secondYear: number;
}

export interface ParsedDateExpression {
  dates: string[];
  warnings: string[];
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateKey(year: number, month: number, day: number): string | null {
  const value = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function keyToDate(key: string): Date {
  const parts = key.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) throw new Error(`Nieprawidłowa data: ${key}`);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function inferYear(month: number, academicYear: AcademicYearContext): number {
  return month >= 9 ? academicYear.firstYear : academicYear.secondYear;
}

function parseToken(token: string, academicYear: AcademicYearContext | null): string | null {
  const match = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](20\d{2}))?\.?$/.exec(token.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const explicitYear = match[3] ? Number(match[3]) : undefined;
  if (!explicitYear && !academicYear) return null;
  return localDateKey(explicitYear ?? inferYear(month, academicYear!), month, day);
}

export function detectAcademicYear(texts: string[]): AcademicYearContext | null {
  for (const text of texts) {
    const match = /(20\d{2})\s*[\/-]\s*(20\d{2})/.exec(text);
    if (!match) continue;
    const firstYear = Number(match[1]);
    const secondYear = Number(match[2]);
    if (secondYear === firstYear + 1) return { firstYear, secondYear };
  }
  return null;
}

export function academicYearLabel(context: AcademicYearContext | null): string | undefined {
  return context ? `${context.firstYear}/${context.secondYear}` : undefined;
}

export function detectTerm(texts: string[]): string | undefined {
  const combined = foldPolishText(texts.join(' '));
  if (/semestr\s+letni|\blato\b/.test(combined)) return 'semestr letni';
  if (/semestr\s+zimowy|\bzima\b/.test(combined)) return 'semestr zimowy';
  return undefined;
}

export function looksLikeDateExpression(text: string): boolean {
  DATE_TOKEN_PATTERN.lastIndex = 0;
  const match = DATE_TOKEN_PATTERN.exec(text);
  DATE_TOKEN_PATTERN.lastIndex = 0;
  return Boolean(match);
}

function expectedWeekday(weekdayLabel?: string): number | undefined {
  if (!weekdayLabel) return undefined;
  const normalized = normalizeWeekdayLabel(weekdayLabel) ?? weekdayLabel.toUpperCase();
  return WEEKDAY_INDEX[normalized];
}

function validateWeekday(dates: string[], weekdayLabel?: string): string[] {
  const expected = expectedWeekday(weekdayLabel);
  if (expected === undefined) return [];
  if (dates.some((key) => keyToDate(key).getDay() !== expected)) {
    return ['Co najmniej jedna data nie odpowiada wykrytemu dniowi tygodnia.'];
  }
  return [];
}

export function parseDateExpression(text: string, academicYear: AcademicYearContext | null, weekdayLabel?: string, excelDateIso?: string): ParsedDateExpression {
  if (excelDateIso && /^20\d{2}-\d{2}-\d{2}$/.test(excelDateIso)) {
    return { dates: [excelDateIso], warnings: validateWeekday([excelDateIso], weekdayLabel) };
  }

  const compact = text.replace(/\s+/g, ' ').trim();
  const rangeMatch = RANGE_PATTERN.exec(compact);
  if (rangeMatch) {
    const startKey = parseToken(rangeMatch[1] ?? '', academicYear);
    const endKey = parseToken(rangeMatch[2] ?? '', academicYear);
    if (!startKey || !endKey) {
      const message = academicYear ? 'Niepoprawny zakres dat.' : 'Nie udało się ustalić roku akademickiego.';
      return { dates: [], warnings: [message] };
    }
    const start = keyToDate(startKey);
    const end = keyToDate(endKey);
    if (end < start) return { dates: [], warnings: ['Końcowa data zakresu jest wcześniejsza od początkowej.'] };

    const expected = expectedWeekday(weekdayLabel);
    const warnings: string[] = [];
    const cursor = new Date(start);
    if (expected !== undefined && cursor.getDay() !== expected) {
      warnings.push('Początek zakresu nie odpowiada wykrytemu dniowi tygodnia.');
      while (cursor <= end && cursor.getDay() !== expected) cursor.setDate(cursor.getDate() + 1);
    }

    const dates: string[] = [];
    while (cursor <= end) {
      dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
      cursor.setDate(cursor.getDate() + 7);
    }
    return { dates, warnings };
  }

  DATE_TOKEN_PATTERN.lastIndex = 0;
  const tokens = [...compact.matchAll(DATE_TOKEN_PATTERN)].map((match) => match[0]);
  DATE_TOKEN_PATTERN.lastIndex = 0;
  if (!tokens.length) return { dates: [], warnings: ['Nie rozpoznano daty zajęć.'] };

  const needsAcademicYear = tokens.some((token) => !/20\d{2}/.test(token));
  if (needsAcademicYear && !academicYear) return { dates: [], warnings: ['Nie udało się ustalić roku akademickiego.'] };

  const parsed = tokens.map((token) => parseToken(token, academicYear));
  const dates = parsed.filter((value): value is string => Boolean(value));
  const warnings: string[] = [];
  if (dates.length !== tokens.length) warnings.push('Co najmniej jedna data ma niepoprawny format lub wartość.');
  if (!dates.length) warnings.push('Nie rozpoznano daty zajęć.');
  warnings.push(...validateWeekday(dates, weekdayLabel));

  return { dates: [...new Set(dates)], warnings: [...new Set(warnings)] };
}
