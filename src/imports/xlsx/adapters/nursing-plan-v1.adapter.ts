import type { ScheduleAnalysis, ScheduleInformation, StudyScheduleCandidate } from '../../../study/study.types';
import type { ScheduleAdapter, ScheduleAdapterMatch } from '../adapter.types';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../xlsx.types';
import { academicYearLabel, detectAcademicYear, detectTerm, looksLikeDateExpression, parseDateExpression } from '../date-parser';
import { normalizeGroupText, sortStudyGroups } from '../group-normalizer';
import { findBestFooterHint, parseLocationText, type FooterLocationHint } from '../location-parser';
import { compactWhitespace, foldPolishText, normalizeClinicLabel, normalizeWeekdayLabel } from '../parser-normalization';
import { inferGridIntervalMinutes, isTimeRange, parseTimeRange, timeToMinutes, type ParsedTimeRange } from '../time-parser';

const WEEKDAYS = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA', 'NIEDZIELA'] as const;
type WeekdayLabel = (typeof WEEKDAYS)[number];

interface TimeGridInterval {
  row: number;
  range: ParsedTimeRange;
}

interface TimeGrid {
  col: number;
  intervals: TimeGridInterval[];
  intervalMinutes?: number;
}

interface DayBlock {
  label: WeekdayLabel;
  labelRow: number;
  labelCol: number;
  timeCol: number;
  startCol: number;
  endCol: number;
  timeStartRow: number;
  timeEndRow: number;
  subjectRow: number;
  dateRow: number;
  timeByRow: Map<number, ParsedTimeRange>;
  intervalMinutes?: number;
}

interface HorizontalSegment {
  startCol: number;
  endCol: number;
  value: string;
  cell: SheetCellSnapshot;
}

interface FooterHints {
  subjects: FooterLocationHint[];
  clinics: Map<string, FooterLocationHint>;
}

interface SheetSignals {
  sheet: SheetSnapshot;
  days: Array<{ cell: SheetCellSnapshot; label: WeekdayLabel }>;
  timeGrids: TimeGrid[];
  academicYear: ReturnType<typeof detectAcademicYear>;
  explicitGroupCount: number;
  score: number;
  reasons: string[];
}

function compact(text: string): string {
  return compactWhitespace(text);
}

function stableId(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `candidate-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function mergeContaining(sheet: SheetSnapshot, row: number, col: number): SheetMergeSnapshot | undefined {
  return sheet.merges.find((merge) => row >= merge.startRow && row <= merge.endRow && col >= merge.startCol && col <= merge.endCol);
}

function isMergeTopLeft(merge: SheetMergeSnapshot | undefined, cell: SheetCellSnapshot): boolean {
  return !merge || (merge.startRow === cell.row && merge.startCol === cell.col);
}

function valuesNearTop(sheet: SheetSnapshot): string[] {
  return sheet.cells.filter((cell) => cell.row <= Math.min(20, sheet.maxRow)).map((cell) => cell.value);
}

function isContinuousGrid(intervals: TimeGridInterval[]): boolean {
  if (intervals.length < 3) return false;
  let linked = 0;
  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1];
    const current = intervals[index];
    if (!previous || !current) continue;
    const previousEnd = timeToMinutes(previous.range.end);
    const currentStart = timeToMinutes(current.range.start);
    if (previousEnd !== null && currentStart !== null && previousEnd === currentStart) linked += 1;
  }
  return linked >= Math.max(2, Math.floor((intervals.length - 1) * 0.55));
}

function detectTimeGrids(sheet: SheetSnapshot): TimeGrid[] {
  const byColumn = new Map<number, TimeGridInterval[]>();
  for (const cell of sheet.cells) {
    if (!isTimeRange(cell.value)) continue;
    const range = parseTimeRange(cell.value);
    if (!range) continue;
    const list = byColumn.get(cell.col) ?? [];
    list.push({ row: cell.row, range });
    byColumn.set(cell.col, list);
  }

  return [...byColumn.entries()]
    .map(([col, intervals]) => {
      const sorted = intervals.sort((a, b) => a.row - b.row);
      const intervalMinutes = inferGridIntervalMinutes(sorted.map((item) => item.range));
      return {
        col,
        intervals: sorted,
        ...(intervalMinutes !== undefined ? { intervalMinutes } : {}),
      };
    })
    .filter((grid) => grid.intervals.length >= 3 && isContinuousGrid(grid.intervals))
    .sort((a, b) => a.col - b.col);
}

function weekdayCells(sheet: SheetSnapshot): Array<{ cell: SheetCellSnapshot; label: WeekdayLabel }> {
  return sheet.cells.flatMap((cell) => {
    const normalized = normalizeWeekdayLabel(cell.value) as WeekdayLabel | undefined;
    return normalized && WEEKDAYS.includes(normalized) ? [{ cell, label: normalized }] : [];
  });
}

function explicitGroupSignalCount(sheet: SheetSnapshot): number {
  return sheet.cells.filter((cell) => /\bgrupa\b|\bgr\.?\s*(?:nr\b)?/i.test(cell.value) && normalizeGroupText(cell.value).groups.length > 0).length;
}

function evaluateSheet(sheet: SheetSnapshot): SheetSignals {
  const days = weekdayCells(sheet);
  const timeGrids = detectTimeGrids(sheet);
  const academicYear = detectAcademicYear(valuesNearTop(sheet));
  const explicitGroupCount = explicitGroupSignalCount(sheet);
  const reasons: string[] = [];
  let score = 0;

  score += Math.min(days.length, 7) * 3;
  score += Math.min(timeGrids.length, 7) * 3;
  if (academicYear) score += 3;
  if (explicitGroupCount >= 2) score += 2;
  if (/prakty|zaj[eę]cia|plan|harmonogram|semestr/i.test(sheet.name)) score += 1;

  reasons.push(days.length ? `Wykryto ${days.length} nagłówków dni tygodnia.` : 'Nie wykryto nagłówków dni tygodnia.');
  reasons.push(timeGrids.length ? `Wykryto ${timeGrids.length} spójnych siatek czasu.` : 'Nie wykryto spójnej siatki czasu.');
  reasons.push(academicYear ? `Wykryto rok akademicki ${academicYearLabel(academicYear)}.` : 'Nie wykryto roku akademickiego w nagłówku.');
  reasons.push(explicitGroupCount ? `Wykryto ${explicitGroupCount} wpisów z jawnym kontekstem grupy.` : 'Nie wykryto jawnych wpisów grupowych.');

  return { sheet, days, timeGrids, academicYear, explicitGroupCount, score, reasons };
}

function bestSheetSignals(workbook: WorkbookSnapshot): SheetSignals | undefined {
  return workbook.sheets.map(evaluateSheet).sort((a, b) => b.score - a.score)[0];
}

function adapterMatch(workbook: WorkbookSnapshot): ScheduleAdapterMatch {
  const best = bestSheetSignals(workbook);
  if (!best) {
    return { adapterId: 'nursing-plan-v1', score: 0, handled: false, reasons: ['Skoroszyt nie zawiera arkuszy.'], detectedDays: [], timeGridCount: 0, detectedGroupCount: 0 };
  }
  const detectedAcademicYear = academicYearLabel(best.academicYear);
  return {
    adapterId: 'nursing-plan-v1',
    score: best.score,
    handled: best.days.length >= 3 && best.timeGrids.length >= 3,
    sheetName: best.sheet.name,
    reasons: best.reasons,
    detectedDays: [...new Set(best.days.map((item) => item.label))],
    timeGridCount: best.timeGrids.length,
    ...(detectedAcademicYear ? { detectedAcademicYear } : {}),
    detectedGroupCount: best.explicitGroupCount,
  };
}

function chooseNearbyTimeGrid(dayCell: SheetCellSnapshot, timeGrids: TimeGrid[]): TimeGrid | undefined {
  return timeGrids
    .filter((grid) => grid.intervals[0] && grid.intervals[0].row > dayCell.row)
    .map((grid) => ({ grid, distance: Math.abs(grid.col - dayCell.col) }))
    .filter(({ distance }) => distance <= 12)
    .sort((a, b) => a.distance - b.distance || a.grid.col - b.grid.col)[0]?.grid;
}

function detectDayBlocks(sheet: SheetSnapshot): DayBlock[] {
  const timeGrids = detectTimeGrids(sheet);
  const dayCells = weekdayCells(sheet);
  const provisional: DayBlock[] = [];
  const usedTimeColumns = new Set<number>();

  for (const { cell: dayCell, label } of dayCells.sort((a, b) => a.cell.col - b.cell.col || a.cell.row - b.cell.row)) {
    const grid = chooseNearbyTimeGrid(dayCell, timeGrids.filter((candidate) => !usedTimeColumns.has(candidate.col)));
    if (!grid) continue;
    const firstInterval = grid.intervals[0];
    const lastInterval = grid.intervals[grid.intervals.length - 1];
    if (!firstInterval || !lastInterval) continue;
    usedTimeColumns.add(grid.col);
    provisional.push({
      label,
      labelRow: dayCell.row,
      labelCol: dayCell.col,
      timeCol: grid.col,
      startCol: grid.col + 1,
      endCol: sheet.maxCol,
      timeStartRow: firstInterval.row,
      timeEndRow: lastInterval.row,
      subjectRow: dayCell.row + 1,
      dateRow: dayCell.row + 3,
      timeByRow: new Map(grid.intervals.map((item) => [item.row, item.range])),
      ...(grid.intervalMinutes ? { intervalMinutes: grid.intervalMinutes } : {}),
    });
  }

  provisional.sort((a, b) => a.timeCol - b.timeCol);
  for (let index = 0; index < provisional.length; index += 1) {
    const block = provisional[index];
    if (!block) continue;
    const next = provisional[index + 1];
    block.endCol = next ? next.timeCol - 1 : sheet.maxCol;

    const candidateRows = Array.from({ length: Math.max(0, block.timeStartRow - block.labelRow - 1) }, (_, rowIndex) => block.labelRow + 1 + rowIndex);
    let dateRow = block.labelRow + 3;
    let dateScore = -1;
    for (const row of candidateRows) {
      const count = sheet.cells.filter((candidate) => candidate.row === row && candidate.col >= block.startCol && candidate.col <= block.endCol && (Boolean(candidate.dateValue) || looksLikeDateExpression(candidate.value))).length;
      if (count > dateScore) {
        dateScore = count;
        dateRow = row;
      }
    }
    block.dateRow = dateRow;

    block.subjectRow = candidateRows.find((row) => {
      if (row >= block.dateRow) return false;
      return sheet.cells.some((candidate) => {
        if (candidate.row !== row || candidate.col < block.startCol || candidate.col > block.endCol) return false;
        if (candidate.dateValue || looksLikeDateExpression(candidate.value) || isTimeRange(candidate.value)) return false;
        return compact(candidate.value).length >= 4;
      });
    }) ?? block.labelRow + 1;
  }
  return provisional;
}

function segmentsForRow(sheet: SheetSnapshot, row: number, startCol: number, endCol: number): HorizontalSegment[] {
  const rowCells = sheet.cells
    .filter((cell) => cell.row === row && cell.col >= startCol && cell.col <= endCol)
    .filter((cell) => isMergeTopLeft(mergeContaining(sheet, cell.row, cell.col), cell))
    .sort((a, b) => a.col - b.col);

  return rowCells.map((cell, index) => {
    const merge = mergeContaining(sheet, cell.row, cell.col);
    const nextStart = rowCells[index + 1]?.col ?? endCol + 1;
    const mergedEnd = merge && merge.endRow === row ? merge.endCol : cell.col;
    return {
      startCol: cell.col,
      endCol: Math.min(endCol, Math.max(mergedEnd, nextStart - 1)),
      value: cell.value,
      cell,
    };
  });
}

function segmentAt(segments: HorizontalSegment[], col: number): HorizontalSegment | undefined {
  return segments.find((segment) => col >= segment.startCol && col <= segment.endCol);
}

function firstDetailText(sheet: SheetSnapshot, block: DayBlock, subject: HorizontalSegment): string {
  const texts = sheet.cells
    .filter((cell) => cell.row > block.subjectRow && cell.row < block.dateRow && cell.col >= subject.startCol && cell.col <= subject.endCol)
    .filter((cell) => isMergeTopLeft(mergeContaining(sheet, cell.row, cell.col), cell))
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((cell) => compact(cell.value));
  return texts.join(' | ');
}

function parseActivityType(subject: string): string | undefined {
  const lower = foldPolishText(subject);
  if (/zajecia\s+prakt|\bpraktyki\b/.test(lower)) return 'Zajęcia praktyczne';
  if (/\bcwiczenia\b/.test(lower)) return 'Ćwiczenia';
  if (/\bseminari(?:um|a)\b/.test(lower)) return 'Seminaria';
  if (/\bwyklady?\b/.test(lower)) return 'Wykład';
  if (/\blaboratorium\b|\blab\.?\b/.test(lower)) return 'Laboratorium';
  return undefined;
}

function footerKey(text: string): string {
  const beforeSeparator = text.split(/\s+-\s+|:\s+/)[0] ?? text;
  return compact(beforeSeparator);
}

function buildFooterHints(sheet: SheetSnapshot, afterRow: number): FooterHints {
  const subjects: FooterLocationHint[] = [];
  const clinics = new Map<string, FooterLocationHint>();
  for (const cell of sheet.cells.filter((candidate) => candidate.row > afterRow).sort((a, b) => a.row - b.row || a.col - b.col)) {
    const text = compact(cell.value);
    if (!text || /^ADRESY JEDNOSTEK/i.test(text)) continue;
    const parsed = parseLocationText(text);
    const clinic = normalizeClinicLabel(text);
    const hint: FooterLocationHint = { key: footerKey(text), rawText: text, ...parsed };
    if (clinic) {
      clinics.set(clinic, hint);
      continue;
    }
    if (parsed.address || parsed.label || parsed.room) subjects.push(hint);
  }
  return { subjects, clinics };
}

function mergeLocation(primary: ReturnType<typeof parseLocationText>, secondary?: FooterLocationHint): ReturnType<typeof parseLocationText> {
  // Bezpośrednia wartość z bloku zajęć ma zawsze wyższy priorytet niż ogólny opis z sekcji pod planem.
  return {
    ...(secondary?.room ? { room: secondary.room } : {}),
    ...(secondary?.address ? { address: secondary.address } : {}),
    ...(secondary?.label ? { label: secondary.label } : {}),
    ...(primary.room ? { room: primary.room } : {}),
    ...(primary.address ? { address: primary.address } : {}),
    ...(primary.label ? { label: primary.label } : {}),
  };
}

function makeInformationalEntries(workbook: WorkbookSnapshot): ScheduleInformation[] {
  const information: ScheduleInformation[] = [];
  for (const sheet of workbook.sheets) {
    const text = compact(sheet.cells.map((cell) => cell.value).join(' '));
    if (!text) continue;
    if (/wykład|wyklad/i.test(text) && /e-learning/i.test(text) && !looksLikeDateExpression(text)) {
      information.push({
        id: `info-${sheet.name.toLowerCase()}`,
        sheet: sheet.name,
        title: 'Wykłady e-learningowe',
        message: `Arkusz ${sheet.name} nie zawiera konkretnych terminów wykładów. Plan informuje, że są dostępne na platformie e-learningowej.`,
      });
    }
  }
  return information;
}

function buildCandidates(sheet: SheetSnapshot, blocks: DayBlock[], academicYear: ReturnType<typeof detectAcademicYear>): StudyScheduleCandidate[] {
  const footerHints = buildFooterHints(sheet, Math.max(...blocks.map((block) => block.timeEndRow)));
  const candidates: StudyScheduleCandidate[] = [];

  for (const block of blocks) {
    const subjects = segmentsForRow(sheet, block.subjectRow, block.startCol, block.endCol);
    const dateSegments = segmentsForRow(sheet, block.dateRow, block.startCol, block.endCol).filter((segment) => Boolean(segment.cell.dateValue) || looksLikeDateExpression(segment.value));

    const groupCells = sheet.cells
      .filter((cell) => cell.row >= block.timeStartRow && cell.row <= block.timeEndRow && cell.col >= block.startCol && cell.col <= block.endCol)
      .filter((cell) => !isTimeRange(cell.value))
      .sort((a, b) => a.col - b.col || a.row - b.row);

    for (const cell of groupCells) {
      const groupResult = normalizeGroupText(cell.value, true);
      if (!groupResult.groups.length) continue;
      const cellMerge = mergeContaining(sheet, cell.row, cell.col);
      if (!isMergeTopLeft(cellMerge, cell)) continue;

      const subject = segmentAt(subjects, cell.col);
      const dateSegment = segmentAt(dateSegments, cell.col);
      const detailText = subject ? firstDetailText(sheet, block, subject) : '';
      const directLocation = parseLocationText(detailText);
      const footerLocation = groupResult.clinic
        ? footerHints.clinics.get(groupResult.clinic)
        : subject ? findBestFooterHint(subject.value, footerHints.subjects) : undefined;
      const location = mergeLocation(directLocation, footerLocation);

      const dateResult = dateSegment
        ? parseDateExpression(dateSegment.value, academicYear, block.label, dateSegment.cell.dateValue)
        : { dates: [] as string[], warnings: ['Nie znaleziono daty dla bloku zajęć.'] };

      const explicitTime = parseTimeRange(cell.value);
      const mergeEndRow = cellMerge?.endRow ?? cell.row;
      const gridStart = block.timeByRow.get(cell.row)?.start;
      const gridEnd = block.timeByRow.get(mergeEndRow)?.end;
      const startTime = explicitTime?.start ?? gridStart;
      const endTime = explicitTime?.end ?? gridEnd;
      const subjectText = subject ? compact(subject.value) : '';
      const activityType = subjectText ? parseActivityType(subjectText) : undefined;
      const baseWarnings = [...dateResult.warnings];
      if (!subjectText) baseWarnings.push('Nie udało się ustalić przedmiotu.');
      if (!startTime || !endTime) baseWarnings.push('Nie udało się jednoznacznie ustalić czasu zajęć.');
      if (!location.address && !location.label) baseWarnings.push('Nie udało się jednoznacznie ustalić lokalizacji.');

      const dates = dateResult.dates.length ? dateResult.dates : [undefined];
      for (const date of dates) {
        const sourceRange = cellMerge?.ref ?? cell.address;
        const sourceKey = [sheet.name, sourceRange, date ?? 'unknown-date', startTime ?? 'unknown-start', endTime ?? 'unknown-end', subjectText || 'unknown-subject'].join('|');
        const warnings = [...new Set(baseWarnings)];
        const ready = Boolean(subjectText && date && startTime && endTime && (location.address || location.label) && warnings.length === 0);
        candidates.push({
          id: stableId(sourceKey),
          adapterId: 'nursing-plan-v1',
          sourceSheet: sheet.name,
          sourceRange,
          sourceKey,
          originalText: [subjectText, dateSegment?.value, cell.value, detailText].filter(Boolean).join(' | '),
          subject: subjectText,
          ...(activityType ? { activityType } : {}),
          ...(date ? { date } : {}),
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
          groupScope: 'SPECIFIC',
          groupTags: groupResult.groups,
          originalGroupText: groupResult.originalText,
          ...(groupResult.clinic ? { clinic: groupResult.clinic } : {}),
          ...(location.room ? { room: location.room } : {}),
          ...(location.address ? { address: location.address } : {}),
          ...(location.label ? { locationLabel: location.label } : {}),
          status: ready ? 'READY' : 'REVIEW_REQUIRED',
          warnings,
          include: ready,
        });
      }
    }
  }

  return candidates;
}

export const nursingPlanV1Adapter: ScheduleAdapter = {
  id: 'nursing-plan-v1',

  match(workbook: WorkbookSnapshot): ScheduleAdapterMatch {
    return adapterMatch(workbook);
  },

  canHandle(workbook: WorkbookSnapshot): boolean {
    return adapterMatch(workbook).handled;
  },

  analyze(workbook: WorkbookSnapshot): ScheduleAnalysis {
    const match = adapterMatch(workbook);
    const signals = bestSheetSignals(workbook);
    const practiceSheet = signals?.sheet;
    if (!practiceSheet || !match.handled) {
      return {
        adapterId: this.id,
        sheetNames: workbook.sheetNames,
        groups: [],
        candidates: [],
        information: [],
        warnings: ['Skoroszyt nie zawiera wystarczająco zgodnego arkusza do analizy.'],
        diagnostics: {
          ...(match.sheetName ? { matchedSheet: match.sheetName } : {}),
          adapterReasons: match.reasons,
          detectedDays: match.detectedDays,
          timeGridCount: match.timeGridCount,
          usedRanges: workbook.sheets.map((sheet) => `${sheet.name}: ${sheet.usedRange ?? 'brak'}`),
        },
      };
    }

    const topTexts = valuesNearTop(practiceSheet);
    const academicYear = detectAcademicYear(topTexts);
    const blocks = detectDayBlocks(practiceSheet);
    const candidates = blocks.length ? buildCandidates(practiceSheet, blocks, academicYear) : [];
    const groups = sortStudyGroups([...new Set(candidates.flatMap((candidate) => candidate.groupTags))]);
    const warnings: string[] = [];
    if (!academicYear) warnings.push('Nie udało się wykryć roku akademickiego.');
    if (blocks.length < 3) warnings.push('Wykryto zbyt mało bloków dni tygodnia.');
    if (!candidates.length) warnings.push(`Nie wykryto kandydatów zajęć w arkuszu ${practiceSheet.name}.`);

    const detectedAcademicYear = academicYearLabel(academicYear);
    const detectedTerm = detectTerm(topTexts);
    const unresolvedPatterns = [...new Set(candidates.flatMap((candidate) => candidate.warnings))].slice(0, 8);
    return {
      adapterId: this.id,
      sheetNames: workbook.sheetNames,
      ...(detectedAcademicYear ? { detectedAcademicYear } : {}),
      ...(detectedTerm ? { detectedTerm } : {}),
      groups,
      candidates,
      information: makeInformationalEntries(workbook),
      warnings,
      diagnostics: {
        matchedSheet: practiceSheet.name,
        adapterReasons: match.reasons,
        detectedDays: blocks.map((block) => block.label),
        timeGridCount: signals.timeGrids.length,
        timeGridIntervals: [...new Set(signals.timeGrids.flatMap((grid) => grid.intervalMinutes ? [grid.intervalMinutes] : []))],
        usedRanges: workbook.sheets.map((sheet) => `${sheet.name}: ${sheet.usedRange ?? 'brak'}`),
        hiddenRowCount: practiceSheet.hiddenRows?.length ?? 0,
        hiddenColumnCount: practiceSheet.hiddenColumns?.length ?? 0,
        unresolvedPatterns,
      },
    };
  },
};
