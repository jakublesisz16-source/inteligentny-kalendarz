import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyGroupRecalculation,
  buildStudyGroupPreview,
  commitUniversityImport,
  deleteDatabaseForTests,
  initializeDatabase,
  listEvents,
  prepareGroupRecalculation,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';

function studyCandidate(id: string, group: string, patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: `A${id}`,
    sourceKey: `source-${id}`,
    originalText: `INTERNA ${group}`,
    subject: 'INTERNA',
    activityType: 'Zajęcia praktyczne',
    date: '2026-10-12',
    startTime: '08:00',
    endTime: '14:00',
    groupScope: 'SPECIFIC',
    groupTags: [group],
    status: 'READY',
    warnings: [],
    include: true,
    ...patch,
  };
}

beforeEach(async () => {
  await deleteDatabaseForTests();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('Build249 Study reality-check', () => {
  it('uses recurring-pattern assumptions consistently in alternate-group preview and group recalculation', async () => {
    await initializeDatabase();

    const current = studyCandidate('current-a', '13A');
    const peerOne = studyCandidate('target-b-1', '13B', { date: '2026-10-12' });
    const peerTwo = studyCandidate('target-b-2', '13B', { date: '2026-10-13' });
    const missingTime = studyCandidate('target-b-3', '13B', {
      date: '2026-10-14',
      status: 'REVIEW_REQUIRED',
      include: false,
      warnings: ['Plan źródłowy nie podaje pełnego zakresu godzin.'],
    });
    delete missingTime.startTime;
    delete missingTime.endTime;

    await commitUniversityImport({
      fileName: 'plan-reality-check.xls',
      fileSize: 1,
      fileHash: 'build249-study-reality-check',
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      selectedGroups: ['13A'],
      availableGroups: ['13A', '13B'],
      candidates: [current],
      allCandidates: [current, peerOne, peerTwo, missingTime],
    });

    const preview = await buildStudyGroupPreview(['13B']);
    const inferredPreview = preview.candidates.find((candidate) => candidate.id === 'target-b-3');
    expect(preview.candidates).toHaveLength(3);
    expect(inferredPreview).toMatchObject({ startTime: '08:00', endTime: '14:00', status: 'READY', include: true });
    expect(inferredPreview?.inferredFields).toEqual(expect.arrayContaining(['startTime', 'endTime']));

    const recalculation = await prepareGroupRecalculation(['13B']);
    expect(recalculation.canRecalculate).toBe(true);
    expect(recalculation.addedEntryIds).toHaveLength(3);
    expect(recalculation.removedEntryIds).toHaveLength(1);
    expect(recalculation.incompleteCandidates ?? []).toHaveLength(0);

    await applyGroupRecalculation(recalculation);
    const events = await listEvents();
    expect(events).toHaveLength(3);
    expect(events.every((event) => event.source === 'UNIVERSITY_XLSX')).toBe(true);
    expect(events.every((event) => event.studyGroupTags?.includes('13B'))).toBe(true);
    expect(events.find((event) => event.startDateTime === '2026-10-14T08:00')?.endDateTime).toBe('2026-10-14T14:00');
  });

  it('keeps Build249 mobile polish structural and minimal', () => {
    const css = readFileSync('src/styles/interface-refinement.css', 'utf8');
    const work = readFileSync('src/work/AvailabilityWorkComparisonPanel.tsx', 'utf8');
    const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
    const preview = readFileSync('src/study/StudyGroupPreviewPanel.tsx', 'utf8');
    const database = readFileSync('src/storage/database.ts', 'utf8');

    expect(css).toContain('Build249 - final mobile polish + Study reality-check closure.');
    expect(css).toContain('.finance-expense-section-v177 .finance-category-select');
    expect(css).toContain('.work-overview-simple .work-comparison-card-empty');
    expect(css).toContain('.calendar-primary-controls-minimal .calendar-view-switch');
    expect(work.match(/work-comparison-card-empty/g)?.length).toBe(2);
    expect(calendar.match(/<span className="day-number">\{day\.getDate\(\)\}<\/span>/g)?.length).toBe(1);
    expect(preview).toContain('applyVerifiedStudyPlanManualCorrectionsToAnalysis(rawResult, fileHash)');
    expect(database).toContain('const operationalSourceAnalysis =');
    expect(database).toContain('applyRecurringPatternToCandidates(sourceAnalysis.candidates).candidates');
  });
});
