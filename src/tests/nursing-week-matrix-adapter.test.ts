import { describe, expect, it } from 'vitest';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import { nursingWeekMatrixV2Adapter } from '../imports/xlsx/adapters/nursing-week-matrix-v2.adapter';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import { candidatesForSelectedGroups } from '../study/study.service';

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

function cell(row: number, col: number, value: string, dateValue?: string): SheetCellSnapshot {
  return { row, col, address: `${colName(col)}${row}`, value, ...(dateValue ? { valueType: 'date' as const, dateValue } : {}) };
}

function merge(startRow: number, startCol: number, endRow: number, endCol: number): SheetMergeSnapshot {
  return { startRow, startCol, endRow, endCol, ref: `${colName(startCol)}${startRow}:${colName(endCol)}${endRow}` };
}

function wideWorkbook(): WorkbookSnapshot {
  const cells: SheetCellSnapshot[] = [
    cell(1, 1, 'ZAJĘCIA PRAKTYCZNE II ROK PIELĘGNIARSTWO SEMESTR ZIMOWY 2025/2026'),
    cell(2, 2, 'CHIRURGIA'),
    cell(3, 2, 'pon. - pt. 8.00 - 14.00'),
    cell(4, 2, 'Prof. Testowa, ul. Testowa 1'),
    cell(3, 4, 'wtorek zajęcia w Centrum Symulacji, ul. Testowa 2, 8.00 - 14.00'),
    cell(2, 5, 'INTERNA (seminaria)'),
    cell(3, 5, 'wtorek 15.15 - 19.00, sala 104, ul. Testowa 3'),
    cell(3, 6, 'piątek 15.15 - 19.00, sala 118 CBI'),
    cell(2, 7, 'PROMOCJA ZDROWIA'),
    cell(3, 7, 'środa 12.00 - 15.45, ul. Testowa 3'),
    cell(3, 8, 'piątek 12.00 - 15.45, ul. Testowa 3'),
  ];
  const merges: SheetMergeSnapshot[] = [
    merge(1, 1, 1, 10),
    merge(2, 2, 2, 4),
    merge(3, 2, 3, 3),
    merge(3, 4, 6, 4),
    merge(2, 5, 2, 6),
    merge(2, 7, 2, 8),
  ];

  const weeks = [
    ['06.10. - 10.10.2025', '1a', '1b', '2025-10-07', 'grupa 2', 'grupa 3', '4a', '4b'],
    ['13.10. - 17.10.2025', '1a', '1b', '2025-10-14', 'grupa 2', 'grupa 3', '4a', '4b'],
    ['20.10. - 24.10.2025', '1a', '1b', '2025-10-21', 'grupa 2', 'grupa 3', '4a', '4b'],
  ];
  weeks.forEach((values, index) => {
    const row = 8 + index;
    cells.push(cell(row, 1, values[0]!));
    cells.push(cell(row, 2, values[1]!));
    cells.push(cell(row, 3, values[2]!));
    cells.push(cell(row, 4, '07.10.', values[3]));
    cells.push(cell(row, 5, values[4]!));
    cells.push(cell(row, 6, values[5]!));
    cells.push(cell(row, 7, values[6]!));
    cells.push(cell(row, 8, values[7]!));
  });
  cells.push(cell(20, 1, 'CHIRURGIA zajęcia praktyczne'));
  cells.push(cell(21, 1, 'Prof. Testowa, ul. Testowa 1'));

  const plan: SheetSnapshot = { name: 'PLAN ZAJĘĆ', usedRange: 'A1:J25', minRow: 1, minCol: 1, maxRow: 25, maxCol: 10, cells, merges };
  const lectures: SheetSnapshot = {
    name: 'WYKŁADY', usedRange: 'A1:D8', minRow: 1, minCol: 1, maxRow: 8, maxCol: 4, merges: [],
    cells: [
      cell(1, 1, 'WYKŁADY II ROK PIELĘGNIARSTWO (SEMESTR ZIMOWY 2025/2026) WTORKI (AULA B) Centrum Dydaktyczne, ul. Akademicka 2'),
      cell(2, 1, 'Podstawy rehabilitacji będą realizowane na platformie e-learningowej'),
      cell(4, 1, '07.10.'), cell(4, 2, 'FARMAKOLOGIA prof. D. Test 15.00 - 16.30 (2)'), cell(4, 3, 'PEDIATRIA prof. B. Test 16.30 - 18.45 (3)'),
      cell(5, 1, '14.10.'), cell(5, 2, 'FARMAKOLOGIA prof. D. Test 15.00 - 16.30 (2)'),
      cell(6, 1, '21.10.'), cell(6, 2, 'INTERNA prof. O. Test 16.30 - 19.00 (3)'),
    ],
  };
  return { sheetNames: [plan.name, lectures.name], sheets: [plan, lectures] };
}

function lectureOnlyWorkbook(): WorkbookSnapshot {
  const lectures: SheetSnapshot = {
    name: 'WYKŁADY', usedRange: 'A1:D8', minRow: 1, minCol: 1, maxRow: 8, maxCol: 4, merges: [],
    cells: [
      cell(1, 1, 'WYKŁADY II ROK PIELĘGNIARSTWO (SEMESTR ZIMOWY 2025/2026) WTORKI (AULA B) Centrum Dydaktyczne, ul. Akademicka 2'),
      cell(3, 1, '07.10.'), cell(3, 2, 'FARMAKOLOGIA prof. D. Test 15.00 - 16.30 (2)'), cell(3, 3, 'PEDIATRIA prof. B. Test 16.30 - 18.45 (3)'),
      cell(4, 1, '14.10.'), cell(4, 2, 'FARMAKOLOGIA prof. D. Test 15.00 - 16.30 (2)'),
      cell(5, 1, '21.10.'), cell(5, 2, 'INTERNA prof. O. Test 16.30 - 19.00 (3)'),
    ],
  };
  return { sheetNames: [lectures.name], sheets: [lectures] };
}

describe('nursing-week-matrix-v2 adapter', () => {
  it('rozpoznaje szeroką macierz tygodniową bez pionowej siatki czasu', () => {
    const workbook = wideWorkbook();
    expect(nursingWeekMatrixV2Adapter.canHandle(workbook)).toBe(true);
    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    expect(result.detectedAcademicYear).toBe('2025/2026');
    expect(result.groups).toEqual(expect.arrayContaining(['1A', '1B', '2', '3', '4A', '4B']));
    expect(result.candidates.length).toBeGreaterThan(30);
  });

  it('rozwija poniedziałek-piątek na konkretne daty i stosuje wyjątek daty/lokalizacji z kolumny obok', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(wideWorkbook());
    const firstWeek1a = result.candidates.filter((candidate) => candidate.groupTags.includes('1A') && candidate.date ? candidate.date >= '2025-10-06' && candidate.date <= '2025-10-10' : false);
    expect(firstWeek1a.map((candidate) => candidate.date)).toEqual(expect.arrayContaining(['2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-10-10']));

    const group1bTuesday = result.candidates.find((candidate) => candidate.groupTags.includes('1B') && candidate.date === '2025-10-07');
    expect(group1bTuesday).toMatchObject({ startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 2' });
    expect(result.candidates.filter((candidate) => candidate.groupTags.includes('1B') && candidate.date === '2025-10-07')).toHaveLength(1);
  });

  it('czyta sekcje WYKŁADY jako wpisy dla wszystkich grup', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(wideWorkbook());
    const lecture = result.candidates.find((candidate) => candidate.subject === 'FARMAKOLOGIA' && candidate.date === '2025-10-07');
    expect(lecture).toMatchObject({ groupScope: 'ALL', startTime: '15:00', endTime: '16:30', activityType: 'Wykład', address: 'ul. Akademicka 2' });
    expect(result.information.some((entry) => entry.message.includes('e-learningowej'))).toBe(true);
  });

  it('rejestr wybiera nowy adapter dla macierzy i nie zmienia kontraktu starego adaptera', () => {
    const result = analyzeScheduleWorkbook(wideWorkbook());
    expect(result?.adapterId).toBe('nursing-week-matrix-v2');
  });

  it('obsługuje plan zawierający tylko wykłady, bez wymuszania wyboru grupy', () => {
    const result = analyzeScheduleWorkbook(lectureOnlyWorkbook());
    expect(result?.adapterId).toBe('nursing-week-matrix-v2');
    expect(result?.groups).toEqual([]);
    expect(result?.candidates.length).toBeGreaterThanOrEqual(4);
    expect(candidatesForSelectedGroups(result!, [])).toHaveLength(result!.candidates.length);
    expect(result?.candidates.every((candidate) => candidate.groupScope === 'ALL')).toBe(true);
  });

  it('nie uznaje przypadkowego arkusza z pojedynczą datą za plan zajęć', () => {
    const randomSheet: SheetSnapshot = {
      name: 'DANE', usedRange: 'A1:C4', minRow: 1, minCol: 1, maxRow: 4, maxCol: 3, merges: [],
      cells: [cell(1, 1, 'Raport'), cell(2, 1, '07.10.2025'), cell(2, 2, 'grupa 1'), cell(3, 1, 'wartość'), cell(3, 2, '123')],
    };
    expect(analyzeScheduleWorkbook({ sheetNames: [randomSheet.name], sheets: [randomSheet] })).toBeNull();
  });
});
