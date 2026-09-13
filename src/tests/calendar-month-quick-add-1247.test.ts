import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');


describe('1.2.0.48 compact quick add in month view', () => {
  it('exposes a compact quick add trigger directly in the selected month day cell', () => {
    expect(calendar).toContain('function openMonthQuickAdd(day: Date)');
    expect(calendar).toContain('current?.source === \'MONTH\' && current.dateKey === dateKey ? null : buildQuickAddState(day, \'MONTH\')');
    expect(calendar).toContain('className="calendar-day-quick-add-trigger"');
    expect(calendar).toContain('calendar-month-quick-add');
  });

  it('keeps the same compact title and time controls known from the weekly quick add', () => {
    expect(calendar).toContain('placeholder="Co planujesz?"');
    expect(calendar).toContain('aria-label="Godzina rozpoczęcia"');
    expect(calendar).toContain('aria-label="Godzina zakończenia"');
    expect(calendar).toContain('Więcej opcji');
  });

  it('adds dedicated desktop and mobile styling without a schema bump', () => {
    expect(css).toContain('/* 1.2.0.48 - compact quick add also available in month view */');
    expect(css).toContain('.calendar-day-quick-add-trigger');
    expect(responsive).toContain('/* 1.2.0.48 - month quick add stays usable on mobile */');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
