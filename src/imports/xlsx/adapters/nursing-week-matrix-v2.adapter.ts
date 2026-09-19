import type { ScheduleAnalysis, ScheduleInformation, StudyScheduleCandidate, StudySourceBlock } from '../../../study/study.types';
import type { ScheduleAdapter, ScheduleAdapterMatch } from '../adapter.types';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../xlsx.types';
import { academicYearLabel, detectAcademicYear, detectTerm, looksLikeDateExpression, parseDateExpression, type AcademicYearContext } from '../date-parser';
import { inferStudyGroupKind, normalizeGroupText, sortStudyGroups, studyGroupKey, type StudyGroupKind } from '../group-normalizer';
import { findBestFooterHint, findFooterHintByExplicitUnitCode, findUnambiguousFooterHint, parseLocationText, type FooterLocationHint, type LocationParseResult } from '../location-parser';
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
  col: number;
  source: string;
  start: string;
  end: string;
}

interface HeaderEntry {
  row: number;
  value: string;
  rawValue?: string;
  merge?: SheetMergeSnapshot;
}

interface LocationRule {
  weekdays: WeekdayLabel[];
  startDate?: string;
  endDate?: string;
  location: LocationParseResult;
  sourceText: string;
}

interface InlineAssignmentDetails {
  groups: ReturnType<typeof normalizeGroupText>;
  date?: string;
  time?: ParsedTimeRange;
  location: LocationParseResult;
}

interface ColumnContext {
  col: number;
  subject: string;
  activityType?: string;
  weekdays: WeekdayLabel[];
  time?: ParsedTimeRange;
  location: LocationParseResult;
  locationRules: LocationRule[];
  firstMeetingLocation?: LocationParseResult;
  firstMeetingLocationKey?: string;
  headerText: string;
  sourceSectionKey: string;
  declaredTeachingHours?: number;
  timeAdjustedByExplicitHint?: boolean;
}

interface FooterContextHint extends FooterLocationHint {
  row: number;
  startTimeOverride?: string;
  firstMeetingOnly?: boolean;
}

interface DateException {
  groupCellAddress: string;
  date: string;
  context: ColumnContext;
  markerCell: SheetCellSnapshot;
}

interface UnappliedDateException {
  groupCellAddress: string;
  markerCellAddress: string;
  date: string;
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
  const normalized = compact(text)
    .replace(/^tydzie[nń]\s*[:.-]?\s*/i, '')
    .replace(/^od\s+/i, '')
    .replace(/\s+do\s+/i, ' - ');

  const fullRange = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](20\d{2}))?\.?\s*[-–—]\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\.?$/.exec(normalized);
  const compactSameMonth = /^(\d{1,2})\.?\s*[-–—]\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\.?$/.exec(normalized);

  let startDay: number;
  let startMonth: number;
  let startYear: number;
  let endDay: number;
  let endMonth: number;
  let endYear: number;

  if (fullRange) {
    startDay = Number(fullRange[1]);
    startMonth = Number(fullRange[2]);
    endDay = Number(fullRange[4]);
    endMonth = Number(fullRange[5]);
    endYear = Number(fullRange[6]);
    const explicitStartYear = fullRange[3] ? Number(fullRange[3]) : undefined;
    startYear = explicitStartYear ?? (startMonth > endMonth ? endYear - 1 : endYear);
  } else if (compactSameMonth) {
    startDay = Number(compactSameMonth[1]);
    endDay = Number(compactSameMonth[2]);
    startMonth = Number(compactSameMonth[3]);
    endMonth = startMonth;
    endYear = Number(compactSameMonth[4]);
    startYear = endYear;
  } else {
    return null;
  }

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
    const leftCandidates = [...cells]
      .filter((cell) => cell.col <= Math.min(sheet.minCol + 2, sheet.maxCol))
      .sort((a, b) => a.col - b.col);
    const match = leftCandidates
      .map((cell) => ({ cell, parsed: parseWeekRange(cell.value) }))
      .find((entry) => Boolean(entry.parsed));
    if (!match?.parsed) continue;
    rows.push({ row, col: match.cell.col, source: compact(match.cell.value), ...match.parsed });
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
    return { row, value: compact(direct.value), rawValue: direct.value, ...(merge ? { merge } : {}) };
  }
  const merge = mergeContaining(sheet, row, col);
  if (!merge) return undefined;
  const anchor = directCell(sheet, merge.startRow, merge.startCol);
  if (!anchor?.value) return undefined;
  return { row, value: compact(anchor.value), rawValue: anchor.value, merge };
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

function headerEntryWidth(entry: HeaderEntry): number {
  return entry.merge ? entry.merge.endCol - entry.merge.startCol + 1 : 1;
}

function entriesMostSpecificFirst(entries: HeaderEntry[]): HeaderEntry[] {
  return [...entries].sort((left, right) => {
    const widthDifference = headerEntryWidth(left) - headerEntryWidth(right);
    if (widthDifference !== 0) return widthDifference;
    return right.row - left.row;
  });
}

function entriesBroadToSpecific(entries: HeaderEntry[]): HeaderEntry[] {
  return [...entries].sort((left, right) => {
    const widthDifference = headerEntryWidth(right) - headerEntryWidth(left);
    if (widthDifference !== 0) return widthDifference;
    return left.row - right.row;
  });
}

function mostSpecificWeekdays(entries: HeaderEntry[]): WeekdayLabel[] {
  const weekdayEntries = entriesMostSpecificFirst(entries)
    .map((entry) => ({ entry, labels: weekdayLabelsFromText(entry.value), hasTime: Boolean(parseTimeRange(entry.value)) }))
    .filter((item) => item.labels.length > 0);
  const first = weekdayEntries[0];
  if (!first) return [];

  const bestWidth = headerEntryWidth(first.entry);
  const sameWidth = weekdayEntries.filter((item) => headerEntryWidth(item.entry) === bestWidth);
  const timed = sameWidth.filter((item) => item.hasTime);
  const pool = timed.length ? timed : sameWidth;
  const bestRow = Math.max(...pool.map((item) => item.entry.row));
  return [...new Set(pool
    .filter((item) => item.entry.row === bestRow)
    .flatMap((item) => item.labels))];
}

function weekdaysFromOverlappingTimedMerge(sheet: SheetSnapshot, col: number, entries: HeaderEntry[], headerStartRow: number, headerEndRow: number): WeekdayLabel[] {
  // Some university sheets contain a malformed merge where the time cell starts
  // one column before the day heading (e.g. CO:CQ while Friday starts at CP).
  // We may bridge that gap only when the SAME timed merge overlaps columns that
  // yield exactly one weekday. Multiple possible weekdays remain unresolved.
  const timedMerges = entries
    .filter((entry) => Boolean(entry.merge) && Boolean(parseTimeRange(entry.value)))
    .map((entry) => entry.merge!)
    .filter((merge) => col >= merge.startCol && col <= merge.endCol);
  for (const merge of timedMerges) {
    const labels = new Set<WeekdayLabel>();
    for (let siblingCol = merge.startCol; siblingCol <= merge.endCol; siblingCol += 1) {
      for (const siblingEntry of uniqueHeaderEntries(sheet, siblingCol, headerStartRow, headerEndRow)) {
        if (siblingEntry.merge?.ref === merge.ref) continue;
        weekdayLabelsFromText(siblingEntry.value).forEach((label) => labels.add(label));
      }
    }
    if (labels.size === 1) return [...labels];
  }
  return [];
}

function mostSpecificWeekdaysForColumn(sheet: SheetSnapshot, col: number, entries: HeaderEntry[], headerStartRow: number, headerEndRow: number): WeekdayLabel[] {
  const direct = mostSpecificWeekdays(entries);
  return direct.length ? direct : weekdaysFromOverlappingTimedMerge(sheet, col, entries, headerStartRow, headerEndRow);
}

function mostSpecificTime(entries: HeaderEntry[]): ParsedTimeRange | undefined {
  for (const entry of entriesMostSpecificFirst(entries)) {
    const range = parseTimeRange(entry.value);
    if (range) return range;
  }
  return undefined;
}

function hasLocationValue(location: LocationParseResult): boolean {
  return Boolean(location.room || location.address || location.label);
}

function isScopedLocationEntry(entry: HeaderEntry): boolean {
  return hasLocationValue(parseLocationText(entry.value)) && weekdayLabelsFromText(entry.value).length > 0;
}

function headerLocation(entries: HeaderEntry[]): LocationParseResult {
  // A room/address qualified by a weekday is not a global column location.
  // It is applied later to concrete candidate dates through locationRules.
  return entriesBroadToSpecific(entries).reduce<LocationParseResult>((location, entry) => {
    if (isScopedLocationEntry(entry)) return location;
    const parsed = parseLocationText(entry.value);
    return {
      ...(location.room ? { room: location.room } : {}),
      ...(location.address ? { address: location.address } : {}),
      ...(location.label ? { label: location.label } : {}),
      ...(parsed.room ? { room: parsed.room } : {}),
      ...(parsed.address ? { address: parsed.address } : {}),
      ...(parsed.label ? { label: parsed.label } : {}),
    };
  }, {});
}

function parseRuleDate(token: string, academicYear: AcademicYearContext | null): string | undefined {
  return parseDateExpression(token, academicYear).dates[0];
}

function locationRulesFromText(text: string, academicYear: AcademicYearContext | null): LocationRule[] {
  if (!hasLocationValue(parseLocationText(text))) return [];
  const foldedText = foldPolishText(text);
  const weekdayToken = /\b(poniedzialek|pon\.|wtorek|wt\.|sroda|sr\.|czwartek|czw\.|piatek|pt\.|sobota|sob\.|niedziela|nd\.)/g;
  const matches = [...foldedText.matchAll(weekdayToken)];
  if (!matches.length) return [];
  const rules: LocationRule[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]!;
    const start = current.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1]!.index ?? text.length) : text.length;
    const segment = compact(text.slice(start, end));
    const weekdays = weekdayLabelsFromText(current[0]);
    if (!weekdays.length) continue;

    // A time range such as 8.00 - 14.00 has the same punctuation shape as a
    // day.month date range. Treat a range as a date scope only after both
    // ends parse as valid calendar dates in the detected academic year.
    const rawRanges = [...segment.matchAll(/(\d{1,2}[.]\d{1,2}[.]?)\s*[-–—]\s*(\d{1,2}[.]\d{1,2}[.]?)/g)];
    const dateRanges = rawRanges.flatMap((range) => {
      const startDate = parseRuleDate(range[1] ?? '', academicYear);
      const endDate = parseRuleDate(range[2] ?? '', academicYear);
      return startDate && endDate ? [{ range, startDate, endDate }] : [];
    });

    if (!dateRanges.length) {
      const location = parseLocationText(segment);
      if (hasLocationValue(location)) rules.push({ weekdays, location, sourceText: segment });
      continue;
    }

    for (let rangeIndex = 0; rangeIndex < dateRanges.length; rangeIndex += 1) {
      const currentRange = dateRanges[rangeIndex]!;
      const bodyStart = (currentRange.range.index ?? 0) + currentRange.range[0].length;
      const bodyEnd = rangeIndex + 1 < dateRanges.length
        ? (dateRanges[rangeIndex + 1]!.range.index ?? segment.length)
        : segment.length;
      const locationText = compact(segment.slice(bodyStart, bodyEnd).replace(/^\s*[-–—]\s*/, ''));
      const location = parseLocationText(locationText);
      if (!hasLocationValue(location)) continue;
      rules.push({
        weekdays,
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        location,
        sourceText: `${currentRange.range[0]} ${locationText}`,
      });
    }
  }
  return rules;
}

function locationRules(entries: HeaderEntry[], academicYear: AcademicYearContext | null): LocationRule[] {
  return entriesBroadToSpecific(entries).flatMap((entry) => locationRulesFromText(entry.rawValue ?? entry.value, academicYear));
}

function locationForDate(base: LocationParseResult, rules: LocationRule[], date: string): LocationParseResult {
  if (!date) return base;
  const day = keyToDate(date).getDay();
  const matching = rules.filter((rule) => rule.weekdays.some((weekday) => WEEKDAY_INDEX[weekday] === day)
    && (!rule.startDate || date >= rule.startDate)
    && (!rule.endDate || date <= rule.endDate));
  return matching.reduce<LocationParseResult>((location, rule) => ({
    ...(location.room ? { room: location.room } : {}),
    ...(location.address ? { address: location.address } : {}),
    ...(location.label ? { label: location.label } : {}),
    ...(rule.location.room ? { room: rule.location.room } : {}),
    ...(rule.location.address ? { address: rule.location.address } : {}),
    ...(rule.location.label ? { label: rule.location.label } : {}),
  }), base);
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

function parseActivityType(text: string): string | undefined {
  const lower = foldPolishText(text);
  if (/zaj(?:ecia|\.)\s*prakt|\bpraktyki\b/.test(lower)) return 'Zajęcia praktyczne';
  if (/\bcwiczenia\b|\bcw\.?\s*\d*g?\b/.test(lower)) return 'Ćwiczenia';
  if (/\bseminari(?:um|a)\b/.test(lower)) return 'Seminaria';
  if (/\bwyklady?\b/.test(lower)) return 'Wykład';
  if (/\blaboratorium\b|\blab\.?\b/.test(lower)) return 'Laboratorium';
  return undefined;
}

function activityDescriptorOnly(text: string): boolean {
  const folded = foldPolishText(text);
  return /^(?:seminari(?:um|a)|cwiczenia|cw\.?|zaj(?:ecia|\.)\s*prakt|praktyki)(?:\b|\s)/.test(folded);
}

function teachingHoursOnly(text: string): boolean {
  return /^\s*\d{1,3}\s*(?:g|godz\.?)\s*$/i.test(text);
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
  const cleanedSubject = cleanMatrixSubject(entry.rawValue ?? entry.value);
  const compactRaw = compact(entry.rawValue ?? entry.value);
  const explicitMultilineSubject = Boolean(
    entry.rawValue?.includes('\n')
    && cleanedSubject
    && cleanedSubject !== compactRaw
    && cleanedSubject === cleanedSubject.toUpperCase()
    && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(cleanedSubject)
    && cleanedSubject.length <= 80
  );
  if (parseTimeRange(entry.value)) return -40;
  if (weekdayLabelsFromText(entry.value).length && entry.value.length < 80) return -30;
  if (activityDescriptorOnly(entry.value) || teachingHoursOnly(entry.value)) return -25;
  if (/^(prof|dr\b|dr hab|mgr|lek\b|sala\b|ul\b|al\b|centrum\b|klinika\b|katedra\b|zaklad\b)/.test(folded)) return -20;
  const strongSubject = explicitMultilineSubject || /chirurg|interna|pediatr|rehab|farmak|promoc|\bpoz\b|prakty|semin|cwicz|\bcw\b|wyklad/.test(folded);
  const locationLike = parseLocationText(entry.value);
  if (!strongSubject && (locationLike.address || locationLike.label || locationLike.room)) return -20;
  if (!explicitMultilineSubject && /pierwsze spotkanie|adres|terminach|godz\.|obowiazk|uwaga/.test(folded)) return -20;

  let score = Math.max(0, 10 - (entry.row - sheet.minRow + 1));
  const width = entry.merge ? entry.merge.endCol - entry.merge.startCol + 1 : 1;
  if (width >= 2) score += 4;
  if (strongSubject) score += 6;
  if (cleanedSubject === cleanedSubject.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(cleanedSubject)) score += 2;
  return score;
}

function strongSubjectHeader(entry: HeaderEntry): boolean {
  const folded = foldPolishText(entry.value);
  if (activityDescriptorOnly(entry.value) || teachingHoursOnly(entry.value)) return false;
  if (/^(prof|profesor|dr\b|dr hab|mgr|lek\b|sala\b|ul\b|al\b|centrum\b|klinika\b|katedra\b|zaklad\b)/.test(folded)) return false;
  const cleanedSubject = cleanMatrixSubject(entry.rawValue ?? entry.value);
  const explicitMultilineSubject = Boolean(
    entry.rawValue?.includes('\n')
    && cleanedSubject
    && cleanedSubject !== compact(entry.rawValue ?? entry.value)
    && cleanedSubject === cleanedSubject.toUpperCase()
    && /[A-ZĄĆĘŁŃÓŚŹŻ]/.test(cleanedSubject)
    && cleanedSubject.length <= 80
  );
  if (explicitMultilineSubject) return true;
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

function declaredTeachingHoursFromEntries(entries: HeaderEntry[]): number | undefined {
  for (const entry of [...entries].sort((a, b) => a.row - b.row)) {
    const value = declaredTeachingHoursFromText(entry.value);
    if (value) return value;
  }
  return undefined;
}

function sourceSectionKey(sheet: SheetSnapshot, entry: HeaderEntry | undefined, col: number): string {
  if (entry?.merge?.ref) return `${sheet.name}|${entry.merge.ref}`;
  if (entry) return `${sheet.name}|R${entry.row}C${col}`;
  return `${sheet.name}|C${col}`;
}

function cleanMatrixSubject(value: string): string {
  const lines = value.split(/\r?\n/).map((line) => compact(line)).filter(Boolean);
  let source = value;
  if (lines.length > 1) {
    const remainder = lines.slice(1).join(' ');
    const parsedLocation = parseLocationText(remainder);
    if (parsedLocation.address || parsedLocation.label || parsedLocation.room
      || /\b(szpital|centrum|klinika|katedra|zaklad|hospicjum|rezydencja|osrodek)\b/.test(foldPolishText(remainder))) {
      source = lines[0] ?? value;
    }
  }
  return compact(source)
    .replace(/\s+zaj[eę]cia\s+praktyczne\b.*$/i, '')
    .replace(/\s+(?:\d+\s*(?:godz\.?|g))\b.*$/i, '')
    .replace(/\s+grupy?\s+\d+\s*[- ]?\s*osobowe.*$/i, '')
    .replace(/^GERIATIA$/i, 'GERIATRIA')
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
        const segmentFirstMeetingOnly = /\bpierwsze\s+spotkanie\b/.test(foldPolishText(segment));
        if (!parsedSegment.address && !parsedSegment.label && !parsedSegment.room && !segmentStartTime) continue;
        hints.push({
          key: segment,
          rawText: segment,
          row: cell.row,
          ...(parsedSegment.room ? { room: parsedSegment.room } : {}),
          ...(parsedSegment.address ? { address: parsedSegment.address } : {}),
          ...(parsedSegment.label ? { label: parsedSegment.label } : {}),
          ...(segmentStartTime ? { startTimeOverride: segmentStartTime } : {}),
          ...(segmentFirstMeetingOnly ? { firstMeetingOnly: true } : {}),
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
      const windowFirstMeetingOnly = /\bpierwsze\s+spotkanie\b/.test(foldPolishText(key));
      if (!parsed.address && !parsed.label && !parsed.room && !windowStartTime) continue;
      hints.push({
        key,
        rawText: key,
        row: cell.row,
        ...(parsed.room ? { room: parsed.room } : {}),
        ...(parsed.address ? { address: parsed.address } : {}),
        ...(parsed.label ? { label: parsed.label } : {}),
        ...(windowStartTime ? { startTimeOverride: windowStartTime } : {}),
        ...(windowFirstMeetingOnly ? { firstMeetingOnly: true } : {}),
      });
    }
    previousByCol.set(cell.col, cell);
  }
  return hints;
}

function footerHintMatchesActivity(hint: FooterContextHint, activityType: string | undefined): boolean {
  if (!activityType) return true;
  const folded = foldPolishText(hint.rawText);
  const mentioned = new Set<string>();
  if (/zaj(?:ecia|\.)\s*prakt|\bpraktyki\b/.test(folded)) mentioned.add('Zajęcia praktyczne');
  if (/\bcwiczenia\b|\bcw\.?\s*\d*g?\b/.test(folded)) mentioned.add('Ćwiczenia');
  if (/\bseminari(?:um|a)\b/.test(folded)) mentioned.add('Seminaria');
  if (/\bwyklady?\b/.test(folded)) mentioned.add('Wykład');
  return mentioned.size === 0 || mentioned.has(activityType);
}

function bestFooterContext(query: string, fallbackQuery: string, footer: FooterContextHint[], activityType?: string): FooterContextHint | undefined {
  const locationHints = footer.filter((hint) => !hint.firstMeetingOnly && footerHintMatchesActivity(hint, activityType) && Boolean(hint.address || hint.label || hint.room));
  const precise = findBestFooterHint(query, locationHints) as FooterContextHint | undefined;
  if (precise) return precise;
  return findUnambiguousFooterHint(fallbackQuery, locationHints) as FooterContextHint | undefined;
}

function bestFirstMeetingFooterContext(query: string, _fallbackQuery: string, footer: FooterContextHint[], activityType?: string): FooterContextHint | undefined {
  const locationHints = footer.filter((hint) => hint.firstMeetingOnly && footerHintMatchesActivity(hint, activityType) && Boolean(hint.address || hint.label || hint.room));
  // Dopisek "pierwsze spotkanie" jest lokalny dla konkretnego prowadzącego / kolumny.
  // Nie wolno rozszerzać go po samym przedmiocie na inną jednostkę tego samego przedmiotu.
  return findBestFooterHint(query, locationHints) as FooterContextHint | undefined;
}

function bestFooterStartTime(query: string, footer: FooterContextHint[]): string | undefined {
  // Godzina ze stopki jest zbyt ryzykowna, by dopasowywać ją po samym przedmiocie.
  // Wymagamy precyzyjnego kontekstu kolumny (np. nazwiska/oznaczenia prowadzącego).
  const timeHints = footer.filter((hint) => Boolean(hint.startTimeOverride));
  return (findBestFooterHint(query, timeHints) as FooterContextHint | undefined)?.startTimeOverride;
}

function columnContext(sheet: SheetSnapshot, col: number, headerStartRow: number, headerEndRow: number, footer: FooterContextHint[], academicYear: AcademicYearContext | null): ColumnContext {
  const entries = uniqueHeaderEntries(sheet, col, headerStartRow, headerEndRow).filter((entry) => !looksGlobalHeader(entry, sheet));
  const subjectEntry = selectSubjectEntry(entries, sheet);
  const subjectHeader = subjectEntry?.value ?? '';
  const subject = cleanMatrixSubject(subjectEntry?.rawValue ?? subjectHeader);
  const sectionKey = sourceSectionKey(sheet, subjectEntry, col);
  const declaredTeachingHours = declaredTeachingHoursFromEntries(entries);
  const detailTexts = entries.filter((entry) => entry.value !== subjectHeader).map((entry) => entry.value);
  const identityTexts = detailTexts.filter((text) => {
    const folded = foldPolishText(text);
    return !parseTimeRange(text)
      && weekdayLabelsFromText(text).length === 0
      && !/wskazane\s+ponizej|pierwsze\s+spotkanie|adresy\s+jednostek|centrum\s+symulacji/.test(folded);
  });
  const allTexts = entries.map((entry) => entry.value);
  const weekdays = mostSpecificWeekdaysForColumn(sheet, col, entries, headerStartRow, headerEndRow);
  const baseTime = mostSpecificTime(entries);
  const combinedHeaderText = allTexts.join(' | ');
  const directLocation = headerLocation(entries);
  const scopedLocationRules = locationRules(entries, academicYear);
  const preciseFooterQuery = identityTexts.join(' | ');
  const fallbackFooterQuery = subjectHeader;
  const activityType = parseActivityType(combinedHeaderText);
  const foldedHeaderText = foldPolishText(combinedHeaderText);
  const locationExplicitlyDeferred = /(?:adresy?|lokalizacj\w*)[^|]{0,120}(?:podane|wskazane|zamieszczone|przekazane)\s+(?:zostana|beda)/.test(foldedHeaderText)
    || /(?:adresy?|lokalizacj\w*)[^|]{0,120}(?:zostana|beda)\s+(?:podane|wskazane|zamieszczone|przekazane)/.test(foldedHeaderText);
  const semanticFallback = locationExplicitlyDeferred ? undefined : bestFooterContext(preciseFooterQuery, fallbackFooterQuery, footer, activityType);
  const explicitUnitFallback = locationExplicitlyDeferred || semanticFallback ? undefined : findFooterHintByExplicitUnitCode(combinedHeaderText, footer);
  const fallback = semanticFallback ?? explicitUnitFallback;
  const firstMeetingFallback = locationExplicitlyDeferred ? undefined : bestFirstMeetingFooterContext(preciseFooterQuery, fallbackFooterQuery, footer, activityType);
  const startTimeOverride = explicitStartTimeHint(combinedHeaderText) ?? bestFooterStartTime(preciseFooterQuery, footer);
  const time = withStartOverride(baseTime, startTimeOverride);
  const timeAdjustedByExplicitHint = Boolean(baseTime && startTimeOverride && startTimeOverride !== baseTime.start);
  const location = mergeLocation(directLocation, fallback);
  const hasDirectOrGeneralLocation = Boolean(location.address || location.label || location.room);
  const firstMeetingLocation = !hasDirectOrGeneralLocation && firstMeetingFallback ? mergeLocation({}, firstMeetingFallback) : undefined;
  return {
    col,
    subject,
    ...(activityType ? { activityType } : {}),
    weekdays,
    ...(time ? { time } : {}),
    location,
    locationRules: scopedLocationRules,
    ...(firstMeetingLocation ? { firstMeetingLocation } : {}),
    ...(firstMeetingLocation && firstMeetingFallback?.key ? { firstMeetingLocationKey: firstMeetingFallback.key } : {}),
    headerText: allTexts.join(' | '),
    sourceSectionKey: sectionKey,
    ...(declaredTeachingHours ? { declaredTeachingHours } : {}),
    ...(timeAdjustedByExplicitHint ? { timeAdjustedByExplicitHint: true } : {}),
  };
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

function looksLikeNarrativeGroupMatrix(sheet: SheetSnapshot, cell: SheetCellSnapshot): boolean {
  const merge = mergeContaining(sheet, cell.row, cell.col);
  if (!merge) return false;
  const area = (merge.endRow - merge.startRow + 1) * (merge.endCol - merge.startCol + 1);
  if (area < 12 || cell.value.length < 120) return false;
  const folded = foldPolishText(cell.value);
  const groupMentions = folded.match(/\b(?:grupa|gr\.)\s*\d+/g)?.length ?? 0;
  const locationMentions = folded.match(/\bsala\b|\bul\.?\b|\bnz[a-z]{1,3}\b|\bcbi\b|\bcd\b/g)?.length ?? 0;
  return groupMentions >= 2 && locationMentions >= 2;
}

function assignmentGroups(cell: SheetCellSnapshot): ReturnType<typeof normalizeGroupText> {
  const direct = normalizeGroupText(cell.value, true);
  if (direct.groups.length) return direct;
  // Some sheets encode a one-off assignment in a single cell, e.g.
  // "10a 05.10. - 8.00 - 14.00 sala 101 ZPK". Only accept a group
  // token anchored at the very beginning so narrative cells are not promoted.
  const prefix = /^\s*(\d{1,2}\s*[A-Za-z](?:\s*[12])?)\b/.exec(cell.value)?.[1];
  if (!prefix) return direct;
  const normalized = normalizeGroupText(prefix, true);
  return normalized.groups.length ? { ...normalized, originalText: cell.value } : direct;
}

function inlineAssignmentDetails(cell: SheetCellSnapshot, academicYear: AcademicYearContext | null): InlineAssignmentDetails | undefined {
  const groups = assignmentGroups(cell);
  if (!groups.groups.length) return undefined;
  const compactValue = compact(cell.value);
  const groupPrefix = /^\s*\d{1,2}\s*[A-Za-z](?:\s*[12])?\b/.exec(compactValue)?.[0];
  if (!groupPrefix) return undefined;
  const afterGroup = compactValue.slice(groupPrefix.length).trim();
  const dateMatch = /^(\d{1,2}[.\/-]\d{1,2}\.?)\s*[-–—]\s*/.exec(afterGroup);
  if (!dateMatch?.[1]) return undefined;
  const date = parseDateExpression(dateMatch[1], academicYear).dates[0];
  if (!date) return undefined;
  const afterDate = afterGroup.slice(dateMatch[0].length);
  const time = parseTimeRange(afterDate);
  const location = parseLocationText(afterDate);
  return { groups, date, ...(time ? { time } : {}), location };
}

function groupCellsForWeekRow(sheet: SheetSnapshot, weekRow: WeekRangeRow, academicYear: AcademicYearContext | null): SheetCellSnapshot[] {
  return sheet.cells
    .filter((cell) => cell.row === weekRow.row && cell.col > weekRow.col)
    .filter((cell) => !looksLikeNarrativeGroupMatrix(sheet, cell))
    .filter((cell) => assignmentGroups(cell).groups.length > 0)
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
    .filter((cell) => cell.row === range.row && cell.col > range.col)
    .filter((cell) => assignmentGroups(cell).groups.length === 0)
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
    ...(base.timeAdjustedByExplicitHint || override.timeAdjustedByExplicitHint ? { timeAdjustedByExplicitHint: true } : {}),
    ...(override.firstMeetingLocation ?? base.firstMeetingLocation ? { firstMeetingLocation: override.firstMeetingLocation ?? base.firstMeetingLocation } : {}),
    ...(override.firstMeetingLocationKey ?? base.firstMeetingLocationKey ? { firstMeetingLocationKey: override.firstMeetingLocationKey ?? base.firstMeetingLocationKey } : {}),
    locationRules: [...base.locationRules, ...override.locationRules],
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
  return assignmentGroups(cell).groups;
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

function explicitGroupKindHints(sheet: SheetSnapshot): Map<string, StudyGroupKind> {
  const candidates = new Map<string, Set<StudyGroupKind>>();
  const add = (activityType: string, kind: StudyGroupKind) => {
    const set = candidates.get(activityType) ?? new Set<StudyGroupKind>();
    set.add(kind);
    candidates.set(activityType, set);
  };

  for (const cell of sheet.cells) {
    const folded = foldPolishText(cell.value);
    for (const segment of folded.split(/[;|]/).map((value) => value.trim()).filter(Boolean)) {
      if (/seminari/.test(segment) && /grup(?:ach|y)\s+dziekansk/.test(segment)) add('Seminaria', 'MAIN');
      if (/cwiczen/.test(segment) && (/(?:1\s*\/\s*2)\s+grupy\s+dziekansk/.test(segment) || /\b12\s*osob/.test(segment))) add('Ćwiczenia', 'G12');
      if (/(?:zajecia\s+praktycz|praktyki)/.test(segment) && (/(?:1\s*\/\s*3)\s+grupy\s+dziekansk/.test(segment) || /\b8\s*osob/.test(segment))) add('Zajęcia praktyczne', 'G8');
      if (/(?:zajecia\s+praktycz|cwiczen|seminari)/.test(segment) && /\b4\s*osob/.test(segment)) {
        const activity = /cwiczen/.test(segment) ? 'Ćwiczenia' : /seminari/.test(segment) ? 'Seminaria' : 'Zajęcia praktyczne';
        add(activity, 'G4');
      }
    }
  }

  const result = new Map<string, StudyGroupKind>();
  for (const [activityType, kinds] of candidates.entries()) {
    if (kinds.size === 1) result.set(activityType, [...kinds][0]!);
  }
  return result;
}

function buildMatrixCandidates(sheet: SheetSnapshot, signals: MatrixSignals): { candidates: StudyScheduleCandidate[]; sourceBlocks: StudySourceBlock[]; unappliedDateExceptions: UnappliedDateException[] } {
  if (!signals.weekRows.length) return { candidates: [], sourceBlocks: [], unappliedDateExceptions: [] };
  const firstWeekRow = signals.weekRows[0]?.row ?? 1;
  const lastWeekRow = signals.weekRows[signals.weekRows.length - 1]?.row ?? sheet.maxRow;
  const footer = footerHints(sheet, lastWeekRow);
  const groupKindHints = explicitGroupKindHints(sheet);
  const consumedFirstMeetingLocations = new Set<string>();
  const contexts = new Map<number, ColumnContext>();
  for (let col = sheet.minCol + 1; col <= sheet.maxCol; col += 1) {
    contexts.set(col, columnContext(sheet, col, sheet.minRow, Math.max(sheet.minRow, firstWeekRow - 1), footer, signals.academicYear));
  }
  const candidates: StudyScheduleCandidate[] = [];
  const sourceBlocks: StudySourceBlock[] = [];
  const unappliedDateExceptions: UnappliedDateException[] = [];
  for (const range of signals.weekRows) {
    const groupCells = groupCellsForWeekRow(sheet, range, signals.academicYear);
    const exceptions = detectDateExceptions(sheet, range, groupCells, contexts, signals.academicYear);
    const exceptionByGroup = new Map(exceptions.map((entry) => [entry.groupCellAddress, entry]));

    for (const cell of groupCells) {
      const groups = assignmentGroups(cell);
      if (!groups.groups.length) continue;
      const inline = inlineAssignmentDetails(cell, signals.academicYear);
      const context = contexts.get(cell.col);
      if (!context) continue;
      const exception = exceptionByGroup.get(cell.address);
      let dates = inline?.date ? [inline.date] : datesWithinRangeForWeekdays(range, context.weekdays);
      if (!inline?.date && exception && dates.length && !dates.includes(exception.date)) {
        // Jawna data w sąsiedniej kolumnie jest silnym sygnałem wyjątku, ale bez
        // zgodności z bazowym rozkładem nie wiemy, który termin miałaby zastąpić.
        // Nie ignorujemy jej i nie dokładamy samodzielnie kolejnego dnia - rejestr
        // zablokuje taki import do ręcznego sprawdzenia.
        unappliedDateExceptions.push({
          groupCellAddress: cell.address,
          markerCellAddress: exception.markerCell.address,
          date: exception.date,
        });
      }
      if (dates.length && !inline?.date) {
        const excluded = excludedDatesForCell(cell, context, range, groupCells, contexts);
        if (excluded.size) dates = dates.filter((date) => !excluded.has(date));
      }
      if (!dates.length && exception) dates = [exception.date];
      const unresolvedDates = !dates.length;
      const excludedDates = dates.length && !inline?.date ? [...excludedDatesForCell(cell, context, range, groupCells, contexts)] : [];
      if (!dates.length) dates = [''];
      const blockCandidateIds: string[] = [];

      for (const date of dates) {
        const exceptionForDate = exception && exception.date === date ? exception : undefined;
        const resolved = effectiveContext(context, exceptionForDate);
        const groupTags = groups.groups.map((group) => studyGroupKey(inferStudyGroupKind(resolved.headerText, group, resolved.activityType ? groupKindHints.get(resolved.activityType) : undefined), group));
        const firstMeetingKeys = resolved.firstMeetingLocation && resolved.firstMeetingLocationKey
          ? groupTags.map((groupTag) => `${resolved.firstMeetingLocationKey}|${groupTag}`)
          : [];
        const useFirstMeetingLocation = firstMeetingKeys.length > 0
          && firstMeetingKeys.every((key) => !consumedFirstMeetingLocations.has(key));
        const candidateTime = inline?.time ?? resolved.time;
        const datedLocation = locationForDate(resolved.location, resolved.locationRules, date);
        const inlineLocation = inline && hasLocationValue(inline.location)
          ? {
              ...(datedLocation.room ? { room: datedLocation.room } : {}),
              ...(datedLocation.address ? { address: datedLocation.address } : {}),
              ...(datedLocation.label ? { label: datedLocation.label } : {}),
              ...(inline.location.room ? { room: inline.location.room } : {}),
              ...(inline.location.address ? { address: inline.location.address } : {}),
              ...(inline.location.label ? { label: inline.location.label } : {}),
            }
          : datedLocation;
        const candidateLocation = useFirstMeetingLocation && resolved.firstMeetingLocation
          ? mergeLocation(inlineLocation, { key: '', rawText: '', ...resolved.firstMeetingLocation })
          : inlineLocation;
        if (useFirstMeetingLocation) firstMeetingKeys.forEach((key) => consumedFirstMeetingLocations.add(key));
        const warnings: string[] = [];
        if (!resolved.subject) warnings.push('Nie udało się ustalić przedmiotu z nagłówka kolumny.');
        if (unresolvedDates || !date) warnings.push(`Plan przypisuje ten wpis do tygodnia ${range.start} - ${range.end}, ale nie podaje jednoznacznego dnia zajęć.`);
        if (!candidateTime) warnings.push(`Plan nie podaje jednoznacznego pełnego zakresu godzin dla tego wpisu w tygodniu ${range.start} - ${range.end}.`);
        if (!candidateLocation.address && !candidateLocation.label) warnings.push('Nie udało się jednoznacznie ustalić lokalizacji.');

        const sourceRange = exceptionForDate ? `${cell.address},${exceptionForDate.markerCell.address}` : cell.address;
        const sourceKey = [sheet.name, sourceRange, date || range.source, candidateTime?.start ?? 'unknown-start', candidateTime?.end ?? 'unknown-end', resolved.subject || 'unknown-subject', groupTags.join('+')].join('|');
        const candidateId = stableId(sourceKey);
        const essential = Boolean(resolved.subject && date && candidateTime?.start && candidateTime?.end);
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
          ...(candidateTime?.start ? { startTime: candidateTime.start } : {}),
          ...(candidateTime?.end ? { endTime: candidateTime.end } : {}),
          groupScope: 'SPECIFIC',
          groupTags,
          originalGroupText: groups.originalText,
          sourceWeekStart: range.start,
          sourceWeekEnd: range.end,
          sourceSectionKey: resolved.sourceSectionKey,
          ...(resolved.declaredTeachingHours ? { declaredTeachingHours: resolved.declaredTeachingHours } : {}),
          ...(groups.clinic ? { clinic: groups.clinic } : {}),
          ...(candidateLocation.room ? { room: candidateLocation.room } : {}),
          ...(candidateLocation.address ? { address: candidateLocation.address } : {}),
          ...(candidateLocation.label ? { locationLabel: candidateLocation.label } : {}),
          status: essential ? (warnings.length ? 'REVIEW_REQUIRED' : 'READY') : 'REVIEW_REQUIRED',
          warnings: [...new Set(warnings)],
          include: essential,
        });
      }

      const blockContext = effectiveContext(context, exception);
      const blockTime = inline?.time ?? blockContext.time;
      const blockGroupTags = groups.groups.map((group) => studyGroupKey(inferStudyGroupKind(blockContext.headerText, group, blockContext.activityType ? groupKindHints.get(blockContext.activityType) : undefined), group));
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
        // Wpis z datą podaną bezpośrednio w komórce jest dokładnym wyjątkiem źródłowym,
        // nawet jeśli data wypada poza tygodniem wiersza. Nie budujemy dla niego
        // semantyki "dzień tygodnia w tym wierszu", bo completeness gate uznałby
        // wtedy jawny wyjątek (np. 06.11 wpisany w wierszu 05-09.10) za błąd.
        weekdays: inline?.date ? [] : [...context.weekdays],
        excludedDates,
        ...(inline?.date ? { exceptionDate: inline.date } : exception ? { exceptionDate: exception.date } : {}),
        sourceHasFullTimeRange: Boolean(blockTime?.start && blockTime?.end),
        ...(blockContext.timeAdjustedByExplicitHint ? { sourceTimeAdjustedByExplicitHint: true } : {}),
        ...(blockContext.declaredTeachingHours ? { declaredTeachingHours: blockContext.declaredTeachingHours } : {}),
        candidateIds: blockCandidateIds,
      });
    }
  }
  return { candidates, sourceBlocks, unappliedDateExceptions };
}

function unparsedAssignmentCellsForWeekRows(sheet: SheetSnapshot, rows: WeekRangeRow[], academicYear: AcademicYearContext | null): SheetCellSnapshot[] {
  const result: SheetCellSnapshot[] = [];
  for (const row of rows) {
    for (const cell of sheet.cells.filter((entry) => entry.row === row.row && entry.col > row.col)) {
      if (!compact(cell.value)) continue;
      if (assignmentGroups(cell).groups.length) continue;
      if (isDateMarkerCell(cell, academicYear)) continue;
      result.push(cell);
    }
  }
  return result;
}

function hasMalformedExplicitWeekCue(sheet: SheetSnapshot, cells: SheetCellSnapshot[]): boolean {
  const leftCandidates = cells
    .filter((cell) => cell.col <= Math.min(sheet.minCol + 2, sheet.maxCol))
    .sort((a, b) => a.col - b.col);

  return leftCandidates.some((cell) => {
    const value = compact(cell.value);
    if (!value || parseWeekRange(value)) return false;
    const folded = foldPolishText(value);

    // Jawne etykiety tygodnia lub zakresu "od ... do ..." oznaczają wiersz
    // danych nawet wtedy, gdy uczelnia zmieni zapis tak, że nie da się już
    // bezpiecznie wydobyć dwóch dat. To ma zablokować częściowy import zamiast
    // pomijać pierwszy/ostatni uszkodzony tydzień poza pasmem rozpoznanych dat.
    if (/\btydzien\b/.test(folded) || /^od\b.*\bdo\b/.test(folded)) return true;

    // Dla jawnych zakresów z rokiem akceptujemy sygnał "to miała być data",
    // ale nie traktujemy samych godzin (np. 8.00 - 14.00) jak zakresu tygodnia.
    return /20\d{2}/.test(value) && /[-–—]/.test(value) && looksLikeDateExpression(value);
  });
}

function suspiciousUnparsedWeekRows(sheet: SheetSnapshot, parsedRows: WeekRangeRow[]): number[] {
  const parsed = new Set(parsedRows.map((entry) => entry.row));
  const minDataRow = parsedRows[0]?.row;
  const maxDataRow = parsedRows[parsedRows.length - 1]?.row;
  const byRow = new Map<number, SheetCellSnapshot[]>();
  for (const cell of sheet.cells) {
    const list = byRow.get(cell.row) ?? [];
    list.push(cell);
    byRow.set(cell.row, list);
  }
  const suspicious: number[] = [];
  for (const [row, cells] of byRow.entries()) {
    if (parsed.has(row)) continue;
    const groupLike = cells.filter((cell) => cell.col > sheet.minCol && assignmentGroups(cell).groups.length > 0);
    if (groupLike.length < 3) continue;

    const insideParsedBand = minDataRow !== undefined && maxDataRow !== undefined && row >= minDataRow && row <= maxDataRow;
    const explicitMalformedWeek = hasMalformedExplicitWeekCue(sheet, cells);

    // Nagłówki wielowierszowe często zawierają liczby typu 80G/40G i nie są
    // wierszami przypisań. Poza rozpoznanym pasmem blokujemy tylko wiersze z
    // wieloma realnymi grupami i jawnym, ale nierozpoznawalnym sygnałem tygodnia.
    if (insideParsedBand || explicitMalformedWeek) suspicious.push(row);
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

function matrixSignalsHandled(matrix: MatrixSignals | undefined): matrix is MatrixSignals {
  if (!matrix) return false;
  return matrix.weekRows.length >= 1
    && matrix.groupCellCount >= 1
    && matrix.subjectHeaderCount >= 1
    && matrix.headerTimeCount >= 1
    && matrix.headerWeekdayCount >= 1;
}

function lectureSubject(text: string): string {
  const timeMatch = /\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}/.exec(text);
  const beforeTime = timeMatch ? text.slice(0, timeMatch.index) : text;
  // W źródle spotyka się również literówkę "Drhab" bez spacji.
  const beforePerson = beforeTime.split(/\b(?:prof\.?|dr\s*hab\.?|dr\.?|mgr\.?|lek\.?)\b/i)[0] ?? beforeTime;
  return compact(beforePerson.replace(/[,:;\-]+$/g, ''));
}

function lectureRoom(text: string): string | undefined {
  const match = /\b(aula(?:\s+im\.?)?\s+[^),;|]+?)(?=\s*[),;|]|\s+\b(?:ul\.?|al\.?|aleja|plac|pl\.?)\b|\s*$)/iu.exec(text);
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

  const matrixHandled = matrixSignalsHandled(matrix);
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

    const matrixData = matrixSignalsHandled(matrix)
      ? buildMatrixCandidates(matrix.sheet, matrix)
      : { candidates: [] as StudyScheduleCandidate[], sourceBlocks: [] as StudySourceBlock[], unappliedDateExceptions: [] as UnappliedDateException[] };
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
        unappliedDateExceptionCount: matrixData.unappliedDateExceptions.length,
        unappliedDateExceptionSamples: matrixData.unappliedDateExceptions.slice(0, 8).map((entry) => `${entry.groupCellAddress} + ${entry.markerCellAddress}: ${entry.date}`),
      },
    };
  },
};
