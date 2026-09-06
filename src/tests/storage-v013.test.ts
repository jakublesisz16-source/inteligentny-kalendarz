import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDatabaseForTests, initializeDatabase, listExpenseCategories, listShoppingItems } from '../storage/database';
import { DATABASE_SCHEMA_VERSION } from '../core/version';

beforeEach(async () => { await deleteDatabaseForTests(); });

function openLegacySchema12(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 12);
    request.onupgradeneeded = () => {
      const db = request.result;
      const shopping = db.createObjectStore('shoppingItems', { keyPath: 'id' });
      shopping.put({ id: 'legacy-shopping', name: 'Papier', isPurchased: false, createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z' });
      const work = db.createObjectStore('workScheduleEntries', { keyPath: 'id' });
      work.put({ id: 'legacy-work', importId: 'legacy-import', eventId: 'event-1', date: '2026-08-15' });
      db.createObjectStore('restorePoints', { keyPath: 'id' });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

describe('schema 13 migration', () => {
  it('upgrades schema 12 additively and preserves existing stores/data', async () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(13);
    await openLegacySchema12();
    await initializeDatabase();

    expect((await listShoppingItems()).map((item) => item.name)).toEqual(['Papier']);
    expect(await listExpenseCategories()).toHaveLength(11);

    const open = indexedDB.open('inteligentny-kalendarz');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    expect(db.version).toBe(13);
    expect([...db.objectStoreNames]).toContain('expenseCategories');
    expect([...db.objectStoreNames]).toContain('receipts');
    const tx = db.transaction('workScheduleEntries', 'readonly');
    const work = await new Promise<unknown>((resolve, reject) => {
      const request = tx.objectStore('workScheduleEntries').get('legacy-work');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(work).toBeTruthy();
    db.close();
  });
});
