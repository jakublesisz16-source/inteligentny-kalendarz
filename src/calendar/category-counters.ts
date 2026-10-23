import { addDaysToDateKey, eventDateKeys } from './date.utils';
import type { CalendarEvent, EventCategory } from '../events/event.types';

export type CategoryCounts = Record<EventCategory, number>;

export function categoryCountsByDate(events: CalendarEvent[]): Map<string, CategoryCounts> {
  const byDate = new Map<string, CategoryCounts>();
  for (const event of events) {
    for (const date of new Set(eventDateKeys(event))) {
      const counts = byDate.get(date) ?? { STUDY: 0, WORK: 0, PERSONAL: 0, OTHER: 0 };
      counts[event.category] += 1;
      byDate.set(date, counts);
    }
  }
  return byDate;
}

/**
 * Counts only dates already requested by CalendarView. Reuses its shared event index
 * instead of traversing the complete event history a second time. The legacy
 * eventDateKeys limit (3660 dates per event) is retained for unusually long spans.
 */
export function categoryCountsForVisibleEvents(index: ReadonlyMap<string, readonly CalendarEvent[]>): Map<string, CategoryCounts> {
  const countsByDate = new Map<string, CategoryCounts>();
  for (const [date, dayEvents] of index) {
    if (!dayEvents.length) continue;
    const counts: CategoryCounts = { STUDY: 0, WORK: 0, PERSONAL: 0, OTHER: 0 };
    for (const event of dayEvents) {
      // Dates beyond the original 3660-day source limit did not have counters.
      // Ordinary durations avoid date arithmetic entirely.
      if (Number(event.endDateTime.slice(0, 4)) - Number(event.startDateTime.slice(0, 4)) >= 10
        && date > addDaysToDateKey(event.startDateTime.slice(0, 10), 3659)) continue;
      counts[event.category] += 1;
    }
    if (counts.STUDY + counts.WORK + counts.PERSONAL + counts.OTHER > 0) countsByDate.set(date, counts);
  }
  return countsByDate;
}
