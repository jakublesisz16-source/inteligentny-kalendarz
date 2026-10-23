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

  it('odrzuca błędne daty przy bezpośrednim tworzeniu i edycji, bez modyfikacji rekordu', async () => {
    await initializeDatabase();
    const valid = {
      title: 'Poprawny termin', startDateTime: '2028-02-29T09:00', endDateTime: '2028-02-29T10:00', category: 'PERSONAL' as const,
    };
    await expect(createEvent({ ...valid, startDateTime: '2026-02-31T09:00' })).rejects.toThrow();
    expect(await listEvents()).toHaveLength(0);

    const saved = await createEvent(valid);
    await expect(updateEvent(saved.id, { ...valid, endDateTime: '2028-02-29T08:00' })).rejects.toThrow();
    await expect(updateEvent(saved.id, { ...valid, title: '   ' })).rejects.toThrow();
    const after = await getEvent(saved.id);
    expect(after?.title).toBe('Poprawny termin');
    expect(after?.startDateTime).toBe('2028-02-29T09:00');
    expect(after?.endDateTime).toBe('2028-02-29T10:00');
    expect(await listEvents()).toHaveLength(1);
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
