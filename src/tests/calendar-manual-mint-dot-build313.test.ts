import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Build313 manual event mint source accent', () => {
  it('renders MANUAL events as a mint dot in the month grid instead of a category badge', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain("const manualEventCount = dayEvents.filter((event) => event.source === 'MANUAL').length");
    expect(calendar).toContain("if (event.source === 'MANUAL') visibleCategoryCounts[event.category]");
    expect(calendar).toContain('className="calendar-manual-source-dot"');
    expect(calendar).toContain('visibleCategoryCounts[category]');
  });

  it('uses the same mint dot for MANUAL + PERSONAL in the selected-day panel without tinting the card', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const card = source('../events/EventCard.tsx');
    const styles = source('../styles/interface-refinement.css');
    expect(calendar).toContain('compactTimeRange accentManualSource />');
    expect(card).toContain("accentManualSource && event.source === 'MANUAL'");
    expect(styles).toContain('.calendar-view .event-card.manual-source-accent .event-source-dot');
    expect(styles).not.toContain('.calendar-view .event-card.manual-source-accent { background:');
  });

  it('keeps day-off styling independent from the manual-event source accent', () => {
    const styles = source('../styles/interface-refinement.css');
    expect(styles).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
    expect(styles).toContain('.calendar-view .calendar-manual-source-dot');
  });
});
