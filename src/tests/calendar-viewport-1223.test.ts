import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.23 calendar viewport-first layout', () => {
  it('keeps the calendar as the first dominant surface instead of a large descriptive header', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain('className="view-shell calendar-view-shell"');
    expect(calendar).toContain('<h1>Kalendarz</h1>');
    expect(calendar).not.toContain('Miesiąc do szybkiego podglądu, tydzień do dokładnych godzin.');
    expect(calendar).not.toContain('<p className="eyebrow">Kalendarz</p>');
  });

  it('keeps primary controls in the compact header without repeating active Study groups', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain('calendar-view-header');
    expect(calendar).toContain('calendar-primary-controls');
    expect(calendar).not.toContain('calendar-selected-day-study-context');
    expect(calendar).toContain('calendar-week-study-group');
  });

  it('has desktop and responsive viewport-first styling without a schema migration', () => {
    const components = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    const version = source('../core/version.ts');
    expect(components).toContain('1.2.0.23 - calendar viewport-first');
    expect(components).toContain('padding-top: 10px;');
    expect(components).toContain('.calendar-view-header .calendar-primary-controls');
    expect(responsive).toContain('1.2.0.23 - calendar viewport-first');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
