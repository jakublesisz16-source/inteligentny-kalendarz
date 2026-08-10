import { describe, expect, it } from 'vitest';
import { toLocalDateKey } from '../calendar/date.utils';
import {
  getStudyPreviewDayEvents,
  getStudyPreviewMonthGrid,
  groupStudyPreviewEventsByDate,
  initialStudyPreviewMonth,
  selectStudyPreviewDateForMonth,
  undatedStudyPreviewCount,
} from '../study/study-preview-calendar';
import type { StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, date: string | undefined, startTime: string | undefined): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'test',
    sourceSheet: 'Plan',
    sourceRange: 'A1',
    sourceKey: id,
    originalText: id,
    subject: `Przedmiot ${id}`,
    ...(date ? { date } : {}),
    ...(startTime ? { startTime, endTime: '12:00' } : {}),
    groupScope: 'SPECIFIC',
    groupTags: ['13B'],
    status: 'READY',
    warnings: [],
  };
}

describe('study preview calendar hotfix', () => {
  it('builds the same 42-day Monday-based month grid used by the calendar', () => {
    const grid = getStudyPreviewMonthGrid(new Date(2026, 7, 1));
    expect(grid).toHaveLength(42);
    expect(toLocalDateKey(grid[0] ?? new Date())).toBe('2026-07-27');
    expect(toLocalDateKey(grid[41] ?? new Date())).toBe('2026-09-06');
  });

  it('groups dated preview entries and sorts a day by start time', () => {
    const grouped = groupStudyPreviewEventsByDate([
      candidate('late', '2026-08-18', '12:00'),
      candidate('early', '2026-08-18', '08:00'),
      candidate('middle', '2026-08-18', '10:15'),
    ]);
    expect(getStudyPreviewDayEvents(grouped, '2026-08-18').map((item) => item.id)).toEqual(['early', 'middle', 'late']);
  });

  it('does not put undated source entries into fake calendar dates', () => {
    const values = [candidate('dated', '2026-08-18', '08:00'), candidate('unknown', undefined, undefined)];
    const grouped = groupStudyPreviewEventsByDate(values);
    expect([...grouped.keys()]).toEqual(['2026-08-18']);
    expect(undatedStudyPreviewCount(values)).toBe(1);
  });

  it('selects the first day with classes when navigating to a month that contains classes', () => {
    const grouped = groupStudyPreviewEventsByDate([
      candidate('b', '2026-08-20', '10:00'),
      candidate('a', '2026-08-05', '10:00'),
    ]);
    expect(selectStudyPreviewDateForMonth(new Date(2026, 7, 1), grouped, new Date(2026, 7, 15))).toBe('2026-08-05');
  });

  it('falls back to today or the first day of an empty month deterministically', () => {
    const grouped = groupStudyPreviewEventsByDate([]);
    expect(selectStudyPreviewDateForMonth(new Date(2026, 7, 1), grouped, new Date(2026, 7, 15))).toBe('2026-08-15');
    expect(selectStudyPreviewDateForMonth(new Date(2026, 8, 1), grouped, new Date(2026, 7, 15))).toBe('2026-09-01');
  });

  it('opens on the current month when that month has preview classes, otherwise on the first dated class', () => {
    const current = new Date(2026, 7, 15);
    expect(initialStudyPreviewMonth([candidate('now', '2026-08-20', '10:00')], current).getMonth()).toBe(7);
    const other = initialStudyPreviewMonth([candidate('later', '2026-10-02', '10:00')], current);
    expect(other.getFullYear()).toBe(2026);
    expect(other.getMonth()).toBe(9);
  });
});
