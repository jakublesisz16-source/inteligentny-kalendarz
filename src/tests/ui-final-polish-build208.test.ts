import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const workList = readFileSync(new URL('../work/CoworkerOverlapList.tsx', import.meta.url), 'utf8');

describe('Build208 final UI polish', () => {
  it('gives Today a small number of quiet visual surfaces', () => {
    expect(css).toContain('Today: a few quiet tiles');
    expect(css).toContain('.today-view.has-plan .today-plan-panel.today-single-surface .event-card');
    expect(css).toContain('.today-view .today-future-preview');
  });

  it('shows the complete seven-day week on phones', () => {
    expect(css).toContain('grid-template-columns: 38px repeat(7, minmax(0, 1fr));');
    expect(css).toContain('.calendar-week-column,');
    expect(calendar).toContain('data-mobile-time=');
    expect(calendar).toContain('data-mobile-label={event.title.split');
  });

  it('reduces Finance navigation and summary density on phones', () => {
    expect(css).toContain('Finance - two navigation rows');
    expect(css).toContain('.finance-month-metric-grid button:nth-child(n+2)');
    expect(css).toContain('.finance-month-category-heading');
  });

  it('keeps expanded Work teammates readable and removes duplicated time text', () => {
    expect(workList).toContain('const sameAsShared =');
    expect(workList).toContain('shared-is-full');
    expect(css).toContain('Work - count stays in the same place');
  });
});
