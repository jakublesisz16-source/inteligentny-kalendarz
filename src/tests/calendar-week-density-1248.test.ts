import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.48 adaptive desktop week density', () => {
  it('fits the desktop week timeline to the available viewport height', () => {
    expect(calendar).toContain('function calculateWeekHourHeight(): number');
    expect(calendar).toContain('window.innerHeight - WEEK_DESKTOP_VERTICAL_CHROME');
    expect(calendar).toContain('const weekTimelineHeight = (WEEK_END_HOUR - WEEK_START_HOUR) * weekHourHeight');
    expect(calendar).toContain('buildWeekTimedEventLayout(timedEvents, key, WEEK_START_HOUR, WEEK_END_HOUR, weekHourHeight)');
  });

  it('does not squeeze the mobile planner', () => {
    expect(calendar).toContain("if (window.innerWidth <= 820) return WEEK_HOUR_HEIGHT;");
    expect(calendar).toContain('weekHourHeight < WEEK_HOUR_HEIGHT ? { height: weekTimelineHeight } : undefined');
  });

  it('uses a compact visual treatment only when desktop hours become dense', () => {
    expect(calendar).toContain("weekHourHeight < 40 ? ' compact-density' : ''");
    expect(css).toContain('/* 1.2.0.48 - adaptive desktop week density, without changing the selected-day panel */');
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
