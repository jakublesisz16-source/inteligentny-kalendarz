import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../ui/Navigation.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

describe('Build 176 minimal navigation and density', () => {
  it('keeps Today focused on the date, the next event and the actual agenda', () => {
    expect(today).toContain('today-next-strip');
    expect(today).toContain('Następne');
    expect(today).not.toContain('today-glance-grid');
    expect(today).not.toContain('Najbliższe zajęcia');
    expect(today).not.toContain('Najbliższa praca');
  });

  it('uses one compact filter control on phones without changing desktop filters', () => {
    expect(calendar).toContain('calendar-filter-desktop');
    expect(calendar).toContain('calendar-filter-select');
    expect(calendar).toContain("setFilter(event.target.value as CalendarFilter)");
    expect(styles).toContain('.calendar-filter-desktop { display: none !important; }');
    expect(styles).toContain('.calendar-filter-select');
  });

  it('removes redundant mobile panel chrome and keeps all six destinations', () => {
    expect(styles).toContain('.calendar-view-shell .calendar-panel');
    expect(styles).toContain('background: transparent;');
    expect(navigation.match(/data-view=\{item\.id\}/g)).toHaveLength(2);
    expect(navigation).toContain("short: 'Dziś'");
    expect(navigation).toContain("short: 'Opcje'");
  });
});
