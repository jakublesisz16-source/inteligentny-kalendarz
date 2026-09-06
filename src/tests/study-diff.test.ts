import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { buildScheduleDiff } from '../study/study-diff';
import { identifyCandidate, identifyEntry } from '../study/study-identity';
import type { StudyScheduleCandidate, UniversityImportEntry } from '../study/study.types';

function candidate(patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return identifyCandidate({
    id: 'new-a', adapterId: 'nursing-plan-v1', sourceSheet: 'PRAKTYKI', sourceRange: 'A1', sourceKey: 'source-a', originalText: 'test',
    subject: 'Farmakologia', activityType: 'Ćwiczenia', date: '2026-03-21', startTime: '08:00', endTime: '10:00', groupScope: 'SPECIFIC', groupTags: ['13A'],
    room: '204', address: 'ul. Testowa 1', status: 'READY', warnings: [], ...patch,
  });
}

function entry(patch: Partial<UniversityImportEntry> = {}): UniversityImportEntry {
  return identifyEntry({
    id: 'old-a', importId: 'old-import', adapterId: 'nursing-plan-v1', eventId: 'event-a', sourceKey: 'source-a', sourceSheet: 'PRAKTYKI', sourceRange: 'A1', originalText: 'test',
    subject: 'Farmakologia', activityType: 'Ćwiczenia', date: '2026-03-21', startTime: '08:00', endTime: '10:00', groupScope: 'SPECIFIC', groupTags: ['13A'],
    room: '204', address: 'ul. Testowa 1', warnings: [], ...patch,
  });
}

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-a', title: 'Farmakologia', startDateTime: '2026-03-21T08:00', endDateTime: '2026-03-21T10:00', allDay: false, spanType: 'SINGLE_DAY', category: 'STUDY', source: 'UNIVERSITY_XLSX',
    sourceImportId: 'old-import', sourceEntryId: 'old-a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...patch,
  };
}

describe('schedule diff', () => {
  it('rozpoznaje brak zmian', () => {
    const result = buildScheduleDiff({ oldEntries: [entry()], oldEvents: [event()], newCandidates: [candidate()], adapterId: 'nursing-plan-v1' });
    expect(result.summary.unchanged).toBe(1);
  });

  it('rozpoznaje nowe wydarzenie', () => {
    const result = buildScheduleDiff({ oldEntries: [], oldEvents: [], newCandidates: [candidate()], adapterId: 'nursing-plan-v1' });
    expect(result.summary.added).toBe(1);
  });

  it('rozpoznaje usunięte wydarzenie', () => {
    const result = buildScheduleDiff({ oldEntries: [entry()], oldEvents: [event()], newCandidates: [], adapterId: 'nursing-plan-v1' });
    expect(result.summary.removed).toBe(1);
  });

  it('rozpoznaje zmianę czasu w jednej pozycji', () => {
    const result = buildScheduleDiff({ oldEntries: [entry()], oldEvents: [event()], newCandidates: [candidate({ startTime: '09:00', endTime: '11:00' })], adapterId: 'nursing-plan-v1' });
    expect(result.summary.changed).toBe(1);
    expect(result.items[0]?.changeTypes).toContain('CHANGED_TIME');
  });

  it('łączy zmianę sali i czasu w jeden diff', () => {
    const result = buildScheduleDiff({ oldEntries: [entry()], oldEvents: [event()], newCandidates: [candidate({ startTime: '09:00', endTime: '11:00', room: '308' })], adapterId: 'nursing-plan-v1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.changes.map((change) => change.field)).toEqual(expect.arrayContaining(['startTime', 'endTime', 'room']));
  });

  it('ręczna zmiana kolidująca z nowym planem tworzy konflikt', () => {
    const result = buildScheduleDiff({
      oldEntries: [entry()],
      oldEvents: [event({ userModified: true, userModifiedFields: ['locationId'] })],
      newCandidates: [candidate({ address: 'ul. Nowa 1' })],
      adapterId: 'nursing-plan-v1',
    });
    expect(result.summary.conflicts).toBe(1);
    expect(result.items[0]?.resolution).toBe('SKIP');
  });
  it('rozpoznaje zmianę grupy po stabilnym sourceKey zamiast tworzyć add/remove', () => {
    const result = buildScheduleDiff({ oldEntries: [entry()], oldEvents: [event()], newCandidates: [candidate({ groupTags: ['13B'] })], adapterId: 'nursing-plan-v1' });
    expect(result.summary.changed).toBe(1);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.items[0]?.changeTypes).toContain('CHANGED_GROUP');
  });

  it('nie gubi wpisu świadomie usuniętego przez użytkownika podczas budowania diffu', () => {
    const deleted = entry({ userDeleted: true });
    delete deleted.eventId;
    const result = buildScheduleDiff({ oldEntries: [deleted], oldEvents: [], newCandidates: [candidate()], adapterId: 'nursing-plan-v1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.oldEntry?.userDeleted).toBe(true);
  });

  it('zmiana daty koliduje z ręczną zmianą zarówno początku, jak i końca wydarzenia', () => {
    for (const field of ['startDateTime', 'endDateTime'] as const) {
      const result = buildScheduleDiff({
        oldEntries: [entry()],
        oldEvents: [event({ userModified: true, userModifiedFields: [field] })],
        newCandidates: [candidate({ date: '2026-03-22' })],
        adapterId: 'nursing-plan-v1',
      });
      expect(result.summary.conflicts).toBe(1);
    }
  });

  it('ostrożny fallback nie łączy usunięcia i nowego wpisu z różnych komórek źródłowych', () => {
    const result = buildScheduleDiff({
      oldEntries: [entry({ id: 'old-cancelled', eventId: 'event-cancelled', sourceKey: 'old-key', sourceRange: 'A3', date: '2026-03-23' })],
      oldEvents: [event({ id: 'event-cancelled', sourceEntryId: 'old-cancelled', startDateTime: '2026-03-23T08:00', endDateTime: '2026-03-23T10:00' })],
      newCandidates: [candidate({ id: 'new-extra', sourceKey: 'new-key', sourceRange: 'A4', date: '2026-03-25' })],
      adapterId: 'nursing-plan-v1',
    });
    expect(result.summary).toMatchObject({ added: 1, removed: 1, changed: 0, ambiguous: 0 });
  });

  it('ostrożny fallback może rozpoznać przesunięcie w tej samej komórce źródłowej mimo zmiany sourceKey', () => {
    const result = buildScheduleDiff({
      oldEntries: [entry({ id: 'old-move', eventId: 'event-move', sourceKey: 'old-key', sourceRange: 'A2', date: '2026-03-22' })],
      oldEvents: [event({ id: 'event-move', sourceEntryId: 'old-move', startDateTime: '2026-03-22T08:00', endDateTime: '2026-03-22T10:00' })],
      newCandidates: [candidate({ id: 'new-move', sourceKey: 'new-key', sourceRange: 'A2', date: '2026-03-24' })],
      adapterId: 'nursing-plan-v1',
    });
    expect(result.summary).toMatchObject({ added: 0, removed: 0, changed: 1, ambiguous: 0 });
    expect(result.items[0]?.changeTypes).toContain('CHANGED_DATE');
  });

  it('obsługuje jednocześnie dodanie, usunięcie, przesunięcie i brak zmian bez duplikatów', () => {
    const oldEntries = [
      entry({ id: 'old-unchanged', eventId: 'event-unchanged', sourceKey: 'source-unchanged', sourceRange: 'A1' }),
      entry({ id: 'old-moved', eventId: 'event-moved', sourceKey: 'source-moved', sourceRange: 'A2', date: '2026-03-22' }),
      entry({ id: 'old-removed', eventId: 'event-removed', sourceKey: 'source-removed', sourceRange: 'A3', date: '2026-03-23' }),
    ];
    const oldEvents = [
      event({ id: 'event-unchanged', sourceEntryId: 'old-unchanged' }),
      event({ id: 'event-moved', sourceEntryId: 'old-moved', startDateTime: '2026-03-22T08:00', endDateTime: '2026-03-22T10:00' }),
      event({ id: 'event-removed', sourceEntryId: 'old-removed', startDateTime: '2026-03-23T08:00', endDateTime: '2026-03-23T10:00' }),
    ];
    const newCandidates = [
      candidate({ id: 'new-unchanged', sourceKey: 'source-unchanged', sourceRange: 'A1' }),
      candidate({ id: 'new-moved', sourceKey: 'source-moved', sourceRange: 'A2', date: '2026-03-24' }),
      candidate({ id: 'new-added', sourceKey: 'source-added', sourceRange: 'A4', date: '2026-03-25' }),
    ];
    const result = buildScheduleDiff({ oldEntries, oldEvents, newCandidates, adapterId: 'nursing-plan-v1' });
    expect(result.summary).toMatchObject({ added: 1, removed: 1, changed: 1, conflicts: 0, unchanged: 1, ambiguous: 0 });
    expect(result.items).toHaveLength(4);
  });

});
