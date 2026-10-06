import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('1.2.0.25 Today balanced layout', () => {
  it('keeps the content-sized plan panel introduced in 1.2.0.24', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    expect(today).toContain("hasAgenda ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(components).toContain('.today-plan-panel {');
    expect(components).toContain('min-height: 0;');
  });

  it('uses a readable but bounded coworker area instead of a tiny left-side block', () => {
    const components = source('../styles/components.css');
    expect(components).toContain('1.2.0.25 - Today balance');
    expect(components).toContain('width: min(100%, 560px);');
    expect(components).toContain('grid-template-columns: minmax(230px, 1fr) minmax(118px, auto);');
    expect(components).toContain('font-size: .75rem;');
    expect(components).toContain('font-size: .69rem;');
  });

  it('keeps all coworkers visible and actions grouped without changing the event data flow', () => {
    const today = source('../calendar/TodayView.tsx');
    const components = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');
    expect(today).toContain('showAllWorkCoworkers');
    expect(components).toContain('.today-plan-panel .event-actions-column');
    expect(components).toContain('font-size: .82rem;');
    expect(responsive).toContain('1.2.0.25 - Today balance');
  });

  it('keeps route and edit actions on one equal-height mobile row', () => {
    const refinement = source('../styles/interface-refinement.css');
    expect(refinement).toContain('Build330 - real-device correction: equal Today actions + visible selected state on day-off cells.');
    expect(refinement).toContain('flex-wrap: nowrap;');
    expect(refinement).toContain('min-height: 28px;');
    expect(refinement).toContain('height: 28px;');
    expect(refinement).toContain('line-height: 1;');
  });

  it('lets future location copy use two lines instead of mobile ellipsis', () => {
    const refinement = source('../styles/interface-refinement.css');
    expect(refinement).toContain('Build333 - mobile future-copy wrap + Today/Calendar header-add parity.');
    expect(refinement).toContain('.today-view .today-tomorrow-row > div > small');
    expect(refinement).toContain('white-space: normal;');
    expect(refinement).toContain('text-overflow: clip;');
    expect(refinement).toContain('-webkit-line-clamp: 2;');
  });

  it('keeps Today and Calendar +Dodaj on one mobile header-action contract', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const refinement = source('../styles/interface-refinement.css');
    expect(calendar).toContain('button button-secondary button-small calendar-mobile-explicit-add');
    expect(refinement).toContain('.today-header-add,');
    expect(refinement).toContain('.calendar-mobile-explicit-add {');
    expect(refinement).toContain('min-height: 44px;');
    expect(refinement).toContain('min-width: 76px;');
  });

  it('keeps the private version and database schema synchronized', () => {
    const version = source('../core/version.ts');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
