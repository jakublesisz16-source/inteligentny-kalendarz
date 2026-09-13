import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { canResizeWeekEvent, computeWeekResizeEndMinutes } from '../calendar/week-drag';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

function manualEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'mobile-resize-1',
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

describe('1.2.0.76 explicit mobile week duration resize', () => {
  it('keeps the same safe manual-only resize guard on touch', () => {
    expect(canResizeWeekEvent(manualEvent())).toBe(true);
    expect(canResizeWeekEvent(manualEvent({ source: 'WORK_PDF' }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ source: 'UNIVERSITY_XLSX' }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ allDay: true }))).toBe(false);
    expect(canResizeWeekEvent(manualEvent({ seriesId: 'series-1', seriesType: 'MANUAL_MULTI_DATE' }))).toBe(false);
  });

  it('keeps 15-minute snapping and minimum duration for touch resize', () => {
    expect(computeWeekResizeEndMinutes({ clientY: 600, columnTop: 0, hourHeight: 48, startHour: 6, endHour: 23, eventStartMinutes: 13 * 60 })).toBe(1110);
    expect(computeWeekResizeEndMinutes({ clientY: 10, columnTop: 0, hourHeight: 48, startHour: 6, endHour: 23, eventStartMinutes: 13 * 60 })).toBe(795);
  });

  it('uses an explicit touch handle instead of another long-press gesture', () => {
    expect(calendar).toContain("const touchResizable = !desktopWeekDragEnabled && canResizeWeekEvent(event);");
    expect(calendar).toContain("touchResizable ? ' touch-resize-handle' : ''");
    expect(calendar).toContain('onTouchStart={(touchEvent) => touchEvent.stopPropagation()}');
    expect(calendar).toContain("weekResize?.inputMode === 'touch'");
    expect(calendar).toContain('Puść, aby ustawić czas');
  });

  it('gives the touch handle its own non-scrolling hit area without reserving label space', () => {
    expect(responsive).toContain('/* 1.2.0.74 - explicit mobile duration resize without stealing long-press drag */');
    expect(responsive).toContain('.calendar-week-resize-handle.touch-resize-handle');
    expect(responsive).toContain('height: min(18px, 100%);');
    expect(responsive).toContain('touch-action: none;');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
