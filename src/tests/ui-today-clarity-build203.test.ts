import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build203 Today clarity', () => {
  it('keeps one add action at the top and removes the bottom CTA strip', () => {
    const today = read('src/calendar/TodayView.tsx');
    expect(today).toContain('today-header-actions');
    expect(today).toContain('today-header-add');
    expect(today).not.toContain('today-add-row');
  });

  it('does not repeat a tomorrow event in both Next and Tomorrow', () => {
    const today = read('src/calendar/TodayView.tsx');
    expect(today).toContain('nextEvent && !tomorrowEvents.length');
    expect(today).toContain('today-tomorrow-title');
    expect(today).not.toContain('today-tomorrow-heading');
  });

  it('keeps tomorrow compact with location grouped under the event', () => {
    const today = read('src/calendar/TodayView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(today).toContain('<strong>{event.title}</strong>');
    expect(today).toContain('{location ? <small>{location}</small> : null}');
    expect(css).toContain('grid-template-columns: 94px minmax(0, 1fr);');
    expect(css).toContain('.today-tomorrow-row > div > small');
  });

  it('lightens coworker rows without hiding names or hours', () => {
    const today = read('src/calendar/TodayView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(today).toContain('showAllWorkCoworkers');
    expect(css).toContain('.today-view .event-coworker-line {');
    expect(css).toContain('border-bottom: 0;');
  });
});
