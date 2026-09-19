import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { findEventConflicts } from '../events/event-conflicts';

const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/App.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    title: 'Zajęcia',
    startDateTime: '2026-09-14T10:00',
    endDateTime: '2026-09-14T12:00',
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    availabilityImpact: 'BLOCKING',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('1.2.0.110 focused usability cleanup', () => {
  it('warns about real blocking overlaps without blocking on informational events or the edited event itself', () => {
    const draft = { startDateTime: '2026-09-14T11:00', endDateTime: '2026-09-14T13:00' };
    expect(findEventConflicts(draft, [event()])).toHaveLength(1);
    expect(findEventConflicts(draft, [event({ availabilityImpact: 'NON_BLOCKING' })])).toHaveLength(0);
    expect(findEventConflicts(draft, [event()], 'event-1')).toHaveLength(0);
    expect(findEventConflicts({ startDateTime: '2026-09-14T12:00', endDateTime: '2026-09-14T13:00' }, [event()])).toHaveLength(0);
  });

  it('adds a compact Today glance dashboard and passes calendar context into the event editor', () => {
    expect(today).toContain('today-glance-grid');
    expect(today).toContain('Najbliższe zajęcia');
    expect(today).toContain('Najbliższa praca');
    expect(today).toContain('calendarOverlayMarkersForDate');
    expect(app).toContain('showPolishHolidays={settings.showPolishHolidays !== false}');
    expect(app).toContain('calendarEvents={events}');
    expect(css).toContain('.today-glance-grid');
    expect(css).toContain('.event-conflict-warning');
  });

  it('keeps receipt scanning in Month but removes it from the Trip UI', () => {
    expect(finance.match(/Skanuj paragon/g)?.length).toBe(1);
    expect(finance).toContain("financeScope === 'MONTH'");
    expect(finance).toContain('activeTripName && !isEmptyActiveTrip');
  });

  it('exposes calendar overlay meaning to assistive technology without making the markers visually louder', () => {
    expect(calendar).toContain('className="calendar-overlay-dots" role="img"');
    expect(calendar).toContain("aria-label={overlayMarkers.map((marker) => marker.label).join(', ')}");
    expect(calendar).toContain('aria-hidden="true"');
  });

  it('keeps schema unchanged', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
