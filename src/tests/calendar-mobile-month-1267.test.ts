import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.67 mobile month tap clarity', () => {
  it('keeps the month cell quick add trigger on desktop only', () => {
    expect(calendar).toContain('!selectionMode && selected && desktopWeekDragEnabled');
    expect(calendar).toContain('className="calendar-day-quick-add-trigger"');
  });

  it('keeps the mobile month cell fail-safe from opening event creation', () => {
    expect(calendar).toContain("window.matchMedia('(max-width: 820px)').matches");
    const start = calendar.indexOf('function openMonthQuickAdd(day: Date)');
    const end = calendar.indexOf('function quickAddInitialDate()', start);
    const block = calendar.slice(start, end);
    expect(block).toContain('setMobileDayPanelOpen(false)');
    expect(block).not.toContain('onAdd(');
    expect(calendar).toContain('>Dodaj wydarzenie</button>');
    expect(calendar).toContain('actionLabel="Dodaj wydarzenie"');
  });

  it('hides the cell plus across the compact calendar range', () => {
    expect(responsive).toContain('/* 1.2.0.67 - mobile month day tap only opens details; add action moves to the day sheet */');
    expect(responsive).toContain('@media (max-width: 820px)');
    expect(responsive).toContain('.calendar-day-quick-add-trigger { display: none; }');
  });

  it('keeps database schema stable', () => {
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
