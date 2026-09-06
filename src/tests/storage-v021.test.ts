import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyGroupRecalculation,
  applyStudyCorrection,
  applyUniversityScheduleUpdate,
  deleteEvent,
  deleteUniversityImport,
  commitUniversityImport,
  deleteDatabaseForTests,
  getActiveUniversityImport,
  getStudyProfile,
  initializeDatabase,
  listChangeJournal,
  listEvents,
  listTrashItems,
  listStudyCorrectionRules,
  listUniversityImportEntries,
  listUniversityImports,
  prepareGroupRecalculation,
  prepareUniversityScheduleUpdate,
  restoreTrashItem,
  resetDatabaseConnectionForTests,
  undoChange,
  updateEvent,
} from '../storage/database';
import type { StudyScheduleCandidate, StudySourceBlock } from '../study/study.types';

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


function sourceBlock(id: string, group: string, candidateIds: string[], patch: Partial<StudySourceBlock> = {}): StudySourceBlock {
  return {
    id,
    sourceSheet: 'PRAKTYKI',
    sourceRange: 'B8',
    sourceSectionKey: 'PRAKTYKI|B2:D2',
    subject: 'Farmakologia',
    activityType: 'Ćwiczenia',
    groupTags: [group],
    weekStart: '2026-03-09',
    weekEnd: '2026-03-13',
    weekdays: ['PONIEDZIAŁEK'],
    excludedDates: [],
    sourceHasFullTimeRange: true,
    candidateIds,
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
    const differentGroup = candidate('c', '13B', { date: '2026-03-18', sourceKey: 'source-c', warnings: ['Brak dokładnego adresu.'], status: 'REVIEW_REQUIRED' });
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

  it('zachowuje metadane niepełnego bloku źródłowego bez tworzenia fikcyjnego wydarzenia', async () => {
    await initializeDatabase();
    const complete = candidate('complete', '13A');
    const incomplete = candidate('incomplete-week', '13A', {
      include: false, status: 'REVIEW_REQUIRED',
      sourceKey: 'source-incomplete-week', sourceRange: 'AT18', subject: 'POZ', activityType: 'Zajęcia praktyczne',
      sourceWeekStart: '2027-01-04', sourceWeekEnd: '2027-01-08', sourceSectionKey: 'PLAN:AT2:AV2', declaredTeachingHours: 40,
      warnings: ['Plan źródłowy przypisuje grupę do tygodnia, ale nie podaje pełnego rozkładu dni i godzin.'],
    });
    delete incomplete.date;
    delete incomplete.startTime;
    delete incomplete.endTime;
    await commitUniversityImport({
      fileName: 'plan-source-block.xlsx', fileSize: 1, fileHash: 'source-block-meta-v1', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PLAN'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [complete], allCandidates: [complete, incomplete],
      sourceBlocks: [
        sourceBlock('complete-block', '13A', ['complete'], { weekStart: '2026-03-10', weekEnd: '2026-03-10', weekdays: ['WTOREK'] }),
        sourceBlock('incomplete-block', '13A', ['incomplete-week'], { sourceRange: 'AT18', sourceSectionKey: 'PLAN:AT2:AV2', subject: 'POZ', activityType: 'Zajęcia praktyczne', weekStart: '2027-01-04', weekEnd: '2027-01-08', weekdays: [], sourceHasFullTimeRange: false, declaredTeachingHours: 40 }),
      ],
    });
    const active = await getActiveUniversityImport();
    if (!active) throw new Error('Brak aktywnego planu.');
    const entries = await listUniversityImportEntries(active.id);
    expect(active.sourceBlocks).toHaveLength(2);
    expect(entries.find((entry) => entry.sourceOnly && entry.sourceKey === 'source-complete')?.sourceCandidateId).toBe('complete');
    const sourceOnly = entries.find((entry) => entry.sourceOnly && entry.sourceKey === 'source-incomplete-week');
    expect(sourceOnly).toMatchObject({
      subject: 'POZ', sourceWeekStart: '2027-01-04', sourceWeekEnd: '2027-01-08',
      sourceSectionKey: 'PLAN:AT2:AV2', declaredTeachingHours: 40,
    });
    expect(sourceOnly?.date).toBeUndefined();
    expect(sourceOnly?.eventId).toBeUndefined();
    expect(await listEvents()).toHaveLength(1);
    const recalculation = await prepareGroupRecalculation(['13A']);
    expect(recalculation.canRecalculate).toBe(true);
    expect(recalculation.requiresReupload).toBe(false);
  });


  it('blokuje zapis, jeśli kompletna semantyka bloku źródłowego straci oczekiwany dzień', async () => {
    await initializeDatabase();
    const monday = candidate('monday', '13A', { date: '2026-03-09', sourceKey: 'source-monday' });
    const broken = sourceBlock('broken-week', '13A', ['monday'], {
      weekStart: '2026-03-09', weekEnd: '2026-03-13',
      weekdays: ['PONIEDZIAŁEK', 'WTOREK'],
    });
    await expect(commitUniversityImport({
      fileName: 'broken-plan.xlsx', fileSize: 1, fileHash: 'broken-completeness-v1', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [monday], allCandidates: [monday], sourceBlocks: [broken],
    })).rejects.toThrow(/bramki kompletności|brakuje.*oczekiwanych dni/i);
    expect(await listEvents()).toHaveLength(0);
  });


  it('ponownie sprawdza kompletność przy przygotowaniu i zastosowaniu aktualizacji planu', async () => {
    await initializeDatabase();
    const original = candidate('original-complete', '13A');
    await commitUniversityImport({
      fileName: 'complete-v1.xlsx', fileSize: 1, fileHash: 'complete-v1', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [original], allCandidates: [original],
      sourceBlocks: [sourceBlock('original-block', '13A', ['original-complete'], { weekStart: '2026-03-10', weekEnd: '2026-03-10', weekdays: ['WTOREK'] })],
    });
    const next = candidate('next-complete', '13A', { sourceKey: 'source-next-complete' });
    const validBlock = sourceBlock('next-block', '13A', ['next-complete'], { weekStart: '2026-03-10', weekEnd: '2026-03-10', weekdays: ['WTOREK'] });
    await expect(prepareUniversityScheduleUpdate({
      fileName: 'broken-v2.xlsx', fileSize: 1, fileHash: 'broken-v2', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [next], allCandidates: [next],
      sourceBlocks: [{ ...validBlock, weekEnd: '2026-03-11', weekdays: ['WTOREK', 'ŚRODA'] }],
    })).rejects.toThrow(/bramki kompletności|brakuje.*oczekiwanych dni/i);

    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'complete-v2.xlsx', fileSize: 1, fileHash: 'complete-v2', adapterId: 'nursing-week-matrix-v2', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [next], allCandidates: [next], sourceBlocks: [validBlock],
    });
    expect(preview.sourceBlocks).toHaveLength(1);
    const tampered = { ...preview, sourceBlocks: [{ ...validBlock, weekEnd: '2026-03-11', weekdays: ['WTOREK', 'ŚRODA'] }] };
    await expect(applyUniversityScheduleUpdate(tampered)).rejects.toThrow(/bramki kompletności|brakuje.*oczekiwanych dni/i);
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
    const next = candidate('new-a', '13A', { startTime: '09:00', endTime: '10:30', sourceKey: 'source-new-a', sourceRange: 'Aa' });
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

  it('przeliczenie grup blokuje nowe konflikty godzin do świadomego potwierdzenia', async () => {
    await initializeDatabase();
    const groupA = candidate('a-conflict', '13A', { date: '2026-03-10', sourceKey: 'source-a-conflict' });
    const groupB1 = candidate('b1-conflict', '13B', { date: '2026-03-11', startTime: '15:00', endTime: '18:45', sourceKey: 'source-b1-conflict' });
    const groupB2 = candidate('b2-conflict', '13B', { subject: 'Interna', date: '2026-03-11', startTime: '15:15', endTime: '19:00', sourceKey: 'source-b2-conflict' });
    await commitUniversityImport({
      fileName: 'plan-conflicts.xlsx', fileSize: 1, fileHash: 'groups-conflicts-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'], selectedGroups: ['13A'], availableGroups: ['13A', '13B'],
      candidates: [groupA], allCandidates: [groupA, groupB1, groupB2],
    });
    const preview = await prepareGroupRecalculation(['13B']);
    expect(preview.scheduleConflicts).toHaveLength(1);
    // Warstwa zapisu nie może ufać tylko podglądowi z UI. Nawet po manipulacji/starym podglądzie
    // konflikt ma zostać ponownie policzony na aktualnych danych źródłowych.
    const stalePreview = { ...preview, scheduleConflicts: [] };
    await expect(applyGroupRecalculation(stalePreview)).rejects.toThrow(/podgląd.*ponownie/i);
    await expect(applyGroupRecalculation(preview, true)).resolves.toBeUndefined();
  });

  it('blokuje drugi pierwszy import, gdy istnieje aktywny plan', async () => {
    await initializeDatabase();
    const first = candidate('guard-a', '13A');
    await commitUniversityImport({
      fileName: 'plan-guard-v1.xlsx', fileSize: 1, fileHash: 'guard-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [first], allCandidates: [first],
    });
    const second = candidate('guard-b', '13A', { date: '2026-03-11', sourceKey: 'guard-source-b' });
    await expect(commitUniversityImport({
      fileName: 'plan-guard-v2.xlsx', fileSize: 1, fileHash: 'guard-v2', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [second], allCandidates: [second],
    })).rejects.toThrow(/aktywny plan/i);
    expect(await listEvents()).toHaveLength(1);
  });

  it('nie reaktywuje planu historycznego po usunięciu aktualnie aktywnego', async () => {
    await initializeDatabase();
    const first = candidate('history-a', '13A');
    await commitUniversityImport({
      fileName: 'history-v1.xlsx', fileSize: 1, fileHash: 'history-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [first], allCandidates: [first],
    });
    const next = candidate('history-a', '13A', { startTime: '09:00', endTime: '10:30' });
    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'history-v2.xlsx', fileSize: 1, fileHash: 'history-v2', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [next], allCandidates: [next],
    });
    await applyUniversityScheduleUpdate(preview);
    const active = await getActiveUniversityImport();
    if (!active) throw new Error('Brak aktywnego planu po aktualizacji.');
    await deleteUniversityImport(active.id);
    expect(await getActiveUniversityImport()).toBeUndefined();
    expect((await listUniversityImports()).some((item) => item.lifecycleStatus === 'HISTORICAL')).toBe(true);
  });

  it('utrzymuje świadomie usunięte zajęcie przez aktualizację, relinkuje je przy przywróceniu i poprawnie cofa przywrócenie', async () => {
    await initializeDatabase();
    const first = candidate('trash-a', '13A');
    await commitUniversityImport({
      fileName: 'trash-v1.xlsx', fileSize: 1, fileHash: 'trash-v1', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [first], allCandidates: [first],
    });
    const [originalEvent] = await listEvents();
    if (!originalEvent) throw new Error('Brak wydarzenia do testu Kosza.');
    await deleteEvent(originalEvent.id);
    expect(await listEvents()).toHaveLength(0);

    const next = candidate('trash-a', '13A', { startTime: '09:00', endTime: '10:30' });
    const preview = await prepareUniversityScheduleUpdate({
      fileName: 'trash-v2.xlsx', fileSize: 1, fileHash: 'trash-v2', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], availableGroups: ['13A'], candidates: [next], allCandidates: [next],
    });
    expect(preview.items.some((item) => item.oldEntry?.userDeleted && item.resolution === 'KEEP_USER')).toBe(true);
    await applyUniversityScheduleUpdate(preview);
    expect(await listEvents()).toHaveLength(0);

    const active = await getActiveUniversityImport();
    if (!active) throw new Error('Brak aktywnego planu po aktualizacji.');
    const beforeRestore = (await listUniversityImportEntries(active.id)).find((entry) => !entry.sourceOnly && entry.userDeleted);
    expect(beforeRestore).toBeTruthy();
    const [trash] = await listTrashItems();
    if (!trash) throw new Error('Brak wpisu w Koszu.');
    await restoreTrashItem(trash.id);

    const [restored] = await listEvents();
    expect(restored?.sourceImportId).toBe(active.id);
    expect(restored?.startDateTime).toBe('2026-03-10T09:00');
    const relinked = (await listUniversityImportEntries(active.id)).find((entry) => entry.eventId === restored?.id && !entry.sourceOnly);
    expect(relinked?.userDeleted).toBe(false);

    const journal = await listChangeJournal();
    const restoreOperation = journal.find((entry) => entry.operationType === 'RESTORE_TRASH' && !entry.undoneAt);
    if (!restoreOperation) throw new Error('Brak operacji przywrócenia w historii.');
    await undoChange(restoreOperation.id);
    expect(await listEvents()).toHaveLength(0);
    const afterUndo = (await listUniversityImportEntries(active.id)).find((entry) => entry.id === relinked?.id);
    expect(afterUndo?.userDeleted).toBe(true);
    expect(await listTrashItems()).toHaveLength(1);
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
