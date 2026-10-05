import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarOverlayMarkersForDate } from '../calendar/calendar-overlays';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.110 mobile calendar overlay context', () => {
  it('keeps official marker data available for a selected WUM day', () => {
    expect(calendarOverlayMarkersForDate('2026-10-05', { showPolishHolidays: true, showWumAcademicCalendar: true }).map((marker) => marker.label)).toContain('WUM - dzień rektorski');
  });

  it('renders the mobile day preview even when a selected day has only an overlay marker', () => {
    expect(calendar).toContain('selectedEvents.length || selectedIncompleteStudyEntries.length || selectedDayOverlayMarkers.length');
    expect(calendar).toContain('calendar-mobile-day-preview-overlays');
    expect(calendar).toContain('Informacja o dniu');
    expect(calendar).toContain('marker.label');
    expect(responsive).toContain('1.2.0.110 - mobile calendar overlay meaning is visible after selecting a marked day.');
  });

  it('keeps day-off meaning visible in Today and preserves it when the calendar day is selected', () => {
    expect(today).toContain('className={`overlay-${marker.kind.toLowerCase()}`}');
    expect(refinement).toContain('.today-calendar-context .overlay-wum_rector_day');
    expect(refinement).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
    expect(refinement).toContain('.calendar-mobile-day-preview-overlays .overlay-polish_holiday');
    expect(refinement).toContain('var(--calendar-day-off-border)');
  });

  it('does not change the database schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
