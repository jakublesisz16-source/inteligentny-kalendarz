import { describe, expect, it } from 'vitest';
import { eventOccursOnDate, indexEventsForDateKeys, sortEventsForDay } from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';

function exampleEvent(id: string, from: string, to: string, title = id, allDay = false): CalendarEvent {
  return {
    id, title, startDateTime: from, endDateTime: to, allDay,
    spanType: from.slice(0, 10) === to.slice(0, 10) ? 'SINGLE_DAY' : 'MULTI_DAY',
    category: 'STUDY', source: 'UNIVERSITY_XLSX',
    createdAt: '2026-10-01T08:00:00', updatedAt: '2026-10-01T08:00:00',
  };
}

function legacyForDate(events: CalendarEvent[], key: string): string[] {
  return sortEventsForDay(events.filter((event) => eventOccursOnDate(event, key))).map((event) => event.id);
}

describe('month/week/selected-day event index parity', () => {
  it('preserves sorting, duplicates, empty dates and multi-day spans', () => {
    const events = [
      exampleEvent('later', '2026-10-22T11:00:00', '2026-10-22T12:00:00'),
      exampleEvent('early', '2026-10-22T08:00:00', '2026-10-22T09:00:00'),
      exampleEvent('long', '2026-09-28T16:00:00', '2026-11-02T09:00:00'),
      exampleEvent('all-day', '2026-10-22T00:00:00', '2026-10-22T23:59:00', 'Cały dzień', true),
      exampleEvent('next', '2026-10-23T08:00:00', '2026-10-23T09:00:00'),
      exampleEvent('backwards', '2026-10-24T18:00:00', '2026-10-23T09:00:00'),
    ];
    const keys = ['2026-10-31', '2026-10-22', '2026-10-23', '2026-10-22', '2026-11-03', '2026-09-29'];
    const indexed = indexEventsForDateKeys(events, keys);
    expect(indexed.size).toBe(5);
    for (const key of new Set(keys)) expect(indexed.get(key)?.map((event) => event.id)).toEqual(legacyForDate(events, key));
    expect(indexed.get('2026-10-22')?.map((event) => event.id)).toEqual(['all-day', 'long', 'early', 'later']);
  });

  it('matches legacy scan over realistic month/week grids and large data sets', () => {
    const events = Array.from({ length: 1500 }, (_, index) => {
      const from = new Date(2026, 9, 1 + (index % 61), 6 + index % 12);
      const to = new Date(from);
      to.setDate(to.getDate() + (index % 9 === 0 ? 12 : index % 7 === 0 ? 2 : 0));
      return exampleEvent(`event-${index}`, `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}T${String(from.getHours()).padStart(2, '0')}:00:00`, `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}T${String(to.getHours()).padStart(2, '0')}:30:00`);
    });
    const keys = Array.from({ length: 42 }, (_, index) => {
      const day = new Date(2026, 8, 28 + index);
      return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    });
    const indexed = indexEventsForDateKeys(events, keys);
    for (const key of keys) expect(indexed.get(key)?.map((event) => event.id)).toEqual(legacyForDate(events, key));
  });
});
