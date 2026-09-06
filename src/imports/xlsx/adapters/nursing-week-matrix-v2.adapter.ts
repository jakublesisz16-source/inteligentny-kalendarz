import type { ScheduleAnalysis, ScheduleInformation, StudyScheduleCandidate, StudySourceBlock } from '../../../study/study.types';
import type { ScheduleAdapter, ScheduleAdapterMatch } from '../adapter.types';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../xlsx.types';
import { academicYearLabel, detectAcademicYear, detectTerm, looksLikeDateExpression, parseDateExpression, type AcademicYearContext } from '../date-parser';
import { inferStudyGroupKind, normalizeGroupText, sortStudyGroups, studyGroupKey } from '../group-normalizer';
import { findBestFooterHint, findUnambiguousFooterHint, parseLocationText, type FooterLocationHint, type LocationParseResult } from '../location-parser';
import { compactWhitespace, foldPolishText } from '../parser-normalization';
import { parseTimeRange, type ParsedTimeRange } from '../time-parser';
import { auditStudyScheduleCompleteness } from '../../../study/study-completeness';

const WEEKDAY_LABELS = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA', 'NIEDZIELA'] as const;
type WeekdayLabel = (typeof WEEKDAY_LABELS)[number];

const WEEKDAY_INDEX: Record<WeekdayLabel, number> = {
  PONIEDZIAŁEK: 1,
  WTOREK: 2,
  ŚRODA: 3,
  CZWARTEK: 4,
  PIĄTEK: 5,
  SOBOTA: 6,
  NIEDZIELA: 0,
};

interface WeekRangeRow {
  row: number;
  source: string;
  start: string;
  end: string;
}

interface HeaderEntry {
  row: number;
  value: string;
  merge?: SheetMergeSnapshot;
}

interface ColumnContext {
  col: number;
  subject: string;
  activityType?: string;
  weekdays: WeekdayLabel[];
  time?: ParsedTimeRange;
  location: LocationParseResult;
  headerText: string;
  sourceSectionKey: string;
  declaredTeachingHours?: number;
}

interface FooterContextHint extends FooterLocationHint {
  row: number;
  startTimeOverride?: string;
}

interface DateException {
  groupCellAddress: string;
  date: string;
  context: ColumnContext;
  markerCell: SheetCellSnapshot;
}

interface MatrixSignals {
  sheet: SheetSnapshot;
  weekRows: WeekRangeRow[];
  academicYear: AcademicYearContext | null;
  groupCellCount: number;
  headerTimeCount: number;
  headerWeekdayCount: number;
  subjectHeaderCount: number;
  unparsedAssignmentCells: SheetCellSnapshot[];
  suspiciousUnparsedWeekRows: number[];
  score: number;
  reasons: string[];
}

interface LectureSignals {
  sheet: SheetSnapshot;
  academicYear: AcademicYearContext | null;
  sectionCount: number;
  datedRowCount: number;
  timedEntryCount: number;
}

function stableId(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `candidate-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function compact(text: string): string {
  return compactWhitespace(text);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(year: number, month: number, day: number): string | null {
  const value = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function keyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

function parseWeekRange(text: string): { start: string; end: string } | null {
  const normalized = compact(text);
  const match = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](20\d{2}))?\.?\s*[-–—]\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\.?$/.exec(normalized);
  if (!match) return null;
  const startDay = Number(match[1]);
  const startMonth = Number(match[2]);
  const endDay = Number(match[4]);
  const endMonth = Number(match[5]);
  const endYear = Number(match[6]);
  const explicitStartYear = match[3] ? Number(match[3]) : undefined;
  const startYear = explicitStartYear ?? (startMonth > endMonth ? endYear - 1 : endYear);
  const start = dateKey(startYear, startMonth, startDay);
  const end = dateKey(endYear, endMonth, endDay);
  if (!start || !end || keyToDate(end) < keyToDate(start)) return null;
  return { start, end };
}

function weekRows(sheet: SheetSnapshot): WeekRangeRow[] {
  const byRow = new Map<number, SheetCellSnapshot[]>();
  for (const cell of sheet.cells) {
    const list = byRow.get(cell.row) ?? [];
    list.push(cell);
    byRow.set(cell.row, list);
  }
  const rows: WeekRangeRow[] = [];
  for (const [row, cells] of byRow.entries()) {
    const left = [...cells].sort((a, b) => a.col - b.col).find((cell) => cell.col <= Math.min(sheet.minCol + 2, sheet.maxCol));
    if (!left) continue;
    const parsed = parseWeekRange(left.value);
    if (!parsed) continue;
    rows.push({ row, source: compact(left.value), ...parsed });
  }
  return rows.sort((a, b) => a.row - b.row);
}

function mergeContaining(sheet: SheetSnapshot, row: number, col: number): SheetMergeSnapshot | undefined {
  return sheet.merges.find((merge) => row >= merge.startRow && row <= merge.endRow && col >= merge.startCol && col <= merge.endCol);
}

function directCell(sheet: SheetSnapshot, row: number, col: number): SheetCellSnapshot | undefined {
  return sheet.cells.find((cell) => cell.row === row && cell.col === col);
}

function headerEntryAt(sheet: SheetSnapshot, row: number, col: number): HeaderEntry | undefined {
  const direct = directCell(sheet, row, col);
  if (direct?.value) {
    const merge = mergeContaining(sheet, row, col);
    return { row, value: compact(direct.value), ...(merge ? { merge } : {}) };
  }
  const merge = mergeContaining(sheet, row, col);
  if (!merge) return undefined;
  const anchor = directCell(sheet, merge.startRow, merge.startCol);
  if (!anchor?.value) return undefined;
  return { row, value: compact(anchor.value), merge };
}

function uniqueHeaderEntries(sheet: SheetSnapshot, col: number, startRow: number, endRow: number): HeaderEntry[] {
  const seen = new Set<string>();
  const entries: HeaderEntry[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const entry = headerEntryAt(sheet, row, col);
    if (!entry?.value) continue;
    const key = `${entry.merge?.ref ?? `${row}:${col}`}|${entry.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

function weekdayLabelsFromText(text: string): WeekdayLabel[] {
  const folded = foldPolishText(text);
  const result: WeekdayLabel[] = [];
  const add = (label: WeekdayLabel) => { if (!result.includes(label)) result.push(label); };

  if (/\bpon(?:iedzialek)?\.?\s*[-–—]\s*pt\.?\b/.test(folded) || /\bponiedzialek\s*[-–—]\s*piatek\b/.test(folded)) {
    add('PONIEDZIAŁEK'); add('WTOREK'); add('ŚRODA'); add('CZWARTEK'); add('PIĄTEK');
  }

  const patterns: Array<[WeekdayLabel, RegExp]> = [
    ['PONIEDZIAŁEK', /\bponiedzial(?:ek|ki)\b|\bpon\.(?=\s|$)/],
    ['WTOREK', /\bwtorek\b|\bwtorki\b|\bwt\.(?=\s|$)/],
    ['ŚRODA', /\bsroda\b|\bsrody\b|\bsr\.(?=\s|$)/],
    ['CZWARTEK', /\bczwartek\b|\bczwartki\b|\bczw\.(?=\s|$)/],
    ['PIĄTEK', /\bpiatek\b|\bpiatki\b|\bpt\.(?=\s|$)/],
    ['SOBOTA', /\bsobota\b|\bsoboty\b|\bsob\.(?=\s|$)/],
    ['NIEDZIELA', /\bniedziela\b|\bniedziele\b|\bnd\.(?=\s|$)/],
  ];
  for (const [label, pattern] of patterns) if (pattern.test(folded)) add(label);
  return result;
}

function firstTimeRange(texts: string[]): ParsedTimeRange | undefined {
  for (const text of texts) {
    const range = parseTimeRange(text);
    if (range) return range;
  }
  return undefined;
}

function normalizeClock(hourToken: string, minuteToken: string): string | undefined {
  const hour = Number(hourToken);
  const minute = Number(minuteToken);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

function explicitStartTimeHint(text: string): string | undefined {
  const folded = foldPolishText(text);
  const patterns = [
    /(?:zaczyn\w*|rozpoczyn\w*)\s+(?:sie\s+)?(?:od\s+)?(?:godz\.?\s*)?(\d{1,2})[.:](\d{2})/,
    /\bzajecia\s+od\s+(?:godz\.?\s*)?(\d{1,2})[.:](\d{2})/,
    /\bod\s+godz\.?\s*(\d{1,2})[.:](\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(folded);
    if (match?.[1] && match[2]) return normalizeClock(match[1], match[2]);
  }
  return undefined;
}

function withStartOverride(range: ParsedTimeRange | undefined, startOverride: string | undefined): ParsedTimeRange | undefined {
  if (!range || !startOverride) return range;
  return { ...range, start: startOverride };
}

function parseActivityType(subject: string): string | undefined {
  const lower = foldPolishText(subject);
  if (/zajecia\s+prakt|\bpraktyki\b/.test(lower)) return 'Zajęcia praktyczne';
  if (/\bcwiczenia\b|\bcw\.?\s*\d*g?\b/.test(lower)) return 'Ćwiczenia';
  if (/\bseminari(?:um|a)\b/.test(lower)) return 'Seminaria';
  if (/\bwyklady?\b/.test(lower)) return 'Wykład';
  if (/\blaboratorium\b|\blab\.?\b/.test(lower)) return 'Laboratorium';
  return undefined;
}

function looksGlobalHeader(entry: HeaderEntry, sheet: SheetSnapshot): boolean {
  const width = entry.merge ? entry.merge.endCol - entry.merge.startCol + 1 : 1;
  const folded = foldPolishText(entry.value);
  return width >= Math.max(8, Math.floor((sheet.maxCol - sheet.minCol + 1) * 0.65))
    || (/piel(?:e|ę)gniar|semestr|rok akademicki|plan zajec/.test(folded) && width >= 8);
}

function subjectScore(entry: HeaderEntry, sheet: SheetSnapshot): number {
  if (!entry.value || looksGlobalHeader(entry, sheet)) return -100;
  const folded = foldPolishText(entry.value);
  if (parseTimeRange(entry.value)) return -40;
  if (weekdayLabelsFromText(entry.value).length && entry.value.length < 80) return -30;
  if (/^(prof|dr\b|dr hab|mgr|lek\b|sala\b|ul\b|al\b|centrum\b|klinika\b|katedra\b|zaklad\b)/.test(folded)) return -20;
  const strongSubject = /chirurg|interna|pediatr|rehab|farmak|promoc|\bpoz\b|prakty|semin|cwicz|\bcw\b|wyklad/.test(folded);
  const locationLike = parseLocationText(entry.value);
  if (!strongSubject && (locationLike.address || locationLike.label || locationLike.room)) return -20;
  if (/pierwsze spotkanie|adres|terminach|godz\.|obowiazk|uwaga/.test(folded)) return -20;

  let score = Math.max(0, 10 - (entry.row - sheet.minRow + 1));
  const width = entry.merge ? entry.merge.endCol - entry.merge.startCol + 1 : 1;
  if (width >= 2) score += 4;
  if (strongSubject) score += 6;
  if (entry.value === entry.value.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(entry.value)) score += 2;
  return score;
}

function strongSubjectHeader(entry: HeaderEntry): boolean {
  const folded = foldPolishText(entry.value);
  if (/^(prof|profesor|dr\b|dr hab|mgr|lek\b|sala\b|ul\b|al\b|centrum\b|klinika\b|katedra\b|zaklad\b)/.test(folded)) return false;
  return /chirurg|interna|pediatr|rehab|farmak|promoc|\bpoz\b|prakty|semin|cwicz|\bcw\b|wyklad/.test(folded)
    && !/pierwsze spotkanie|adres|terminach|obowiazk|uwaga/.test(folded);
}


function declaredTeachingHoursFromText(text: string): number | undefined {
  const folded = foldPolishText(text);
  const match = /(?:^|\s)(\d{1,3})\s*(?:godz\.?|g)(?=\s|$|[.,;])/i.exec(folded);
  if (!match?.[1]) return undefined;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 && value <= 300 ? value : undefined;
}

function sourceSectionKey(sheet: SheetSnapshot, entry: HeaderEntry | undefined, col: number): string {
  if (entry?.merge?.ref) return `${sheet.name}|${entry.merge.ref}`;
  if (entry) return `${sheet.name}|R${entry.row}C${col}`;
  return `${sheet.name}|C${col}`;
}

function cleanMatrixSubject(value: string): string {
  return compact(value)
    .replace(/\s+zaj[eę]cia\s+praktyczne\b.*$/i, '')
    .replace(/\s+(?:\d+\s*(?:godz\.?|g))\b.*$/i, '')
    .replace(/\s+grupy?\s+\d+\s*[- ]?\s*osobowe.*$/i, '')
    .trim();
}

function selectSubjectEntry(entries: HeaderEntry[], sheet: SheetSnapshot): HeaderEntry | undefined {
  const strong = entries
    .filter(strongSubjectHeader)
    .map((entry) => ({ entry, score: subjectScore(entry, sheet) }))
    .sort((a, b) => a.entry.row - b.entry.row || b.score - a.score);
  if (strong[0]?.entry.value) return strong[0].entry;

  const ranked = entries
    .map((entry) => ({ entry, score: subjectScore(entry, sheet) }))
    .filter((item) => item.score > -20)
    .sort((a, b) => b.score - a.score || a.entry.row - b.entry.row);
  return ranked[0]?.entry;
}

function selectSubject(entries: HeaderEntry[], sheet: SheetSnapshot): string {
  return selectSubjectEntry(entries, sheet)?.value ?? '';
}

function mergeLocation(primary: LocationParseResult, fallback?: FooterLocationHint): LocationParseResult {
  return {
    ...(fallback?.room ? { room: fallback.room } : {}),
    ...(fallback?.address ? { address: fallback.address } : {}),
    ...(fallback?.label ? { label: fallback.label } : {}),
    ...(primary.room ? { room: primary.room } : {}),
    ...(primary.address ? { address: primary.address } : {}),
    ...(primary.label ? { label: primary.label } : {}),
  };
}

function footerHints(sheet: SheetSnapshot, afterRow: number): FooterContextHint[] {
  const footerCells = sheet.cells
    .filter((candidate) => candidate.row > afterRow)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const hints: FooterContextHint[] = [];
  const previousByCol = new Map<number, SheetCellSnapshot>();

  const isSectionHeader = (text: string) => {
    const value = compact(text);
    if (!value) return false;
    const folded = foldPolishText(value);
    const parsed = parseLocationText(value);
    if (parsed.address || parsed.label || parsed.room || parseTimeRange(value) || weekdayLabelsFromText(value).length) return false;
    if (/^(prof|profesor|dr\b|mgr|lek\b|sala\b|ul\b|al\b)/.test(folded)) return false;
    if (/uwaga|pierwsze\s+spotkanie|adresy?|lokalizacj|terminach|obowiazk|godz\.?/.test(folded)) return false;
    if (strongSubjectHeader({ row: 0, value })) return true;
    const words = folded.split(/\s+/).filter(Boolean);
    return value === value.toUpperCase() && words.length >= 1 && words.length <= 8 && value.length <= 120;
  };
  const isLocationContinuation = (text: string) => /zajecia[^|]{0,100}(?:realiz|odbyw)/.test(foldPolishText(text));

  for (const cell of footerCells) {
    const rawText = compact(cell.value);
    if (!rawText) continue;
    const previous = previousByCol.get(cell.col);
    const currentLocation = parseLocationText(rawText);
    const startTimeOverride = explicitStartTimeHint(rawText);

    // Niektóre stopki zawierają kilka niezależnych jednostek w jednej komórce,
    // rozdzielonych pustą linią. Każdy blok musi być osobnym hintem, inaczej
    // prowadzący z drugiej części mógłby dostać lokalizację pierwszej.
    const footerSegments = cell.value
      .split(/\n\s*\n+/)
      .map((segment) => compact(segment))
      .filter(Boolean);
    if (footerSegments.length > 1) {
      for (const segment of footerSegments) {
        const parsedSegment = parseLocationText(segment);
        const segmentStartTime = explicitStartTimeHint(segment);
        if (!parsedSegment.address && !parsedSegment.label && !parsedSegment.room && !segmentStartTime) continue;
        hints.push({
          key: segment,
          rawText: segment,
          row: cell.row,
          ...(parsedSegment.room ? { room: parsedSegment.room } : {}),
          ...(parsedSegment.address ? { address: parsedSegment.address } : {}),
          ...(parsedSegment.label ? { label: parsedSegment.label } : {}),
          ...(segmentStartTime ? { startTimeOverride: segmentStartTime } : {}),
        });
      }
    }

    if (currentLocation.address && isLocationContinuation(rawText) && previous) {
      // Jawny dopisek "zajęcia będą realizowane..." zastępuje adres organizacyjny z poprzedniego wiersza.
      for (let index = hints.length - 1; index >= 0; index -= 1) {
        const prior = hints[index];
        if (prior?.row === previous.row && prior.address) hints.splice(index, 1);
      }
    }

    const windows: SheetCellSnapshot[][] = [[cell]];
    if (previous && cell.row - previous.row <= 1) {
      const previousText = compact(previous.value);
      const previousLocation = parseLocationText(previousText);
      const shouldCombine = isLocationContinuation(rawText)
        || ((currentLocation.address || currentLocation.label || currentLocation.room) && !previousLocation.address && !previousLocation.label && !previousLocation.room && isSectionHeader(previousText));
      if (shouldCombine) windows.push([previous, cell]);
    }

    for (const window of windows) {
      const key = window.map((entry) => compact(entry.value)).filter(Boolean).join(' | ');
      const parsed = currentLocation.address || currentLocation.label || currentLocation.room ? currentLocation : parseLocationText(key);
      const windowStartTime = startTimeOverride ?? explicitStartTimeHint(key);
      if (!parsed.address && !parsed.label && !parsed.room && !windowStartTime) continue;
      hints.push({
        key,
        rawText: key,
        row: cell.row,
        ...(parsed.room ? { room: parsed.room } : {}),
        ...(parsed.address ? { address: parsed.address } : {}),
        ...(parsed.label ? { label: parsed.label } : {}),
        ...(windowStartTime ? { startTimeOverride: windowStartTime } : {}),
      });
    }
    previousByCol.set(cell.col, cell);
  }
  return hints;
}

function bestFooterContext(query: string, fallbackQuery: string, footer: FooterContextHint[]): FooterContextHint | undefined {
  const locationHints = footer.filter((hint) => Boolean(hint.address || hint.label || hint.room));
  const precise = findBestFooterHint(query, locationHints) as FooterContextHint | undefined;
  if (precise) return precise;
  return findUnambiguousFooterHint(fallbackQuery, locationHints) as FooterContextHint | undefined;
}

function bestFooterStartTime(query: string, footer: FooterContextHint[]): string | undefined {
  // Godzina ze stopki jest zbyt ryzykowna, by dopasowywać ją po samym przedmiocie.
  // Wymagamy precyzyjnego kontekstu kolumny (np. nazwiska/oznaczenia prowadzącego).
  const timeHints = footer.filter((hint) => Boolean(hint.startTimeOverride));
  return (findBestFooterHint(query, timeHints) as FooterContextHint | undefined)?.startTimeOverride;
}

function columnContext(sheet: SheetSnapshot, col: number, headerStartRow: number, headerEndRow: number, footer: FooterContextHint[]): ColumnContext {
  const entries = uniqueHeaderEntries(sheet, col, headerStartRow, headerEndRow).filter((entry) => !looksGlobalHeader(entry, sheet));
  const subjectEntry = selectSubjectEntry(entries, sheet);
  const subjectHeader = subjectEntry?.value ?? '';
  const subject = cleanMatrixSubject(subjectHeader);
  const sectionKey = sourceSectionKey(sheet, subjectEntry, col);
  const declaredTeachingHours = declaredTeachingHoursFromText(subjectHeader);
  const detailTexts = entries.filter((entry) => entry.value !== subjectHeader).map((entry) => entry.value);
  const identityTexts = detailTexts.filter((text) => {
    const folded = foldPolishText(text);
    return !parseTimeRange(text)
      && weekdayLabelsFromText(text).length === 0
      && !/wskazane\s+ponizej|pierwsze\s+spotkanie|adresy\s+jednostek|centrum\s+symulacji/.test(folded);
  });
  const allTexts = entries.map((entry) => entry.value);
  const weekdays = [...new Set(allTexts.flatMap(weekdayLabelsFromText))];
  const baseTime = firstTimeRange(allTexts);
  const combinedHeaderText = allTexts.join(' | ');
  const directLocation = parseLocationText(combinedHeaderText);
  const preciseFooterQuery = identityTexts.join(' | ');
  const fallbackFooterQuery = subjectHeader;
  const foldedHeaderText = foldPolishText(combinedHeaderText);
  const locationExplicitlyDeferred = /(?:adresy?|lokalizacj\w*)[^|]{0,120}(?:podane|wskazane|zamieszczone|przekazane)\s+(?:zostana|beda)/.test(foldedHeaderText)
    || /(?:adresy?|lokalizacj\w*)[^|]{0,120}(?:zostana|beda)\s+(?:podane|wskazane|zamieszczone|przekazane)/.test(foldedHeaderText);
  const fallback = locationExplicitlyDeferred ? undefined : bestFooterContext(preciseFooterQuery, fallbackFooterQuery, footer);
  const startTimeOverride = explicitStartTimeHint(combinedHeaderText) ?? bestFooterStartTime(preciseFooterQuery, footer);
  const time = withStartOverride(baseTime, startTimeOverride);
  const location = mergeLocation(directLocation, fallback);
  const activityType = parseActivityType(subjectHeader);
  return {
    col,
    subject,
    ...(activityType ? { activityType } : {}),
    weekdays,
    ...(time ? { time } : {}),
    location,
    headerText: allTexts.join(' | '),
    sourceSectionKey: sectionKey,
    ...(declaredTeachingHours ? { declaredTeachingHours } : {}),
  };
}


function repairMissingColumnSubjects(contexts: Map<number, ColumnContext>): void {
  const cols = [...contexts.keys()].sort((a, b) => a - b);
  for (const col of cols) {
    const context = contexts.get(col);
    if (!context || context.subject) continue;
    const neighbors = cols
      .filter((candidateCol) => candidateCol !== col && Math.abs(candidateCol - col) <= 2)
      .map((candidateCol) => ({ candidateCol, context: contexts.get(candidateCol) }))
      .filter((entry): entry is { candidateCol: number; context: ColumnContext } => Boolean(entry.context?.subject))
      .sort((a, b) => Math.abs(a.candidateCol - col) - Math.abs(b.candidateCol - col) || (a.candidateCol < col ? -1 : 1));
    const neighbor = neighbors[0]?.context;
    if (!neighbor) continue;
    context.subject = neighbor.subject;
    if (neighbor.activityType) context.activityType = neighbor.activityType;
  }
}

function datesWithinRangeForWeekdays(range: WeekRangeRow, weekdays: WeekdayLabel[]): string[] {
  if (!weekdays.length) return [];
  const indexes = new Set(weekdays.map((label) => WEEKDAY_INDEX[label]));
  const cursor = keyToDate(range.start);
  const end = keyToDate(range.end);
  const dates: string[] = [];
  while (cursor <= end) {
    if (indexes.has(cursor.getDay())) dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parsedExactDate(cell: SheetCellSnapshot, academicYear: AcademicYearContext | null): string | undefined {
  const result = parseDateExpression(cell.value, academicYear, undefined, cell.dateValue);
  return result.dates.length === 1 ? result.dates[0] : undefined;
}

function isDateMarkerCell(cell: SheetCellSnapshot, academicYear: AcademicYearContext | null): boolean {
  if (cell.dateValue) return true;
  if (!looksLikeDateExpression(cell.value)) return false;
  return Boolean(parsedExactDate(cell, academicYear));
}

function groupCellsForWeekRow(sheet: SheetSnapshot, weekRow: WeekRangeRow, academicYear: AcademicYearContext | null): SheetCellSnapshot[] {
  return sheet.cells
    .filter((cell) => cell.row === weekRow.row && cell.col > sheet.minCol)
    .filter((cell) => !isDateMarkerCell(cell, academicYear))
    .filter((cell) => normalizeGroupText(cell.value, true).groups.length > 0)
    .sort((a, b) => a.col - b.col);
}

function detectDateExceptions(
  sheet: SheetSnapshot,
  range: WeekRangeRow,
  groups: SheetCellSnapshot[],
  contexts: Map<number, ColumnContext>,
  academicYear: AcademicYearContext | null,
): DateException[] {
  const groupByCol = new Map(groups.map((cell) => [cell.col, cell]));
  const markers = sheet.cells
    .filter((cell) => cell.row === range.row && cell.col > sheet.minCol)
    .filter((cell) => isDateMarkerCell(cell, academicYear));
  const exceptions: DateException[] = [];

  for (const marker of markers) {
    const previous = groupByCol.get(marker.col - 1);
    if (!previous) continue;
    const date = parsedExactDate(marker, academicYear);
    const markerContext = contexts.get(marker.col);
    const groupContext = contexts.get(previous.col);
    if (!date || !markerContext || !groupContext) continue;
    if (markerContext.subject && groupContext.subject && foldPolishText(markerContext.subject) !== foldPolishText(groupContext.subject)) continue;
    exceptions.push({ groupCellAddress: previous.address, date, context: markerContext, markerCell: marker });
  }
  return exceptions;
}

function effectiveContext(base: ColumnContext, exception: DateException | undefined): ColumnContext {
  if (!exception) return base;
  const override = exception.context;
  const activityType = override.activityType ?? base.activityType;
  const time = override.time ?? base.time;
  return {
    ...base,
    subject: override.subject || base.subject,
    ...(activityType ? { activityType } : {}),
    weekdays: base.weekdays,
    ...(time ? { time } : {}),
    location: {
      ...(base.location.room ? { room: base.location.room } : {}),
      ...(base.location.address ? { address: base.location.address } : {}),
      ...(base.location.label ? { label: base.location.label } : {}),
      ...(override.location.room ? { room: override.location.room } : {}),
      ...(override.location.address ? { address: override.location.address } : {}),
      ...(override.location.label ? { label: override.location.label } : {}),
    },
    headerText: `${base.headerText} | wyjątek: ${override.headerText}`,
  };
}

function excludesOtherClassDays(context: ColumnContext): boolean {
  const folded = foldPolishText(context.headerText);
  return /bez\s+dni[^|]{0,120}(?:odbywaja\s+sie\s+)?zajec/.test(folded);
}

function sameNormalizedSubject(left: ColumnContext, right: ColumnContext): boolean {
  const a = foldPolishText(left.subject).replace(/[^a-z0-9]/g, '');
  const b = foldPolishText(right.subject).replace(/[^a-z0-9]/g, '');
  return Boolean(a && b && a === b);
}

function groupLabels(cell: SheetCellSnapshot): string[] {
  return normalizeGroupText(cell.value, true).groups;
}

function excludedDatesForCell(
  cell: SheetCellSnapshot,
  context: ColumnContext,
  range: WeekRangeRow,
  groupCells: SheetCellSnapshot[],
  contexts: Map<number, ColumnContext>,
): Set<string> {
  if (!excludesOtherClassDays(context)) return new Set();
  const ownGroups = new Set(groupLabels(cell));
  const dates = new Set<string>();
  for (const other of groupCells) {
    if (other.address === cell.address) continue;
    const otherContext = contexts.get(other.col);
    if (!otherContext || !sameNormalizedSubject(context, otherContext)) continue;
    const otherGroups = groupLabels(other);
    if (!otherGroups.some((group) => ownGroups.has(group))) continue;
    for (const date of datesWithinRangeForWeekdays(range, otherContext.weekdays)) dates.add(date);
  }
  return dates;
}

function buildMatrixCandidates(sheet: SheetSnapshot, signals: MatrixSignals): { candidates: StudyScheduleCandidate[]; sourceBlocks: StudySourceBlock[] } {
  if (!signals.weekRows.length) return { candidates: [], sourceBlocks: [] };
  const firstWeekRow = signals.weekRows[0]?.row ?? 1;
  const lastWeekRow = signals.weekRows[signals.weekRows.length - 1]?.row ?? sheet.maxRow;
  const footer = footerHints(sheet, lastWeekRow);
  const contexts = new Map<number, ColumnContext>();
  for (let col = sheet.minCol + 1; col <= sheet.maxCol; col += 1) {
    contexts.set(col, columnContext(sheet, col, sheet.minRow, Math.max(sheet.minRow, firstWeekRow - 1), footer));
  }
  repairMissingColumnSubjects(contexts);

  const candidates: StudyScheduleCandidate[] = [];
  const sourceBlocks: StudySourceBlock[] = [];
  for (const range of signals.weekRows) {
    const groupCells = groupCellsForWeekRow(sheet, range, signals.academicYear);
    const exceptions = detectDateExceptions(sheet, range, groupCells, contexts, signals.academicYear);
    const exceptionByGroup = new Map(exceptions.map((entry) => [entry.groupCellAddress, entry]));

    for (const cell of groupCells) {
      const groups = normalizeGroupText(cell.value, true);
      if (!groups.groups.length) continue;
      const context = contexts.get(cell.col);
      if (!context) continue;
      const exception = exceptionByGroup.get(cell.address);
      let dates = datesWithinRangeForWeekdays(range, context.weekdays);
      if (dates.length) {
        const excluded = excludedDatesForCell(cell, context, range, groupCells, contexts);
        if (excluded.size) dates = dates.filter((date) => !excluded.has(date));
      }
      if (!dates.length && exception) dates = [exception.date];
      const unresolvedDates = !dates.length;
      const excludedDates = dates.length ? [...excludedDatesForCell(cell, context, range, groupCells, contexts)] : [];
      if (!dates.length) dates = [''];
      const blockCandidateIds: string[] = [];

      for (const date of dates) {
        const exceptionForDate = exception && exception.date === date ? exception : undefined;
        const resolved = effectiveContext(context, exceptionForDate);
        const groupTags = groups.groups.map((group) => studyGroupKey(inferStudyGroupKind(resolved.headerText, group), group));
        const warnings: string[] = [];
        if (!resolved.subject) warnings.push('Nie udało się ustalić przedmiotu z nagłówka kolumny.');
        if (unresolvedDates || !date) warnings.push(`Plan przypisuje ten wpis do tygodnia ${range.start} - ${range.end}, ale nie podaje jednoznacznego dnia zajęć.`);
        if (!resolved.time) warnings.push(`Plan nie podaje jednoznacznego pełnego zakresu godzin dla tego wpisu w tygodniu ${range.start} - ${range.end}.`);
        if (!resolved.location.address && !resolved.location.label) warnings.push('Nie udało się jednoznacznie ustalić lokalizacji.');

        const sourceRange = exceptionForDate ? `${cell.address},${exceptionForDate.markerCell.address}` : cell.address;
        const sourceKey = [sheet.name, sourceRange, date || range.source, resolved.time?.start ?? 'unknown-start', resolved.time?.end ?? 'unknown-end', resolved.subject || 'unknown-subject', groupTags.join('+')].join('|');
        const candidateId = stableId(sourceKey);
        const essential = Boolean(resolved.subject && date && resolved.time?.start && resolved.time?.end);
        blockCandidateIds.push(candidateId);
        candidates.push({
          id: candidateId,
          adapterId: 'nursing-week-matrix-v2',
          sourceSheet: sheet.name,
          sourceRange,
          sourceKey,
          originalText: [range.source, cell.value, resolved.headerText].filter(Boolean).join(' | '),
          subject: resolved.subject,
          ...(resolved.activityType ? { activityType: resolved.activityType } : {}),
          ...(date ? { date } : {}),
          ...(resolved.time?.start ? { startTime: resolved.time.start } : {}),
          ...(resolved.time?.end ? { endTime: resolved.time.end } : {}),
          groupScope: 'SPECIFIC',
          groupTags,
          originalGroupText: groups.originalText,
          sourceWeekStart: range.start,
          sourceWeekEnd: range.end,
          sourceSectionKey: resolved.sourceSectionKey,
          ...(resolved.declaredTeachingHours ? { declaredTeachingHours: resolved.declaredTeachingHours } : {}),
          ...(groups.clinic ? { clinic: groups.clinic } : {}),
          ...(resolved.location.room ? { room: resolved.location.room } : {}),
          ...(resolved.location.address ? { address: resolved.location.address } : {}),
          ...(resolved.location.label ? { locationLabel: resolved.location.label } : {}),
          status: essential ? (warnings.length ? 'REVIEW_REQUIRED' : 'READY') : 'REVIEW_REQUIRED',
          warnings: [...new Set(warnings)],
          include: essential,
        });
      }

      const blockContext = effectiveContext(context, exception);
      const blockGroupTags = groups.groups.map((group) => studyGroupKey(inferStudyGroupKind(blockContext.headerText, group), group));
      sourceBlocks.push({
        id: stableId(`${sheet.name}|${cell.address}|${range.start}|${range.end}|${blockGroupTags.join('+')}`),
        sourceSheet: sheet.name,
        sourceRange: cell.address,
        sourceSectionKey: blockContext.sourceSectionKey,
        subject: blockContext.subject,
        ...(blockContext.activityType ? { activityType: blockContext.activityType } : {}),
        groupTags: blockGroupTags,
        weekStart: range.start,
        weekEnd: range.end,
        weekdays: [...context.weekdays],
        excludedDates,
        ...(exception ? { exceptionDate: exception.date } : {}),
        sourceHasFullTimeRange: Boolean(blockContext.time?.start && blockContext.time?.end),
        ...(blockContext.declaredTeachingHours ? { declaredTeachingHours: blockContext.declaredTeachingHours } : {}),
        candidateIds: blockCandidateIds,
      });
    }
  }
  return { candidates, sourceBlocks };
}

function unparsedAssignmentCellsForWeekRows(sheet: SheetSnapshot, rows: WeekRangeRow[], academicYear: AcademicYearContext | null): SheetCellSnapshot[] {
  const result: SheetCellSnapshot[] = [];
  for (const row of rows) {
    for (const cell of sheet.cells.filter((entry) => entry.row === row.row && entry.col > sheet.minCol)) {
      if (!compact(cell.value) || isDateMarkerCell(cell, academicYear)) continue;
      if (normalizeGroupText(cell.value, true).groups.length) continue;
      result.push(cell);
    }
  }
  return result;
}

function suspiciousUnparsedWeekRows(sheet: SheetSnapshot, parsedRows: WeekRangeRow[]): number[] {
  const parsed = new Set(parsedRows.map((entry) => entry.row));
  const byRow = new Map<number, SheetCellSnapshot[]>();
  for (const cell of sheet.cells) {
    const list = byRow.get(cell.row) ?? [];
    list.push(cell);
    byRow.set(cell.row, list);
  }
  const suspicious: number[] = [];
  for (const [row, cells] of byRow.entries()) {
    if (parsed.has(row)) continue;
    const groupLike = cells.filter((cell) => cell.col > sheet.minCol && normalizeGroupText(cell.value, true).groups.length > 0);
    if (groupLike.length >= 3) suspicious.push(row);
  }
  return suspicious.sort((a, b) => a - b);
}

function matrixSignals(sheet: SheetSnapshot): MatrixSignals {
  const rows = weekRows(sheet);
  const academicYear = detectAcademicYear(sheet.cells.filter((cell) => cell.row <= Math.min(sheet.minRow + 11, sheet.maxRow)).map((cell) => cell.value));
  const firstWeekRow = rows[0]?.row ?? Math.min(sheet.minRow + 11, sheet.maxRow + 1);
  const groupCellCount = rows.reduce((count, row) => count + groupCellsForWeekRow(sheet, row, academicYear).length, 0);
  const unparsedAssignmentCells = unparsedAssignmentCellsForWeekRows(sheet, rows, academicYear);
  const suspiciousRows = suspiciousUnparsedWeekRows(sheet, rows);
  const headerCells = sheet.cells.filter((cell) => cell.row < firstWeekRow);
  const headerTimeCount = headerCells.filter((cell) => Boolean(parseTimeRange(cell.value))).length;
  const headerWeekdayCount = headerCells.filter((cell) => weekdayLabelsFromText(cell.value).length > 0).length;
  const subjectHeaderCount = headerCells.filter((cell) => {
    const merge = mergeContaining(sheet, cell.row, cell.col);
    const entry: HeaderEntry = { row: cell.row, value: compact(cell.value), ...(merge ? { merge } : {}) };
    return subjectScore(entry, sheet) >= 5;
  }).length;
  const reasons = [
    rows.length ? `Wykryto ${rows.length} wierszy zakresów tygodniowych.` : 'Nie wykryto wierszy zakresów tygodniowych.',
    groupCellCount ? `Wykryto ${groupCellCount} komórek z oznaczeniami grup w macierzy.` : 'Nie wykryto grup w wierszach tygodniowych.',
    headerTimeCount ? `Wykryto ${headerTimeCount} zakresów godzin w wielowierszowych nagłówkach.` : 'Nie wykryto godzin w nagłówkach macierzy.',
    headerWeekdayCount ? `Wykryto ${headerWeekdayCount} wskazówek dni tygodnia w nagłówkach.` : 'Nie wykryto wskazówek dni tygodnia w nagłówkach.',
    academicYear ? `Wykryto rok akademicki ${academicYearLabel(academicYear)}.` : 'Nie wykryto roku akademickiego.',
    unparsedAssignmentCells.length ? `Wykryto ${unparsedAssignmentCells.length} nieprzetworzonych komórek przypisań w rozpoznanych tygodniach.` : 'Wszystkie niepuste przypisania w rozpoznanych tygodniach mają rozpoznany model grup.',
    suspiciousRows.length ? `Wykryto ${suspiciousRows.length} wierszy z wieloma grupami, ale bez rozpoznanego zakresu tygodnia.` : 'Nie wykryto podejrzanych wierszy grup poza rozpoznanymi tygodniami.',
  ];
  let score = 0;
  score += Math.min(rows.length, 12) * 3;
  score += Math.min(groupCellCount, 60) / 5;
  score += Math.min(headerTimeCount, 12) * 1.5;
  score += Math.min(headerWeekdayCount, 12);
  score += Math.min(subjectHeaderCount, 12);
  if (academicYear) score += 4;
  if (/plan|zaj[eę]cia|prakty|harmonogram/i.test(sheet.name)) score += 3;
  return { sheet, weekRows: rows, academicYear, groupCellCount, headerTimeCount, headerWeekdayCount, subjectHeaderCount, unparsedAssignmentCells, suspiciousUnparsedWeekRows: suspiciousRows, score, reasons };
}

function bestMatrixSignals(workbook: WorkbookSnapshot): MatrixSignals | undefined {
  return workbook.sheets.map(matrixSignals).sort((a, b) => b.score - a.score)[0];
}

function lectureSectionHeader(text: string): boolean {
  const folded = foldPolishText(text);
  return /\bwyklady\b/.test(folded) && weekdayLabelsFromText(text).length > 0;
}

function lectureSignals(sheet: SheetSnapshot): LectureSignals {
  const academicYear = detectAcademicYear(sheet.cells.filter((cell) => cell.row <= Math.min(sheet.minRow + 19, sheet.maxRow)).map((cell) => cell.value));
  const sectionCount = sheet.cells.filter((cell) => lectureSectionHeader(cell.value)).length;
  const datedRows = new Set(sheet.cells
    .filter((cell) => cell.col <= Math.min(sheet.minCol + 1, sheet.maxCol))
    .filter((cell) => Boolean(cell.dateValue) || (looksLikeDateExpression(cell.value) && !parseTimeRange(cell.value)))
    .map((cell) => cell.row));
  const timedEntryCount = sheet.cells.filter((cell) => datedRows.has(cell.row) && cell.col > sheet.minCol && Boolean(parseTimeRange(cell.value))).length;
  return { sheet, academicYear, sectionCount, datedRowCount: datedRows.size, timedEntryCount };
}

function bestLectureSignals(workbook: WorkbookSnapshot): LectureSignals | undefined {
  return workbook.sheets
    .map(lectureSignals)
    .filter((signals) => signals.sectionCount > 0)
    .sort((a, b) => b.timedEntryCount - a.timedEntryCount || b.datedRowCount - a.datedRowCount)[0];
}

function lectureSubject(text: string): string {
  const timeMatch = /\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}/.exec(text);
  const beforeTime = timeMatch ? text.slice(0, timeMatch.index) : text;
  const beforePerson = beforeTime.split(/\b(?:prof\.?|dr\s+hab\.?|dr\.?|mgr\.?|lek\.?)\b/i)[0] ?? beforeTime;
  return compact(beforePerson.replace(/[,:;\-]+$/g, ''));
}

function lectureRoom(text: string): string | undefined {
  const match = /\b(aula\s+[A-Z0-9-]+)\b/i.exec(text);
  return match?.[1] ? compact(match[1]) : undefined;
}

function lectureLocationLabel(text: string): string | undefined {
  if (/centrum\s+dydaktyczne/i.test(text)) return 'Centrum Dydaktyczne';
  return undefined;
}

function buildLectureCandidates(sheet: SheetSnapshot, academicYear: AcademicYearContext | null): { candidates: StudyScheduleCandidate[]; information: ScheduleInformation[] } {
  const cellsByRow = new Map<number, SheetCellSnapshot[]>();
  for (const cell of sheet.cells) {
    const list = cellsByRow.get(cell.row) ?? [];
    list.push(cell);
    cellsByRow.set(cell.row, list);
  }
  const sectionRows = sheet.cells.filter((cell) => lectureSectionHeader(cell.value)).sort((a, b) => a.row - b.row);
  const candidates: StudyScheduleCandidate[] = [];
  const information: ScheduleInformation[] = [];

  for (let index = 0; index < sectionRows.length; index += 1) {
    const section = sectionRows[index];
    if (!section) continue;
    const nextRow = sectionRows[index + 1]?.row ?? sheet.maxRow + 1;
    const sectionText = compact(section.value);
    const sectionLocation = parseLocationText(sectionText);
    const sectionRoom = lectureRoom(sectionText);
    const sectionLabel = lectureLocationLabel(sectionText) ?? sectionLocation.label;

    const infoRows = sheet.cells.filter((cell) => cell.row > section.row && cell.row < nextRow && /e-learning/i.test(cell.value) && !looksLikeDateExpression(cell.value));
    for (const info of infoRows) {
      information.push({
        id: `info-${stableId(`${sheet.name}|${info.address}|${info.value}`)}`,
        sheet: sheet.name,
        title: 'Informacja o wykładach e-learningowych',
        message: compact(info.value),
      });
    }

    const rows = [...cellsByRow.entries()].filter(([row]) => row > section.row && row < nextRow).sort(([a], [b]) => a - b);
    for (const [row, rowCells] of rows) {
      const dateCell = [...rowCells].sort((a, b) => a.col - b.col).find((cell) => looksLikeDateExpression(cell.value) || Boolean(cell.dateValue));
      if (!dateCell) continue;
      const dateResult = parseDateExpression(dateCell.value, academicYear, undefined, dateCell.dateValue);
      const date = dateResult.dates[0];
      for (const entry of rowCells.filter((cell) => cell.col > dateCell.col).sort((a, b) => a.col - b.col)) {
        const time = parseTimeRange(entry.value);
        if (!time) continue;
        const subject = lectureSubject(entry.value);
        const directLocation = parseLocationText(`${entry.value} | ${sectionText}`);
        const room = lectureRoom(entry.value) ?? sectionRoom;
        const locationLabel = lectureLocationLabel(entry.value) ?? directLocation.label ?? sectionLabel;
        const address = directLocation.address ?? sectionLocation.address;
        const warnings: string[] = [...dateResult.warnings];
        if (!subject) warnings.push('Nie udało się ustalić przedmiotu wykładu.');
        if (!date) warnings.push('Nie udało się ustalić daty wykładu.');
        if (!address && !locationLabel) warnings.push('Nie udało się jednoznacznie ustalić lokalizacji.');
        const sourceKey = [sheet.name, entry.address, date ?? 'unknown-date', time.start, time.end, subject || 'unknown-subject'].join('|');
        const essential = Boolean(subject && date && time.start && time.end);
        candidates.push({
          id: stableId(sourceKey),
          adapterId: 'nursing-week-matrix-v2',
          sourceSheet: sheet.name,
          sourceRange: `${dateCell.address},${entry.address}`,
          sourceKey,
          originalText: `${dateCell.value} | ${entry.value} | ${sectionText}`,
          subject,
          activityType: 'Wykład',
          ...(date ? { date } : {}),
          startTime: time.start,
          endTime: time.end,
          groupScope: 'ALL',
          groupTags: [],
          ...(room ? { room } : {}),
          ...(address ? { address } : {}),
          ...(locationLabel ? { locationLabel } : {}),
          status: essential ? (warnings.length ? 'REVIEW_REQUIRED' : 'READY') : 'REVIEW_REQUIRED',
          warnings: [...new Set(warnings)],
          include: essential,
        });
      }
    }
  }
  return { candidates, information };
}

function adapterMatch(workbook: WorkbookSnapshot): ScheduleAdapterMatch {
  const matrix = bestMatrixSignals(workbook);
  const lecture = bestLectureSignals(workbook);
  if (!matrix && !lecture) {
    return { adapterId: 'nursing-week-matrix-v2', score: 0, handled: false, reasons: ['Skoroszyt nie zawiera arkuszy.'], detectedDays: [], layoutKind: 'WEEK_MATRIX', timeGridCount: 0, weekRowCount: 0, lectureEntryCount: 0, detectedGroupCount: 0 };
  }

  const matrixHandled = Boolean(matrix && matrix.weekRows.length >= 3 && matrix.groupCellCount >= 8 && matrix.subjectHeaderCount >= 2 && matrix.headerTimeCount >= 1);
  const lectureHandled = Boolean(lecture && lecture.sectionCount >= 1 && lecture.datedRowCount >= 3 && lecture.timedEntryCount >= 3);
  const handled = matrixHandled || lectureHandled;
  const score = (matrix?.score ?? 0) + (lectureHandled ? Math.min(20, lecture?.timedEntryCount ?? 0) : 0);
  const detectedDays = matrix
    ? [...new Set(sheetHeaderWeekdays(matrix.sheet, matrix.weekRows[0]?.row ?? 12))]
    : [];
  const reasons = [
    ...(matrix?.reasons ?? []),
    ...(lecture?.sectionCount ? [`Wykryto ${lecture.sectionCount} sekcje wykładów i ${lecture.timedEntryCount} wpisów z godzinami.`] : []),
  ];
  const detectedAcademicYear = academicYearLabel(matrix?.academicYear ?? lecture?.academicYear ?? null);
  return {
    adapterId: 'nursing-week-matrix-v2',
    score,
    handled,
    ...(matrix?.sheet.name ? { sheetName: matrix.sheet.name } : lecture?.sheet.name ? { sheetName: lecture.sheet.name } : {}),
    reasons,
    detectedDays,
    layoutKind: 'WEEK_MATRIX',
    timeGridCount: 0,
    weekRowCount: matrix?.weekRows.length ?? 0,
    lectureEntryCount: lecture?.timedEntryCount ?? 0,
    ...(detectedAcademicYear ? { detectedAcademicYear } : {}),
    detectedGroupCount: matrix?.groupCellCount ?? 0,
  };
}

function sheetHeaderWeekdays(sheet: SheetSnapshot, beforeRow: number): WeekdayLabel[] {
  return [...new Set(sheet.cells.filter((cell) => cell.row < beforeRow).flatMap((cell) => weekdayLabelsFromText(cell.value)))];
}

export const nursingWeekMatrixV2Adapter: ScheduleAdapter = {
  id: 'nursing-week-matrix-v2',

  match(workbook: WorkbookSnapshot): ScheduleAdapterMatch {
    return adapterMatch(workbook);
  },

  canHandle(workbook: WorkbookSnapshot): boolean {
    return adapterMatch(workbook).handled;
  },

  analyze(workbook: WorkbookSnapshot): ScheduleAnalysis {
    const match = adapterMatch(workbook);
    const matrix = bestMatrixSignals(workbook);
    const lecture = bestLectureSignals(workbook);
    if (!match.handled) {
      return {
        adapterId: this.id,
        sheetNames: workbook.sheetNames,
        groups: [],
        candidates: [],
        information: [],
        warnings: ['Skoroszyt nie zawiera wystarczająco zgodnej macierzy tygodniowej ani sekcji wykładów.'],
        diagnostics: {
          ...(match.sheetName ? { matchedSheet: match.sheetName } : {}),
          adapterReasons: match.reasons,
          detectedDays: match.detectedDays,
          layoutKind: 'WEEK_MATRIX',
          timeGridCount: 0,
          weekRowCount: matrix?.weekRows.length ?? 0,
          lectureEntryCount: 0,
          usedRanges: workbook.sheets.map((sheet) => `${sheet.name}: ${sheet.usedRange ?? 'brak'}`),
        },
      };
    }

    const matrixData = matrix && matrix.weekRows.length >= 3 && matrix.groupCellCount >= 8
      ? buildMatrixCandidates(matrix.sheet, matrix)
      : { candidates: [] as StudyScheduleCandidate[], sourceBlocks: [] as StudySourceBlock[] };
    const matrixCandidates = matrixData.candidates;
    const lectureData = lecture && lecture.sectionCount >= 1 && lecture.timedEntryCount >= 3
      ? buildLectureCandidates(lecture.sheet, lecture.academicYear ?? matrix?.academicYear ?? null)
      : { candidates: [] as StudyScheduleCandidate[], information: [] as ScheduleInformation[] };
    const candidates = [...matrixCandidates, ...lectureData.candidates];
    const groups = sortStudyGroups([...new Set(matrixCandidates.flatMap((candidate) => candidate.groupTags))]);
    const academicYear = matrix?.academicYear ?? lecture?.academicYear ?? null;
    const termTexts = workbook.sheets.flatMap((sheet) => sheet.cells.filter((cell) => cell.row <= Math.min(sheet.maxRow, sheet.minRow + 19)).map((cell) => cell.value));
    const warnings: string[] = [];
    if (!matrixCandidates.length && matrix?.weekRows.length) warnings.push('Rozpoznano macierz tygodniową, ale nie utworzono kandydatów zajęć grupowych.');
    if (!groups.length && matrixCandidates.length) warnings.push('Nie udało się wydobyć listy grup z macierzy.');
    if (!candidates.length) warnings.push('Nie wykryto kandydatów zajęć w rozpoznanym formacie.');

    const unresolvedPatterns = [...new Set(candidates.flatMap((candidate) => candidate.warnings))].slice(0, 10);
    const detectedAcademicYear = academicYearLabel(academicYear);
    const detectedTerm = detectTerm(termTexts);
    return {
      adapterId: this.id,
      sheetNames: workbook.sheetNames,
      ...(detectedAcademicYear ? { detectedAcademicYear } : {}),
      ...(detectedTerm ? { detectedTerm } : {}),
      groups,
      candidates,
      sourceBlocks: matrixData.sourceBlocks,
      completeness: auditStudyScheduleCompleteness({ candidates, sourceBlocks: matrixData.sourceBlocks }),
      information: lectureData.information,
      warnings,
      diagnostics: {
        ...(matrix?.sheet.name ? { matchedSheet: matrix.sheet.name } : lecture?.sheet.name ? { matchedSheet: lecture.sheet.name } : {}),
        adapterReasons: match.reasons,
        detectedDays: match.detectedDays,
        layoutKind: 'WEEK_MATRIX',
        timeGridCount: 0,
        weekRowCount: matrix?.weekRows.length ?? 0,
        lectureEntryCount: lectureData.candidates.length,
        usedRanges: workbook.sheets.map((sheet) => `${sheet.name}: ${sheet.usedRange ?? 'brak'}`),
        hiddenRowCount: matrix?.sheet.hiddenRows?.length ?? 0,
        hiddenColumnCount: matrix?.sheet.hiddenColumns?.length ?? 0,
        unresolvedPatterns,
        unparsedAssignmentCellCount: matrix?.unparsedAssignmentCells.length ?? 0,
        unparsedAssignmentSamples: matrix?.unparsedAssignmentCells.slice(0, 8).map((cell) => `${cell.address}: ${compact(cell.value)}`) ?? [],
        suspiciousUnparsedWeekRows: matrix?.suspiciousUnparsedWeekRows ?? [],
      },
    };
  },
};
