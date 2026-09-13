import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { buildMovedWeekEventDraft, canDragWeekEvent, computeWeekDropStartMinutes } from '../calendar/week-drag';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');

function manualEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'manual-1',
    title: 'Spacer',
    startDateTime: '2026-09-12T10:00',
    endDateTime: '2026-09-12T11:30',
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'PERSONAL',
    source: 'MANUAL',
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    ...overrides,
  };
}

describe('1.2.0.63 safe week drag and drop', () => {
  it('allows only simple manual timed events in the first stage', () => {
    expect(canDragWeekEvent(manualEvent())).toBe(true);
    expect(canDragWeekEvent(manualEvent({ source: 'WORK_PDF' }))).toBe(false);
    expect(canDragWeekEvent(manualEvent({ source: 'UNIVERSITY_XLSX' }))).toBe(false);
    expect(canDragWeekEvent(manualEvent({ allDay: true }))).toBe(false);
    expect(canDragWeekEvent(manualEvent({ seriesId: 'series-1', seriesType: 'MANUAL_MULTI_DATE' }))).toBe(false);
  });

  it('preserves duration and event metadata when moved to another day', () => {
    const draft = buildMovedWeekEventDraft(manualEvent({ locationText: 'Wawel', availabilityImpact: 'BLOCKING' }), '2026-09-14', 14 * 60 + 15);
    expect(draft?.startDateTime).toBe('2026-09-14T14:15');
    expect(draft?.endDateTime).toBe('2026-09-14T15:45');
    expect(draft?.locationText).toBe('Wawel');
    expect(draft?.availabilityImpact).toBe('BLOCKING');
  });

  it('snaps drop time to 15 minutes and keeps the event inside the visible day', () => {
    expect(computeWeekDropStartMinutes({ clientY: 115, columnTop: 100, hourHeight: 60, startHour: 6, endHour: 23, durationMinutes: 60, grabOffsetMinutes: 0 })).toBe(375);
    expect(computeWeekDropStartMinutes({ clientY: 5000, columnTop: 100, hourHeight: 60, startHour: 6, endHour: 23, durationMinutes: 120, grabOffsetMinutes: 0 })).toBe(1260);
  });

  it('wires native desktop drag without enabling imported event movement', () => {
    expect(calendar).toContain("draggable={draggable && !resizeState}");
    expect(calendar).toContain('onDragStart={(dragEvent) => startWeekEventDrag(dragEvent, event)}');
    expect(calendar).toContain('onDrop={(event) => { void dropWeekEvent(event, key); }}');
    expect(app).toContain("if (event.source !== 'MANUAL' || event.allDay || event.spanType !== 'SINGLE_DAY' || event.seriesId) return;");
    expect(css).toContain('1.2.0.63 - safe desktop drag and drop for manual week events');
    expect(responsive).toContain('1.2.0.64 - long-press drag and drop for safe manual week events on mobile');
  });
});
