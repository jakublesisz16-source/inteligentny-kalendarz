import { describe, expect, it } from 'vitest';
import {
  applyManualCorrection,
  classifyCandidateIssues,
  defaultIncludeForCandidate,
  deselectAllCandidates,
  reviewCandidate,
  selectAllImportable,
  toggleCandidateSelection,
} from '../study/import-review';
import type { StudyScheduleCandidate } from '../study/study.types';

type CandidatePatch = Omit<Partial<StudyScheduleCandidate>, 'date' | 'startTime' | 'endTime'> & {
  date?: string | undefined;
  startTime?: string | undefined;
  endTime?: string | undefined;
};

function candidate(patch: CandidatePatch = {}): StudyScheduleCandidate {
  const { date, startTime, endTime, ...rest } = patch;
  const result: StudyScheduleCandidate = {
    id: 'candidate',
    adapterId: 'test',
    sourceSheet: 'PRAKTYKI',
    sourceRange: 'A1',
    sourceKey: 'key',
    originalText: 'test',
    subject: 'Podstawy pielęgniarstwa',
    date: '2026-03-18',
    startTime: '08:00',
    endTime: '11:30',
    groupScope: 'SPECIFIC',
    groupTags: ['13A'],
    status: 'READY',
    warnings: [],
    ...rest,
  };
  if ('date' in patch) {
    if (date === undefined) delete result.date;
    else result.date = date;
  }
  if ('startTime' in patch) {
    if (startTime === undefined) delete result.startTime;
    else result.startTime = startTime;
  }
  if ('endTime' in patch) {
    if (endTime === undefined) delete result.endTime;
    else result.endTime = endTime;
  }
  return result;
}

function codes(value: StudyScheduleCandidate): string[] {
  return classifyCandidateIssues(value).map((entry) => entry.code);
}

describe('klasyfikacja problemów importu', () => {
  it('traktuje problem lokalizacji jako ostrzeżenie', () => {
    const value = candidate({ status: 'REVIEW_REQUIRED', warnings: ['Nie udało się jednoznacznie ustalić lokalizacji.'] });
    expect(reviewCandidate(value).state).toBe('WARNING');
    expect(codes(value)).toContain('AMBIGUOUS_LOCATION');
  });

  it('MISSING_ADDRESS jest WARNING', () => {
    const value = candidate({ status: 'REVIEW_REQUIRED' });
    const found = classifyCandidateIssues(value).find((entry) => entry.code === 'MISSING_ADDRESS');
    expect(found?.severity).toBe('WARNING');
  });

  it('brak daty jest BLOCKING', () => {
    const value = candidate({ date: undefined, status: 'REVIEW_REQUIRED' });
    expect(reviewCandidate(value).state).toBe('BLOCKING');
    expect(codes(value)).toContain('MISSING_DATE');
  });

  it('brak godziny początku jest BLOCKING', () => {
    const value = candidate({ startTime: undefined, status: 'REVIEW_REQUIRED' });
    expect(codes(value)).toContain('MISSING_START_TIME');
    expect(reviewCandidate(value).canImport).toBe(false);
  });

  it('brak godziny końca jest BLOCKING', () => {
    const value = candidate({ endTime: undefined, status: 'REVIEW_REQUIRED' });
    expect(codes(value)).toContain('MISSING_END_TIME');
    expect(reviewCandidate(value).canImport).toBe(false);
  });

  it('niepoprawny zakres czasu jest BLOCKING', () => {
    const value = candidate({ startTime: '12:00', endTime: '11:00', status: 'REVIEW_REQUIRED' });
    expect(codes(value)).toContain('INVALID_TIME_RANGE');
    expect(reviewCandidate(value).state).toBe('BLOCKING');
  });

  it('brak przedmiotu jest BLOCKING', () => {
    const value = candidate({ subject: '', status: 'REVIEW_REQUIRED' });
    expect(codes(value)).toContain('MISSING_SUBJECT');
    expect(reviewCandidate(value).state).toBe('BLOCKING');
  });

  it('ostrzeżenie lokalizacji plus brak końca daje BLOCKING', () => {
    const value = candidate({
      endTime: undefined,
      status: 'REVIEW_REQUIRED',
      warnings: ['Nie udało się jednoznacznie ustalić lokalizacji.'],
    });
    expect(reviewCandidate(value).state).toBe('BLOCKING');
  });
});

describe('domyślny wybór i akcje zbiorcze', () => {
  it('READY i WARNING są domyślnie zaznaczone, BLOCKING nie', () => {
    expect(defaultIncludeForCandidate(candidate())).toBe(true);
    expect(defaultIncludeForCandidate(candidate({ status: 'REVIEW_REQUIRED' }))).toBe(true);
    expect(defaultIncludeForCandidate(candidate({ endTime: undefined, status: 'REVIEW_REQUIRED' }))).toBe(false);
  });

  it('Zaznacz wszystkie możliwe pomija BLOCKING', () => {
    const values = selectAllImportable([
      candidate({ id: 'ready' }),
      candidate({ id: 'warning', status: 'REVIEW_REQUIRED' }),
      candidate({ id: 'blocking', status: 'REVIEW_REQUIRED', endTime: undefined }),
    ]);
    expect(values.map((entry) => [entry.id, entry.include])).toEqual([
      ['ready', true],
      ['warning', true],
      ['blocking', false],
    ]);
  });

  it('Odznacz wszystkie odznacza wszystkie wpisy', () => {
    expect(deselectAllCandidates([candidate({ include: true }), candidate({ id: 'b', include: true })]).every((entry) => entry.include === false)).toBe(true);
  });

  it('przełączenie karty zmienia selection tylko dla wpisu importowalnego', () => {
    expect(toggleCandidateSelection(candidate({ include: true })).include).toBe(false);
    expect(toggleCandidateSelection(candidate({ include: false })).include).toBe(true);
    expect(toggleCandidateSelection(candidate({ include: true, endTime: undefined, status: 'REVIEW_REQUIRED' })).include).toBe(false);
  });

  it('po poprawie problemu blokującego wpis staje się zaznaczony', () => {
    const blocking = candidate({ status: 'REVIEW_REQUIRED', endTime: undefined, include: false });
    const corrected = applyManualCorrection({ ...blocking, endTime: '12:30' });
    expect(reviewCandidate(corrected).state).toBe('WARNING');
    expect(corrected.include).toBe(true);
  });
});
