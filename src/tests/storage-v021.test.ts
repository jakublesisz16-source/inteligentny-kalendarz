import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyGroupRecalculation,
  applyStudyCorrection,
  applyUniversityScheduleUpdate,
  commitUniversityImport,
  deleteDatabaseForTests,
  getStudyProfile,
  initializeDatabase,
  listEvents,
  listStudyCorrectionRules,
  listUniversityImportEntries,
  listUniversityImports,
  prepareGroupRecalculation,
  prepareUniversityScheduleUpdate,
  resetDatabaseConnectionForTests,
  updateEvent,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, group: string, patch: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-plan-v1',
    sourceSheet: 'PRAKTYKI',
    sourceRange: `A${id}`,
    sourceKey: `source-${id}`,
    originalText: `Farmakologia ${group}`,
    subject: 'Farmakologia',
    activityType: 'Ćwiczenia',
    date: '2026-03-10',
    startTime: '08:00',
    endTime: '09:30',
    groupScope: 'SPECIFIC',
    groupTags: [group],
    status: 'READY',
    warnings: [],
    include: true,
    ...patch,
  };
}

beforeEach(async () => {
  await deleteDatabaseForTests();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('legacy study schema and current lifecycle', () => {
  it('migruje legacy schema 2 do aktualnego schema bez utraty danych i backfilluje klucze serii', async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('startDateTime', 'startDateTime');
        events.createIndex('sourceImportId', 'sourceImportId');
        db.createObjectStore('locations', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        const imports = db.createObjectStore('universityImports', { keyPath: 'id' });
        imports.createIndex('fileHash', 'fileHash', { unique: true });
        imports.createIndex('importedAt', 'importedAt');
        const entries = db.createObjectStore('universityImportEntries', { keyPath: 'id' });
        entries.createIndex('importId', 'importId');
        entries.createIndex('eventId', 'eventId');
        db.createObjectStore('studyProfile', { keyPath: 'id' });
        const tx = request.transaction;
        if (!tx) return;
        tx.objectStore('meta').put({ key: 'seeded-locations-v1', value: true });
        tx.objectStore('events').put({
          id: 'legacy-study-event', title: 'Farmakologia', startDateTime: '2026-03-10T08:00', endDateTime: '2026-03-10T09:30',
          category: 'STUDY', source: 'UNIVERSITY_XLSX', sourceImportId: 'legacy-import', sourceEntryId: 'legacy-entry',
          userModified: true, createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z',
        });
        tx.objectStore('universityImports').put({
          id: 'legacy-import', fileName: 'stary-plan.xlsx', fileSize: 123, fileHash: 'legacy-hash', importedAt: '2026-03-01T00:00:00.000Z',
          adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'], selectedGroups: ['13A'], importedEventCount: 1, warningCount: 0, status: 'COMPLETED',
        });
        tx.objectStore('universityImportEntries').put({
          id: 'legacy-entry', importId: 'legacy-import', sourceKey: 'legacy-source', eventId: 'legacy-study-event', sourceSheet: 'PRAKTYKI', sourceRange: 'A1',
          originalText: 'Farmakologia 13A', subject: 'Farmakologia', activityType: 'Ćwiczenia', date: '2026-03-10', startTime: '08:00', endTime: '09:30',
          groupTags: ['13A'], warnings: [],
        });
        tx.objectStore('studyProfile').put({ id: 'university', selectedGroups: ['13A'], updatedAt: '2026-03-01T00:00:00.000Z' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });

    await initializeDatabase();
    const [event] = await listEvents();
    const [entry] = await listUniversityImportEntries('legacy-import');
    const [plan] = await listUniversityImports();
    const profile = await getStudyProfile();
    expect(event).toMatchObject({ id: 'legacy-study-event', userModified: true });
    expect(entry?.seriesKey).toMatch(/^series-/);
    expect(entry?.occurrenceKey).toMatch(/^occ-/);
    expect(event?.seriesKey).toBe(entry?.seriesKey);
    expect(plan?.lifecycleStatus).toBe('ACTIVE');
    expect(profile?.activeImportId).toBe('legacy-import');

    resetDatabaseConnectionForTests();
    const names = await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz');
      request.onsuccess = () => {
        const db = request.result;
        const result = Array.from(db.objectStoreNames);
        db.close();
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
    expect(names).toEqual(expect.arrayContaining(['scheduleUpdateSessions', 'studyCorrectionRules']));
  });

  it('propaguje brakujący adres tylko w tej samej serii i zapisuje regułę', async () => {
    await initializeDatabase();
    const sameSeriesSecond = candidate('b', '13A', { date: '2026-03-17', sourceKey: 'source-b', warnings: ['Brak dokładnego adresu.'], status: 'REVIEW_REQUIRED' });
    const differentGroup = candidate('c', '13B', { date: '2026-03-17', sourceKey: 'source-c', warnings: ['Brak dokładnego adresu.'], status: 'REVIEW_REQUIRED' });
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1, fileHash: 'correction-hash', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A', '13B'], availableGroups: ['13A', '13B'],
      candidates: [candidate('a', '13A', { warnings: ['Brak dokładnego adresu.'], status: 'REVIEW_REQUIRED' }), sameSeriesSecond, differentGroup],
      allCandidates: [candidate('a', '13A', { warnings: ['Brak dokładnego adresu.'], status: 'REVIEW_REQUIRED' }), sameSeriesSecond, differentGroup],
    });
    const events = await listEvents();
    const source = events.find((event) => event.title === 'Farmakologia' && event.startDateTime.startsWith('2026-03-10'));
    if (!source) throw new Error('Brak wydarzenia źródłowego.');
    const count = await applyStudyCorrection({ eventId: source.id, field: 'address', value: 'ul. Testowa 1, Warszawa', scope: 'SERIES' });
    expect(count).toBe(2);
    const imports = await listUniversityImports();
    const active = imports.find((item) => item.lifecycleStatus === 'ACTIVE');
    if (!active) throw new Error('Brak aktywnego importu.');
    const linked = (await listUniversityImportEntries(active.id)).filter((entry) => entry.eventId && !entry.sourceOnly);
    expect(linked.filter((entry) => entry.groupTags.includes('13A')).every((entry) => entry.address === 'ul. Testowa 1, Warszawa')).toBe(true);
    expect(linked.find((entry) => entry.groupTags.includes('13B'))?.address).toBeUndefined();
    expect((await listStudyCorrectionRules()).some((rule) => rule.field === 'address' && rule.value === 'ul. Testowa 1, Warszawa')).toBe(true);
  });

  it('aktualizacja planu zachowuje ręcznie zmienione pole, a aktualizuje niezależną godzinę', async () => {
    await initializeDatabase();
    await commitUniversityImport({
      fileName: 'plan-v1.xlsx', fileSize: 1, fileHash: 'update-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'], selectedGroups: ['13A'], availableGroups: ['13A'],
      candidates: [candidate('a', '13A')], allCandidates: [candidate('a', '13A')],
    });
    const [event] = await listEvents();
    if (!event) throw new Error('Brak wydarzenia.');
    await updateEvent(event.id, {
      title: 'Farmakologia - moja nazwa', startDateTime: event.startDateTime, endDateTime: event.endDateTime, category: event.category,
      ...(event.description ? { description: event.description } : {}), ...(event.locationId ? { locationId: event.locationId } : {}),
    });
    const next = candidate('new-a', '13A', { startTime: '09:00', endTime: '10:30', sourceKey: 'source-new-a' });
    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'plan-v2.xlsx', fileSize: 1, fileHash: 'update-v2', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'], selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [next], allCandidates: [next],
    });
    expect(preview.summary.changed).toBe(1);
    expect(preview.summary.conflicts).toBe(0);
    await applyUniversityScheduleUpdate(preview);
    const [updated] = await listEvents();
    expect(updated?.title).toBe('Farmakologia - moja nazwa');
    expect(updated?.startDateTime).toBe('2026-03-10T09:00');
    expect(updated?.userModified).toBe(true);
    expect(updated?.userModifiedFields).toContain('title');
  });

  it('przeliczenie grup chroni ręcznie zmienione usuwane zajęcie i dodaje nową grupę', async () => {
    await initializeDatabase();
    const groupA = candidate('a', '13A');
    const groupB = candidate('b', '13B', { date: '2026-03-11', sourceKey: 'source-b' });
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1, fileHash: 'groups-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'], selectedGroups: ['13A'], availableGroups: ['13A', '13B'],
      candidates: [groupA], allCandidates: [groupA, groupB],
    });
    const [event] = await listEvents();
    if (!event) throw new Error('Brak wydarzenia.');
    await updateEvent(event.id, { title: 'Moja zachowana Farmakologia', startDateTime: event.startDateTime, endDateTime: event.endDateTime, category: event.category });
    const preview = await prepareGroupRecalculation(['13B']);
    expect(preview.addedEntryIds).toHaveLength(1);
    expect(preview.removedEventIds).toHaveLength(1);
    expect(preview.protectedRemovedEventIds).toEqual([event.id]);
    await applyGroupRecalculation(preview);
    const events = await listEvents();
    expect(events.some((item) => item.title === 'Moja zachowana Farmakologia' && item.source === 'MANUAL')).toBe(true);
    expect(events.some((item) => item.source === 'UNIVERSITY_XLSX' && item.startDateTime.startsWith('2026-03-11'))).toBe(true);
  });
});
