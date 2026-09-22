import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { upcomingEvent } from '../calendar/TodayView';

function event(id: string, startDateTime: string, endDateTime: string): CalendarEvent {
  return {
    id,
    title: id,
    startDateTime,
    endDateTime,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'WORK',
    source: 'MANUAL',
    createdAt: '2026-09-01T00:00:00',
    updatedAt: '2026-09-01T00:00:00',
  };
}

describe('Build193 Today and Work mobile stability', () => {
  it('keeps the Today next strip from duplicating an event already visible in today agenda', () => {
    const now = new Date('2026-09-22T07:01:00');
    const todayShift = event('today-shift', '2026-09-22T14:00:00', '2026-09-22T22:00:00');
    const tomorrowShift = event('tomorrow-shift', '2026-09-23T08:00:00', '2026-09-23T16:00:00');

    expect(upcomingEvent([todayShift, tomorrowShift], now)?.id).toBe('today-shift');
    expect(upcomingEvent([todayShift, tomorrowShift], now, '2026-09-22')?.id).toBe('tomorrow-shift');
  });

  it('wires the exclusion only when Today already renders event cards', () => {
    const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
    expect(today).toContain('upcomingEvent(events, today, todayEvents.length ? todayKey : undefined)');
  });

  it('keeps the coworker-count summary anchored on the right before and after expanding', () => {
    const css = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
    expect(css).toContain('.work-shift-team-details {\n    width: 100%;\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) auto;\n    justify-self: stretch;');
    expect(css).toContain('.work-shift-team-details > summary {\n    grid-column: 2;\n    justify-self: end;');
    expect(css).toContain('.work-shift-team-details .coworker-overlap-list.compact {\n    grid-column: 1 / -1;\n    grid-row: 2;');
  });
});
