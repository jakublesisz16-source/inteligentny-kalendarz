import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.56 mobile month day sheet', () => {
  it('keeps the day sheet available only behind an explicit details action', () => {
    expect(calendar).toContain('const [mobileDayPanelOpen, setMobileDayPanelOpen] = useState(false)');
    expect(calendar).toContain('calendar-mobile-day-preview-event');
    expect(calendar).toContain('onClick={() => setMobileDayPanelOpen(true)}');
    expect(calendar).toContain('calendar-mobile-day-backdrop');
    expect(calendar).toContain("selected-day-panel${mobileDayPanelOpen ? ' mobile-open' : ''}");
  });

  it('provides an explicit close control and hides the static mobile side panel', () => {
    expect(calendar).toContain('aria-label="Zamknij szczegóły dnia"');
    expect(responsive).toContain('.calendar-view-shell .calendar-side-column .selected-day-panel {');
    expect(responsive).toContain('.calendar-view-shell .calendar-side-column .selected-day-panel.mobile-open');
    expect(responsive).toContain('position: fixed;');
  });

  it('keeps Today as a lighter agenda without hiding work-team context', () => {
    expect(responsive).toContain('.today-view.has-plan .today-plan-panel');
    expect(calendar).toContain('showAllWorkCoworkers');
  });

  it('does not change the database schema', () => {
    expect(components).toContain('/* 1.2.0.56 - mobile month details behave like a lightweight day sheet */');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
