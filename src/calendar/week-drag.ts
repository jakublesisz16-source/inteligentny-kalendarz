import type { CalendarEvent, EventDraft } from '../events/event.types';

const MINUTES_PER_DAY = 24 * 60;

function minuteOfDay(value: string): number {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeFromMinutes(minutes: number): string {
  const safe = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function canDragWeekEvent(event: CalendarEvent): boolean {
  return event.source === 'MANUAL'
    && !event.allDay
    && event.spanType === 'SINGLE_DAY'
    && !event.seriesId;
}

export function canResizeWeekEvent(event: CalendarEvent): boolean {
  return canDragWeekEvent(event);
}

export function weekEventStartMinutes(event: CalendarEvent): number | null {
  if (!canResizeWeekEvent(event)) return null;
  const start = minuteOfDay(event.startDateTime);
  return Number.isFinite(start) ? start : null;
}

export function weekEventDurationMinutes(event: CalendarEvent): number | null {
  if (!canDragWeekEvent(event)) return null;
  const start = minuteOfDay(event.startDateTime);
  const end = minuteOfDay(event.endDateTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return end - start;
}

export function computeWeekDropStartMinutes(input: {
  clientY: number;
  columnTop: number;
  hourHeight: number;
  startHour: number;
  endHour: number;
  durationMinutes: number;
  grabOffsetMinutes: number;
  snapMinutes?: number;
}): number | null {
  const { clientY, columnTop, hourHeight, startHour, endHour, durationMinutes, grabOffsetMinutes } = input;
  const snapMinutes = input.snapMinutes ?? 15;
  if (hourHeight <= 0 || durationMinutes <= 0 || snapMinutes <= 0) return null;
  const visibleStart = startHour * 60;
  const visibleEnd = endHour * 60;
  const latestStart = visibleEnd - durationMinutes;
  if (latestStart < visibleStart) return null;
  const rawPointerMinutes = visibleStart + ((clientY - columnTop) / hourHeight) * 60;
  const rawStart = rawPointerMinutes - grabOffsetMinutes;
  const snapped = Math.round(rawStart / snapMinutes) * snapMinutes;
  return Math.max(visibleStart, Math.min(latestStart, snapped));
}

export function computeWeekResizeEndMinutes(input: {
  clientY: number;
  columnTop: number;
  hourHeight: number;
  startHour: number;
  endHour: number;
  eventStartMinutes: number;
  minDurationMinutes?: number;
  snapMinutes?: number;
}): number | null {
  const { clientY, columnTop, hourHeight, startHour, endHour, eventStartMinutes } = input;
  const minDurationMinutes = input.minDurationMinutes ?? 15;
  const snapMinutes = input.snapMinutes ?? 15;
  if (hourHeight <= 0 || minDurationMinutes <= 0 || snapMinutes <= 0) return null;
  const visibleStart = startHour * 60;
  const visibleEnd = endHour * 60;
  if (eventStartMinutes < 0 || eventStartMinutes >= visibleEnd) return null;
  const rawPointerMinutes = visibleStart + ((clientY - columnTop) / hourHeight) * 60;
  const snapped = Math.round(rawPointerMinutes / snapMinutes) * snapMinutes;
  const earliestEnd = eventStartMinutes + minDurationMinutes;
  return Math.max(earliestEnd, Math.min(visibleEnd, snapped));
}

export function buildMovedWeekEventDraft(event: CalendarEvent, dateKey: string, startMinutes: number): EventDraft | null {
  const duration = weekEventDurationMinutes(event);
  if (!duration || startMinutes < 0 || startMinutes + duration >= MINUTES_PER_DAY) return null;
  const startTime = timeFromMinutes(startMinutes);
  const endTime = timeFromMinutes(startMinutes + duration);
  return {
    title: event.title,
    startDateTime: `${dateKey}T${startTime}`,
    endDateTime: `${dateKey}T${endTime}`,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: event.category,
    ...(event.description ? { description: event.description } : {}),
    ...(event.locationId ? { locationId: event.locationId } : {}),
    ...(event.locationText ? { locationText: event.locationText } : {}),
    ...(event.availabilityImpact ? { availabilityImpact: event.availabilityImpact } : {}),
  };
}

export function buildResizedWeekEventDraft(event: CalendarEvent, endMinutes: number): EventDraft | null {
  const startMinutes = weekEventStartMinutes(event);
  if (startMinutes === null || endMinutes <= startMinutes || endMinutes >= MINUTES_PER_DAY) return null;
  const dateKey = event.startDateTime.slice(0, 10);
  const startTime = timeFromMinutes(startMinutes);
  const endTime = timeFromMinutes(endMinutes);
  return {
    title: event.title,
    startDateTime: `${dateKey}T${startTime}`,
    endDateTime: `${dateKey}T${endTime}`,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: event.category,
    ...(event.description ? { description: event.description } : {}),
    ...(event.locationId ? { locationId: event.locationId } : {}),
    ...(event.locationText ? { locationText: event.locationText } : {}),
    ...(event.availabilityImpact ? { availabilityImpact: event.availabilityImpact } : {}),
  };
}
