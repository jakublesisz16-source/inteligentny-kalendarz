import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBackupFile,
  createShoppingItem,
  createRestorePoint,
  deleteDatabaseForTests,
  deletePurchasedShoppingItems,
  deleteShoppingItem,
  getLatestReversibleChange,
  initializeDatabase,
  inspectBackupText,
  listChangeJournal,
  listLocations,
  listShoppingItems,
  restoreBackup,
  restoreRestorePoint,
  setShoppingItemPurchased,
  undoChange,
  updateShoppingItem,
} from '../storage/database';
import type { BackupDocument } from '../safety/safety.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openLegacySchema8(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 8);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('locations', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
      request.transaction?.objectStore('locations').put({
        id: 'legacy-location',
        name: 'Stare miejsce',
        type: 'OTHER',
        address: 'Warszawa',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error ?? new Error('legacy schema open failed'));
  });
}

describe('schema 9 shopping storage', () => {
  it('adds, edits, purchases and unpurchases an item', async () => {
    await initializeDatabase();
    const milk = await createShoppingItem({ name: '  Mleko  ' });
    expect(milk.name).toBe('Mleko');
    await updateShoppingItem(milk.id, { name: 'Mleko', quantity: ' 2 ' });
    expect((await listShoppingItems())[0]?.quantity).toBe('2');
    await setShoppingItemPurchased(milk.id, true);
    expect((await listShoppingItems())[0]?.isPurchased).toBe(true);
    expect((await listShoppingItems())[0]?.purchasedAt).toBeTruthy();
    await setShoppingItemPurchased(milk.id, false);
    expect((await listShoppingItems())[0]?.isPurchased).toBe(false);
    expect((await listShoppingItems())[0]?.purchasedAt).toBeUndefined();
  });

  it('allows duplicate names and rejects an empty name', async () => {
    await initializeDatabase();
    await createShoppingItem({ name: 'Mleko' });
    await createShoppingItem({ name: 'Mleko' });
    expect(await listShoppingItems()).toHaveLength(2);
    await expect(createShoppingItem({ name: '   ' })).rejects.toThrow('Wpisz nazwę produktu.');
  });

  it('deletes purchased items only and supports undo', async () => {
    await initializeDatabase();
    const milk = await createShoppingItem({ name: 'Mleko' });
    await createShoppingItem({ name: 'Chleb' });
    await setShoppingItemPurchased(milk.id, true);
    await deletePurchasedShoppingItems();
    expect((await listShoppingItems()).map((item) => item.name)).toEqual(['Chleb']);
    const change = await getLatestReversibleChange();
    expect(change?.operationType).toBe('DELETE_PURCHASED_SHOPPING_ITEMS');
    await undoChange(change!.id);
    expect((await listShoppingItems()).map((item) => item.name).sort()).toEqual(['Chleb', 'Mleko']);
  });

  it('undoes a single delete', async () => {
    await initializeDatabase();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-10T12:00:00.000Z'));
    try {
      const bread = await createShoppingItem({ name: 'Chleb' });
      await deleteShoppingItem(bread.id);
      expect(await listShoppingItems()).toHaveLength(0);
      const journal = (await listChangeJournal()).filter((item) => item.entityIds.includes(bread.id));
      const added = journal.find((item) => item.operationType === 'ADD_SHOPPING_ITEM');
      const deleted = journal.find((item) => item.operationType === 'DELETE_SHOPPING_ITEM');
      expect(added).toBeDefined();
      expect(deleted).toBeDefined();
      expect(Date.parse(deleted!.timestamp) - Date.parse(added!.timestamp)).toBe(1);
      const change = await getLatestReversibleChange();
      expect(change?.operationType).toBe('DELETE_SHOPPING_ITEM');
      await undoChange(change!.id);
      expect((await listShoppingItems())[0]?.name).toBe('Chleb');
    } finally {
      clock.mockRestore();
    }
  });

  it('migrates schema 8 to schema 9 without losing old data', async () => {
    await openLegacySchema8();
    await initializeDatabase();
    expect((await listLocations()).some((location) => location.id === 'legacy-location')).toBe(true);
    expect(await listShoppingItems()).toEqual([]);
  });

  it('includes shopping items in backup and restores them', async () => {
    await initializeDatabase();
    await createShoppingItem({ name: 'Mleko', quantity: '2' });
    await createShoppingItem({ name: 'Chleb' });
    const backup = await createBackupFile();
    expect(backup.summary.shoppingItems).toBe(2);
    const inspected = await inspectBackupText(backup.text);
    await restoreBackup(inspected.document);
    expect((await listShoppingItems()).map((item) => item.name).sort()).toEqual(['Chleb', 'Mleko']);
  });


  it('includes shopping in restore points', async () => {
    await initializeDatabase();
    await createShoppingItem({ name: 'Mleko' });
    const point = await createRestorePoint('Zakupy test');
    await createShoppingItem({ name: 'Pomidory' });
    expect(await listShoppingItems()).toHaveLength(2);
    await restoreRestorePoint(point.id);
    expect((await listShoppingItems()).map((item) => item.name)).toEqual(['Mleko']);
  });

  it('restores a valid schema 8 backup with an empty shopping list', async () => {
    await initializeDatabase();
    const current = await createBackupFile();
    const currentDocument = JSON.parse(current.text) as BackupDocument;
    const legacyData = {
      ...currentDocument.data,
      appVersion: '0.3.4',
      databaseSchemaVersion: 8,
      stores: Object.fromEntries(Object.entries(currentDocument.data.stores).filter(([name]) => name !== 'shoppingItems')),
    };
    const unsigned = {
      format: currentDocument.format,
      backupVersion: currentDocument.backupVersion,
      appVersion: '0.3.4',
      databaseSchemaVersion: 8,
      createdAt: currentDocument.createdAt,
      data: legacyData,
    };
    const legacyDocument: BackupDocument = { ...unsigned, checksum: await sha256(JSON.stringify(unsigned)) };
    const inspected = await inspectBackupText(JSON.stringify(legacyDocument));
    await restoreBackup(inspected.document);
    expect(await listShoppingItems()).toEqual([]);
  });
});
