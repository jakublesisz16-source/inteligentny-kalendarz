import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');

describe('Build182 mobile detail polish', () => {
  it('keeps explicit Add in the mobile Calendar header after removing category filters', () => {
    expect(calendar).toContain('<div className="calendar-header-title-row"><h1>Kalendarz</h1></div>');
    expect(calendar).toContain('calendar-mobile-header-actions');
    expect(calendar).toContain('calendar-mobile-explicit-add');
    expect(calendar).not.toContain('calendar-filter-select');
  });

  it('keeps the Add action compact while the view switch moves into the calendar toolbar', () => {
    expect(calendar).toContain('calendar-view-switch-inline');
    expect(styles).toContain('compact Work duration never wraps');
    expect(styles).toContain('@media (max-width: 360px)');
  });

  it('keeps compact Work duration on one line', () => {
    expect(work).toContain('<small>{formatWorkMinutes(ownMinutes)}</small>');
    expect(styles).toContain('min-width: 2.35rem;');
    expect(styles).toContain('white-space: nowrap;');
  });
});
