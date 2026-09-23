import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build204 Today clean agenda', () => {
  it('narrows Today and keeps the add action quiet', () => {
    const today = read('src/calendar/TodayView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(today).toContain('button button-secondary button-small today-header-add');
    expect(css).toContain('max-width: 980px;');
    expect(css).toContain('background: rgba(255,255,255,.72);');
  });

  it('keeps future context inside the same agenda surface without duplication', () => {
    const today = read('src/calendar/TodayView.tsx');
    expect(today).toContain('nextEvent && !tomorrowEvents.length');
    expect(today).toContain('today-next-strip today-future-preview');
    expect(today).toContain('today-tomorrow today-future-preview');
    expect(today.indexOf('today-plan-panel')).toBeLessThan(today.indexOf('today-future-preview'));
  });

  it('uses a shorter Today-only coworker label while preserving names and hours', () => {
    const today = read('src/calendar/TodayView.tsx');
    const card = read('src/events/EventCard.tsx');
    expect(today).toContain('compactCoworkerLabel');
    expect(card).toContain('Z Tobą · ${workCoworkerCountLabel}');
    expect(card).toContain('Z Tobą na zmianie · ${workCoworkerCountLabel}');
    expect(card).toContain('{person.displayName}');
    expect(card).toContain('{person.overlapStartTime}-{person.overlapEndTime}');
  });

  it('keeps the desktop coworker block compact and mobile touch safe', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toContain('width: min(100%, 650px);');
    expect(css).toContain('min-height: 21px;');
    expect(css).toContain('.today-future-preview {');
    expect(css).toContain('min-height: 44px;');
  });
});
