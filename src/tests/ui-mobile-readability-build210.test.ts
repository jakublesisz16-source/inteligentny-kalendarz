import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const availability = readFileSync(new URL('../availability/AvailabilityView.tsx', import.meta.url), 'utf8');
const summary = readFileSync(new URL('../work/WorkSummaryView.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build210 mobile readability polish', () => {
  it('keeps the seven-day week but renders only concise event labels on phone', () => {
    expect(calendar).toContain('data-mobile-time=');
    expect(calendar).toContain('data-mobile-label={event.title.split');
    expect(css).toContain("content: attr(data-mobile-time) !important");
    expect(css).toContain("content: attr(data-mobile-label) !important");
  });

  it('turns Availability into one clean row per day', () => {
    expect(availability).toContain('availability-day-total');
    expect(availability).toContain('availability-fixed-work-label');
    expect(availability).toContain("{dayBlocks.length ? 'Dodaj' : 'Ustaw'}");
    expect(css).toContain('grid-template-columns: minmax(92px, .9fr) minmax(0, 1.2fr) auto !important');
  });

  it('keeps missing comparison secondary in Work Summary', () => {
    expect(summary).toContain('work-summary-no-comparison');
    expect(summary).not.toContain('<strong>Brak porównania</strong>');
    expect(css).toContain('.work-summary-facts-grid > span:nth-child(2),');
  });
});
