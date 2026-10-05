import { describe, expect, it } from 'vitest';
import { sourceText } from './helpers/source-text';

describe('personal-event semantic contract', () => {
  it('keeps PERSONAL mint and day-off purple as separate semantic tokens', () => {
    const tokens = sourceText('src/styles/tokens.css');
    expect(tokens).toContain('--category-personal: #4f9f83;');
    expect(tokens).toContain('--category-personal-soft: #e7f6f0;');
    expect(tokens).toContain('--calendar-day-off: #efe5f7;');
    expect(tokens).toContain('--calendar-day-off-strong: #695591;');
  });

  it('uses the normal PERSONAL category count in month view with no source-dot workaround', () => {
    const calendar = sourceText('src/calendar/CalendarView.tsx');
    const consistency = sourceText('src/styles/interface-consistency.css');
    expect(calendar).toContain('counts[category]');
    expect(calendar).toContain('className={`category-count category-${category.toLowerCase()}`}');
    expect(calendar).not.toContain('calendar-manual-source-dot');
    expect(calendar).not.toContain('manualEventCount');
    expect(calendar).not.toContain('visibleCategoryCounts');
    expect(consistency).toContain('.calendar-day .category-count.category-personal');
    expect(consistency).toContain('background: var(--category-personal-soft)');
  });

  it('uses mint PERSONAL styling for week blocks and selected-day cards without source markers', () => {
    const consistency = sourceText('src/styles/interface-consistency.css');
    const card = sourceText('src/events/EventCard.tsx');
    expect(consistency).toContain('.calendar-week-event.category-personal { background: var(--category-personal-soft); }');
    expect(consistency).toContain('.selected-day-panel .event-card.category-personal');
    expect(card).toContain('<span className="event-category">{categoryLabels[event.category]}</span>');
    expect(card).not.toContain('manual-source-accent');
    expect(card).not.toContain('event-source-dot');
  });

  it('keeps Today free of manual-source marker experiments', () => {
    const today = sourceText('src/calendar/TodayView.tsx');
    expect(today).not.toContain('accentManualSource');
    expect(today).not.toContain('today-source-dot');
    expect(today).not.toContain('manual-source-accent');
  });

  it('preserves day-off purple and the compact tomorrow preview independently', () => {
    const consistency = sourceText('src/styles/interface-consistency.css');
    const refinement = sourceText('src/styles/interface-refinement.css');
    expect(consistency).toContain('var(--calendar-day-off)');
    expect(consistency).toContain('color: var(--calendar-day-off-strong);');
    expect(refinement).toContain('.calendar-day.day-off.selected:not(.multi-selected)');
    expect(refinement).toContain('.today-view .today-future-preview');
    expect(refinement).toContain('.today-view .today-tomorrow-row');
  });
});
