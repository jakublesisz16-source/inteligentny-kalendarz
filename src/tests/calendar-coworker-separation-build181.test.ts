import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');

describe('Build 181 selected-day coworker separation', () => {
  it('keeps coworkers fully visible while separating only consecutive rows', () => {
    expect(calendar).toContain('showAllWorkCoworkers compactTimeRange');
    expect(styles).toContain('/* 1.2.0.181 - selected-day coworkers stay fully visible but get only a hairline separation for scanability. */');
    expect(styles).toContain('.calendar-view-shell .selected-day-panel .event-coworker-line + .event-coworker-line {');
    expect(styles).toContain('border-top: 1px solid color-mix(in srgb, var(--line) 26%, transparent);');
  });

  it('keeps the treatment deliberately light', () => {
    expect(styles).toContain('padding: 2px 1px 3px;');
    expect(styles).not.toContain('.calendar-view-shell .selected-day-panel .event-coworker-line { background:');
    expect(styles).toContain('.calendar-view-shell .selected-day-panel .event-card::before { display: none; }');
  });
});
