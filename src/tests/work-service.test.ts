import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import {
  buildWorkOccurrenceKey,
  buildWorkScheduleDiff,
  coworkerOverlaps,
  detectCandidateCollisions,
  workDateTimes,
  workMinutes,
} from '../work/work.service';
import type { WorkCoworkerShift, WorkImportCandidate, WorkScheduleEntry } from '../work/work.types';

function candidate(date = '2026-08-10', startTime = '14:00', endTime = '22:00'): WorkImportCandidate {
  return {
    date, startTime, endTime, minutes: workMinutes(startTime, endTime), sourcePage: 1,
    status: 'READY', issues: [], workOccurrenceKey: buildWorkOccurrenceKey('primary-work', date, startTime, endTime),
  };
}

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1', title: 'Praca', startDateTime: '2026-08-10T14:00', endDateTime: '2026-08-10T22:00', allDay: false,
    spanType: 'SINGLE_DAY', category: 'WORK', source: 'WORK_PDF', sourceWorkImportId: 'old', sourceWorkEntryId: 'entry-1',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', ...patch,
  };
}

function entry(patch: Partial<WorkScheduleEntry> = {}): WorkScheduleEntry {
  return {
    id: 'entry-1', importId: 'old', profileId: 'primary-work', date: '2026-08-10', type: 'SHIFT', startTime: '14:00', endTime: '22:00',
    minutes: 480, status: 'READY', issues: [], sourcePage: 1, workOccurrenceKey: buildWorkOccurrenceKey('primary-work', '2026-08-10', '14:00', '22:00'),
    eventId: 'event-1', ...patch,
  };
}

describe('work domain', () => {
  it('traktuje 2-godzinną zmianę jako poprawny blok pracy', () => {
    expect(workMinutes('16:00', '18:00')).toBe(120);
  });

  it('reprezentuje zmianę przez północ na następnym dniu', () => {
    expect(workDateTimes('2026-12-31', '22:00', '02:00')).toEqual({
      startDateTime: '2026-12-31T22:00', endDateTime: '2027-01-01T02:00', crossesMidnight: true,
    });
  });

  it('rozróżnia overlap, touching i możliwy duplikat', () => {
    const candidates = [candidate()];
    const events: CalendarEvent[] = [
      event({ id: 'study', title: 'Zajęcia', category: 'STUDY', source: 'UNIVERSITY_XLSX', startDateTime: '2026-08-10T13:00', endDateTime: '2026-08-10T15:00' }),
      event({ id: 'touch', title: 'Spotkanie', category: 'PERSONAL', source: 'MANUAL', startDateTime: '2026-08-10T12:00', endDateTime: '2026-08-10T14:00' }),
      event({ id: 'manual', title: 'Praca ręczna', category: 'WORK', source: 'MANUAL' }),
    ];
    const kinds = detectCandidateCollisions(candidates, events).map((item) => item.kind);
    expect(kinds).toEqual(expect.arrayContaining(['OVERLAP', 'TOUCHING', 'POTENTIAL_DUPLICATE']));
  });

  it('wykrywa zmianę czasu i konflikt userModified podczas aktualizacji PDF', () => {
    const changed = buildWorkScheduleDiff([entry()], [candidate('2026-08-10', '15:00', '22:00')], new Map([['event-1', event()]]));
    expect(changed.summary.changed).toBe(1);
    const conflict = buildWorkScheduleDiff([entry()], [candidate('2026-08-10', '15:00', '22:00')], new Map([['event-1', event({ userModified: true })]]));
    expect(conflict.summary.conflicts).toBe(1);
  });

  it('pokazuje tylko osoby faktycznie nakładające się na zmianę', () => {
    const shifts: WorkCoworkerShift[] = [
      { id: 'a', importId: 'i', date: '2026-08-10', displayName: 'Anna Testowa', normalizedName: 'ANNA TESTOWA', startTime: '10:00', endTime: '18:00', minutes: 480, sourcePage: 1 },
      { id: 'b', importId: 'i', date: '2026-08-10', displayName: 'Beata Testowa', normalizedName: 'BEATA TESTOWA', startTime: '18:00', endTime: '22:00', minutes: 240, sourcePage: 1 },
      { id: 'c', importId: 'i', date: '2026-08-10', displayName: 'Celina Testowa', normalizedName: 'CELINA TESTOWA', startTime: '08:00', endTime: '12:00', minutes: 240, sourcePage: 1 },
      { id: 'd', importId: 'i', date: '2026-08-10', displayName: 'Dorota Testowa', normalizedName: 'DOROTA TESTOWA', startTime: '22:00', endTime: '23:00', minutes: 60, sourcePage: 1 },
    ];
    const result = coworkerOverlaps('2026-08-10', '14:00', '22:00', shifts);
    expect(result.map((item) => item.displayName)).toEqual(['Anna Testowa', 'Beata Testowa']);
    expect(result.map((item) => item.overlapMinutes)).toEqual([240, 240]);
  });
});
