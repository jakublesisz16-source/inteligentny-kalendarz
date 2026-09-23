import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const availability = readFileSync(new URL('../availability/AvailabilityView.tsx', import.meta.url), 'utf8');
const components = readFileSync(new URL('../styles/components.css', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build198 information reduction', () => {
  it('removes redundant Today metadata while keeping the next-event strip', () => {
    expect(today).toContain('<section className="today-next-strip today-future-preview"');
    expect(today).not.toContain('nextCategoryLabels');
    expect(refinement).toContain('.today-view .event-category');
    expect(refinement).toContain('.today-view .event-source { display: none; }');
  });

  it('keeps Work person-count control anchored when details expand', () => {
    expect(refinement).toContain('.work-shift-team-details[open] > summary');
    expect(refinement).toContain('grid-column: 2;');
    expect(refinement).toContain('justify-self: end;');
  });

  it('removes decorative category rails without losing semantic fills', () => {
    expect(components).not.toContain('.event-card::before');
    expect(components).not.toContain('calendar-week-event.category-work { border-left-color');
    expect(consistency).not.toContain('calendar-mobile-day-preview-event.category-work { border-left-color');
    expect(components).toContain('.calendar-week-event.category-work { background:');
  });

  it('trims generic tutorial-style copy', () => {
    expect(work).not.toContain('workHeaderSubtitle');
    expect(availability).toContain('<h3>Automat</h3>');
    expect(availability).toContain('>Wolne</span>');
  });
});
