import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commitUniversityImport,
  createEvent,
  deleteDatabaseForTests,
  deleteUniversityImport,
  findUniversityImportByHash,
  initializeDatabase,
  listEvents,
  listLocations,
  listUniversityImports,
  resetDatabaseConnectionForTests,
  updateEvent,
} from '../storage/database';
import type { StudyScheduleCandidate } from '../study/study.types';

function readyCandidate(overrides: Partial<StudyScheduleCandidate> = {}): StudyScheduleCandidate {
  return {
    id: 'candidate-a',
    adapterId: 'nursing-plan-v1',
    sourceSheet: 'PRAKTYKI',
    sourceRange: 'D9:D12',
    sourceKey: 'source-a',
    originalText: 'Badanie fizykalne | 16.02. | grupa 13a',
    subject: 'Badanie fizykalne',
    activityType: 'Ćwiczenia',
    date: '2026-02-16',
    startTime: '08:00',
    endTime: '09:00',
    groupScope: 'SPECIFIC',
    groupTags: ['13A'],
    originalGroupText: 'grupa 13a',
    room: 'sala 205',
    address: 'ul. Testowa 1',
    status: 'READY',
    warnings: [],
    include: true,
    ...overrides,
  };
}

beforeEach(async () => {
  await deleteDatabaseForTests();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('university import storage', () => {
  it('zapisuje import, wpis źródłowy, wydarzenie i lokalizację', async () => {
    await initializeDatabase();
    const result = await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-a', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      detectedAcademicYear: '2025/2026', selectedGroups: ['13A'], candidates: [readyCandidate()],
    });
    expect(result.eventCount).toBe(1);
    expect(await listUniversityImports()).toHaveLength(1);
    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ source: 'UNIVERSITY_XLSX', sourceImportId: result.importRecord.id, studyGroupTags: ['13A'], studyGroupScope: 'SPECIFIC', userModified: false });
    expect((await listLocations()).some((location) => location.address === 'ul. Testowa 1')).toBe(true);
  });

  it('wykrywa ten sam fingerprint i nie pozwala utworzyć duplikatu', async () => {
    await initializeDatabase();
    const input = {
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'same-hash', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], candidates: [readyCandidate()],
    };
    await commitUniversityImport(input);
    expect(await findUniversityImportByHash('same-hash')).toBeTruthy();
    await expect(commitUniversityImport(input)).rejects.toThrow(/już wcześniej/);
    expect(await listEvents()).toHaveLength(1);
  });

  it('usunięcie importu usuwa jego wydarzenia, ale zachowuje MANUAL', async () => {
    await initializeDatabase();
    await createEvent({ title: 'Ręczne', startDateTime: '2026-02-16T12:00', endDateTime: '2026-02-16T13:00', category: 'PERSONAL' });
    const result = await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-delete', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], candidates: [readyCandidate()],
    });
    expect(await listEvents()).toHaveLength(2);
    await deleteUniversityImport(result.importRecord.id);
    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.source).toBe('MANUAL');
  });


  it('pomija kandydata wyłączonego przed importem', async () => {
    await initializeDatabase();
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-skip', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], candidates: [readyCandidate({ include: false })],
    });
    expect(await listEvents()).toHaveLength(0);
  });

  it('zapisuje ręcznie poprawione dane kandydata', async () => {
    await initializeDatabase();
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-reviewed', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], candidates: [readyCandidate({ subject: 'Poprawiony przedmiot', room: 'sala 104', manuallyReviewed: true })],
    });
    const events = await listEvents();
    expect(events[0]?.title).toBe('Poprawiony przedmiot');
    expect(events[0]?.description).toContain('sala 104');
  });

  it('ręczna edycja wydarzenia z XLSX zachowuje źródło i ustawia userModified', async () => {
    await initializeDatabase();
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-edit', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A'], candidates: [readyCandidate()],
    });
    const [event] = await listEvents();
    if (!event) throw new Error('Brak wydarzenia testowego.');
    const updated = await updateEvent(event.id, {
      title: 'Badanie fizykalne - poprawione',
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      category: event.category,
      ...(event.locationId ? { locationId: event.locationId } : {}),
      ...(event.description ? { description: event.description } : {}),
    });
    expect(updated).toMatchObject({ source: 'UNIVERSITY_XLSX', userModified: true, sourceImportId: event.sourceImportId, sourceEntryId: event.sourceEntryId });
  });

  it('wiele grup nie powoduje duplikacji jednego kandydata', async () => {
    await initializeDatabase();
    const candidate = readyCandidate({ groupTags: ['13A', '13B', '13C'] });
    await commitUniversityImport({
      fileName: 'plan.xlsx', fileSize: 1234, fileHash: 'hash-groups', adapterId: 'nursing-plan-v1', sheetNames: ['PRAKTYKI'],
      selectedGroups: ['13A', '13B'], candidates: [candidate],
    });
    expect(await listEvents()).toHaveLength(1);
  });
});

describe('migration legacy schema 1 -> current', () => {
  it('zachowuje dane starego schematu i dodaje nowe store-y', async () => {
    resetDatabaseConnectionForTests();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('events', { keyPath: 'id' });
        db.createObjectStore('locations', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
        const tx = request.transaction;
        if (!tx) return;
        tx.objectStore('events').put({
          id: 'legacy-event', title: 'Stare wydarzenie', startDateTime: '2026-08-01T10:00', endDateTime: '2026-08-01T11:00',
          category: 'OTHER', source: 'MANUAL', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
        });
        tx.objectStore('locations').put({
          id: 'legacy-location-home', name: 'Stare miejsce startowe', type: 'HOME_AREA',
          address: 'ul. Testowa 1, Testowo', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
        });
        tx.objectStore('settings').put({ id: 'app', preferredStartView: 'today', timeFormat: '24h', updatedAt: '2026-08-01T00:00:00.000Z' });
        tx.objectStore('meta').put({ key: 'seeded-locations-v1', value: true });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });

    await initializeDatabase();
    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'legacy-event', source: 'MANUAL', allDay: false, spanType: 'SINGLE_DAY' });
    expect((await listLocations()).filter((location) => location.id === 'legacy-location-home')).toHaveLength(1);

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
    expect(names).toEqual(expect.arrayContaining(['universityImports', 'universityImportEntries', 'studyProfile', 'scheduleUpdateSessions', 'studyCorrectionRules']));
  });
});
