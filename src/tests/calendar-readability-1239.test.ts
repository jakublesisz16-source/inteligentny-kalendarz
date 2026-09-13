import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/components.css', 'utf8');
const responsiveCss = readFileSync('src/styles/responsive.css', 'utf8');
const calendarView = readFileSync('src/calendar/CalendarView.tsx', 'utf8');

describe('1.2.0.39 month calendar readability', () => {
  it('keeps event counters neutral and high-contrast without redundant inner dots', () => {
    expect(css).toContain('/* 1.2.0.39 - month calendar readability polish */');
    expect(css).toContain('.calendar-day .category-count {');
    expect(css).toContain('color: var(--text);');
    expect(css).toContain('font-weight: 900;');
    expect(css).not.toContain('.calendar-day .category-count.category-study i');
    expect(css).not.toContain('.calendar-day .category-count.category-personal i');
    expect(responsiveCss).toContain('/* 1.2.0.39 - preserve counter contrast on compact month grids */');
  });

  it('separates selected day, today and adjacent-month states', () => {
    expect(css).toContain('.calendar-day.muted { opacity: .52; }');
    expect(css).toContain('.calendar-day.selected:not(.today) .day-number');
    expect(css).toContain('.calendar-day.today .day-number');
  });

  it('shows the full Study group label as a native tooltip', () => {
    expect(calendarView).toContain('title={studyGroupDisplayLabel(group)}>{studyGroupDisplayLabel(group)}</span>');
  });
});
