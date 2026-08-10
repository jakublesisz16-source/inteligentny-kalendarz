import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEvent,
  createManualEventSeries,
  deleteDatabaseForTests,
  deleteEvent,
  deleteManualEventSeries,
  initializeDatabase,
  listEvents,
  listManualSeriesEvents,
  resetDatabaseConnectionForTests,
  updateManualEventSeries,
} from '../storage/database';

beforeEach(async () => { await deleteDatabaseForTests(); });
afterEach(async () => { await deleteDatabaseForTests(); });

describe('schema 4 manual calendar', () => {
  it('tworzy serię kilku dat atomowo z jednym seriesId', async () => {
    await initializeDatabase();
    const created = await createManualEventSeries({
      title: 'Nauka', dates: ['2026-08-15', '2026-08-10', '2026-08-12'], startTime: '18:00', endTime: '20:00', allDay: false, category: 'STUDY',
    });
    expect(created).toHaveLength(3);
    expect(new Set(created.map((item) => item.id)).size).toBe(3);
    expect(new Set(created.map((item) => item.seriesId)).size).toBe(1);
    expect(created.map((item) => item.startDateTime.slice(0, 10))).toEqual(['2026-08-10', '2026-08-12', '2026-08-15']);
    expect(created.every((item) => item.source === 'MANUAL' && item.seriesType === 'MANUAL_MULTI_DATE' && item.allDay === false)).toBe(true);
  });

  it('edycja całej serii zachowuje własne daty wystąpień', async () => {
    await initializeDatabase();
    const created = await createManualEventSeries({
      title: 'Nauka', dates: ['2026-08-10', '2026-08-12', '2026-08-15'], startTime: '18:00', endTime: '20:00', allDay: false, category: 'STUDY',
    });
    const updated = await updateManualEventSeries(created[0]!.id, {
      title: 'Nauka farmakologii', startDateTime: '2026-08-10T19:00', endDateTime: '2026-08-10T21:00', allDay: false, spanType: 'SINGLE_DAY', category: 'STUDY',
    });
    expect(updated.map((item) => item.startDateTime)).toEqual(['2026-08-10T19:00', '2026-08-12T19:00', '2026-08-15T19:00']);
    expect(updated.every((item) => item.title === 'Nauka farmakologii')).toBe(true);
  });

  it('usuwa jedno wystąpienie albo całą serię bez ruszania innych wydarzeń', async () => {
    await initializeDatabase();
    const created = await createManualEventSeries({ title: 'Nauka', dates: ['2026-08-10', '2026-08-12', '2026-08-15'], startTime: '18:00', endTime: '20:00', allDay: false, category: 'STUDY' });
    await createEvent({ title: 'Osobne', startDateTime: '2026-08-10T09:00', endDateTime: '2026-08-10T10:00', category: 'OTHER' });
    await deleteEvent(created[0]!.id);
    expect(await listManualSeriesEvents(created[1]!.seriesId!)).toHaveLength(2);
    expect(await deleteManualEventSeries(created[1]!.seriesId!)).toBe(2);
    const left = await listEvents();
    expect(left).toHaveLength(1);
    expect(left[0]?.title).toBe('Osobne');
  });

  it('migruje schema 3 -> 4 bez reinterpretowania starych wydarzeń', async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('startDateTime', 'startDateTime');
        events.createIndex('sourceImportId', 'sourceImportId');
        events.createIndex('seriesKey', 'seriesKey');
        events.createIndex('occurrenceKey', 'occurrenceKey');
        db.createObjectStore('locations', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        const imports = db.createObjectStore('universityImports', { keyPath: 'id' });
        imports.createIndex('fileHash', 'fileHash', { unique: true });
        imports.createIndex('importedAt', 'importedAt');
        const entries = db.createObjectStore('universityImportEntries', { keyPath: 'id' });
        entries.createIndex('importId', 'importId');
        entries.createIndex('eventId', 'eventId');
        entries.createIndex('seriesKey', 'seriesKey');
        entries.createIndex('occurrenceKey', 'occurrenceKey');
        db.createObjectStore('studyProfile', { keyPath: 'id' });
        const sessions = db.createObjectStore('scheduleUpdateSessions', { keyPath: 'id' });
        sessions.createIndex('status', 'status'); sessions.createIndex('createdAt', 'createdAt');
        const corrections = db.createObjectStore('studyCorrectionRules', { keyPath: 'id' }); corrections.createIndex('seriesKey', 'seriesKey');
        const tx = request.transaction!;
        tx.objectStore('meta').put({ key: 'seeded-locations-v1', value: true });
        tx.objectStore('events').put({ id: 'old-manual', title: 'Stare', startDateTime: '2026-08-10T10:00', endDateTime: '2026-08-10T11:00', category: 'OTHER', source: 'MANUAL', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' });
        tx.objectStore('events').put({ id: 'old-study', title: 'Zajęcia', startDateTime: '2026-08-11T08:00', endDateTime: '2026-08-11T09:00', category: 'STUDY', source: 'UNIVERSITY_XLSX', userModified: true, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    await initializeDatabase();
    const events = await listEvents();
    expect(events).toHaveLength(2);
    expect(events.every((item) => item.allDay === false && item.spanType === 'SINGLE_DAY' && item.seriesId === undefined)).toBe(true);
    expect(events.find((item) => item.id === 'old-study')?.userModified).toBe(true);
  });
});
