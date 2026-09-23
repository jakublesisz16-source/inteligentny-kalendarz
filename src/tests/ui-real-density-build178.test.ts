import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');

describe('Build 178 real-screen density polish', () => {
  it('keeps an empty Today directly actionable without a dashboard-sized surface', () => {
    expect(today).toContain('title="Wolny dzień"');
    expect(today).toContain('today-header-add');
    expect(today).toContain('>+ Dodaj</button>');
    expect(consistency).toContain('.today-view.is-empty .today-empty-panel {');
    expect(consistency).toContain('grid-template-columns: 42px minmax(0, 1fr) auto;');
  });

  it('keeps an empty selected Calendar day compact', () => {
    expect(calendar).toContain('<EmptyState title="Brak wydarzeń" description="" actionLabel="+ Dodaj"');
    expect(consistency).toContain('.calendar-side-column.is-empty .selected-day-panel .empty-orbit { display: none; }');
    expect(consistency).toContain('min-height: 54px;');
  });

  it('keeps Work team detail below the nearest-shift summary without widening the strip', () => {
    expect(work).toContain('className="work-next-strip"');
    expect(consistency).toContain('.work-next-team-static {');
    expect(consistency).toContain('grid-column: 1 / -1;');
    expect(consistency).toContain('justify-content: flex-start;');
  });
});
