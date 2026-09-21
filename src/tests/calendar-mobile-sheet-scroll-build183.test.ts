import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');

describe('Build 183 mobile selected-day sheet scroll', () => {
  it('locks the background document while the sheet is open and restores it on close', () => {
    expect(calendar).toContain("body.classList.add('calendar-day-sheet-open')");
    expect(calendar).toContain("body.style.position = 'fixed'");
    expect(calendar).toContain("body.style.overflow = 'hidden'");
    expect(calendar).toContain("body.classList.remove('calendar-day-sheet-open')");
    expect(calendar).toContain('window.scrollTo(0, scrollY)');
  });

  it('uses the sheet as the only mobile overflow container instead of nesting coworker scroll', () => {
    expect(responsive).toContain('max-height: min(72dvh, 640px);');
    expect(responsive).toContain('.selected-day-panel.mobile-open .event-coworkers > span');
    expect(responsive).toContain('max-height: none;');
    expect(responsive).toContain('overflow: visible;');
  });
});
