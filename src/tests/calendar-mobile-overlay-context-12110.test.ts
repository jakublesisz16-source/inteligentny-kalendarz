import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarOverlayMarkersForDate } from '../calendar/calendar-overlays';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
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

  it('does not change the database schema', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
