import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyRecurringPatternToCandidates, applyRecurringStudyPatternAssumptions } from '../study/study-recurring-pattern-assumptions';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-week-matrix-v2',
    sourceSheet: 'PLAN ZAJĘĆ',
    sourceRange: `A${id}`,
    sourceKey: `source-${id}`,
    originalText: `source ${id}`,
    subject: 'INTERNA',
    activityType: 'Zajęcia praktyczne',
    date: `2026-10-${String(Number(id.replace(/\D/gu, '')) + 10).padStart(2, '0')}`,
    groupScope: 'SPECIFIC',
    groupTags: ['G8:7B'],
    status: 'READY',
    warnings: [],
    include: true,
    ...patch,
  };
}

function incomplete(id: string, patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  const result = candidate(id, {
    status: 'REVIEW_REQUIRED',
    include: false,
    warnings: [
      'Plan nie podaje jednoznacznego pełnego zakresu godzin dla tego wpisu w tygodniu 2026-10-12 - 2026-10-16.',
      'Nie udało się jednoznacznie ustalić lokalizacji.',
    ],
    ...patch,
  });
  delete result.startTime;
  delete result.endTime;
  delete result.address;
  delete result.room;
  return result;
}

describe('Build246 recurring Study pattern assumptions', () => {
  it('fills missing time and location only after two matching occurrences of the same subject/type/group', () => {
    const raw = [
      candidate('1', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1', room: 'sala 101' }),
      candidate('2', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1', room: 'sala 101' }),
      incomplete('3'),
    ];
    const result = applyRecurringPatternToCandidates(raw);
    const inferred = result.candidates.find((entry) => entry.id === '3');

    expect(inferred).toMatchObject({
      startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1', room: 'sala 101',
      status: 'READY', include: true,
    });
    expect(inferred?.inferredFields).toEqual(expect.arrayContaining(['startTime', 'endTime', 'address', 'room']));
    expect(inferred?.warnings).toEqual([]);
    expect(inferred?.inferenceNotes?.join(' ')).toContain('Oficjalna wartość z kolejnej wersji planu ma pierwszeństwo');
    expect(result.summary).toMatchObject({ inferredCandidateCount: 1, inferredTimeCandidateCount: 1, inferredLocationCandidateCount: 1 });

    expect(raw[2]?.startTime).toBeUndefined();
    expect(raw[2]?.warnings).toHaveLength(2);
  });

  it('does not guess when matching occurrences disagree about time or location', () => {
    const result = applyRecurringPatternToCandidates([
      candidate('1', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
      candidate('2', { startTime: '09:00', endTime: '15:00', address: 'ul. Testowa 2' }),
      incomplete('3'),
    ]);
    const unresolved = result.candidates.find((entry) => entry.id === '3');
    expect(unresolved?.startTime).toBeUndefined();
    expect(unresolved?.address).toBeUndefined();
    expect(unresolved?.status).toBe('REVIEW_REQUIRED');
    expect(result.summary.inferredCandidateCount).toBe(0);
  });

  it('never overwrites an explicit value from the current official plan', () => {
    const result = applyRecurringPatternToCandidates([
      candidate('1', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
      candidate('2', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
      candidate('3', { startTime: '10:00', endTime: '16:00', address: 'ul. Nowa 5' }),
    ]);
    const explicit = result.candidates.find((entry) => entry.id === '3');
    expect(explicit).toMatchObject({ startTime: '10:00', endTime: '16:00', address: 'ul. Nowa 5' });
    expect(explicit?.inferredFields).toBeUndefined();
  });

  it('does not infer a missing day/date and keeps that entry incomplete', () => {
    const result = applyRecurringPatternToCandidates([
      candidate('1', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
      candidate('2', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
      (() => {
        const entry = incomplete('3', { sourceWeekStart: '2026-10-12', sourceWeekEnd: '2026-10-16' });
        delete entry.date;
        return entry;
      })(),
    ]);
    const unresolved = result.candidates.find((entry) => entry.id === '3');
    expect(unresolved?.date).toBeUndefined();
    expect(unresolved?.startTime).toBe('08:00');
    expect(unresolved?.status).toBe('REVIEW_REQUIRED');
    expect(unresolved?.include).toBe(false);
  });

  it('keeps raw verified-source analysis separate and adds an explicit application-assumption note only to the enriched copy', () => {
    const analysis: ScheduleAnalysis = {
      adapterId: 'nursing-week-matrix-v2',
      sheetNames: ['PLAN ZAJĘĆ'],
      groups: ['G8:7B'],
      candidates: [
        candidate('1', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
        candidate('2', { startTime: '08:00', endTime: '14:00', address: 'ul. Testowa 1' }),
        incomplete('3'),
      ],
      information: [], warnings: [],
    };
    const enriched = applyRecurringStudyPatternAssumptions(analysis);
    expect(analysis.candidates[2]?.startTime).toBeUndefined();
    expect(enriched.candidates[2]?.startTime).toBe('08:00');
    expect(enriched.information.some((entry) => entry.title === 'Założenia z powtarzalnego wzorca')).toBe(true);
    expect(enriched.diagnostics?.recurringPatternInferredCandidateCount).toBe(1);
  });
  it('backfills an already active import from stored raw source entries without rewriting the raw entries', () => {
    const database = readFileSync(new URL('../storage/database.ts', import.meta.url), 'utf8');
    const studyView = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
    expect(database).toContain('applyRecurringAssumptionsToActiveStudyPlan');
    expect(database).toContain('const sourceEntries = entries.filter((entry) => entry.sourceOnly)');
    expect(database).toContain('const rawCandidates = sourceEntries.map(candidateFromEntry)');
    expect(database).toContain('description: `Zastosowano powtarzalny wzorzec: +${newEvents.length} wydarzeń, zaktualizowano ${updatedEvents.length}`');
    expect(database).toContain('addedEventCount: newEvents.length');
    expect(database).toContain('updatedEventCount: updatedEvents.length');
    expect(studyView).toContain('const assumptionUpdate = await applyRecurringAssumptionsToActiveStudyPlan()');
    expect(studyView).toContain('assumptionUpdate.updatedEventCount > 0');
  });

});
