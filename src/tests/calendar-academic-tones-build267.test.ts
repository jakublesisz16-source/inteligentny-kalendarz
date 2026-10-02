import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarDayToneForDate, isKnownStudyDayOff, wumAcademicMarkerForDate } from '../calendar/calendar-overlays';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

const allLayers = { showPolishHolidays: true, showWumAcademicCalendar: true };

describe('Build267 academic calendar tones', () => {
  it('marks statutory and WUM no-class days with the subtle day-off tone', () => {
    expect(calendarDayToneForDate('2026-11-11', allLayers)).toBe('DAY_OFF');
    expect(calendarDayToneForDate('2026-10-05', allLayers)).toBe('DAY_OFF');
    expect(calendarDayToneForDate('2026-12-21', allLayers)).toBe('DAY_OFF');
    expect(isKnownStudyDayOff('2026-11-11')).toBe(true);
    expect(isKnownStudyDayOff('2027-03-29')).toBe(true);
  });

  it('marks official 2026/2027 exam sessions separately without treating them as automatic days off', () => {
    expect(wumAcademicMarkerForDate('2027-02-03')?.label).toContain('sesja egzaminacyjna zimowa');
    expect(wumAcademicMarkerForDate('2027-02-18')?.label).toContain('sesja poprawkowa zimowa');
    expect(wumAcademicMarkerForDate('2027-06-28')?.label).toContain('sesja egzaminacyjna letnia');
    expect(wumAcademicMarkerForDate('2027-09-06')?.label).toContain('sesja poprawkowa letnia');
    expect(calendarDayToneForDate('2027-02-03', allLayers)).toBe('SESSION');
    expect(calendarDayToneForDate('2027-09-06', allLayers)).toBe('SESSION');
    expect(calendarDayToneForDate('2027-07-20', allLayers)).toBe('VACATION');
    expect(isKnownStudyDayOff('2027-02-03')).toBe(false);
  });

  it('renders the month-cell tones as owned subtle surfaces and preserves selected-day priority', () => {
    expect(calendar).toContain("dayTone === 'DAY_OFF' ? ' day-off'");
    expect(calendar).toContain("dayTone === 'SESSION' ? ' session-period'");
    expect(calendar).toContain("dayTone === 'VACATION' ? ' vacation-period'");
    expect(styles).toContain('.calendar-day.day-off:not(.selected):not(.multi-selected)');
    expect(styles).toContain('.calendar-day.session-period:not(.selected):not(.multi-selected)');
    expect(styles).toContain('.calendar-day.vacation-period:not(.selected):not(.multi-selected)');
    expect(styles).toContain('.overlay-wum_session');
    expect(styles).toContain('var(--calendar-day-off) 86%');
    expect(styles).toContain('var(--calendar-session) 46%');
    expect(styles).toContain('var(--calendar-vacation-border) 72%');
    expect(calendar).toContain('const exceptionalOverlayMarkers = dayTone ? [] : overlayMarkers;');
    expect(styles).toContain('.calendar-week-day-heading.day-off:not(.selected)');
    expect(styles).toContain('.calendar-week-day-heading.session-period:not(.selected)');
    expect(styles).toContain('.calendar-week-day-heading.vacation-period:not(.selected)');
  });
});
