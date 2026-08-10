import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATABASE_SCHEMA_VERSION } from '../core/version';
import {
  commitWorkScheduleImport,
  createBackupFile,
  createEvent,
  deleteDatabaseForTests,
  getConfirmedWorkMinutes,
  getWorkProfile,
  initializeDatabase,
  inspectBackupText,
  listCoworkersForWorkEvent,
  listEvents,
  listWorkCoworkerShifts,
  listWorkScheduleEntries,
  listWorkScheduleImports,
  resetDatabaseConnectionForTests,
  saveWorkProfile,
} from '../storage/database';
import { buildWorkOccurrenceKey } from '../work/work.service';

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

describe('legacy work schema and current work data', () => {
  it('zapisuje profil, grafik i minimalne dane zespołu oraz pokazuje overlap', async () => {
    await initializeDatabase();
    const profile = await saveWorkProfile({
      employeeMatchName: 'Anna Testowa', employerName: 'Sklep testowy', workplaceName: 'Galeria testowa', storeCoworkerSchedule: true,
    });
    const result = await commitWorkScheduleImport({
      profileId: profile.id, fileName: 'grafik.pdf', fileHash: 'work-hash-1', adapterId: 'retail-roster-v1', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      shifts: [{ date: '2026-08-10', startTime: '14:00', endTime: '22:00', minutes: 480, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: buildWorkOccurrenceKey(profile.id, '2026-08-10', '14:00', '22:00') }],
      coworkerShifts: [
        { date: '2026-08-10', displayName: 'Beata Testowa', normalizedName: 'BEATA TESTOWA', startTime: '12:00', endTime: '18:00', minutes: 360, sourcePage: 1 },
        { date: '2026-08-10', displayName: 'Celina Testowa', normalizedName: 'CELINA TESTOWA', startTime: '08:00', endTime: '12:00', minutes: 240, sourcePage: 1 },
      ],
    });
    expect(result.workImport.shiftCount).toBe(1);
    expect((await listWorkScheduleEntries(result.workImport.id))).toHaveLength(1);
    expect((await listWorkCoworkerShifts(result.workImport.id))).toHaveLength(2);
    const workEvent = (await listEvents()).find((event) => event.source === 'WORK_PDF');
    if (!workEvent) throw new Error('Brak wydarzenia WORK_PDF.');
    const coworkers = await listCoworkersForWorkEvent(workEvent.id);
    expect(coworkers.map((item) => item.displayName)).toEqual(['Beata Testowa']);
    expect(coworkers[0]?.overlapMinutes).toBe(240);
  });

  it('nie utrwala zespołu, gdy ustawienie prywatności jest wyłączone', async () => {
    await initializeDatabase();
    const profile = await saveWorkProfile({ employeeMatchName: 'Anna Testowa', employerName: '', workplaceName: '', storeCoworkerSchedule: false });
    const result = await commitWorkScheduleImport({
      profileId: profile.id, fileName: 'grafik.pdf', fileHash: 'work-hash-private', adapterId: 'retail-roster-v1', periodStart: '2026-09-01', periodEnd: '2026-09-30',
      shifts: [{ date: '2026-09-01', startTime: '16:00', endTime: '18:00', minutes: 120, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: buildWorkOccurrenceKey(profile.id, '2026-09-01', '16:00', '18:00') }],
      coworkerShifts: [{ date: '2026-09-01', displayName: 'Beata Testowa', normalizedName: 'BEATA TESTOWA', startTime: '16:00', endTime: '20:00', minutes: 240, sourcePage: 1 }],
    });
    expect(result.workImport.coworkerShiftCount).toBe(0);
    expect(await listWorkCoworkerShifts(result.workImport.id)).toHaveLength(0);
  });

  it('confirmed work łączy PDF i ręczną pracę, w tym krótkie 2h', async () => {
    await initializeDatabase();
    const profile = await saveWorkProfile({ employeeMatchName: 'Anna Testowa', employerName: '', workplaceName: '', storeCoworkerSchedule: false });
    await commitWorkScheduleImport({
      profileId: profile.id, fileName: 'grafik.pdf', fileHash: 'work-hash-2', adapterId: 'retail-roster-v1', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      shifts: [{ date: '2026-08-11', startTime: '16:00', endTime: '18:00', minutes: 120, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: buildWorkOccurrenceKey(profile.id, '2026-08-11', '16:00', '18:00') }], coworkerShifts: [],
    });
    await createEvent({ title: 'Praca ręczna', startDateTime: '2026-08-12T10:00', endDateTime: '2026-08-12T14:00', category: 'WORK' });
    expect(await getConfirmedWorkMinutes('2026-08-01', '2026-08-31')).toEqual({ importedWorkMinutes: 120, manualWorkMinutes: 240, totalConfirmedWorkMinutes: 360 });
  });

  it('backup aktualnego schema zawiera dane pracy i opcjonalne minimalne dane zespołu', async () => {
    await initializeDatabase();
    const profile = await saveWorkProfile({ employeeMatchName: 'Anna Testowa', employerName: '', workplaceName: '', storeCoworkerSchedule: true });
    await commitWorkScheduleImport({
      profileId: profile.id, fileName: 'grafik.pdf', fileHash: 'work-hash-backup', adapterId: 'retail-roster-v1', periodStart: '2026-08-01', periodEnd: '2026-08-31',
      shifts: [{ date: '2026-08-13', startTime: '14:00', endTime: '20:00', minutes: 360, sourcePage: 1, status: 'READY', issues: [], workOccurrenceKey: buildWorkOccurrenceKey(profile.id, '2026-08-13', '14:00', '20:00') }],
      coworkerShifts: [{ date: '2026-08-13', displayName: 'Beata Testowa', normalizedName: 'BEATA TESTOWA', startTime: '12:00', endTime: '18:00', minutes: 360, sourcePage: 1 }],
    });
    const backup = await createBackupFile();
    const inspection = await inspectBackupText(backup.text);
    expect(inspection.summary.workProfiles).toBe(1);
    expect(inspection.summary.workScheduleImports).toBe(1);
    expect(inspection.summary.workScheduleEntries).toBe(1);
    expect(inspection.summary.workCoworkerShifts).toBe(1);
    expect(inspection.document.databaseSchemaVersion).toBe(DATABASE_SCHEMA_VERSION);
  });

  it('migruje legacy schema 5 do aktualnego schema bez tworzenia prywatnego profilu pracy', async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 5);
      request.onupgradeneeded = () => {
        const db = request.result;
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('startDateTime', 'startDateTime'); events.createIndex('sourceImportId', 'sourceImportId'); events.createIndex('seriesKey', 'seriesKey'); events.createIndex('occurrenceKey', 'occurrenceKey'); events.createIndex('seriesId', 'seriesId');
        db.createObjectStore('locations', { keyPath: 'id' }); db.createObjectStore('settings', { keyPath: 'id' }); db.createObjectStore('meta', { keyPath: 'key' });
        const imports = db.createObjectStore('universityImports', { keyPath: 'id' }); imports.createIndex('fileHash', 'fileHash', { unique: true }); imports.createIndex('importedAt', 'importedAt');
        const entries = db.createObjectStore('universityImportEntries', { keyPath: 'id' }); entries.createIndex('importId', 'importId'); entries.createIndex('eventId', 'eventId'); entries.createIndex('seriesKey', 'seriesKey'); entries.createIndex('occurrenceKey', 'occurrenceKey');
        db.createObjectStore('studyProfile', { keyPath: 'id' });
        const sessions = db.createObjectStore('scheduleUpdateSessions', { keyPath: 'id' }); sessions.createIndex('status', 'status'); sessions.createIndex('createdAt', 'createdAt');
        const corrections = db.createObjectStore('studyCorrectionRules', { keyPath: 'id' }); corrections.createIndex('seriesKey', 'seriesKey');
        const journal = db.createObjectStore('changeJournal', { keyPath: 'id' }); journal.createIndex('timestamp', 'timestamp');
        const trash = db.createObjectStore('trashItems', { keyPath: 'id' }); trash.createIndex('deletedAt', 'deletedAt');
        const restore = db.createObjectStore('restorePoints', { keyPath: 'id' }); restore.createIndex('createdAt', 'createdAt');
        const constraints = db.createObjectStore('dayConstraints', { keyPath: 'id' }); constraints.createIndex('date', 'date'); constraints.createIndex('type', 'type');
        const previews = db.createObjectStore('studyPreviewProfiles', { keyPath: 'id' }); previews.createIndex('updatedAt', 'updatedAt');
        request.transaction!.objectStore('meta').put({ key: 'seeded-locations-v1', value: true });
        request.transaction!.objectStore('events').put({ id: 'old', title: 'Stare wydarzenie', startDateTime: '2026-08-01T10:00', endDateTime: '2026-08-01T11:00', allDay: false, spanType: 'SINGLE_DAY', category: 'OTHER', source: 'MANUAL', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error);
    });
    await initializeDatabase();
    expect((await listEvents()).map((event) => event.id)).toContain('old');
    expect(await getWorkProfile()).toBeUndefined();
    expect(await listWorkScheduleImports()).toHaveLength(0);
    resetDatabaseConnectionForTests();
    const stores = await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz');
      request.onsuccess = () => { const db = request.result; const names = Array.from(db.objectStoreNames); db.close(); resolve(names); }; request.onerror = () => reject(request.error);
    });
    expect(stores).toEqual(expect.arrayContaining(['workProfiles', 'workScheduleImports', 'workScheduleEntries', 'workCoworkerShifts']));
  });
});
