import { describe, expect, it } from 'vitest';
import { candidatesForSelectedGroups } from '../study/study.service';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, groups: string[], scope: StudyScheduleCandidate['groupScope'] = 'SPECIFIC'): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'test',
    sourceSheet: 'PRAKTYKI',
    sourceRange: id,
    sourceKey: id,
    originalText: id,
    subject: `Przedmiot ${id}`,
    date: '2026-02-16',
    startTime: '08:00',
    endTime: '09:00',
    groupScope: scope,
    groupTags: groups,
    status: 'READY',
    warnings: [],
    include: true,
  };
}

const analysis: ScheduleAnalysis = {
  adapterId: 'test',
  sheetNames: ['PRAKTYKI'],
  groups: ['1', '10', '13A'],
  candidates: [
    candidate('a', ['1']),
    candidate('b', ['10']),
    candidate('c', ['13A']),
    candidate('all', [], 'ALL'),
    { ...candidate('unknown', [], 'UNKNOWN'), status: 'REVIEW_REQUIRED', include: false },
  ],
  information: [],
  warnings: [],
};

describe('candidatesForSelectedGroups', () => {
  it('wybiera dokładną grupę i zajęcia wspólne', () => {
    const result = candidatesForSelectedGroups(analysis, ['1']);
    expect(result.map((item) => item.id).sort()).toEqual(['a', 'all', 'unknown']);
  });

  it('łączy wiele wybranych grup bez substring matching', () => {
    const result = candidatesForSelectedGroups(analysis, ['10', '13A']);
    expect(result.map((item) => item.id).sort()).toEqual(['all', 'b', 'c', 'unknown']);
  });
});
