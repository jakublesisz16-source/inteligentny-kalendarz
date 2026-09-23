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

  it('keeps the accepted mobile week density contract', () => {
    const calendar = read('src/calendar/CalendarView.tsx');
    expect(calendar).toContain('if (window.innerWidth <= 620) {');
    expect(calendar).toContain('window.innerHeight - WEEK_MOBILE_VERTICAL_CHROME');
    expect(calendar).toContain('return Math.max(26, Math.min(32, Math.floor(availableHeight / hourCount)));');
    expect(calendar).toContain('if (window.innerWidth <= 820) return 40;');
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

  it('keeps Build211 metadata synchronized without changing schema', () => {
    const version = read('src/core/version.ts');
    const build = read('src/core/build.ts');
    const sw = read('public/service-worker.js');
    expect(version).toContain("APP_VERSION = '1.2.0.211'");
    expect(build).toContain("APP_BUILD = '211'");
    expect(sw).toContain('v1.2.0.211');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
