import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build239 mobile Calendar full-week readability', () => {
  it('keeps all seven day timelines visible on phone while preserving a compact selected-day preview', () => {
    expect(refinement).toContain('Build239 - mobile Week keeps the whole seven-day planner visible');
    expect(refinement).toContain('grid-template-columns: 32px repeat(7, minmax(0, 1fr));');
    expect(refinement).toContain('grid-template-columns: repeat(7, minmax(0, 1fr));');
    expect(refinement).toContain('.calendar-week-column,');
    expect(refinement).toContain('.calendar-week-column.selected {');
    expect(calendar).toContain("displayMode === 'WEEK' ? ' calendar-mobile-week-preview' : ''");
  });

  it('uses a readable scroll density and compact event codes instead of full titles in narrow columns', () => {
    expect(calendar).toContain('const WEEK_MOBILE_HOUR_HEIGHT = 38;');
    expect(calendar).toContain('return WEEK_MOBILE_HOUR_HEIGHT;');
    expect(calendar).toContain('function mobileWeekEventLabel(event: CalendarEvent): string');
    expect(calendar).toContain('data-mobile-label={mobileWeekEventLabel(event)}');
    expect(refinement).toContain('height: clamp(380px, calc(100dvh - 430px), 590px);');
    expect(refinement).toContain('overflow-y: auto;');
    expect(refinement).toContain('attr(data-mobile-time-start)');
    expect(refinement).toContain('attr(data-mobile-time-end)');
    expect(refinement).toContain('content: attr(data-mobile-label) !important;');
  });

  it('opens the existing detail sheet after tapping a Week event without changing desktop behavior', () => {
    expect(calendar).toContain("window.innerWidth <= 620) setMobileDayPanelOpen(true)");
    expect(calendar).toContain('onClick={(clickEvent) => selectWeekEventDay(clickEvent, day)}');
  });

  it('keeps the 1.2.0 release line and database schema 14', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
