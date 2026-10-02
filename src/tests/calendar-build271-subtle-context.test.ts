import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calendarDayToneForDate, wumAcademicMarkerForDate } from '../calendar/calendar-overlays';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../planning/ConsistencyCenter.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

const layers = { showPolishHolidays: true, showWumAcademicCalendar: true };

describe('Build271 subtle commute and summer context', () => {
  it('keeps summer vacation secondary and lets the summer resit session win visually', () => {
    expect(wumAcademicMarkerForDate('2027-07-20')?.kind).toBe('WUM_VACATION');
    expect(calendarDayToneForDate('2027-07-20', layers)).toBe('VACATION');
    expect(wumAcademicMarkerForDate('2027-09-06')?.kind).toBe('WUM_SESSION');
    expect(calendarDayToneForDate('2027-09-06', layers)).toBe('SESSION');
    expect(styles).toContain('.calendar-day.vacation-period:not(.selected):not(.multi-selected)');
    expect(styles).toContain('background: var(--surface);');
    expect(calendar).not.toContain('calendar-academic-legend');
  });

  it('keeps soft commute hints informational instead of rendering them as conflicts', () => {
    expect(calendar).toContain("issue.type === 'TOUCHING' && issue.planningImpact === 'INFO'");
    expect(calendar).toContain('calendar-travel-hint');
    expect(consistency).toContain("TOUCHING:'Dojazd'");
    expect(consistency).toContain('Informacje pomocnicze');
    expect(consistency).toContain('consistency-center info-only');
    expect(consistency).toContain("issue.planningImpact !== 'INFO'");
  });
});
