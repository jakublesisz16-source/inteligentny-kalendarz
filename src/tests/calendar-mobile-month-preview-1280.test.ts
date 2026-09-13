import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.80 mobile month selection and inline day preview', () => {
  it('never auto-opens day details when a month date is tapped', () => {
    const start = calendar.indexOf('function selectDay(day: Date)');
    const end = calendar.indexOf('function addAtHour(day: Date, hour: number)', start);
    const block = calendar.slice(start, end);
    expect(block).toContain("if (displayMode === 'MONTH') setMobileDayPanelOpen(false)");
    expect(block).not.toContain('setMobileDayPanelOpen(true)');
    expect(block).not.toContain('hasVisibleEvent');
  });

  it('shows a lightweight inline preview for selected dates with visible content', () => {
    expect(calendar).toContain('calendar-mobile-day-preview');
    expect(calendar).toContain('calendar-mobile-day-preview-event');
    expect(calendar).toContain('selectedEvents.slice(0, 3)');
    expect(calendar).toContain('Pokaż szczegóły');
    expect(calendar).toContain('Otwórz szczegóły wydarzenia');
  });

  it('opens the existing details sheet only from an explicit preview action and keeps add in the header', () => {
    expect(calendar).toContain('onClick={() => setMobileDayPanelOpen(true)}');
    expect(calendar).toContain('calendar-mobile-explicit-add');
    expect(responsive).toContain('.calendar-view-shell .selected-day-panel.mobile-open .selected-day-quick-actions { display: none; }');
  });

  it('keeps the preview phone-only and visually lightweight', () => {
    expect(components).toContain('/* 1.2.0.80 - mobile month date selection stays separate from event details */');
    expect(components).toContain('.calendar-mobile-day-preview { display: none; }');
    expect(responsive).toContain('/* 1.2.0.80 - tapping a month date only selects it; event rows are the explicit detail action. */');
    expect(responsive).toContain('.calendar-mobile-day-preview-event:first-child { border-top: 0; }');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
