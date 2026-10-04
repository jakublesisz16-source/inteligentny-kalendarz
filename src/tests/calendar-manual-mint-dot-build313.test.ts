import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Build313/314 manual event mint source accent', () => {
  it('renders MANUAL events as a mint dot in the month grid instead of a category badge', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain("const manualEventCount = dayEvents.filter((event) => event.source === 'MANUAL').length");
    expect(calendar).toContain("if (event.source === 'MANUAL') visibleCategoryCounts[event.category]");
    expect(calendar).toContain('className="calendar-manual-source-dot"');
    expect(calendar).toContain('visibleCategoryCounts[category]');
  });

  it('uses a visible mint dot in selected-day panel and hides the purple category chip for MANUAL', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const card = source('../events/EventCard.tsx');
    const styles = source('../styles/interface-refinement.css');
    expect(calendar).toContain('compactTimeRange accentManualSource />');
    expect(card).toContain("accentManualSource && event.source === 'MANUAL'");
    expect(card).toContain('showManualSourceAccent ? null : <span className="event-category">');
    expect(styles).toContain('.calendar-view-shell .event-card.manual-source-accent .event-source-dot');
    expect(styles).toContain('background: var(--manual-event-mint);');
  });

  it('keeps day-off styling independent and Today free of the source dot', () => {
    const styles = source('../styles/interface-refinement.css');
    const today = source('../calendar/TodayView.tsx');
    expect(styles).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
    expect(styles).toContain('.calendar-view-shell .calendar-manual-source-dot');
    expect(today).not.toContain('today-source-dot');
  });
});
