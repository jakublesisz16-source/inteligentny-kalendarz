import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('Build315 supersedes the Build313 manual source-dot experiment', () => {
  it('uses the normal category count badge in month view, with no extra manual dot', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain('counts[category]');
    expect(calendar).not.toContain('calendar-manual-source-dot');
    expect(calendar).not.toContain('manualEventCount');
    expect(calendar).not.toContain('visibleCategoryCounts');
  });

  it('keeps selected-day details on the standard category style', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const card = source('../events/EventCard.tsx');
    expect(calendar).not.toContain('accentManualSource');
    expect(card).not.toContain('manual-source-accent');
    expect(card).not.toContain('event-source-dot');
    expect(card).toContain('<span className="event-category">{categoryLabels[event.category]}</span>');
  });
});
