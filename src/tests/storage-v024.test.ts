import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_SCHEMA_VERSION } from '../core/version';
import {
  buildStudyGroupPreview,
  commitUniversityImport,
  createBackupFile,
  createEvent,
  createRestorePoint,
  deleteDatabaseForTests,
  deleteEvent,
  getStudyProfile,
  initializeDatabase,
  inspectBackupText,
  listActiveDayConstraints,
  listChangeJournal,
  listDayConstraints,
  listEvents,
  listRestorePoints,
  listStudyPreviewProfiles,
  listTrashItems,
  resetDatabaseConnectionForTests,
  restoreBackup,
  restoreRestorePoint,
  restoreTrashItem,
  saveStudyPreviewProfile,
  setWorkAvailabilityExcluded,
  undoChange,
  updateEvent,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, group: string, date = '2026-08-10'): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'nursing-plan-v1',
    sourceSheet: 'PRAKTYKI',
    sourceRange: `A${id}`,
    sourceKey: `source-${id}`,
    originalText: `Farmakologia ${group}`,
    subject: 'Farmakologia',
    activityType: 'Ćwiczenia',
    date,
    startTime: '08:00',
    endTime: '10:00',
    groupScope: 'SPECIFIC',
    groupTags: [group],
    status: 'READY',
    warnings: [],
    include: true,
  };
}

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

describe('legacy safety schema and isolated study preview', () => {
  it('przenosi wydarzenie do Kosza i bezpiecznie je przywraca', async () => {
    await initializeDatabase();
    const event = await createEvent({
      title: 'Test Kosza',
      startDateTime: '2026-08-12T12:00',
      endDateTime: '2026-08-12T14:00',
      category: 'OTHER',
    });

    await deleteEvent(event.id);
    expect(await listEvents()).toHaveLength(0);
    const trash = await listTrashItems();
    expect(trash).toHaveLength(1);
    expect(trash[0]?.displayName).toBe('Test Kosza');

    await restoreTrashItem(trash[0]!.id);
    expect((await listEvents()).map((item) => item.id)).toEqual([event.id]);
    expect(await listTrashItems()).toHaveLength(0);
  });

  it('cofa edycję pojedynczego wydarzenia przez Change Journal', async () => {
    await initializeDatabase();
    const event = await createEvent({
      title: 'Przed',
      startDateTime: '2026-08-12T12:00',
      endDateTime: '2026-08-12T14:00',
      category: 'OTHER',
    });
    await updateEvent(event.id, {
      title: 'Po',
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      category: event.category,
    });
    const edit = (await listChangeJournal()).find((item) => item.operationType === 'UPDATE_EVENT');
    if (!edit) throw new Error('Brak wpisu historii edycji.');

    await undoChange(edit.id);
    expect((await listEvents())[0]?.title).toBe('Przed');
    expect((await listChangeJournal()).find((item) => item.id === edit.id)?.undoneAt).toBeTruthy();
  });

  it('DayConstraint wyklucza automatyczną dyspozycyjność, ale nie blokuje ręcznej pracy', async () => {
    await initializeDatabase();
    await setWorkAvailabilityExcluded('2026-08-15', true, 'Prywatnie zajęty dzień');
    const constraints = await listActiveDayConstraints('2026-08-15', '2026-08-15');
    expect(constraints).toHaveLength(1);
    expect(constraints[0]?.type).toBe('EXCLUDE_FROM_WORK_AVAILABILITY');

    const work = await createEvent({
      title: 'Praca ręczna',
      startDateTime: '2026-08-15T16:00',
      endDateTime: '2026-08-15T18:00',
      category: 'WORK',
    });
    expect((await listEvents()).some((event) => event.id === work.id)).toBe(true);
    expect(await listActiveDayConstraints('2026-08-15', '2026-08-15')).toHaveLength(1);

    const change = (await listChangeJournal()).find((item) => item.operationType === 'SET_DAY_CONSTRAINT');
    if (!change) throw new Error('Brak wpisu historii ograniczenia dnia.');
    await undoChange(change.id);
    expect(await listActiveDayConstraints('2026-08-15', '2026-08-15')).toHaveLength(0);
    expect((await listEvents()).some((event) => event.id === work.id)).toBe(true);
  });

  it('backup ma checksum, dry run i wykrywa modyfikację pliku', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Backup event', startDateTime: '2026-08-16T10:00', endDateTime: '2026-08-16T11:00', category: 'OTHER' });
    await setWorkAvailabilityExcluded('2026-08-17', true);
    await saveStudyPreviewProfile('Grupa testowa', ['13B']);
    const backup = await createBackupFile();
    const inspection = await inspectBackupText(backup.text);
    expect(inspection.summary.events).toBe(1);
    expect(inspection.summary.dayConstraints).toBe(1);
    expect(inspection.summary.studyPreviewProfiles).toBe(1);
    expect(inspection.document.databaseSchemaVersion).toBe(DATABASE_SCHEMA_VERSION);

    const changed = JSON.parse(backup.text) as Record<string, unknown>;
    changed.appVersion = 'tampered';
    await expect(inspectBackupText(JSON.stringify(changed))).rejects.toThrow(/uszkodzony|zmieniony/i);
  });

  it('przywraca pełny backup i tworzy punkt bezpieczeństwa bieżącego stanu', async () => {
    await initializeDatabase();
    const first = await createEvent({ title: 'Stan A', startDateTime: '2026-08-18T10:00', endDateTime: '2026-08-18T11:00', category: 'OTHER' });
    const backup = await createBackupFile();
    const inspection = await inspectBackupText(backup.text);

    await updateEvent(first.id, { title: 'Stan B', startDateTime: first.startDateTime, endDateTime: first.endDateTime, category: first.category });
    await createEvent({ title: 'Dodatkowe', startDateTime: '2026-08-18T12:00', endDateTime: '2026-08-18T13:00', category: 'OTHER' });
    expect(await listEvents()).toHaveLength(2);

    await restoreBackup(inspection.document);
    const restored = await listEvents();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.title).toBe('Stan A');
    expect((await listRestorePoints()).some((point) => point.reason === 'BEFORE_BACKUP_RESTORE')).toBe(true);
  });

  it('restore point przywraca wcześniejszy logiczny stan', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Zostaje', startDateTime: '2026-08-19T10:00', endDateTime: '2026-08-19T11:00', category: 'OTHER' });
    const point = await createRestorePoint('Stan A');
    await createEvent({ title: 'Późniejsze', startDateTime: '2026-08-19T12:00', endDateTime: '2026-08-19T13:00', category: 'OTHER' });
    expect(await listEvents()).toHaveLength(2);

    await restoreRestorePoint(point.id);
    expect((await listEvents()).map((event) => event.title)).toEqual(['Zostaje']);
    expect((await listRestorePoints()).some((item) => item.reason === 'BEFORE_RESTORE_POINT')).toBe(true);
  });

  it('podgląd innej grupy nie zmienia głównego profilu ani wydarzeń kalendarza', async () => {
    await initializeDatabase();
    const group13A = candidate('13a', '13A', '2026-08-20');
    const group13B = candidate('13b', '13B', '2026-08-21');
    await commitUniversityImport({
      fileName: 'plan.xlsx',
      fileSize: 100,
      fileHash: 'preview-profile-hash',
      adapterId: 'nursing-plan-v1',
      sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'],
      availableGroups: ['13A', '13B'],
      candidates: [group13A],
      allCandidates: [group13A, group13B],
    });
    const beforeProfile = await getStudyProfile();
    const beforeEvents = await listEvents();

    const preview = await buildStudyGroupPreview(['13B']);
    expect(preview.requiresReupload).toBe(false);
    expect(preview.candidates).toHaveLength(1);
    expect(preview.candidates[0]?.groupTags).toEqual(['13B']);

    const afterProfile = await getStudyProfile();
    const afterEvents = await listEvents();
    expect(afterProfile?.selectedGroups).toEqual(beforeProfile?.selectedGroups);
    expect(afterProfile?.activeImportId).toBe(beforeProfile?.activeImportId);
    expect(afterEvents).toEqual(beforeEvents);

    await saveStudyPreviewProfile('Sprawdzenie 13B', ['13B']);
    const profiles = await listStudyPreviewProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.selectedGroups).toEqual(['13B']);
    expect((await getStudyProfile())?.selectedGroups).toEqual(['13A']);
    expect(await listEvents()).toHaveLength(1);
  });

  it('migruje legacy schema 4 do aktualnego schema bez zmiany istniejących eventów i tworzy wymagane store\'y', async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 4);
      request.onupgradeneeded = () => {
        const db = request.result;
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('startDateTime', 'startDateTime');
        events.createIndex('sourceImportId', 'sourceImportId');
        events.createIndex('seriesKey', 'seriesKey');
        events.createIndex('occurrenceKey', 'occurrenceKey');
        events.createIndex('seriesId', 'seriesId');
        db.createObjectStore('locations', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        const imports = db.createObjectStore('universityImports', { keyPath: 'id' });
        imports.createIndex('fileHash', 'fileHash', { unique: true });
        imports.createIndex('importedAt', 'importedAt');
        const entries = db.createObjectStore('universityImportEntries', { keyPath: 'id' });
        entries.createIndex('importId', 'importId'); entries.createIndex('eventId', 'eventId'); entries.createIndex('seriesKey', 'seriesKey'); entries.createIndex('occurrenceKey', 'occurrenceKey');
        db.createObjectStore('studyProfile', { keyPath: 'id' });
        const sessions = db.createObjectStore('scheduleUpdateSessions', { keyPath: 'id' }); sessions.createIndex('status', 'status'); sessions.createIndex('createdAt', 'createdAt');
        const corrections = db.createObjectStore('studyCorrectionRules', { keyPath: 'id' }); corrections.createIndex('seriesKey', 'seriesKey');
        request.transaction!.objectStore('meta').put({ key: 'seeded-locations-v1', value: true });
        request.transaction!.objectStore('events').put({
          id: 'schema4-event',
          title: 'Wyjazd',
          startDateTime: '2026-08-29T00:00',
          endDateTime: '2026-09-04T00:00',
          category: 'PERSONAL',
          source: 'MANUAL',
          allDay: true,
          spanType: 'MULTI_DAY',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });

    await initializeDatabase();
    const [event] = await listEvents();
    expect(event).toMatchObject({ id: 'schema4-event', allDay: true, spanType: 'MULTI_DAY' });
    expect(await listDayConstraints()).toHaveLength(0);

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
    expect(names).toEqual(expect.arrayContaining(['changeJournal', 'trashItems', 'restorePoints', 'dayConstraints', 'studyPreviewProfiles']));
  });
});
