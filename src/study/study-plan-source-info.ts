import type { StudyScheduleCandidate } from './study.types';

/** Verified, actionable excerpts from source text. Never invent a missing date/place. */
export function studyPlanSourceInfo(candidate: Pick<StudyScheduleCandidate,
  'originalText' | 'subject' | 'date' | 'sourceWeekStart' | 'sourceRange' | 'include'>): string | undefined {
  const raw = candidate.originalText ?? '';
  const normalized = raw.toLocaleLowerCase('pl-PL');
  // The DSK note refers to the FIRST meeting of each 5-day block, not every day.
  if (candidate.subject === 'PEDIATRIA'
    && candidate.date && candidate.date === candidate.sourceWeekStart
    && normalized.includes('pierwsze spotkanie z asystentem')
    && normalized.includes('przed wejściem do kliniki')
    && normalized.includes('8.00')) {
    return 'Pierwsze spotkanie z asystentem o 08:00 przed wejściem do wskazanej kliniki (DSK).';
  }
  // A source-only week-level notice is useful information, NOT a dated event.
  if (candidate.include === false && candidate.sourceRange === 'AY9'
    && normalized.includes('szkolenie rodo i bhp') && normalized.includes('8.30')) {
    return 'Pierwsze spotkanie: szkolenie RODO/BHP od 08:30. Dokładny dzień i miejsce szkolenia nie są jeszcze potwierdzone w planie.';
  }
  return undefined;
}

export const STUDY_PLAN_INFO_PREFIX = 'Informacja z planu: ';
