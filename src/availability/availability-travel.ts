import type { CalendarEvent } from '../events/event.types';

/**
 * Returns the local travel allowance that should surround a blocking calendar event
 * when the optimizer searches for work hours. We intentionally do not call an
 * external routing service: the app remains local-first and the user controls one
 * simple commute allowance in Work settings.
 */
export function travelBufferMinutesForEvent(
  event: CalendarEvent,
  workLocationId: string | undefined,
  commuteMinutes: number,
): number {
  const safeMinutes = Math.max(0, Math.round(commuteMinutes));
  if (!safeMinutes || event.category === 'WORK') return 0;

  // If both sides explicitly point at the same saved place there is no commute.
  if (event.locationId && workLocationId && event.locationId === workLocationId) return 0;

  // Study is the key case: even when an imported timetable has incomplete location
  // metadata we still reserve the user's configured commute allowance.
  if (event.category === 'STUDY') return safeMinutes;

  // For other events reserve travel only when both locations are known and differ.
  if (event.locationId && workLocationId && event.locationId !== workLocationId) return safeMinutes;
  return 0;
}
