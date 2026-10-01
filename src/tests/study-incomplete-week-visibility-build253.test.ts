import { describe, expect, it } from 'vitest';
import type { UniversityImportEntry } from '../study/study.types';
import {
  incompleteStudyEntryAppliesOnDate,
  incompleteStudyEntryDetail,
  incompleteStudyEntryMarkerAppliesOnDate,
  incompleteStudyEntryMarkerLabel,
  incompleteStudyEntryOverlapsRange,
  incompleteStudyEntryRangeLabel,
  incompleteStudyEntrySourceHint,
} from '../study/study-incomplete-visibility';
import { readFileSync } from 'node:fs';

function weekEntry(): UniversityImportEntry {
  return {
    id: 'source-week', importId: 'import', sourceKey: 'key', sourceOnly: true,
    sourceSheet: 'PLAN ZAJĘĆ', sourceRange: 'AW8',
    originalText: '12.10. - 16.10.2026 | 4c1 | POZ zajęcia praktyczne 40 godz. | Pierwsze spotkanie - szkolenie RODO i BHP od godz. 8.30; adresy jednostek będą podane',
    subject: 'POZ', activityType: 'Zajęcia praktyczne', groupScope: 'SPECIFIC', groupTags: ['G4:4C1'], warnings: [],
    sourceWeekStart: '2026-10-12', sourceWeekEnd: '2026-10-16', declaredTeachingHours: 40,
  };
}

describe('Build253 truthful Study source visibility', () => {
  it('keeps week-level source information attached to the source week without inventing a daily event', () => {
    const entry = weekEntry();
    expect(incompleteStudyEntryAppliesOnDate(entry, '2026-10-12')).toBe(true);
    expect(incompleteStudyEntryAppliesOnDate(entry, '2026-10-14')).toBe(true);
    expect(incompleteStudyEntryAppliesOnDate(entry, '2026-10-16')).toBe(true);
    expect(incompleteStudyEntryAppliesOnDate(entry, '2026-10-17')).toBe(false);
    expect(incompleteStudyEntryMarkerAppliesOnDate(entry, '2026-10-12')).toBe(true);
    expect(incompleteStudyEntryMarkerAppliesOnDate(entry, '2026-10-13')).toBe(false);
    expect(incompleteStudyEntryOverlapsRange(entry, '2026-10-12', '2026-10-18')).toBe(true);
    expect(entry.date).toBeUndefined();
    expect(incompleteStudyEntryDetail(entry)).toContain('Nie podaje konkretnego dnia ani pełnych godzin');
  });

  it('shows only information actually present in the source', () => {
    const entry = weekEntry();
    expect(incompleteStudyEntrySourceHint(entry)).toContain('RODO i BHP od godz. 8.30');
    expect(incompleteStudyEntryRangeLabel(entry)).toBe('12.10.2026 - 16.10.2026');
    expect(incompleteStudyEntryMarkerLabel(entry)).toBe('POZ · sprawdź');
  });

  it('uses neutral source wording in Month, Week and details instead of certainty levels', () => {
    const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
    const css = readFileSync('src/styles/components.css', 'utf8');
    expect(calendar).toContain('calendar-week-study-source-strip');
    expect(calendar).toContain('calendar-week-study-source-list');
    expect(calendar).toContain('Do sprawdzenia - plan studiów');
    expect(calendar).toContain('Sprawdź');
    expect(calendar).toContain('Wymiar w planie: {entry.declaredTeachingHours} godz.');
    expect(calendar).not.toContain('Plan wymaga potwierdzenia');
    expect(calendar).not.toContain('Niepełne dane z planu studiów');
    expect(css).toContain('1.2.0.264 - incomplete Study source data is visibly marked as requiring review');
  });
});
