import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEvent,
  deleteDatabaseForTests,
  deleteEvent,
  getEvent,
  getSettings,
  initializeDatabase,
  listEvents,
  listLocations,
  updateEvent,
  updateSettings,
} from '../storage/database';

beforeEach(async () => {
  await deleteDatabaseForTests();
});

afterEach(async () => {
  await deleteDatabaseForTests();
});

describe('IndexedDB storage', () => {
  it('inicjalizuje nową bazę bez cudzych domyślnych lokalizacji', async () => {
    await initializeDatabase();
    const first = await listLocations();
    await initializeDatabase();
    const second = await listLocations();

    expect(first).toHaveLength(0);
    expect(second).toHaveLength(0);
  });

  it('tworzy, aktualizuje i usuwa wydarzenie', async () => {
    await initializeDatabase();
    const created = await createEvent({
      title: 'Test',
      startDateTime: '2026-08-12T10:00',
      endDateTime: '2026-08-12T11:00',
      category: 'OTHER',
    });

    expect((await listEvents())).toHaveLength(1);
    expect((await getEvent(created.id))?.title).toBe('Test');

    const updated = await updateEvent(created.id, {
      title: 'Test po zmianie',
      startDateTime: '2026-08-12T10:30',
      endDateTime: '2026-08-12T11:30',
      category: 'PERSONAL',
    });
    expect(updated.title).toBe('Test po zmianie');
    expect(updated.category).toBe('PERSONAL');

    await deleteEvent(created.id);
    expect(await listEvents()).toHaveLength(0);
  });

  it('zapisuje i odczytuje ustawienia', async () => {
    await initializeDatabase();
    const initial = await getSettings();
    expect(initial.timeFormat).toBe('24h');
    expect(initial.homeLocationId).toBeUndefined();
    expect(initial.workLocationId).toBeUndefined();

    await updateSettings({ preferredStartView: 'calendar', timeFormat: '12h' });
    const updated = await getSettings();
    expect(updated.preferredStartView).toBe('calendar');
    expect(updated.timeFormat).toBe('12h');
  });
});
