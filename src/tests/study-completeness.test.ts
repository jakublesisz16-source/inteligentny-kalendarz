import { describe, expect, it } from 'vitest';
import { auditStudyScheduleCompleteness, completenessForSelectedGroups, expectedDatesForSourceBlock } from '../study/study-completeness';
import type { ScheduleAnalysis, StudyScheduleCandidate, StudySourceBlock } from '../study/study.types';

function candidate(id: string, date: string | undefined, groupTag = 'G8:1A', startTime = '08:00', endTime = '11:00'): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN',
    sourceRange: id,
    sourceKey: `source-${id}`,
    originalText: `Test ${id}`,
    subject: 'TEST PRAKTYCZNY',
    activityType: 'Zajęcia praktyczne',
    ...(date ? { date } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    groupScope: 'SPECIFIC',
    groupTags: [groupTag],
    status: date && startTime && endTime ? 'READY' : 'REVIEW_REQUIRED',
    warnings: date && startTime && endTime ? [] : ['Brak pełnych danych w planie źródłowym.'],
    include: true,
  };
}

function block(patch: Partial<StudySourceBlock> = {}): StudySourceBlock {
  return {
    id: 'block-a',
    sourceSheet: 'PLAN',
    sourceRange: 'B8',
    sourceSectionKey: 'PLAN:B2:D2',
    subject: 'TEST PRAKTYCZNY',
    activityType: 'Zajęcia praktyczne',
    groupTags: ['G8:1A'],
    weekStart: '2026-10-05',
    weekEnd: '2026-10-09',
    weekdays: ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'],
    excludedDates: [],
    sourceHasFullTimeRange: true,
    declaredTeachingHours: 20,
    candidateIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
    ...patch,
  };
}

const weekDates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];

describe('study schedule completeness gate', () => {
  it('rozwija blok poniedziałek-piątek do dokładnie pięciu oczekiwanych dat', () => {
    expect(expectedDatesForSourceBlock(block())).toEqual(weekDates);
    const candidates = weekDates.map((date, index) => candidate(`c${index + 1}`, date));
    const audit = auditStudyScheduleCompleteness({ candidates, sourceBlocks: [block()] });
    expect(audit.safe).toBe(true);
    expect(audit.completeBlockCount).toBe(1);
    expect(audit.blockingBlockCount).toBe(0);
    expect(audit.hourAudits).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'MATCH', enforcement: 'STRICT', confirmedTeachingHours: 20 })]));
  });

  it('blokuje import, jeśli z kompletnego bloku pon-pt zniknie jeden oczekiwany dzień', () => {
    const candidates = weekDates.slice(0, 4).map((date, index) => candidate(`c${index + 1}`, date));
    const audit = auditStudyScheduleCompleteness({ candidates, sourceBlocks: [block({ candidateIds: ['c1', 'c2', 'c3', 'c4'] })] });
    expect(audit.safe).toBe(false);
    expect(audit.blockingBlockCount).toBe(1);
    expect(audit.reasons.join(' ')).toContain('2026-10-09');
  });

  it('blokuje kompletny źródłowo blok, gdy bilans godzin jest niższy od deklaracji', () => {
    const candidates = weekDates.map((date, index) => candidate(`c${index + 1}`, date, 'G8:1A', '08:00', index === 4 ? '10:00' : '11:00'));
    const audit = auditStudyScheduleCompleteness({ candidates, sourceBlocks: [block()] });
    expect(audit.safe).toBe(false);
    expect(audit.hourAudits[0]).toMatchObject({ enforcement: 'STRICT', status: 'MISMATCH' });
    expect(audit.reasons.join(' ')).toContain('źródło deklaruje 20 godz.');
  });

  it('nie zgaduje 40-godzinnego tygodnia bez dni i godzin - zachowuje go jako bezpiecznie niepełny', () => {
    const incomplete = candidate('poz-week', undefined, 'G4:12B1', '', '');
    const sourceBlock = block({
      id: 'poz-block',
      sourceRange: 'AT18',
      sourceSectionKey: 'PLAN:AT2:AV2',
      subject: 'POZ',
      groupTags: ['G4:12B1'],
      weekStart: '2027-01-04',
      weekEnd: '2027-01-08',
      weekdays: [],
      sourceHasFullTimeRange: false,
      declaredTeachingHours: 40,
      candidateIds: ['poz-week'],
    });
    const audit = auditStudyScheduleCompleteness({ candidates: [incomplete], sourceBlocks: [sourceBlock] });
    expect(audit.safe).toBe(true);
    expect(audit.incompleteSourceBlockCount).toBe(1);
    expect(audit.hourAudits[0]).toMatchObject({ enforcement: 'STRICT', status: 'SOURCE_INCOMPLETE', confirmedTeachingHours: 0 });
  });

  it('wykrywa niespójność deklaracji godzin seminarium bez dopisywania fikcyjnych zajęć i bez blokowania importu', () => {
    const seminarCandidates = [
      candidate('s1', '2026-10-06', 'G8:1A', '16:00', '18:45'),
      candidate('s2', '2026-10-07', 'G8:1A', '08:00', '11:45'),
    ].map((item) => ({ ...item, activityType: 'Seminarium', subject: 'TEST SEMINARIUM' }));
    const sourceBlock = block({
      id: 'seminar-block', subject: 'TEST SEMINARIUM', activityType: 'Seminarium',
      declaredTeachingHours: 15, weekdays: [], exceptionDate: '2026-10-06',
      candidateIds: seminarCandidates.map((item) => item.id),
    });
    const audit = auditStudyScheduleCompleteness({ candidates: seminarCandidates, sourceBlocks: [sourceBlock] });
    expect(audit.safe).toBe(true);
    expect(audit.hourAudits[0]).toMatchObject({ enforcement: 'ADVISORY', status: 'SOURCE_INCONSISTENT' });
  });

  it('audyt wybranych grup ignoruje blok należący wyłącznie do innej grupy', () => {
    const goodCandidates = weekDates.map((date, index) => candidate(`a${index + 1}`, date, 'G8:1A'));
    const badCandidates = weekDates.slice(0, 4).map((date, index) => candidate(`b${index + 1}`, date, 'G8:1B'));
    const analysis: ScheduleAnalysis = {
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN'],
      groups: ['G8:1A', 'G8:1B'],
      candidates: [...goodCandidates, ...badCandidates],
      information: [],
      warnings: [],
      sourceBlocks: [
        block({ id: 'a', groupTags: ['G8:1A'], candidateIds: goodCandidates.map((item) => item.id) }),
        block({ id: 'b', groupTags: ['G8:1B'], candidateIds: badCandidates.map((item) => item.id) }),
      ],
    };
    expect(auditStudyScheduleCompleteness(analysis).safe).toBe(false);
    expect(completenessForSelectedGroups(analysis, ['G8:1A']).safe).toBe(true);
  });
});
