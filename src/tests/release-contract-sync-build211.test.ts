import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build211 release contract synchronization', () => {
  it('keeps the accepted Today contract instead of restoring obsolete add/panel markup', () => {
    const today = read('src/calendar/TodayView.tsx');
    expect(today).toContain('today-header-add');
    expect(today).toContain("hasAgenda ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(today).toContain('today-next-strip today-future-preview');
    expect(today).toContain('showAllWorkCoworkers');
  });

  it('keeps the accepted mobile full-week readability contract', () => {
    const calendar = read('src/calendar/CalendarView.tsx');
    const refinement = read('src/styles/interface-refinement.css');
    expect(calendar).toContain('const WEEK_MOBILE_HOUR_HEIGHT = 38;');
    expect(calendar).toContain('if (window.innerWidth <= 620) return WEEK_MOBILE_HOUR_HEIGHT;');
    expect(calendar).toContain('if (window.innerWidth <= 820) return 40;');
    expect(refinement).toContain('Build239 - mobile Week keeps the whole seven-day planner visible');
    expect(refinement).toContain('overflow-y: auto;');
  });

  it('keeps current Work/Availability compaction wording', () => {
    const coworkerList = read('src/work/CoworkerOverlapList.tsx');
    const availability = read('src/availability/AvailabilityView.tsx');
    const summary = read('src/work/WorkSummaryView.tsx');
    expect(coworkerList).toContain('className="coworker-compact-time"');
    expect(coworkerList).toContain('· razem {person.overlapStartTime}-{person.overlapEndTime}');
    expect(availability).toContain("dayBlocks.length ? 'Dodaj' : 'Ustaw'");
    expect(summary).toContain('work-summary-rhythm-inline');
    expect(summary).toContain('dni z rzędu');
  });

  it('keeps Build211-or-newer metadata synchronized without changing schema', () => {
    const version = read('src/core/version.ts');
    const build = read('src/core/build.ts');
    const sw = read('public/service-worker.js');
    const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
    const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
    expect(versionMatch).not.toBeNull();
    expect(buildMatch).not.toBeNull();
    expect(Number(versionMatch?.[2])).toBeGreaterThanOrEqual(211);
    expect(versionMatch?.[2]).toBe(buildMatch?.[1]);
    expect(sw).toContain(`v${versionMatch?.[1]}`);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
