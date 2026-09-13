import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const components = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.50 compact calendar study context placement', () => {
  it('moves active Study group context into the right calendar column below the selected-day panel', () => {
    expect(calendar).toContain('calendar-side-column');
    expect(calendar).toContain('calendar-side-study-context');
    const sideColumnIndex = calendar.indexOf('calendar-side-column');
    const selectedPanelIndex = calendar.indexOf('selected-day-panel${mobileDayPanelOpen', sideColumnIndex);
    const studyContextIndex = calendar.indexOf('calendar-side-study-context', sideColumnIndex);
    expect(sideColumnIndex).toBeGreaterThan(-1);
    expect(selectedPanelIndex).toBeGreaterThan(sideColumnIndex);
    expect(studyContextIndex).toBeGreaterThan(selectedPanelIndex);
  });

  it('keeps the Study context compact and responsive instead of consuming vertical space above the calendar', () => {
    expect(components).toContain('/* 1.2.0.50 - move Study context out of the main calendar vertical flow */');
    expect(components).toContain('.calendar-side-column');
    expect(components).toContain('.calendar-side-study-context');
    expect(responsive).toContain('/* 1.2.0.50 - compact side Study context */');
    expect(calendar).toContain('const WEEK_DESKTOP_VERTICAL_CHROME = 225;');
  });

  it('does not change the database schema', () => {
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
