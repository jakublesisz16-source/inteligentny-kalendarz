import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.2 Today simplification', () => {
  it('removes the duplicated three-column summary strip and local-data status', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).not.toContain('summary-strip');
    expect(today).not.toContain('Tryb danych');
    expect(today).not.toContain('Pierwszy plan');
    expect(source('../ui/Navigation.tsx')).not.toContain('Dane pozostają lokalnie na tym urządzeniu.');
  });

  it('uses only one add-event action when the day is empty', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).toContain('today-header-add');
    expect(today).not.toContain('today-add-row');
    expect(today).toContain('title="Wolny dzień"');
    expect(today).toContain('description=""');
    expect(today).not.toContain('actionLabel="+ Dodaj"');
  });

  it('keeps the existing calendar and work/availability data flows intact', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).toContain('EventCard');
    expect(today).toContain('todayAvailability');
    expect(today).toContain('blockingToday');
  });
});
