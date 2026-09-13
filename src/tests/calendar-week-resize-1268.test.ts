import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { buildResizedWeekEventDraft, canResizeWeekEvent, computeWeekResizeEndMinutes } from '../calendar/week-drag';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

function manualEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'manual-resize-1',
    title: 'Spotkanie',
    startDateTime: '2026-09-14T13:00',
    endDateTime: '2026-09-14T14:00',
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'PERSONAL',
    source: 'MANUAL',
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    ...overrides,
  };
}

describe('1.2.0.68 safe desktop week duration resize', () => {
  it('allows resize only for simple non-series manual timed events', () => {
    expect(canResizeWeekEvent(manualEvent())).toBe(true);
    expect(canResizeWeekEvent(manualEvent({ source: 'WORK_PDF' }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ source: 'UNIVERSITY_XLSX' }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ allDay: true }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ spanType: 'MULTI_DAY' }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ seriesId: 'series-1', seriesType: 'MANUAL_MULTI_DATE' }))).toBe(false);
  });

  it('snaps the end to 15 minutes and enforces a 15 minute minimum duration', () => {
    expect(computeWeekResizeEndMinutes({ clientY: 585, columnTop: 0, hourHeight: 60, startHour: 6, endHour: 23, eventStartMinutes: 13 * 60 })).toBe(945);
    expect(computeWeekResizeEndMinutes({ clientY: 20, columnTop: 0, hourHeight: 60, startHour: 6, endHour: 23, eventStartMinutes: 13 * 60 })).toBe(795);
    expect(computeWeekResizeEndMinutes({ clientY: 5000, columnTop: 0, hourHeight: 60, startHour: 6, endHour: 23, eventStartMinutes: 13 * 60 })).toBe(1380);
  });

  it('changes only the end time and preserves event metadata', () => {
    const draft = buildResizedWeekEventDraft(manualEvent({ locationText: 'Biblioteka', availabilityImpact: 'BLOCKING' }), 15 * 60 + 45);
    expect(draft?.startDateTime).toBe('2026-09-14T13:00');
    expect(draft?.endDateTime).toBe('2026-09-14T15:45');
    expect(draft?.locationText).toBe('Biblioteka');
    expect(draft?.availabilityImpact).toBe('BLOCKING');
  });

  it('wires a desktop-only bottom resize handle and live time preview', () => {
    expect(calendar).toContain('startWeekResize');
    expect(calendar).toContain("calendar-week-resize-handle${touchResizable ? ' touch-resize-handle' : ''}");
    expect(calendar).toContain('previewEndMinutes');
    expect(calendar).toContain('formatMinuteTime(resizeState.startMinutes)');
    expect(css).toContain('/* 1.2.0.68 - desktop duration resize for safe manual week events */');
    expect(css).toContain('@media (min-width: 821px)');
    expect(css).toContain('cursor: ns-resize');
  });

  it('keeps the database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
