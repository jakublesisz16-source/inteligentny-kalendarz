import type { CalendarEvent, EventDraft } from './event.types';

export interface EventConflict {
  event: CalendarEvent;
  overlapStartDateTime: string;
  overlapEndDateTime: string;
}

function asMillis(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function findEventConflicts(
  draft: Pick<EventDraft, 'startDateTime' | 'endDateTime'>,
  events: CalendarEvent[],
  excludeEventId?: string,
): EventConflict[] {
  const draftStart = asMillis(draft.startDateTime);
  const draftEnd = asMillis(draft.endDateTime);
  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd) || draftEnd <= draftStart) return [];

  return events
    .filter((event) => event.id !== excludeEventId && event.availabilityImpact !== 'NON_BLOCKING')
    .map((event) => {
      const eventStart = asMillis(event.startDateTime);
      const eventEnd = asMillis(event.endDateTime);
      if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd) || eventEnd <= draftStart || eventStart >= draftEnd) return null;
      return {
        event,
        overlapStartDateTime: eventStart > draftStart ? event.startDateTime : draft.startDateTime,
        overlapEndDateTime: eventEnd < draftEnd ? event.endDateTime : draft.endDateTime,
      } satisfies EventConflict;
    })
    .filter((item): item is EventConflict => Boolean(item))
    .sort((a, b) => a.overlapStartDateTime.localeCompare(b.overlapStartDateTime) || a.event.title.localeCompare(b.event.title, 'pl'));
}
