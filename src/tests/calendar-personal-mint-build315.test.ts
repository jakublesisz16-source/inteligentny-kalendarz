import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('Build315 personal events use the existing semantic UI in mint', () => {
  it('makes PERSONAL mint while keeping day-off purple on separate tokens', () => {
    const tokens = source('../styles/tokens.css');
    expect(tokens).toContain('--category-personal: #4f9f83;');
    expect(tokens).toContain('--category-personal-soft: #e7f6f0;');
    expect(tokens).toContain('--calendar-day-off: #efe5f7;');
    expect(tokens).toContain('--calendar-day-off-strong: #695591;');
  });

  it('uses the normal PERSONAL count badge in month view instead of a source dot', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const consistency = source('../styles/interface-consistency.css');
    expect(calendar).toContain('className={`category-count category-${category.toLowerCase()}`}');
    expect(calendar).not.toContain('calendar-manual-source-dot');
    expect(consistency).toContain('.calendar-day .category-count.category-personal');
    expect(consistency).toContain('background: var(--category-personal-soft)');
  });

  it('uses mint PERSONAL styling for week blocks and selected-day cards', () => {
    const consistency = source('../styles/interface-consistency.css');
    const card = source('../events/EventCard.tsx');
    expect(consistency).toContain('.calendar-week-event.category-personal { background: var(--category-personal-soft); }');
    expect(consistency).toContain('.selected-day-panel .event-card.category-personal');
    expect(card).toContain('<span className="event-category">{categoryLabels[event.category]}</span>');
    expect(card).not.toContain('event-source-dot');
  });

  it('preserves day-off purple styling independently from PERSONAL mint', () => {
    const consistency = source('../styles/interface-consistency.css');
    const refinement = source('../styles/interface-refinement.css');
    expect(consistency).toContain('var(--calendar-day-off)');
    expect(consistency).toContain('color: var(--calendar-day-off-strong);');
    expect(refinement).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
  });
});
