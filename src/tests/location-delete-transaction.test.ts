import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import {
  createEvent,
  createLocation,
  deleteDatabaseForTests,
  deleteLocation,
  getSettings,
  getWorkProfile,
  initializeDatabase,
  listChangeJournal,
  listEvents,
  listLocations,
  saveWorkProfile,
  updateSettings,
} from '../storage/database';

const DB_NAME = 'inteligentny-kalendarz';

async function putImportedEvent(event: CalendarEvent): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Nie udało się otworzyć bazy testowej.'));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(event);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Nie udało się zapisać wydarzenia testowego.'));
      tx.onabort = () => reject(tx.error ?? new Error('Przerwano zapis wydarzenia testowego.'));
    });
  } finally {
    db.close();
  }
}

function importedEvent(input: {
  id: string;
  source: 'UNIVERSITY_XLSX' | 'WORK_PDF';
  locationId: string;
  category: 'STUDY' | 'WORK';
}): CalendarEvent {
  return {
    id: input.id,
    title: input.source === 'UNIVERSITY_XLSX' ? 'Zajęcia' : 'Praca',
    startDateTime: '2026-09-10T08:00',
    endDateTime: '2026-09-10T10:00',
    allDay: false,
    spanType: 'SINGLE_DAY',
    locationId: input.locationId,
    category: input.category,
    source: input.source,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(async () => {
  await deleteDatabaseForTests();
  await initializeDatabase();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await deleteDatabaseForTests();
});

describe('transakcyjne usuwanie lokalizacji', () => {
  it('atomowo usuwa lokalizację i wszystkie referencje bez utraty ochrony importów', async () => {
    const location = await createLocation({ name: 'Szpital', type: 'UNIVERSITY', address: 'ul. Testowa 1' });
    await updateSettings({ homeLocationId: location.id, workLocationId: location.id });
    await saveWorkProfile({
      employeeMatchName: 'Jan Testowy',
      employerName: 'Pracodawca',
      workplaceName: 'Oddział',
      locationId: location.id,
    });
    const manual = await createEvent({
      title: 'Ręczne',
      startDateTime: '2026-09-10T12:00',
      endDateTime: '2026-09-10T13:00',
      category: 'PERSONAL',
      locationId: location.id,
    });
    await putImportedEvent(importedEvent({ id: 'study-event', source: 'UNIVERSITY_XLSX', locationId: location.id, category: 'STUDY' }));
    await putImportedEvent(importedEvent({ id: 'work-event', source: 'WORK_PDF', locationId: location.id, category: 'WORK' }));
    await putImportedEvent({
      ...importedEvent({ id: 'legacy-study-event', source: 'UNIVERSITY_XLSX', locationId: location.id, category: 'STUDY' }),
      userModified: true,
    });

    await deleteLocation(location.id);

    expect((await listLocations()).find((item) => item.id === location.id)).toBeUndefined();
    const settings = await getSettings();
    expect(settings.homeLocationId).toBeUndefined();
    expect(settings.workLocationId).toBeUndefined();
    expect((await getWorkProfile())?.locationId).toBeUndefined();

    const events = await listEvents();
    const manualAfter = events.find((event) => event.id === manual.id);
    const studyAfter = events.find((event) => event.id === 'study-event');
    const workAfter = events.find((event) => event.id === 'work-event');
    const legacyStudyAfter = events.find((event) => event.id === 'legacy-study-event');
    expect(manualAfter?.locationId).toBeUndefined();
    expect(manualAfter?.userModified).toBeUndefined();
    expect(studyAfter?.locationId).toBeUndefined();
    expect(studyAfter?.userModified).toBe(true);
    expect(studyAfter?.userModifiedFields).toContain('locationId');
    expect(workAfter?.locationId).toBeUndefined();
    expect(workAfter?.userModified).toBe(true);
    expect(workAfter?.userModifiedFields).toContain('locationId');
    expect(legacyStudyAfter?.locationId).toBeUndefined();
    expect(legacyStudyAfter?.userModifiedFields).toEqual(expect.arrayContaining(['title', 'startDateTime', 'endDateTime', 'locationId', 'description', 'category']));

    const journal = await listChangeJournal();
    const deletion = journal.find((entry) => entry.operationType === 'DELETE_LOCATION');
    expect(deletion?.entityType).toBe('LOCATION');
    expect(deletion?.reversible).toBe(false);
    expect(deletion?.metadata).toMatchObject({ affectedEventCount: 4, affectedWorkProfileCount: 1, settingsAffected: true });
  });

  it('wycofuje całą operację, gdy błąd wystąpi po przygotowaniu zmian', async () => {
    const location = await createLocation({ name: 'Miejsce rollback', type: 'WORK', address: 'ul. Awaryjna 2' });
    await updateSettings({ homeLocationId: location.id, workLocationId: location.id });
    await saveWorkProfile({
      employeeMatchName: 'Jan Testowy',
      employerName: 'Pracodawca',
      workplaceName: 'Oddział',
      locationId: location.id,
    });
    await putImportedEvent(importedEvent({ id: 'rollback-study', source: 'UNIVERSITY_XLSX', locationId: location.id, category: 'STUDY' }));

    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, query: IDBValidKey | IDBKeyRange) {
      if (this.name === 'locations') throw new Error('FORCED_LOCATION_DELETE_FAILURE');
      return originalDelete.call(this, query);
    });

    await expect(deleteLocation(location.id)).rejects.toThrow('FORCED_LOCATION_DELETE_FAILURE');
    vi.restoreAllMocks();

    expect((await listLocations()).find((item) => item.id === location.id)).toBeDefined();
    const settings = await getSettings();
    expect(settings.homeLocationId).toBe(location.id);
    expect(settings.workLocationId).toBe(location.id);
    expect((await getWorkProfile())?.locationId).toBe(location.id);
    const event = (await listEvents()).find((item) => item.id === 'rollback-study');
    expect(event?.locationId).toBe(location.id);
    expect(event?.userModified).toBeUndefined();
    expect((await listChangeJournal()).some((entry) => entry.operationType === 'DELETE_LOCATION')).toBe(false);
  });
});
