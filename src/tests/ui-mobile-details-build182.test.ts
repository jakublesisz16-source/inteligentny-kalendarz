import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');

describe('Build182 mobile detail polish', () => {
  it('keeps Add beside the mobile filter instead of beside the Calendar title', () => {
    expect(calendar).toContain('<div className="calendar-header-title-row"><h1>Kalendarz</h1></div>');
    expect(calendar).toContain('calendar-mobile-filter-actions');
    expect(calendar.indexOf('calendar-filter-select')).toBeLessThan(calendar.indexOf('calendar-mobile-explicit-add'));
  });

  it('keeps filter labels readable and the Add action compact down to 360px', () => {
    expect(styles).toContain('/* 1.2.0.182 - mobile Calendar keeps filter and explicit Add on one row; compact Work duration never wraps. */');
    expect(styles).toContain('grid-template-columns: minmax(100px, 1fr) auto;');
    expect(styles).toContain('padding-right: 24px;');
    expect(styles).toContain('@media (max-width: 360px)');
  });

  it('keeps compact Work duration on one line', () => {
    expect(work).toContain('<small>{formatWorkMinutes(ownMinutes)}</small>');
    expect(styles).toContain('min-width: 2.35rem;');
    expect(styles).toContain('white-space: nowrap;');
  });
});
