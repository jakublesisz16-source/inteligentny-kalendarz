import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.72 mobile month selection is not creation', () => {
  it('keeps every mobile month day as selection only', () => {
    const start = calendar.indexOf('function selectDay(day: Date)');
    const end = calendar.indexOf('function addAtHour(day: Date, hour: number)', start);
    const block = calendar.slice(start, end);
    expect(block).toContain("if (displayMode === 'MONTH') setMobileDayPanelOpen(false)");
    expect(block).not.toContain('hasVisibleEvent');
    expect(block).not.toContain('hasVisibleIncompleteStudy');
    expect(block).not.toContain('onAdd(');
  });

  it('provides a separate explicit add action in the mobile month header', () => {
    expect(calendar).toContain('calendar-mobile-explicit-add');
    expect(calendar).toContain("displayMode === 'MONTH'");
    expect(calendar).toContain('onClick={() => onAdd(selectedDate)}>+ Dodaj</button>');
    expect(responsive).toContain('.calendar-mobile-explicit-add');
  });

  it('keeps database schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
