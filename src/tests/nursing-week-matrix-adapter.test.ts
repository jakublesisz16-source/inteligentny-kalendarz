import { describe, expect, it } from 'vitest';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import { nursingWeekMatrixV2Adapter } from '../imports/xlsx/adapters/nursing-week-matrix-v2.adapter';
import type { SheetCellSnapshot, SheetMergeSnapshot, SheetSnapshot, WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import { candidatesForSelectedGroups } from '../study/study.service';
import { expectedDatesForSourceBlock } from '../study/study-completeness';

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

  it('nie myli dnia z opisu sali z właściwym zakresem pon-pt w tej samej kolumnie', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.merges = plan.merges.filter((entry) => entry.ref !== 'B3:C3');
    plan.cells.push(cell(5, 2, 'pon. - sala 102 w NZN'));

    const result = analyzeScheduleWorkbook(workbook);
    expect(result).not.toBeNull();
    const sourceBlock = result?.sourceBlocks?.find((block) => block.groupTags.includes('G8:1A') && block.weekStart === '2025-10-06');
    expect(sourceBlock?.weekdays).toEqual(['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK']);
    expect(sourceBlock?.candidateIds).toHaveLength(5);
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

  it('akceptuje brak scaleń, gdy każda kolumna zachowuje własny jawny nagłówek przedmiotu, dnia i godzin', () => {
    const baseline = analyzeScheduleWorkbook(wideWorkbook());
    const changed = wideWorkbook();
    const plan = changed.sheets[0]!;
    plan.merges = [];
    plan.cells.push(
      cell(2, 3, 'CHIRURGIA - grupy 8-osobowe'),
      cell(2, 4, 'CHIRURGIA - grupy 8-osobowe'),
      cell(3, 3, 'pon. - pt. 8.00 - 14.00'),
      cell(2, 6, 'INTERNA (seminaria)'),
      cell(2, 8, 'PROMOCJA ZDROWIA - grupy 8-osobowe'),
    );

    const result = analyzeScheduleWorkbook(changed);
    expect(baseline).not.toBeNull();
    expect(result).not.toBeNull();
    const baselineCandidates = baseline!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const changedCandidates = result!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(changedCandidates).toEqual(baselineCandidates);
  });

  it('toleruje dodatkowe wiersze informacyjne między nagłówkami a pierwszym tygodniem', () => {
    const baseline = analyzeScheduleWorkbook(wideWorkbook());
    const changed = wideWorkbook();
    const plan = changed.sheets[0]!;
    plan.cells = plan.cells.map((entry) => entry.row >= 8 ? { ...entry, row: entry.row + 3, address: `${colName(entry.col)}${entry.row + 3}` } : entry);
    plan.merges = plan.merges.map((entry) => entry.startRow >= 8 ? {
      ...entry,
      startRow: entry.startRow + 3,
      endRow: entry.endRow + 3,
      ref: `${colName(entry.startCol)}${entry.startRow + 3}:${colName(entry.endCol)}${entry.endRow + 3}`,
    } : entry);
    plan.maxRow += 3;
    plan.cells.push(cell(8, 1, 'Uwagi organizacyjne'), cell(9, 2, 'Aktualizacja planu'), cell(10, 2, 'Obowiązuje od października'));

    const result = analyzeScheduleWorkbook(changed);
    expect(baseline).not.toBeNull();
    expect(result).not.toBeNull();
    const baselineCandidates = baseline!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const changedCandidates = result!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(changedCandidates).toEqual(baselineCandidates);
  });

  it('stosuje wyjątek godziny na tej samej dacie bez tworzenia drugiego bazowego terminu', () => {
    const changed = wideWorkbook();
    changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === 'D3'
      ? { ...entry, value: 'wtorek zajęcia w Centrum Symulacji, ul. Testowa 2, 9.00 - 12.00' }
      : entry);
    const result = analyzeScheduleWorkbook(changed);
    expect(result).not.toBeNull();
    const tuesday = result!.candidates.filter((candidate) => candidate.groupTags.includes('G8:1B') && candidate.date === '2025-10-07');
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0]).toMatchObject({ startTime: '09:00', endTime: '12:00', address: 'ul. Testowa 2' });
  });

  it('fail-closed zatrzymuje jawny wyjątek daty, którego nie da się pogodzić z bazowym dniem kolumny', () => {
    const changed = wideWorkbook();
    changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === 'D8'
      ? { ...entry, value: '11.10.', valueType: 'date' as const, dateValue: '2025-10-11' }
      : entry);
    expect(analyzeScheduleWorkbook(changed)).toBeNull();
    const direct = nursingWeekMatrixV2Adapter.analyze(changed);
    expect(direct.diagnostics?.unappliedDateExceptionCount).toBe(1);
    expect(direct.diagnostics?.unappliedDateExceptionSamples?.[0]).toContain('C8 + D8: 2025-10-11');
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

  it('nie gubi tygodni po dodaniu pomocniczej kolumny przed zakresem dat', () => {
    const baseline = analyzeScheduleWorkbook(wideWorkbook());
    const changed = shiftWorkbook(wideWorkbook(), 0, 1);
    const plan = changed.sheets[0]!;
    plan.minCol = 1;
    plan.cells.push(cell(1, 1, 'Nr tyg.'));
    [8, 9, 10].forEach((row, index) => plan.cells.push(cell(row, 1, String(index + 1))));

    const result = analyzeScheduleWorkbook(changed);
    expect(baseline).not.toBeNull();
    expect(result).not.toBeNull();
    expect(result?.diagnostics?.weekRowCount).toBe(3);
    expect(result?.diagnostics?.unparsedAssignmentCellCount).toBe(0);
    const baselineCandidates = baseline!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const changedCandidates = result!.candidates.map(semanticCandidate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(changedCandidates).toEqual(baselineCandidates);
  });

  it('akceptuje bezpieczne warianty zapisu zakresu tygodnia bez strojenia pod jeden arkusz', () => {
    for (const value of [
      'tydzień 06.10. - 10.10.2025',
      'od 06.10.2025 do 10.10.2025',
      '6-10.10.2025',
      '06.10.2025 - 10.10.2025',
    ]) {
      const changed = wideWorkbook();
      changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === 'A8' ? { ...entry, value } : entry);
      const result = analyzeScheduleWorkbook(changed);
      expect(result, value).not.toBeNull();
      expect(result?.candidates.some((candidate) => candidate.groupTags.includes('G8:1A') && candidate.date === '2025-10-06'), value).toBe(true);
      expect(result?.candidates.some((candidate) => candidate.groupTags.includes('G8:1A') && candidate.date === '2025-10-10'), value).toBe(true);
    }
  });

  it('nie zgaduje przedmiotu z sąsiedniej kolumny, gdy lokalna kolumna ma grupę, dzień i godzinę, ale brak nagłówka przedmiotu', () => {
    const changed = wideWorkbook();
    const plan = changed.sheets[0]!;
    plan.cells.push(
      cell(5, 9, 'środa 10.00 - 12.00, sala 999, ul. Testowa 99'),
      cell(8, 9, '5a'),
    );

    const result = analyzeScheduleWorkbook(changed);
    expect(result).not.toBeNull();
    const ambiguous = result!.candidates.find((candidate) => candidate.sourceRange === 'I8');
    expect(ambiguous).toBeDefined();
    expect(ambiguous?.subject).toBe('');
    expect(ambiguous?.date).toBe('2025-10-08');
    expect(ambiguous?.startTime).toBe('10:00');
    expect(ambiguous?.endTime).toBe('12:00');
    expect(ambiguous?.room).toBe('sala 999');
    expect(ambiguous?.address).toBe('ul. Testowa 99');
    expect(ambiguous?.include).toBe(false);
    expect(ambiguous?.warnings.join(' ')).toContain('przedmiotu');
    expect(ambiguous?.sourceSectionKey).toBe('PLAN ZAJĘĆ|C9');
  });

  it('nadal fail-closed zatrzymuje wiersz grup, gdy zakres tygodnia nie daje dwóch jednoznacznych dat', () => {
    for (const address of ['A8', 'A10']) {
      const changed = wideWorkbook();
      changed.sheets[0]!.cells = changed.sheets[0]!.cells.map((entry) => entry.address === address ? { ...entry, value: 'tydzień pierwszy października' } : entry);
      expect(analyzeScheduleWorkbook(changed), address).toBeNull();
    }
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

function currentPlanPharmacologyWorkbook(): WorkbookSnapshot {
  const workbook = wideWorkbook();
  const plan = workbook.sheets[0]!;

  plan.merges = plan.merges
    .filter((entry) => entry.ref !== 'B3:C3' && entry.ref !== 'D3:D6')
    .concat(merge(3, 2, 3, 4));

  plan.cells = plan.cells.filter((entry) => {
    if (entry.row === 2 && entry.col === 2) return false;
    if (entry.row === 3 && entry.col >= 2 && entry.col <= 4) return false;
    if (entry.row === 4 && entry.col >= 2 && entry.col <= 4) return false;
    if (entry.row >= 8 && entry.row <= 10 && entry.col >= 2 && entry.col <= 4) return false;
    return true;
  });

  plan.cells.push(
    cell(2, 2, 'FARMAKOLOGIA seminaria 15g'),
    cell(3, 2, 'Prof. dr hab. D. Test, seminaria PON., WT. i CZW. 10.15 - 14.00'),
    cell(4, 2, 'poniedziałek'),
    cell(4, 3, 'wtorek'),
    cell(4, 4, 'czwartek'),
    cell(8, 2, 'grupa 10'),
    cell(8, 3, 'grupa 10'),
    cell(9, 2, 'grupa 8'),
    cell(9, 3, 'grupa 8'),
    cell(10, 2, 'grupa 7'),
    cell(10, 3, 'grupa 7'),
  );

  return workbook;
}

describe('nursing-week-matrix-v2 current 2026/2027 plan precedence', () => {
  it('dokładny dzień konkretnej kolumny ma pierwszeństwo przed ogólnym PON/WT/CZW przedmiotu', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(currentPlanPharmacologyWorkbook());
    const farmakologia = result.candidates.filter((candidate) =>
      candidate.subject.startsWith('FARMAKOLOGIA')
      && candidate.groupTags.includes('MAIN:10')
      && candidate.date
      && candidate.date >= '2025-10-06'
      && candidate.date <= '2025-10-10');

    expect(farmakologia.map((candidate) => candidate.date).sort()).toEqual(['2025-10-06', '2025-10-07']);
    expect(farmakologia.some((candidate) => candidate.date === '2025-10-09')).toBe(false);
    expect(farmakologia.every((candidate) => candidate.startTime === '10:15' && candidate.endTime === '14:00')).toBe(true);
  });

  it('lokalna aktualizacja godziny i miejsca w konkretnej kolumnie wygrywa z szerszym opisem sekcji', () => {
    const workbook = currentPlanPharmacologyWorkbook();
    const plan = workbook.sheets[0]!;
    plan.cells = plan.cells.map((entry) => entry.address === 'B4'
      ? { ...entry, value: 'poniedziałek 10.30 - 14.15, sala 201, ul. Nowa 5' }
      : entry);

    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const monday = result.candidates.find((candidate) => candidate.subject.startsWith('FARMAKOLOGIA') && candidate.groupTags.includes('MAIN:10') && candidate.date === '2025-10-06');
    const tuesday = result.candidates.find((candidate) => candidate.subject.startsWith('FARMAKOLOGIA') && candidate.groupTags.includes('MAIN:10') && candidate.date === '2025-10-07');

    expect(monday).toMatchObject({ startTime: '10:30', endTime: '14:15', room: 'sala 201', address: 'ul. Nowa 5' });
    expect(tuesday).toMatchObject({ startTime: '10:15', endTime: '14:00' });
  });
});

function thirdYear2026LayoutWorkbook(): WorkbookSnapshot {
  const plan: SheetSnapshot = {
    name: 'PLAN ZAJĘĆ', usedRange: 'A1:D20', minRow: 1, minCol: 1, maxRow: 20, maxCol: 4, merges: [merge(1, 1, 1, 4)],
    cells: [
      cell(1, 1, 'III ROK PIELĘGNIARSTWO STACJONARNE SEMESTR ZIMOWY 2026/2027'),
      cell(2, 2, 'ANESTEZJOLOGIA'),
      cell(3, 2, '40G'),
      cell(4, 2, 'zaj. prakt. (pon. - pt.) 8.00. - 14.00.'),
      cell(5, 2, 'Szpital Testowy, ul. Testowa 1'),
      cell(2, 3, 'RATOWNICTWO MEDYCZNE'),
      cell(3, 3, 'ćwiczenia 10G'),
      cell(4, 3, 'poniedziałki 15.00 - 18.45'),
      cell(5, 3, 'sala 218, ul. Litewska 14/16'),
      cell(2, 4, 'PSYCHIATRIA\nMazowieckie Centrum Zdrowia, ul. Partyzantów 2/4, Oddział 2SK'),
      cell(3, 4, 'seminaria 5G'),
      cell(4, 4, 'poniedziałek 15.00 - 18.45'),
      cell(8, 1, '12.10. - 16.10.2026'), cell(8, 2, '4b*'), cell(8, 3, '4b'), cell(8, 4, '7'),
      cell(9, 1, '19.10. - 23.10.2026'), cell(9, 3, '4b'),
      cell(20, 1, 'oznaczenie grup: seminaria w grupach dziekańskich (24 osoby); ćwiczenia w 1/2 grupy dziekańskiej (12 osób); zajęcia praktyczne w 1/3 grupy dziekańskiej (8 osób)'),
    ],
  };
  return { sheetNames: [plan.name], sheets: [plan] };
}

describe('nursing-week-matrix-v2 III year 2026/2027 layout', () => {
  it('wyprowadza trzy niezależne poziomy grup z globalnej legendy i usuwa przypisowe gwiazdki', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(thirdYear2026LayoutWorkbook());
    expect(result.groups).toEqual(expect.arrayContaining(['MAIN:7', 'G12:4B', 'G8:4B']));
    expect(result.groups.some((group) => group.startsWith('GENERIC:'))).toBe(false);
    expect(result.diagnostics?.unparsedAssignmentCellCount).toBe(0);
    expect(result.diagnostics?.suspiciousUnparsedWeekRows).toEqual([]);
  });

  it('nie bierze etykiet seminaria/ćwiczenia za nazwę przedmiotu i zachowuje właściwy rodzaj zajęć', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(thirdYear2026LayoutWorkbook());
    const practical = result.candidates.find((candidate) => candidate.groupTags.includes('G8:4B'));
    const exercise = result.candidates.find((candidate) => candidate.groupTags.includes('G12:4B'));
    const seminar = result.candidates.find((candidate) => candidate.groupTags.includes('MAIN:7'));
    expect(practical).toMatchObject({ subject: 'ANESTEZJOLOGIA', activityType: 'Zajęcia praktyczne', startTime: '08:00', endTime: '14:00' });
    expect(exercise).toMatchObject({ subject: 'RATOWNICTWO MEDYCZNE', activityType: 'Ćwiczenia', startTime: '15:00', endTime: '18:45' });
    expect(seminar).toMatchObject({ subject: 'PSYCHIATRIA', activityType: 'Seminaria', address: 'ul. Partyzantów 2/4' });
  });

  it('traktuje jawne przesunięcie godziny z arkusza jako silniejsze od matematycznego przeliczenia deklarowanych G', () => {
    const workbook = thirdYear2026LayoutWorkbook();
    workbook.sheets[0]!.cells = workbook.sheets[0]!.cells.map((entry) => entry.address === 'B4'
      ? { ...entry, value: 'zaj. prakt. (pon. - pt.) 8.00 - 14.00; Uwaga! zajęcia zaczynają się od godz. 7.00' }
      : entry);
    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const audit = result.completeness?.hourAudits.find((entry) => entry.subject === 'ANESTEZJOLOGIA' && entry.groupTag === 'G8:4B');
    expect(audit?.enforcement).toBe('ADVISORY');
    expect(result.completeness?.safe).toBe(true);
    expect(result.candidates.find((candidate) => candidate.groupTags.includes('G8:4B'))).toMatchObject({ startTime: '07:00', endTime: '14:00' });
  });

  it('czyta pełną nazwę auli i literówkę Drhab w wykładach', () => {
    const workbook = lectureOnlyWorkbook();
    const lectures = workbook.sheets[0]!;
    lectures.cells = lectures.cells.map((entry) => {
      if (entry.address === 'A1') return { ...entry, value: 'WYKŁADY III ROK PIELĘGNIARSTWO STACJONARNE ŚRODY aula im. Prof. A. Grucy, ul. Lindleya 4 SEM. ZIMOWY 2026/2027' };
      if (entry.address === 'B3') return { ...entry, value: 'ANESTEZJOLOGIA Drhab D. Kosson 15.00 - 16.30 (2)' };
      return entry;
    });
    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const lecture = result.candidates.find((candidate) => candidate.subject === 'ANESTEZJOLOGIA');
    expect(lecture).toMatchObject({ room: 'aula im. Prof. A. Grucy', address: 'ul. Lindleya 4' });
  });
});

function thirdYearFirstMeetingLocationWorkbook(): WorkbookSnapshot {
  const plan: SheetSnapshot = {
    name: 'PLAN ZAJĘĆ', usedRange: 'A1:C20', minRow: 1, minCol: 1, maxRow: 20, maxCol: 3, merges: [],
    cells: [
      cell(1, 1, 'III ROK PIELĘGNIARSTWO STACJONARNE SEMESTR ZIMOWY 2026/2027'),
      cell(2, 2, 'PSYCHIATRIA'),
      cell(3, 2, '80G'),
      cell(4, 2, 'zaj. prakt. (pon. - pt.) 8.00. - 14.00.'),
      cell(5, 2, 'Prof. A. Szulc'),
      cell(2, 3, 'PSYCHIATRIA'),
      cell(3, 3, '80G'),
      cell(4, 3, 'zaj. prakt. (pon. - pt.) 8.00. - 14.00.'),
      cell(5, 3, 'dr hab. A. Silczuk'),
      cell(8, 1, '12.10. - 16.10.2026'), cell(8, 2, '2a'), cell(8, 3, '3a'),
      cell(9, 1, '19.10. - 23.10.2026'), cell(9, 2, '2a'), cell(9, 3, '3a'),
      cell(18, 2, 'Prof. A. Szulc - pierwsze spotkanie w Mazowieckim Specjalistycznym Centrum Zdrowia, ul. Partyzantów 2/4, Oddział 2DE'),
      cell(20, 1, 'oznaczenie grup: seminaria w grupach dziekańskich (24 osoby); ćwiczenia w 1/2 grupy dziekańskiej (12 osób); zajęcia praktyczne w 1/3 grupy dziekańskiej (8 osób)'),
    ],
  };
  return { sheetNames: [plan.name], sheets: [plan] };
}

describe('nursing-week-matrix-v2 source-faithful first meeting locations', () => {
  it('nie rozciąga lokalizacji oznaczonej jako pierwsze spotkanie na cały tydzień ani na innego prowadzącego', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(thirdYearFirstMeetingLocationWorkbook());
    const szulc = result.candidates
      .filter((candidate) => candidate.groupTags.includes('G8:2A'))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const silczuk = result.candidates
      .filter((candidate) => candidate.groupTags.includes('G8:3A'))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    expect(szulc).toHaveLength(10);
    expect(szulc[0]).toMatchObject({ date: '2026-10-12', address: 'ul. Partyzantów 2/4' });
    expect(szulc.slice(1).every((candidate) => !candidate.address && !candidate.locationLabel)).toBe(true);
    expect(silczuk).toHaveLength(10);
    expect(silczuk.every((candidate) => !candidate.address && !candidate.locationLabel)).toBe(true);
  });
});


function thirdYearNeurologySeminarFooterWorkbook(): WorkbookSnapshot {
  const plan: SheetSnapshot = {
    name: 'PLAN ZAJĘĆ', usedRange: 'A1:B18', minRow: 1, minCol: 1, maxRow: 18, maxCol: 2, merges: [],
    cells: [
      cell(1, 1, 'III ROK PIELĘGNIARSTWO STACJONARNE SEMESTR ZIMOWY 2026/2027'),
      cell(2, 2, 'NEUROLOGIA'),
      cell(3, 2, 'seminaria 5G'),
      cell(4, 2, 'piątek 9.00 - 12.45'),
      cell(8, 1, '12.10. - 16.10.2026'), cell(8, 2, '2'),
      cell(18, 1, 'Dr hab. D. Koziorowski - Klinika Neurologii WNoZ, zajęcia praktyczne dla grup oraz seminaria dla wszystkich grup dziekańskich odbywają się w Klinice Neurologii, ul. Kondratowicza 8'),
    ],
  };
  return { sheetNames: [plan.name], sheets: [plan] };
}

describe('nursing-week-matrix-v2 footer describing more than one activity type', () => {
  it('nie odrzuca jawnej lokalizacji seminarium tylko dlatego, że ta sama stopka wspomina też zajęcia praktyczne', () => {
    const result = nursingWeekMatrixV2Adapter.analyze(thirdYearNeurologySeminarFooterWorkbook());
    const seminar = result.candidates.find((candidate) => candidate.groupTags.includes('MAIN:2'));
    expect(seminar).toMatchObject({ subject: 'NEUROLOGIA', activityType: 'Seminaria', address: 'ul. Kondratowicza 8' });
  });
});


describe('nursing-week-matrix-v2 II year 2026/2027 current layout hardening', () => {
  it('nie interpretuje dużej scalonej tabeli lokalizacji jako przypisania grupy', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.maxCol = 20;
    plan.usedRange = 'A1:T25';
    plan.merges.push(merge(9, 9, 20, 20));
    plan.cells.push(cell(9, 9, 'poniedziałek środa piątek gr. 13 - sala 210 w NZJ gr. 1 - sala 119 w CBI gr. 14 - sala 102 w NZN gr. 8 - sala 101, ul. Litewska 14/16'));

    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    expect(result.candidates.some((candidate) => candidate.originalGroupText?.includes('gr. 13 - sala') === true)).toBe(false);
  });

  it('stosuje lokalizację z dnia tylko do tego dnia i respektuje zakresy dat w tej samej komórce', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.cells.push(cell(5, 2, 'pon. - sala 126 w CD pt. - 10.10. - 24.10. - sala 210 w NZJ'));

    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const group = result.candidates.filter((candidate) => candidate.groupTags.includes('G8:1A'));
    expect(group.find((candidate) => candidate.date === '2025-10-06')).toMatchObject({ room: 'sala 126 w CD' });
    expect(group.find((candidate) => candidate.date === '2025-10-07')?.room).toBeUndefined();
    expect(group.find((candidate) => candidate.date === '2025-10-10')).toMatchObject({ room: 'sala 210 w NZJ' });
    expect(group.find((candidate) => candidate.date === '2025-10-17')).toMatchObject({ room: 'sala 210 w NZJ' });
  });

  it('wiąże jawny kod jednostki NZJ z jednoznacznym adresem ze stopki bez zgadywania po przedmiocie', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.cells = plan.cells.map((entry) => {
      if (entry.address === 'E2') return { ...entry, value: 'POZ ćw. 5 godz. grupy 12-osobowe' };
      if (entry.address === 'E3') return { ...entry, value: 'środa sala 210 w NZJ 8.00 - 11.45' };
      return entry;
    });
    plan.cells.push(cell(22, 5, 'POZ ćwiczenia'), cell(23, 5, 'Zakład Rozwoju Pielęgniarstwa (NZJ), ul. Ciołka 27'));

    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const poz = result.candidates.find((candidate) => candidate.groupTags.includes('G12:2') && candidate.subject.startsWith('POZ'));
    expect(poz).toMatchObject({ room: 'sala 210 w NZJ', address: 'ul. Ciołka 27' });
  });

  it('naprawia bezpiecznie przesunięte scalenie godzin tylko wtedy, gdy nakłada się na jeden jednoznaczny dzień', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.maxCol = 11;
    plan.usedRange = 'A1:K25';
    plan.merges.push(merge(2, 9, 2, 11), merge(4, 10, 4, 11), merge(5, 9, 6, 11));
    plan.cells.push(
      cell(2, 9, 'POZ seminaria 15g'),
      cell(3, 9, 'Zakład Rozwoju Pielęgniarstwa, ul. Ciołka 27'),
      cell(4, 10, 'piątek'),
      cell(5, 9, '8.00 - 11.45'),
      cell(8, 9, 'grupa 14'), cell(8, 10, 'grupa 1'), cell(8, 11, 'grupa 2'),
      cell(9, 9, 'grupa 13'), cell(9, 10, 'grupa 3'), cell(9, 11, 'grupa 4'),
      cell(10, 9, 'grupa 12'), cell(10, 10, 'grupa 5'), cell(10, 11, 'grupa 6'),
    );

    const result = nursingWeekMatrixV2Adapter.analyze(workbook);
    const group14 = result.candidates.find((candidate) => candidate.groupTags.includes('MAIN:14') && candidate.subject.startsWith('POZ'));
    expect(group14).toMatchObject({ date: '2025-10-10', startTime: '08:00', endTime: '11:45' });
  });
});

describe('nursing-week-matrix-v2 inline exact-date assignments', () => {
  it('traktuje datę wpisaną bezpośrednio w komórce grupy jako dokładny wyjątek, także poza tygodniem wiersza', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.cells = plan.cells.map((entry) => entry.address === 'B8'
      ? { ...entry, value: '1a\n06.11. - 8.00 - 14.00\nsala 101 ZPK' }
      : entry);

    const direct = nursingWeekMatrixV2Adapter.analyze(workbook);
    const candidate = direct.candidates.find((entry) => entry.sourceRange === 'B8');
    const sourceBlock = direct.sourceBlocks?.find((entry) => entry.sourceRange === 'B8');

    expect(candidate).toMatchObject({ date: '2025-11-06', startTime: '08:00', endTime: '14:00', groupTags: ['G8:1A'] });
    expect(sourceBlock).toMatchObject({ weekdays: [], exceptionDate: '2025-11-06' });
    expect(expectedDatesForSourceBlock(sourceBlock!)).toEqual(['2025-11-06']);
  });
});


describe('nursing-week-matrix-v2 dedicated exact-date marker columns', () => {
  it('uznaje dokładną datę z dedykowanej kolumny za bardziej szczegółową niż szeroki dzień sąsiedniej komórki', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.merges = plan.merges.filter((entry) => entry.ref !== 'B3:C3');
    plan.cells = plan.cells.map((entry) => {
      if (entry.address === 'B3') return { ...entry, value: 'pon. - pt. 8.00 - 14.00 bez dni, w których odbywają się inne zajęcia' };
      if (entry.address === 'C3') return { ...entry, value: 'piątek 15.15 - 19.00, ul. Banacha 1a' };
      if (entry.address === 'D3') return { ...entry, value: 'ŚRODY - Centrum Symulacji Medycznych, ul. Pawińskiego 3a, w konkretnych terminach 8.00 - 14.00' };
      if (entry.address === 'B8') return { ...entry, value: '1a' };
      if (entry.address === 'C8') return { ...entry, value: '1a' };
      if (entry.address === 'D8') return { ...entry, value: '06.10.', valueType: 'date' as const, dateValue: '2025-10-06' };
      return entry;
    });

    const direct = nursingWeekMatrixV2Adapter.analyze(workbook);
    const group = direct.candidates
      .filter((entry) => entry.groupTags.includes('G8:1A') && entry.subject.startsWith('CHIRURGIA'))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.startTime ?? '').localeCompare(b.startTime ?? ''));

    expect(direct.diagnostics?.unappliedDateExceptionCount ?? 0).toBe(0);
    expect(analyzeScheduleWorkbook(workbook)).not.toBeNull();
    expect(group.filter((entry) => entry.date === '2025-10-06')).toHaveLength(1);
    expect(group.filter((entry) => entry.date === '2025-10-10')).toHaveLength(1);
    expect(group.find((entry) => entry.date === '2025-10-06')).toMatchObject({
      startTime: '08:00',
      endTime: '14:00',
      address: 'ul. Pawińskiego 3a',
      locationLabel: 'CSM',
    });
  });

  it('rozpoznaje pluralne nagłówki dni jako reguły lokalizacji dla konkretnego dnia', () => {
    const workbook = wideWorkbook();
    const plan = workbook.sheets[0]!;
    plan.merges = plan.merges.filter((entry) => entry.ref !== 'B3:C3');
    plan.cells = plan.cells.map((entry) => {
      if (entry.address === 'B3') return { ...entry, value: 'pon. - pt. 8.00 - 14.00' };
      return entry;
    });
    plan.cells.push(cell(5, 2, 'WTORKI - Centrum Symulacji Medycznych, ul. Pawińskiego 3a'));

    const direct = nursingWeekMatrixV2Adapter.analyze(workbook);
    const monday = direct.candidates.find((entry) => entry.sourceRange === 'B8' && entry.date === '2025-10-06');
    const tuesday = direct.candidates.find((entry) => entry.sourceRange === 'B8' && entry.date === '2025-10-07');

    expect(monday?.address).not.toBe('ul. Pawińskiego 3a');
    expect(tuesday).toMatchObject({ address: 'ul. Pawińskiego 3a', locationLabel: 'CSM' });
  });
});
