import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.48 editable quick-add hours', () => {
  it('shows editable start and end time controls inside the compact week composer', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain('calendar-week-quick-add-times');
    expect(calendar).toContain('aria-label="Godzina rozpoczęcia"');
    expect(calendar).toContain('aria-label="Godzina zakończenia"');
    expect(calendar).toContain('type="time"');
  });

  it('uses the edited range when creating the event and validates same-day ordering', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain('const startTime = quickAdd.startTime');
    expect(calendar).toContain('const endTime = quickAdd.endTime');
    expect(calendar).toContain("endTime <= startTime");
    expect(calendar).toContain('Godzina zakończenia musi być późniejsza od rozpoczęcia.');
  });

  it('preserves both edited times when opening the full form', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const app = source('../app/App.tsx');
    const form = source('../events/EventForm.tsx');
    expect(calendar).toContain('onAdd(initial, title || undefined, initialEnd)');
    expect(app).toContain('initialEndDate');
    expect(form).toContain('initialEndDate ?? new Date');
  });

  it('keeps time controls compact on desktop and touch-friendly on mobile', () => {
    const css = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    const version = source('../core/version.ts');
    const visualQa = source('../../scripts/visual-qa-capture.mjs');
    expect(css).toContain('1.2.0.48 - editable times in compact week quick add');
    expect(responsive).toContain('1.2.0.48 - touch-friendly editable quick-add time range');
    expect(responsive).toContain('.calendar-week-quick-add-times input { min-height: 40px;');
    expect(visualQa).toContain('calendar-week-quick-add-desktop-1440x1000.png');
    expect(visualQa).toContain('calendar-week-quick-add-mobile-390x844.png');
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
