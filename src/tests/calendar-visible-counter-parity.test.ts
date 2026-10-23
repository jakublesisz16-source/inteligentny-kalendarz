import { describe, expect, it } from 'vitest';
import { categoryCountsByDate, categoryCountsForVisibleEvents } from '../calendar/category-counters';
import { indexEventsForDateKeys } from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';

const categories: CalendarEvent['category'][] = ['STUDY', 'WORK', 'PERSONAL', 'OTHER'];
function sample(id: number, start: string, end: string): CalendarEvent {
  return { id: String(id), title: `Zajecia ${id}`, category: categories[id % categories.length]!,
    source: 'MANUAL', allDay: id % 7 === 0, spanType: start.slice(0, 10) === end.slice(0, 10) ? 'SINGLE_DAY' : 'MULTI_DAY',
    startDateTime: start, endDateTime: end, createdAt: start, updatedAt: end };
}
function assertParity(events: CalendarEvent[], keys: string[]) {
  const previous = categoryCountsByDate(events);
  const indexed = indexEventsForDateKeys(events, keys);
  const next = categoryCountsForVisibleEvents(indexed);
  for (const key of keys) {
    expect(next.get(key)).toEqual(previous.get(key));
    expect(indexed.get(key)?.length ?? 0).toBeGreaterThanOrEqual(next.get(key)
      ? Object.values(next.get(key)!).reduce((a, b) => a + b, 0) : 0);
  }
}

describe('shared calendar event index -> month category counters', () => {
  it('agrees with legacy counts, including duplicates, all-day, multi-day, empty and invalid reversed spans', () => {
    const events = [
      sample(1, '2026-10-22T09:00', '2026-10-22T10:00'),
      sample(2, '2026-10-22T11:00', '2026-10-22T12:00'),
      sample(3, '2026-10-20T09:00', '2026-10-24T18:00'),
      sample(4, '2026-10-24T12:00', '2026-10-22T14:00'),
      sample(5, '2026-09-01T00:00', '2026-11-30T23:59'),
    ];
    assertParity(events, ['2026-10-22', '2026-10-23', '2026-10-22', '2026-11-02', '2026-12-01']);
  });
  it('agrees across 42-day grids with 1500 mixed events', () => {
    const events = Array.from({ length: 1500 }, (_, i) => {
      const from = new Date(2026, 8, 1 + i % 90, 7 + i % 12);
      const to = new Date(from);
      to.setDate(to.getDate() + (i % 11 === 0 ? 20 : i % 3));
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`;
      return sample(i, iso(from), iso(to));
    });
    const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(2026, 9, 1 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    assertParity(events, days);
  });
  it('retains legacy 3660-day counter cap while preserving indexed event visibility', () => {
    const events = [sample(8, '2010-01-01T00:00', '2028-12-31T23:59')];
    assertParity(events, ['2010-01-01', '2020-01-01', '2026-10-22']);
  });
});
