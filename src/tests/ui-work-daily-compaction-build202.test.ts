import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build202 Today and Work compaction', () => {
  it('keeps Today ordered as today first, with compact next and tomorrow context', () => {
    const today = read('src/calendar/TodayView.tsx');
    expect(today).toContain('today-next-when');
    expect(today).toContain('today-tomorrow');
    expect(today.indexOf('today-plan-panel')).toBeLessThan(today.lastIndexOf('today-tomorrow'));
    expect(today).toContain('showAllWorkCoworkers');
  });

  it('keeps Work coworker details complete but shortens the expanded rows', () => {
    const list = read('src/work/CoworkerOverlapList.tsx');
    const work = read('src/work/WorkView.tsx');
    expect(list).toContain('className="coworker-compact-time"');
    expect(list).toContain('!sameAsShared ? <small>· razem {person.overlapStartTime}-{person.overlapEndTime}</small> : null');
    expect(list).toContain('razem z Tobą ${person.overlapStartTime}-${person.overlapEndTime}');
    expect(work).toContain('<span>Najbliższa</span>');
    expect(work).toContain('<CoworkerOverlapList people={coworkers} compact />');
  });

  it('reduces repeated Availability actions and automation copy', () => {
    const availability = read('src/availability/AvailabilityView.tsx');
    expect(availability).toContain('availability-day-action');
    expect(availability).toContain("dayBlocks.length ? 'Dodaj' : 'Ustaw'");
    expect(availability).toContain('availability-config-note-compact');
    expect(availability).not.toContain('Automat nie jest jeszcze skonfigurowany');
    expect(availability).not.toContain('Ustawienia automatu</button>');
    expect(availability).not.toContain('stałe</span>');
  });

  it('compresses Work summary without removing its useful metrics', () => {
    const summary = read('src/work/WorkSummaryView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(summary).toContain('<h3>Godziny w tygodniach</h3>');
    expect(summary).toContain('<h3>Ostatnie miesiące</h3>');
    expect(summary).toContain('work-summary-rhythm-inline');
    expect(summary).toContain('<h3>Dyspozycyjność</h3>');
    expect(summary).not.toContain('Na podstawie aktualnie zapisanych potwierdzonych zmian');
    expect(css).toContain('.work-rhythm-stats {\n  grid-template-columns: repeat(3');
    expect(css).toContain('.work-month-bar-track { height: 58px;');
  });
});
