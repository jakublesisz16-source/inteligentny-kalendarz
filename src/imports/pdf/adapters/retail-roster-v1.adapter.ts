import type { PdfDocumentSnapshot, PdfPageSnapshot, PdfTextItemSnapshot } from '../pdf-reader';
import type { WorkScheduleAdapter } from '../work-adapter.types';
import type { ParsedEmployeeSchedule, ParsedWorkShift, WorkScheduleParseResult } from '../../../work/work.types';

const MONTHS: Record<string, number> = {
  styczen: 1, luty: 2, marzec: 3, kwiecien: 4, maj: 5, czerwiec: 6,
  lipiec: 7, sierpien: 8, wrzesien: 9, pazdziernik: 10, listopad: 11, grudzien: 12,
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeWorkPersonName(value: string): string {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseMonthYear(document: PdfDocumentSnapshot): { year: number; month: number; label: string } {
  const text = normalizeToken(document.fullText);
  const explicit = text.match(/miesiac\s*:?\s*([a-z]+)\s+(\d{2,4})/i) ?? text.match(/\b(styczen|luty|marzec|kwiecien|maj|czerwiec|lipiec|sierpien|wrzesien|pazdziernik|listopad|grudzien)\s+(20\d{2}|\d{2})\b/i);
  if (!explicit) throw new Error('Nie udało się jednoznacznie ustalić miesiąca i roku grafiku.');
  const monthName = explicit[1];
  const yearToken = explicit[2];
  if (!monthName || !yearToken) throw new Error('Nie udało się odczytać miesiąca i roku grafiku.');
  const month = MONTHS[monthName];
  if (!month) throw new Error('Nieobsługiwany miesiąc w grafiku.');
  const rawYear = Number(yearToken);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return { year, month, label: `${monthName} ${year}` };
}

function localDateKey(year: number, month: number, day: number): string {
  const test = new Date(year, month - 1, day);
  if (test.getFullYear() !== year || test.getMonth() !== month - 1 || test.getDate() !== day) throw new Error(`Nieprawidłowy dzień miesiąca: ${day}.`);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthEnd(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate();
  return localDateKey(year, month, day);
}

interface Line {
  y: number;
  items: PdfTextItemSnapshot[];
}

function linesForPage(page: PdfPageSnapshot, tolerance = 2.8): Line[] {
  const sorted = [...page.items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const existing = lines.find((line) => Math.abs(line.y - item.y) <= tolerance);
    if (existing) {
      existing.items.push(item);
      existing.y = (existing.y * (existing.items.length - 1) + item.y) / existing.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => a.y - b.y);
}

function scheduleHeaderLine(page: PdfPageSnapshot): Line | undefined {
  return linesForPage(page).find((line) => {
    const tokens = line.items.map((item) => normalizeToken(item.text));
    const od = tokens.filter((token) => token === 'od').length;
    const doCount = tokens.filter((token) => token === 'do').length;
    return od >= 2 && doCount >= 2 && tokens.some((token) => token === 'suma');
  });
}

function isSchedulePage(page: PdfPageSnapshot): boolean {
  const text = normalizeToken(page.items.map((item) => item.text).join(' '));
  if (!text.includes('dzien m-ca')) return false;
  if (!text.includes('imie i nazwisko')) return false;
  return Boolean(scheduleHeaderLine(page));
}

function hasRealShiftCells(page: PdfPageSnapshot): boolean {
  const header = scheduleHeaderLine(page);
  if (!header) return false;
  const columns = detectEmployeeColumns(page, header);
  if (!columns.length) return false;
  const rows = dayRows(page, header, Math.min(...columns.map((column) => column.odX)));
  return rows.some((row) => columns.some((column) => Boolean(parseShiftForCell(page, row.y, column, '2000-01-01'))));
}

interface EmployeeColumn {
  displayName: string;
  normalizedName: string;
  odX: number;
  doX: number;
}

const NAME_EXCLUSIONS = new Set([
  'IMIE', 'I', 'NAZWISKO', 'ETAT', 'URLOP', 'DZIEN', 'WOLNY', 'PROSBA', 'GRAFIKOWA', 'SUMA', 'OD', 'DO', 'DN', 'M-CA',
]);

function looksLikeNameToken(text: string): boolean {
  const normalized = normalizeWorkPersonName(text);
  if (!normalized || NAME_EXCLUSIONS.has(normalized)) return false;
  if (/^\d+(?:[,.]\d+)?$/.test(text.trim())) return false;
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(text)) return false;
  if (/^\d{1,2}:\d{2}$/.test(text.trim())) return false;
  return true;
}

function detectEmployeeColumns(page: PdfPageSnapshot, header: Line): EmployeeColumn[] {
  const odItems = header.items.filter((item) => normalizeToken(item.text) === 'od');
  const doItems = header.items.filter((item) => normalizeToken(item.text) === 'do');
  const pairs = odItems.map((od) => {
    const match = doItems.filter((candidate) => candidate.x > od.x && candidate.x - od.x < 70).sort((a, b) => a.x - b.x)[0];
    return match ? { od, doItem: match } : undefined;
  }).filter((pair): pair is { od: PdfTextItemSnapshot; doItem: PdfTextItemSnapshot } => Boolean(pair));

  const columns: EmployeeColumn[] = [];
  for (const pair of pairs) {
    const minX = pair.od.x - 26;
    const maxX = pair.doItem.x + Math.max(pair.doItem.width, 8) + 28;
    const minY = header.y - 31;
    const maxY = header.y - 5;
    const tokens = page.items
      .filter((item) => item.y >= minY && item.y <= maxY && item.x + item.width >= minX && item.x <= maxX)
      .filter((item) => looksLikeNameToken(item.text))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((item) => item.text.trim());
    const displayName = tokens.join(' ').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeWorkPersonName(displayName);
    if (normalizedName.split(' ').filter(Boolean).length < 2) continue;
    columns.push({ displayName, normalizedName, odX: pair.od.x, doX: pair.doItem.x });
  }
  return columns;
}

function parseClock(value: string): string | undefined {
  const text = value.trim();
  let match = text.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (match) return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
  match = text.match(/^([01]?\d|2[0-3])$/);
  if (match) return `${String(Number(match[1])).padStart(2, '0')}:00`;
  return undefined;
}

function parseRange(value: string): { startTime: string; endTime: string } | undefined {
  const text = value.replace(/\s+/g, '');
  const match = text.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?[-–—]([01]?\d|2[0-3])(?::([0-5]\d))?$/);
  if (!match) return undefined;
  const startTime = `${String(Number(match[1])).padStart(2, '0')}:${match[2] ?? '00'}`;
  const endTime = `${String(Number(match[3])).padStart(2, '0')}:${match[4] ?? '00'}`;
  return { startTime, endTime };
}

function minutesBetween(startTime: string, endTime: string): number {
  const [shText = '0', smText = '0'] = startTime.split(':');
  const [ehText = '0', emText = '0'] = endTime.split(':');
  const start = Number(shText) * 60 + Number(smText);
  const end = Number(ehText) * 60 + Number(emText);
  if (end <= start) return end + 1440 - start;
  return end - start;
}

function nearestItemOnRow(page: PdfPageSnapshot, y: number, x: number, toleranceX = 22, toleranceY = 2.9): PdfTextItemSnapshot | undefined {
  return page.items
    .filter((item) => Math.abs(item.y - y) <= toleranceY && Math.abs(item.x - x) <= toleranceX)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
}

function dayRows(page: PdfPageSnapshot, header: Line, firstOdX: number): Array<{ day: number; y: number }> {
  return page.items
    .filter((item) => item.y > header.y + 5 && item.x < firstOdX - 40 && /^(0[1-9]|[12]\d|3[01])$/.test(item.text.trim()))
    .map((item) => ({ day: Number(item.text), y: item.y }))
    .sort((a, b) => a.day - b.day);
}

function parseShiftForCell(page: PdfPageSnapshot, rowY: number, column: EmployeeColumn, date: string): ParsedWorkShift | undefined {
  const od = nearestItemOnRow(page, rowY, column.odX);
  const doItem = nearestItemOnRow(page, rowY, column.doX);
  const startTime = od ? parseClock(od.text) : undefined;
  const endTime = doItem ? parseClock(doItem.text) : undefined;
  if (startTime && endTime) {
    const minutes = minutesBetween(startTime, endTime);
    if (minutes <= 0 || minutes > 16 * 60) return undefined;
    return { date, startTime, endTime, minutes, sourcePage: page.pageNumber, sourceContext: `strona ${page.pageNumber}` };
  }
  if (od) {
    const range = parseRange(od.text);
    if (range) {
      const minutes = minutesBetween(range.startTime, range.endTime);
      if (minutes > 0 && minutes <= 16 * 60) return { date, ...range, minutes, sourcePage: page.pageNumber, sourceContext: `strona ${page.pageNumber}` };
    }
  }
  return undefined;
}

function sourceReportedMinutes(page: PdfPageSnapshot, header: Line, column: EmployeeColumn, lastRowY: number): number | undefined {
  const sumHeaders = header.items.filter((item) => normalizeToken(item.text) === 'suma' && item.x > column.doX).sort((a, b) => a.x - b.x);
  const nextSum = sumHeaders[0];
  if (!nextSum) return undefined;
  const candidates = page.items
    .filter((item) => item.y > lastRowY + 3 && Math.abs(item.x - nextSum.x) <= 22)
    .map((item) => item.text.trim())
    .filter((text) => /^\d{1,3}:\d{2}$/.test(text));
  const first = candidates[0];
  if (!first) return undefined;
  const [hoursText = '0', minutesText = '0'] = first.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
}

function mergeEmployee(existing: ParsedEmployeeSchedule | undefined, incoming: ParsedEmployeeSchedule): ParsedEmployeeSchedule {
  if (!existing) return incoming;
  const byKey = new Map(existing.shifts.map((shift) => [`${shift.date}|${shift.startTime}|${shift.endTime}`, shift]));
  for (const shift of incoming.shifts) byKey.set(`${shift.date}|${shift.startTime}|${shift.endTime}`, shift);
  const reported = incoming.sourceReportedMinutes ?? existing.sourceReportedMinutes;
  return {
    displayName: existing.displayName || incoming.displayName,
    normalizedName: existing.normalizedName,
    shifts: [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    pages: [...new Set([...existing.pages, ...incoming.pages])].sort((a, b) => a - b),
    ...(reported !== undefined ? { sourceReportedMinutes: reported } : {}),
  };
}

function parse(document: PdfDocumentSnapshot): WorkScheduleParseResult {
  const { year, month, label } = parseMonthYear(document);
  const employeeMap = new Map<string, ParsedEmployeeSchedule>();
  const schedulePages: number[] = [];
  const warnings: string[] = [];
  const matchReasons: string[] = [];

  for (const page of document.pages) {
    if (!isSchedulePage(page)) continue;
    const header = scheduleHeaderLine(page);
    if (!header) continue;
    const columns = detectEmployeeColumns(page, header);
    if (!columns.length) continue;
    const rows = dayRows(page, header, Math.min(...columns.map((column) => column.odX)));
    const lastRowY = rows.at(-1)?.y ?? header.y;
    const pageEmployees: ParsedEmployeeSchedule[] = [];
    for (const column of columns) {
      const shifts: ParsedWorkShift[] = [];
      for (const row of rows) {
        let date: string;
        try { date = localDateKey(year, month, row.day); } catch { continue; }
        const shift = parseShiftForCell(page, row.y, column, date);
        if (shift) shifts.push(shift);
      }
      const reported = sourceReportedMinutes(page, header, column, lastRowY);
      const employee: ParsedEmployeeSchedule = {
        displayName: column.displayName,
        normalizedName: column.normalizedName,
        shifts,
        pages: [page.pageNumber],
        ...(reported !== undefined ? { sourceReportedMinutes: reported } : {}),
      };
      pageEmployees.push(employee);
    }
    if (!pageEmployees.some((employee) => employee.shifts.length > 0)) continue;
    schedulePages.push(page.pageNumber);
    matchReasons.push(`Strona ${page.pageNumber}: tabela dni, godzin i pracowników.`);
    for (const employee of pageEmployees) employeeMap.set(employee.normalizedName, mergeEmployee(employeeMap.get(employee.normalizedName), employee));
  }

  if (!schedulePages.length) throw new Error('Nie znaleziono stron zawierających właściwy grafik pracy.');
  const employees = [...employeeMap.values()].filter((employee) => employee.shifts.length || employee.sourceReportedMinutes !== undefined).sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'));
  if (!employees.length) warnings.push('Rozpoznano tabelę grafiku, ale nie udało się odczytać żadnych zmian pracowników.');

  return {
    adapterId: 'retail-roster-v1',
    periodStart: localDateKey(year, month, 1),
    periodEnd: monthEnd(year, month),
    monthLabel: label,
    employees,
    diagnostics: {
      adapterId: 'retail-roster-v1',
      pageCount: document.pageCount,
      schedulePages,
      detectedEmployeeCount: employees.length,
      unknownCodes: [],
      warnings,
      matchReasons,
    },
  };
}

export const retailRosterV1Adapter: WorkScheduleAdapter = {
  id: 'retail-roster-v1',
  label: 'Grafik sklepu - tabela pracowników',
  detect(document) {
    const normalized = normalizeToken(document.fullText);
    const reasons: string[] = [];
    let confidence = 0;
    if (normalized.includes('imie i nazwisko')) { confidence += 0.22; reasons.push('Wykryto nagłówki pracowników.'); }
    if (normalized.includes('dzien m-ca')) { confidence += 0.2; reasons.push('Wykryto kolumnę dnia miesiąca.'); }
    if (normalized.includes('miesiac')) { confidence += 0.16; reasons.push('Wykryto miesiąc grafiku.'); }
    const schedulePages = document.pages.filter((page) => isSchedulePage(page) && hasRealShiftCells(page)).length;
    if (schedulePages) { confidence += Math.min(0.34, schedulePages * 0.17); reasons.push(`Wykryto ${schedulePages} stron tabeli grafiku.`); }
    const clockTokens = document.pages.flatMap((page) => page.items).filter((item) => /^\d{1,2}:\d{2}$/.test(item.text.trim())).length;
    if (clockTokens > 20) { confidence += 0.14; reasons.push('Wykryto siatkę godzin zmian.'); }
    return { confidence: Math.min(confidence, 1), reasons };
  },
  parse,
};
