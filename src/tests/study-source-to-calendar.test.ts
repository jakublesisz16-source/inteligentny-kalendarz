import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from '../calendar/CalendarView';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import type { SheetCellSnapshot, SheetSnapshot, WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import {
  commitUniversityImport,
  deleteDatabaseForTests,
  getActiveUniversityImport,
  initializeDatabase,
  listEvents,
} from '../storage/database';
import { candidatesForSelectedGroups } from '../study/study.service';

function cell(row: number, col: number, address: string, value: string): SheetCellSnapshot {
  return { row, col, address, value };
}

function lectureWorkbook(): WorkbookSnapshot {
  const sheet: SheetSnapshot = {
    name: 'WYKŁADY',
    usedRange: 'A1:C6',
    minRow: 1,
    minCol: 1,
    maxRow: 6,
    maxCol: 3,
    merges: [],
    cells: [
      cell(1, 1, 'A1', 'WYKŁADY II ROK PIELĘGNIARSTWO (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Akademicka 2'),
      cell(3, 1, 'A3', '06.10.'),
      cell(3, 2, 'B3', 'FARMAKOLOGIA prof. Test 15.00 - 16.30 (2)'),
      cell(4, 1, 'A4', '13.10.'),
      cell(4, 2, 'B4', 'PEDIATRIA prof. Test 15.00 - 17.15 (3)'),
      cell(5, 1, 'A5', '20.10.'),
      cell(5, 2, 'B5', 'CHIRURGIA prof. Test 15.00 - 16.30 (2)'),
    ],
  };
  return { sheetNames: [sheet.name], sheets: [sheet] };
}

beforeEach(async () => {
  await deleteDatabaseForTests();
});

afterEach(async () => {
  vi.useRealTimers();
  await deleteDatabaseForTests();
});

describe('Study source -> parser -> IndexedDB -> calendar regression', () => {
  it('preserves a concrete Excel class through the full application path without changing its date or time', async () => {
    const analysis = analyzeScheduleWorkbook(lectureWorkbook());
    expect(analysis).not.toBeNull();
    const parsed = analysis!;
    const selected = candidatesForSelectedGroups(parsed, []).map((candidate) => ({ ...candidate, include: true }));
    const source = selected.find((candidate) => candidate.subject === 'FARMAKOLOGIA');
    expect(source).toMatchObject({ date: '2026-10-06', startTime: '15:00', endTime: '16:30' });

    await initializeDatabase();
    await commitUniversityImport({
      fileName: 'synthetic-plan.xlsx',
      fileSize: 1,
      fileHash: 'source-to-calendar-rc11',
      adapterId: parsed.adapterId,
      sheetNames: parsed.sheetNames,
      selectedGroups: [],
      availableGroups: parsed.groups,
      candidates: selected,
      allCandidates: parsed.candidates,
      ...(parsed.sourceBlocks ? { sourceBlocks: parsed.sourceBlocks } : {}),
    });

    const events = await listEvents();
    expect(events).toHaveLength(3);
    const farmakologia = events.find((event) => event.title === 'FARMAKOLOGIA');
    expect(farmakologia).toMatchObject({
      title: 'FARMAKOLOGIA',
      startDateTime: '2026-10-06T15:00',
      endDateTime: '2026-10-06T16:30',
      category: 'STUDY',
      source: 'UNIVERSITY_XLSX',
    });
    expect((await getActiveUniversityImport())?.importedEventCount).toBe(3);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00'));
    let markup = '';
    try {
      markup = renderToStaticMarkup(createElement(CalendarView, {
        events,
        locations: [],
        timeFormat: '24h',
        dayConstraints: [],
        dayAttributes: [],
        consistencyIssues: [],
        activeStudyGroups: [],
        incompleteStudyEntries: [],
        onToggleWorkAvailabilityExclusion: async () => undefined,
        onToggleTradingSunday: async () => undefined,
        onAcknowledgeConsistency: async () => undefined,
        onAdd: () => undefined,
        onAddMany: () => undefined,
        onEdit: () => undefined,
        onStudyCorrect: () => undefined,
        onStudySeriesCorrect: () => undefined,
        availabilityPlans: [],
        coworkersByEvent: {},
        onOpenAvailability: () => undefined,
      }));
    } finally {
      vi.useRealTimers();
    }

    expect(markup).toContain('title="15:00-16:30 FARMAKOLOGIA"');
    expect(markup).toContain('FARMAKOLOGIA');
  });
});
