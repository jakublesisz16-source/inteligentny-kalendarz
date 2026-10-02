import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { buildWeekTimedEventLayout } from '../calendar/week-layout';

function event(id: string, start: string, end: string, allDay = false): CalendarEvent {
  return {
    id,
    title: id,
    startDateTime: start,
    endDateTime: end,
    allDay,
    spanType: 'SINGLE_DAY',
    category: 'PERSONAL',
    source: 'MANUAL',
    createdAt: '2026-09-12T00:00:00',
    updatedAt: '2026-09-12T00:00:00',
  };
}

describe('1.2.0.44 weekly planner layout', () => {
  it('keeps non-overlapping events at full width', () => {
    const layout = buildWeekTimedEventLayout([
      event('a', '2026-09-14T09:00', '2026-09-14T10:00'),
      event('b', '2026-09-14T10:00', '2026-09-14T11:00'),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.get('a')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: false, overlapSegments: [] });
    expect(layout.get('b')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: false, overlapSegments: [] });
  });

  it('keeps overlapping events full width and marks only the shared time range', () => {
    const layout = buildWeekTimedEventLayout([
      event('a', '2026-09-14T09:00', '2026-09-14T11:00'),
      event('b', '2026-09-14T09:30', '2026-09-14T10:30'),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.get('a')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: true });
    expect(layout.get('a')?.overlapSegments[0]).toEqual({ topPercent: 25, heightPercent: 50 });
    expect(layout.get('b')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: true });
    expect(layout.get('b')?.overlapSegments[0]).toEqual({ topPercent: 0, heightPercent: 100 });
  });

  it('does not treat touching events as overlapping while preserving overlap with a longer event', () => {
    const layout = buildWeekTimedEventLayout([
      event('a', '2026-09-14T09:00', '2026-09-14T12:00'),
      event('b', '2026-09-14T09:00', '2026-09-14T10:00'),
      event('c', '2026-09-14T10:00', '2026-09-14T11:00'),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.get('a')).toMatchObject({ widthPercent: 100, overlapping: true });
    expect(layout.get('b')).toMatchObject({ widthPercent: 100, overlapping: true });
    expect(layout.get('c')).toMatchObject({ widthPercent: 100, overlapping: true });
    expect(layout.get('a')?.overlapSegments).toHaveLength(1);
    expect(layout.get('a')?.overlapSegments[0]?.topPercent).toBe(0);
    expect(layout.get('a')?.overlapSegments[0]?.heightPercent).toBeCloseTo(66.6666666667);
  });

  it('keeps all-day events outside the timed layout', () => {
    const layout = buildWeekTimedEventLayout([
      event('all-day', '2026-09-14T00:00', '2026-09-14T23:59', true),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.has('all-day')).toBe(false);
  });
});
