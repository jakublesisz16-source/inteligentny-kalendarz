import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteDatabaseForTests,
  initializeDatabase,
  listExpenseCategories,
  listExpenseProducts,
  listReceipts,
  syncExpenseProductsFromReceipts,
} from '../storage/database';
import { DATABASE_SCHEMA_VERSION } from '../core/version';

beforeEach(async () => { await deleteDatabaseForTests(); });

function openLegacySchema13(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 13);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('restorePoints', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      const categories = db.createObjectStore('expenseCategories', { keyPath: 'id' });
      categories.put({
        id: 'expense-category-food',
        name: 'Jedzenie',
        sortOrder: 0,
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      });
      const receipts = db.createObjectStore('receipts', { keyPath: 'id' });
      receipts.createIndex('date', 'date');
      receipts.put({
        id: 'receipt-old',
        date: '2026-09-01',
        merchant: 'Biedronka',
        items: [{ id: 'item-old', name: 'MLEKO 3,2 1L', categoryId: 'expense-category-food', amountMinor: 499 }],
        totalMinor: 499,
        source: 'receipt',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

describe('schema 14 finance products migration', () => {
  it('adds expenseProducts without rewriting schema 13 receipts', async () => {
    expect(DATABASE_SCHEMA_VERSION).toBe(14);
    await openLegacySchema13();
    await initializeDatabase();

    const beforeSync = await listReceipts();
    expect(beforeSync).toHaveLength(1);
    expect(beforeSync[0]!.items[0]!.name).toBe('MLEKO 3,2 1L');
    expect(await listExpenseProducts()).toEqual([]);

    const products = await syncExpenseProductsFromReceipts();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      originalName: 'MLEKO 3,2 1L',
      name: 'MLEKO 3,2 1L',
      normalizedKey: 'mleko 3 2 1l',
      categoryId: 'expense-category-food',
      necessity: 'essential',
    });

    const afterSync = await listReceipts();
    expect(afterSync).toEqual(beforeSync);
    expect((await listExpenseCategories()).some((entry) => entry.id === 'expense-category-food')).toBe(true);

    const open = indexedDB.open('inteligentny-kalendarz');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    expect(db.version).toBe(14);
    expect([...db.objectStoreNames]).toContain('expenseProducts');
    db.close();
  });
});
