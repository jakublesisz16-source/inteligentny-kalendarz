import { describe, expect, it } from 'vitest';
import { analyzeScheduleWorkbook, diagnoseUnrecognizedWorkbook } from '../imports/xlsx/adapter-registry';
import { nursingPlanV1Adapter } from '../imports/xlsx/adapters/nursing-plan-v1.adapter';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../imports/xlsx/xlsx.types';

function colName(col: number): string {
  let value = col;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cell(row: number, col: number, value: string): SheetCellSnapshot {
  return { row, col, address: `${colName(col)}${row}`, value };
}

function merge(startRow: number, startCol: number, endRow: number, endCol: number): SheetMergeSnapshot {
  return { startRow, startCol, endRow, endCol, ref: `${colName(startCol)}${startRow}:${colName(endCol)}${endRow}` };
}

function formatTime(total: number, separator = '.'): string {
  return `${Math.floor(total / 60)}${separator}${String(total % 60).padStart(2, '0')}`;
}

function addDay(
  cells: SheetCellSnapshot[],
  merges: SheetMergeSnapshot[],
  dayCol: number,
  label: string,
  date: string,
  group: string,
  address: string,
  intervalMinutes = 15,
  intervalCount = 12,
) {
  const timeCol = dayCol - 2;
  cells.push(cell(3, dayCol, label));
  cells.push(cell(4, dayCol, 'Badanie fizykalne ćwiczenia NZA 15g'));
  cells.push(cell(5, dayCol, `sala 205, ${address}`));
  cells.push(cell(6, dayCol, date));
  merges.push(merge(4, dayCol, 4, dayCol + 3));
  merges.push(merge(5, dayCol, 5, dayCol + 3));
  merges.push(merge(6, dayCol, 6, dayCol + 3));
  for (let index = 0; index < intervalCount; index += 1) {
    const totalStart = 7 * 60 + index * intervalMinutes;
    const totalEnd = totalStart + intervalMinutes;
    cells.push(cell(7 + index, timeCol, `${formatTime(totalStart)} - ${formatTime(totalEnd)}`));
  }
  cells.push(cell(7, dayCol, group));
  merges.push(merge(7, dayCol, Math.min(10, 6 + intervalCount), dayCol));
}

function fixture(options?: { sheetName?: string; order?: Array<[number, string, string, string]>; intervalMinutes?: number; intervalCount?: number }): WorkbookSnapshot {
  const cells: SheetCellSnapshot[] = [cell(1, 1, 'Plan zajęć, semestr letni 2025/2026')];
  const merges: SheetMergeSnapshot[] = [];
  const order = options?.order ?? [
    [7, 'PONIEDZIAŁEK', '16.02.', 'grupa 13 a b, c'],
    [27, 'WTOREK', '17.02.', 'grupa 10a'],
    [47, 'ŚRODA', '18.02.', 'grupa 1'],
  ];
  for (const [col, label, date, group] of order) {
    addDay(cells, merges, col, label, date, group, 'ul. Testowa 1', options?.intervalMinutes ?? 15, options?.intervalCount ?? 12);
  }
  const practice: SheetSnapshot = { name: options?.sheetName ?? 'PRAKTYKI', usedRange: 'A1:CR40', minRow: 1, minCol: 1, maxRow: 40, maxCol: 96, cells, merges };
  const lectures: SheetSnapshot = {
    name: 'WYKŁADY', usedRange: 'A1:A1', minRow: 1, minCol: 1, maxRow: 1, maxCol: 1,
    cells: [cell(1, 1, 'wszystkie wykłady w semestrze letnim 2025/2026 są zamieszczone na platformie e-learningowej')], merges: [],
  };
  return { sheetNames: [practice.name, 'WYKŁADY'], sheets: [practice, lectures] };
}

describe('nursing-plan-v1 adapter hardening', () => {
  it('rozpoznaje strukturę bez zależności od historycznych kolumn i nazwy PRAKTYKI', () => {
    const workbook = fixture({ sheetName: 'Harmonogram' });
    expect(nursingPlanV1Adapter.canHandle(workbook)).toBe(true);
    const result = nursingPlanV1Adapter.analyze(workbook);
    expect(result.detectedAcademicYear).toBe('2025/2026');
    expect(result.groups).toEqual(expect.arrayContaining(['1', '10A', '13A', '13B', '13C']));
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.every((candidate) => candidate.status === 'READY')).toBe(true);
    expect(result.information).toHaveLength(1);
  });

  it('wylicza czas na podstawie pionowego scalenia', () => {
    const result = nursingPlanV1Adapter.analyze(fixture());
    expect(result.candidates[0]).toMatchObject({ startTime: '07:00', endTime: '08:00' });
  });

  it('toleruje mocno przesunięte bloki i puste przestrzenie między nimi', () => {
    const shifted = fixture({ order: [
      [12, 'PONIEDZIAŁEK', '16.02.', 'grupa 13A'],
      [41, 'WTOREK', '17.02.', 'grupa 13B'],
      [76, 'ŚRODA', '18.02.', 'grupa 13C'],
    ] });
    const result = nursingPlanV1Adapter.analyze(shifted);
    expect(result.candidates).toHaveLength(3);
    expect(result.diagnostics?.detectedDays).toEqual(['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA']);
  });

  it('nie zakłada kolejności dni w poziomie', () => {
    const changedOrder = fixture({ order: [
      [7, 'ŚRODA', '18.02.', 'grupa 13A'],
      [27, 'PONIEDZIAŁEK', '16.02.', 'grupa 13B'],
      [47, 'WTOREK', '17.02.', 'grupa 13C'],
    ] });
    const result = nursingPlanV1Adapter.analyze(changedOrder);
    expect(result.candidates.map((candidate) => candidate.date)).toEqual(['2026-02-18', '2026-02-16', '2026-02-17']);
  });

  it('rozpoznaje sobotę jako normalny blok planu', () => {
    const saturday = fixture({ order: [
      [7, 'czwartek', '19.02.', 'grupa 13A'],
      [27, 'PIĄTEK', '20.02.', 'grupa 13B'],
      [47, 'sobota', '21.02.', 'grupa 13C'],
    ] });
    const result = nursingPlanV1Adapter.analyze(saturday);
    expect(result.diagnostics?.detectedDays).toContain('SOBOTA');
    expect(result.candidates.some((candidate) => candidate.date === '2026-02-21')).toBe(true);
  });

  it('wykrywa 30-minutową siatkę bez hardkodowania 15 minut', () => {
    const workbook = fixture({ intervalMinutes: 30, intervalCount: 4 });
    const result = nursingPlanV1Adapter.analyze(workbook);
    expect(result.candidates[0]).toMatchObject({ startTime: '07:00', endTime: '09:00' });
    expect(result.diagnostics?.timeGridIntervals).toContain(30);
  });

  it('obsługuje scalenia przedmiotu, daty i pionowego bloku grupy', () => {
    const result = nursingPlanV1Adapter.analyze(fixture());
    const first = result.candidates[0];
    expect(first).toMatchObject({ subject: expect.stringContaining('Badanie fizykalne'), groupTags: ['13A', '13B', '13C'] });
    expect(first?.sourceRange).toContain(':');
  });

  it('odrzuca nieznany plik i zwraca diagnostykę zamiast crashu', () => {
    const unknown: WorkbookSnapshot = {
      sheetNames: ['Dane', 'Inne'],
      sheets: [
        { name: 'Dane', minRow: 1, minCol: 1, maxRow: 3, maxCol: 3, usedRange: 'A1:C3', cells: [cell(1, 1, 'Raport'), cell(2, 1, '204'), cell(3, 2, 'Tekst')], merges: [] },
        { name: 'Inne', minRow: 1, minCol: 1, maxRow: 1, maxCol: 1, usedRange: 'A1:A1', cells: [cell(1, 1, 'Brak planu')], merges: [] },
      ],
    };
    expect(analyzeScheduleWorkbook(unknown)).toBeNull();
    expect(diagnoseUnrecognizedWorkbook(unknown).join(' ')).toContain('Siatki czasu: 0');
  });

  it('częściowo zgodny plik bez siatki czasu nie tworzy fikcyjnych zajęć', () => {
    const partial: WorkbookSnapshot = {
      sheetNames: ['Plan'],
      sheets: [{
        name: 'Plan', minRow: 1, minCol: 1, maxRow: 10, maxCol: 30, usedRange: 'A1:AD10', merges: [],
        cells: [
          cell(1, 1, '2025/2026 semestr letni'),
          cell(3, 5, 'PONIEDZIAŁEK'), cell(3, 15, 'WTOREK'), cell(3, 25, 'ŚRODA'),
          cell(6, 5, 'grupa 13A'), cell(6, 15, 'grupa 13B'), cell(6, 25, 'grupa 13C'),
        ],
      }],
    };
    expect(analyzeScheduleWorkbook(partial)).toBeNull();
    expect(diagnoseUnrecognizedWorkbook(partial).join(' ')).toContain('Siatki czasu: 0');
  });
});
