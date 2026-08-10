import { eventDateKeys } from './date.utils';
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
