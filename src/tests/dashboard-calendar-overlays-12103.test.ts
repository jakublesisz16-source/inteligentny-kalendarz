import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calendarOverlayMarkersForDate, polishHolidayForDate, wumAcademicMarkerForDate } from '../calendar/calendar-overlays';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('1.2.0.103 dashboard continuation and calendar overlays', () => {
  it('moves Today add action below existing agenda instead of keeping it in the header', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).toContain('today-add-row');
    expect(today).toContain('+ Dodaj');
    expect(today).not.toContain('+ Dodaj wydarzenie');
    expect(today).not.toContain('today-header-actions');
  });

  it('keeps empty trips to one central create action', () => {
    const finance = source('../finance/FinanceDashboardView.tsx');
    expect(finance).toContain('!newTripOpen && tripSummaries.length');
    expect(finance).toContain('Utwórz pierwszy wyjazd, a jego wydatki będą zebrane w jednym miejscu.');
  });

  it('recognizes statutory Polish holidays including movable dates and Christmas Eve', () => {
    expect(polishHolidayForDate('2026-04-05')?.label).toBe('Wielkanoc');
    expect(polishHolidayForDate('2026-04-06')?.label).toBe('Poniedziałek Wielkanocny');
    expect(polishHolidayForDate('2026-12-24')?.label).toBe('Wigilia Bożego Narodzenia');
    expect(polishHolidayForDate('2027-05-27')?.label).toBe('Boże Ciało');
  });

  it('marks only official WUM 2026/2027 rector day and academic break ranges', () => {
    expect(wumAcademicMarkerForDate('2026-10-05')?.kind).toBe('WUM_RECTOR_DAY');
    expect(wumAcademicMarkerForDate('2026-12-21')?.label).toContain('przerwa świąteczna');
    expect(wumAcademicMarkerForDate('2027-02-10')?.label).toContain('przerwa semestralna');
    expect(wumAcademicMarkerForDate('2026-10-06')).toBeUndefined();
  });

  it('respects independent overlay visibility settings', () => {
    expect(calendarOverlayMarkersForDate('2026-12-25', { showPolishHolidays: true, showWumAcademicCalendar: true })).toHaveLength(2);
    expect(calendarOverlayMarkersForDate('2026-12-25', { showPolishHolidays: true, showWumAcademicCalendar: false })).toHaveLength(1);
    expect(calendarOverlayMarkersForDate('2026-12-25', { showPolishHolidays: false, showWumAcademicCalendar: false })).toHaveLength(0);
  });

  it('keeps settings history dashboard short by default', () => {
    const safety = source('../safety/SafetyCenter.tsx');
    expect(safety).toContain('journal.slice(0, showAllHistory ? journal.length : 5)');
    expect(safety).toContain('Pokaż całą historię');
  });
});
