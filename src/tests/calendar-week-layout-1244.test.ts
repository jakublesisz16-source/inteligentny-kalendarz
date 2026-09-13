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

    expect(layout.get('a')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: false });
    expect(layout.get('b')).toMatchObject({ leftPercent: 0, widthPercent: 100, overlapping: false });
  });

  it('places overlapping events side by side instead of hiding one behind another', () => {
    const layout = buildWeekTimedEventLayout([
      event('a', '2026-09-14T09:00', '2026-09-14T11:00'),
      event('b', '2026-09-14T09:30', '2026-09-14T10:30'),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.get('a')).toMatchObject({ leftPercent: 0, widthPercent: 50, overlapping: true });
    expect(layout.get('b')).toMatchObject({ leftPercent: 50, widthPercent: 50, overlapping: true });
  });

  it('reuses a free overlap column when touching events do not overlap', () => {
    const layout = buildWeekTimedEventLayout([
      event('a', '2026-09-14T09:00', '2026-09-14T12:00'),
      event('b', '2026-09-14T09:00', '2026-09-14T10:00'),
      event('c', '2026-09-14T10:00', '2026-09-14T11:00'),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.get('a')?.widthPercent).toBe(50);
    expect(layout.get('b')?.leftPercent).toBe(50);
    expect(layout.get('c')?.leftPercent).toBe(50);
  });

  it('keeps all-day events outside the timed layout', () => {
    const layout = buildWeekTimedEventLayout([
      event('all-day', '2026-09-14T00:00', '2026-09-14T23:59', true),
    ], '2026-09-14', 6, 23, 48);

    expect(layout.has('all-day')).toBe(false);
  });
});
