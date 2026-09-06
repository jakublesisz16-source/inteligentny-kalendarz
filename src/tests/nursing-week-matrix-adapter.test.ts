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
    cell(2, 2, 'CHIRURGIA - grupy 8-osobowe'),
    cell(3, 2, 'pon. - pt. 8.00 - 14.00'),
    cell(4, 2, 'Prof. Testowa, ul. Testowa 1'),
    cell(3, 4, 'wtorek zajęcia w Centrum Symulacji, ul. Testowa 2, 8.00 - 14.00'),
    cell(2, 5, 'INTERNA (seminaria)'),
    cell(3, 5, 'wtorek 15.15 - 19.00, sala 104, ul. Testowa 3'),
    cell(3, 6, 'piątek 15.15 - 19.00, sala 118 CBI'),
    cell(2, 7, 'PROMOCJA ZDROWIA - grupy 8-osobowe'),
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


function shiftWorkbook(workbook: WorkbookSnapshot, rowOffset: number, colOffset: number, renameSheets = false): WorkbookSnapshot {
  const shiftedSheets = workbook.sheets.map((sheet, index) => {
    const shiftedCells = sheet.cells.map((entry) => ({
      ...entry,
      row: entry.row + rowOffset,
      col: entry.col + colOffset,
      address: `${colName(entry.col + colOffset)}${entry.row + rowOffset}`,
    }));
    const shiftedMerges = sheet.merges.map((entry) => ({
      startRow: entry.startRow + rowOffset,
      startCol: entry.startCol + colOffset,
      endRow: entry.endRow + rowOffset,
      endCol: entry.endCol + colOffset,
      ref: `${colName(entry.startCol + colOffset)}${entry.startRow + rowOffset}:${colName(entry.endCol + colOffset)}${entry.endRow + rowOffset}`,
    }));
    return {
      ...sheet,
      name: renameSheets ? `Arkusz ${index + 1}` : sheet.name,
      minRow: sheet.minRow + rowOffset,
      maxRow: sheet.maxRow + rowOffset,
      minCol: sheet.minCol + colOffset,
      maxCol: sheet.maxCol + colOffset,
      cells: shiftedCells,
      merges: shiftedMerges,
      ...(sheet.hiddenRows ? { hiddenRows: sheet.hiddenRows.map((row) => row + rowOffset) } : {}),
      ...(sheet.hiddenColumns ? { hiddenColumns: sheet.hiddenColumns.map((col) => col + colOffset) } : {}),
    };
  });
  return { sheetNames: shiftedSheets.map((sheet) => sheet.name), sheets: shiftedSheets };
}

function semanticCandidate(candidate: ReturnType<typeof nursingWeekMatrixV2Adapter.analyze>['candidates'][number]) {
  return {
    subject: candidate.subject, activityType: candidate.activityType, date: candidate.date,
    startTime: candidate.startTime, endTime: candidate.endTime, groupScope: candidate.groupScope,
    groupTags: [...candidate.groupTags].sort(), clinic: candidate.clinic, room: candidate.room,
    address: candidate.address, locationLabel: candidate.locationLabel, status: candidate.status, include: candidate.include,
  };
}

describe('nursing-week-matrix-v2 adapter', () => {
  it('rozpoznaje szeroką macierz tygodniową bez pionowej siatki czasu', () => {
    const workbook = wideWorkbook();
    expect(nursingWeekMatrixV2Adapter.canHandle(workbook)).toBe(true);
    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    expect(result.detectedAcademicYear).toBe('2025/2026');
    expect(result.groups).toEqual(expect.arrayContaining(['G8:1A', 'G8:1B', 'MAIN:2', 'MAIN:3', 'G8:4A', 'G8:4B']));
    expect(result.candidates.length).toBeGreaterThan(30);
  });

  it('rejestruje semantykę źródłowego bloku pon-pt razem z wygenerowanymi dniami', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(wideWorkbook());
    const sourceBlock = result.sourceBlocks?.find((block) => block.groupTags.includes('G8:1A') && block.weekStart === '2025-10-06');
    expect(sourceBlock).toMatchObject({
      weekStart: '2025-10-06', weekEnd: '2025-10-10', sourceHasFullTimeRange: true,
      weekdays: ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'],
    });
    expect(sourceBlock?.candidateIds).toHaveLength(5);
    expect(result.completeness?.safe).toBe(true);
  });

  it('używa deklarowanych godzin jako bramki kompletności zamiast polegać wyłącznie na liczbie kandydatów', () => {
    const matching = wideWorkbook();
    matching.sheets[0]!.cells = matching.sheets[0]!.cells.map((entry) => entry.address === 'B2' ? { ...entry, value: 'CHIRURGIA zajęcia praktyczne 120 godz. grupy 8-osobowe' } : entry);
    const accepted = analyzeScheduleWorkbook(matching);
    expect(accepted).not.toBeNull();
    expect(accepted?.completeness?.hourAudits.some((audit) => audit.enforcement === 'STRICT' && audit.declaredTeachingHours === 120 && audit.status === 'MATCH')).toBe(true);

    const shortened = wideWorkbook();
    shortened.sheets[0]!.cells = shortened.sheets[0]!.cells.map((entry) => {
      if (entry.address === 'B2') return { ...entry, value: 'CHIRURGIA zajęcia praktyczne 120 godz. grupy 8-osobowe' };
      if (entry.address === 'B3') return { ...entry, value: 'pon. - pt. 8.00 - 13.00' };
      return entry;
    });
    expect(analyzeScheduleWorkbook(shortened)).toBeNull();
  });

  it('rozwija poniedziałek-piątek na konkretne daty i stosuje wyjątek daty/lokalizacji z kolumny obok', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(wideWorkbook());
    const firstWeek1a = result.candidates.filter((candidate) => candidate.groupTags.includes('G8:1A') && candidate.date ? candidate.date >= '2025-10-06' && candidate.date <= '2025-10-10' : false);
    expect(firstWeek1a.map((candidate) => candidate.date)).toEqual(expect.arrayContaining(['2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-10-10']));

    const group1bTuesday = result.candidates.find((candidate) => candidate.groupTags.includes('G8:1B') && candidate.date === '2025-10-07');
    expect(group1bTuesday).toMatchObject({ startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 2' });
    expect(result.candidates.filter((candidate) => candidate.groupTags.includes('G8:1B') && candidate.date === '2025-10-07')).toHaveLength(1);
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

  it('nie wybiera wiersza prowadzącego jako przedmiotu po zmianie nazw przedmiotów', () => {
    const workbook = wideWorkbook();
    workbook.sheets = workbook.sheets.map((sheet) => ({
      ...sheet,
      cells: sheet.cells.map((entry) => ({
        ...entry,
        value: entry.value
          .replace(/CHIRURGIA/gi, 'OPIEKA OPERACYJNA')
          .replace(/INTERNA/gi, 'MEDYCYNA KLINICZNA')
          .replace(/PROMOCJA ZDROWIA/gi, 'EDUKACJA ZDROWOTNA'),
      })),
    }));
    const result = analyzeScheduleWorkbook(workbook);
    expect(result).not.toBeNull();
    expect(result?.candidates.some((candidate) => /^Prof\.|^Dr\b/i.test(candidate.subject))).toBe(false);
    expect(result?.candidates.some((candidate) => candidate.subject.includes('OPIEKA OPERACYJNA'))).toBe(true);
  });

  it('rozpoznaje nieznany przedmiot oznaczony skrótem ćw. i wiąże ogólny nagłówek stopki z lokalizacją', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.cells = plan.cells.map((entry) => {
      if (entry.address === 'B2') return { ...entry, value: 'NOWY PRZEDMIOT ćw. 120 godz. grupy 8-osobowe' };
      if (entry.address === 'A20') return { ...entry, value: 'NOWY PRZEDMIOT' };
      return entry;
    });
    const result = analyzeScheduleWorkbook(workbook);
    expect(result).not.toBeNull();
    const entries = result!.candidates.filter((candidate) => candidate.subject.startsWith('NOWY PRZEDMIOT'));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((candidate) => candidate.subject.startsWith('NOWY PRZEDMIOT ćw.'))).toBe(true);
    expect(entries.some((candidate) => candidate.address === 'ul. Testowa 1')).toBe(true);
  });

  it('zachowuje semantykę po przesunięciu całego planu w dół i w prawo oraz zmianie nazw arkuszy', () => {
    const baseline = analyzeScheduleWorkbook(wideWorkbook());
    const shifted = analyzeScheduleWorkbook(shiftWorkbook(wideWorkbook(), 15, 11, true));
    expect(baseline).not.toBeNull();
    expect(shifted).not.toBeNull();
    expect(shifted?.detectedAcademicYear).toBe(baseline?.detectedAcademicYear);
    expect(shifted?.groups).toEqual(baseline?.groups);
    const baselineCandidates = baseline!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const shiftedCandidates = shifted!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(shiftedCandidates).toEqual(baselineCandidates);
  });

  it('odrzuca podobny, ale semantycznie rozpadnięty układ zamiast importować go częściowo', () => {
    const broken = wideWorkbook();
    broken.sheets = broken.sheets.map((sheet) => ({ ...sheet, merges: [] }));
    expect(analyzeScheduleWorkbook(broken)).toBeNull();
  });

  it('odrzuca macierz po utracie scaleń nagłówków nawet jeśli pozostaje scalenie tytułu', () => {
    const broken = wideWorkbook();
    broken.sheets = broken.sheets.map((sheet) => ({
      ...sheet,
      merges: sheet.name === 'PLAN ZAJĘĆ' ? sheet.merges.filter((entry) => entry.ref === 'A1:J1') : sheet.merges,
    }));
    expect(analyzeScheduleWorkbook(broken)).toBeNull();
  });

  it('fail-closed zatrzymuje nowy nierozpoznany sposób oznaczenia grupy zamiast po cichu zgubić przypisanie', () => {
    const changed = wideWorkbook();
    changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === 'B8' ? { ...entry, value: 'zespół Alfa' } : entry);
    expect(analyzeScheduleWorkbook(changed)).toBeNull();
  });

  it('fail-closed zatrzymuje wiersz pełen grup, jeśli zmienił się format zakresu tygodnia', () => {
    const changed = wideWorkbook();
    changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === 'A8' ? { ...entry, value: 'tydzień 06.10. - 10.10.2025' } : entry);
    expect(analyzeScheduleWorkbook(changed)).toBeNull();
  });

  it('nie uznaje przypadkowego arkusza z pojedynczą datą za plan zajęć', () => {
    const randomSheet: SheetSnapshot = {
      name: 'DANE', usedRange: 'A1:C4', minRow: 1, minCol: 1, maxRow: 4, maxCol: 3, merges: [],
      cells: [cell(1, 1, 'Raport'), cell(2, 1, '07.10.2025'), cell(2, 2, 'grupa 1'), cell(3, 1, 'wartość'), cell(3, 2, '123')],
    };
    expect(analyzeScheduleWorkbook({ sheetNames: [randomSheet.name], sheets: [randomSheet] })).toBeNull();
  });
});

function internaExclusionWorkbook(): WorkbookSnapshot {
  const cells: SheetCellSnapshot[] = [
    cell(1, 1, 'PLAN II ROK PIELĘGNIARSTWO SEMESTR ZIMOWY 2026/2027'),
    cell(2, 2, 'INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe'),
    cell(3, 2, 'pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. Testa)'),
    cell(4, 2, 'Dr Nowak'),
    cell(2, 3, 'INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe'),
    cell(3, 3, 'wskazane poniżej dni tygodnia'),
    cell(4, 3, 'Prof. Test - wtorek'),
    cell(2, 4, 'CHIRURGIA zajęcia praktyczne - grupy 8-osobowe'),
    cell(3, 4, 'pon. - pt. 8.00 - 14.00'),
  ];
  ['12.10. - 16.10.2026', '19.10. - 23.10.2026', '26.10. - 30.10.2026'].forEach((week, index) => {
    const row = 8 + index;
    cells.push(cell(row, 1, week), cell(row, 2, '2a'), cell(row, 3, '2a'), cell(row, 4, '3a'));
  });
  cells.push(cell(20, 1, 'INTERNA zajęcia praktyczne'));
  cells.push(cell(21, 1, 'Klinika Testowa (Dr Nowak), ul. Testowa 1, zajęcia rozpoczynają się od 7.30'));
  const plan: SheetSnapshot = { name: 'PLAN ZAJĘĆ', usedRange: 'A1:D21', minRow: 1, minCol: 1, maxRow: 21, maxCol: 4, cells, merges: [] };
  return { sheetNames: [plan.name], sheets: [plan] };
}

describe('nursing-week-matrix-v2 regressions', () => {
  it('wyklucza z bloku pon-pt dni alternatywnych zajęć tego samego przedmiotu i nie zgaduje ich godzin', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(internaExclusionWorkbook());
    const firstWeek = result.candidates.filter((candidate) => candidate.groupTags.includes('G8:2A') && candidate.date && candidate.date >= '2026-10-12' && candidate.date <= '2026-10-16');
    expect(firstWeek).toHaveLength(5);
    const tuesday = firstWeek.filter((candidate) => candidate.date === '2026-10-13');
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0]?.startTime).toBeUndefined();
    expect(tuesday[0]?.warnings.join(' ')).toContain('pełnego zakresu godzin');
  });

  it('wiąże wyjątek godziny ze stopki po tożsamości prowadzącego, bez nazwiska zakodowanego w parserze', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(internaExclusionWorkbook());
    const base = result.candidates.find((candidate) => candidate.groupTags.includes('G8:2A') && candidate.date === '2026-10-12');
    expect(base).toMatchObject({ startTime: '07:30', endTime: '14:00', address: 'ul. Testowa 1' });
  });
});
