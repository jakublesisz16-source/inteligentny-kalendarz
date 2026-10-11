import { describe, expect, it } from 'vitest';
import { studyPlanSourceInfo } from '../study/study-plan-source-info';
import { studyEventDisplay } from '../events/study-event-display';
import { VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_09 } from '../study/verified-study-current-schedule';

const candidates = VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_09;

describe('verified Study source note presentation', () => {
  it('shows first assistant meeting once per pediatric week, not on every subsequent day', () => {
    const blockOne = candidates.filter((x) => x.sourceRange === 'AM14');
    const blockTwo = candidates.filter((x) => x.sourceRange === 'AM15');
    expect(blockOne.map(studyPlanSourceInfo).filter(Boolean)).toEqual(['Pierwsze spotkanie z asystentem o 08:00 przed wejściem do wskazanej kliniki (DSK).']);
    expect(blockTwo.map(studyPlanSourceInfo).filter(Boolean)).toEqual(['Pierwsze spotkanie z asystentem o 08:00 przed wejściem do wskazanej kliniki (DSK).']);
  });
  it('preserves the POZ RODO/BHP 08:30 note but not a guessed calendar time/date', () => {
    const poz = candidates.find((x) => x.sourceRange === 'AY9')!;
    expect(poz.include).toBe(false);
    expect(poz.date).toBeUndefined();
    expect(poz.startTime).toBeUndefined();
    expect(studyPlanSourceInfo(poz)).toContain('RODO/BHP od 08:30');
  });
  it('shows a short independent note in imported event detail rather than losing it in raw XLS text', () => {
    const event = {
      id: 'study-pediatrics', title: 'PEDIATRIA', startDateTime: '2026-11-23T08:00', endDateTime: '2026-11-23T14:00',
      allDay: false, spanType: 'SINGLE_DAY' as const, category: 'STUDY' as const, source: 'UNIVERSITY_XLSX' as const,
      studyGroupTags: ['G4:11B2'], studyGroupScope: 'SPECIFIC' as const,
      description: 'Zajęcia praktyczne - Grupa 11B2 - Katedra i Klinika Pediatrii i Nefrologii\nInformacja z planu: Pierwsze spotkanie z asystentem o 08:00 przed wejściem do wskazanej kliniki (DSK).',
      createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z',
    };
    const view = studyEventDisplay(event);
    expect(view.groupLabel).toBe('Grupa 11B2');
    expect(view.planInfo).toBe('Pierwsze spotkanie z asystentem o 08:00 przed wejściem do wskazanej kliniki (DSK).');
    expect(view.description).not.toContain('Informacja z planu:');
  });
});
