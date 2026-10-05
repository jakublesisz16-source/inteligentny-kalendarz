import { describe, expect, it } from 'vitest';
import { sourceText } from './helpers/source-text';

describe('current release UI contract', () => {
  it('keeps concise Settings and Availability wording', () => {
    const settings = sourceText('src/settings/SettingsView.tsx');
    const availability = sourceText('src/availability/AvailabilityView.tsx');
    expect(settings).toContain('Kopia i przenoszenie');
    expect(settings).toContain('Historia i odzyskiwanie');
    expect(settings).not.toContain('Backup i przenoszenie');
    expect(availability).toContain('<h3>Automat</h3>');
    expect(availability).toContain('<strong>Wyjątki</strong>');
  });

  it('keeps one Work settings save action', () => {
    const work = sourceText('src/work/WorkView.tsx');
    expect(work).toContain('work-settings-header-save');
    expect(work).not.toContain('work-settings-save-footer');
  });

  it('keeps Today on the accepted single-surface agenda contract', () => {
    const today = sourceText('src/calendar/TodayView.tsx');
    expect(today).toContain('today-header-add');
    expect(today).toContain("hasAgenda ? ' today-plan-panel today-single-surface' : ' today-empty-panel'");
    expect(today).toContain('today-next-strip today-future-preview');
    expect(today).toContain('showAllWorkCoworkers');
  });

  it('keeps the mobile Week readable with natural page scrolling', () => {
    const calendar = sourceText('src/calendar/CalendarView.tsx');
    const refinement = sourceText('src/styles/interface-refinement.css');
    expect(calendar).toContain('const WEEK_MOBILE_HOUR_HEIGHT = 38;');
    expect(calendar).toContain('if (window.innerWidth <= 620) return WEEK_MOBILE_HOUR_HEIGHT;');
    expect(calendar).toContain('if (window.innerWidth <= 820) return 40;');
    expect(refinement).toContain('overflow-y: visible !important;');
  });

  it('keeps Work and Availability compact without hiding key context', () => {
    const coworkerList = sourceText('src/work/CoworkerOverlapList.tsx');
    const availability = sourceText('src/availability/AvailabilityView.tsx');
    const summary = sourceText('src/work/WorkSummaryView.tsx');
    expect(coworkerList).toContain('className="coworker-compact-time"');
    expect(coworkerList).toContain('· razem {person.overlapStartTime}-{person.overlapEndTime}');
    expect(availability).toContain("dayBlocks.length ? 'Dodaj' : 'Ustaw'");
    expect(summary).toContain('work-summary-rhythm-inline');
    expect(summary).toContain('dni z rzędu');
  });
});
