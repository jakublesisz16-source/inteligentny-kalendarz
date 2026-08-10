import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDataTransferFile,
  createEvent,
  createShoppingItem,
  deleteDatabaseForTests,
  importDataTransfer,
  inspectDataTransferText,
  listEvents,
  listRestorePoints,
  listShoppingItems,
  restoreRestorePoint,
} from '../storage/database';
import { DATABASE_SCHEMA_VERSION } from '../core/version';
import type { BackupDocument } from '../safety/safety.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resign(document: BackupDocument, schemaVersion = document.databaseSchemaVersion): Promise<BackupDocument> {
  const data = { ...document.data, databaseSchemaVersion: schemaVersion };
  const unsigned = {
    format: document.format,
    backupVersion: document.backupVersion,
    appVersion: document.appVersion,
    databaseSchemaVersion: schemaVersion,
    createdAt: document.createdAt,
    data,
  };
  return { ...unsigned, checksum: await sha256(JSON.stringify(unsigned)) };
}

describe('0.3.6 one-file data transfer', () => {
  it('exports one canonical JSON file with current logical data', async () => {
    await createEvent({ title: 'Test', startDateTime: '2026-08-08T10:00', endDateTime: '2026-08-08T11:00', category: 'OTHER' });
    await createShoppingItem({ name: 'Mleko', quantity: '2' });
    const transfer = await createDataTransferFile();
    expect(transfer.fileName).toMatch(/^inteligentny-kalendarz-dane-.*\.json$/);
    expect(transfer.summary.events).toBe(1);
    expect(transfer.summary.shoppingItems).toBe(1);
    const document = JSON.parse(transfer.text) as BackupDocument;
    expect(document.format).toBe('inteligentny-kalendarz-backup');
    expect(document.backupVersion).toBe(1);
  });

  it('validates checksum and preview without modifying the database', async () => {
    await createShoppingItem({ name: 'Mleko' });
    const transfer = await createDataTransferFile();
    const before = await listShoppingItems();
    const inspected = await inspectDataTransferText(transfer.text);
    expect(inspected.summary.shoppingItems).toBe(1);
    expect(await listShoppingItems()).toEqual(before);

    const tampered = JSON.parse(transfer.text) as BackupDocument;
    tampered.data.stores.shoppingItems = [];
    await expect(inspectDataTransferText(JSON.stringify(tampered))).rejects.toThrow('Plik jest uszkodzony albo został zmieniony.');
  });

  it('replaces target data and keeps a restore point for the previous device state', async () => {
    await createShoppingItem({ name: 'Źródłowe mleko' });
    const transfer = await createDataTransferFile();
    const inspected = await inspectDataTransferText(transfer.text);

    await deleteDatabaseForTests();
    await createShoppingItem({ name: 'Dane urządzenia B' });
    await importDataTransfer(inspected.document);
    expect((await listShoppingItems()).map((item) => item.name)).toEqual(['Źródłowe mleko']);

    const point = (await listRestorePoints()).find((item) => item.label.startsWith('Przed importem danych -'));
    expect(point).toBeTruthy();
    await restoreRestorePoint(point!.id);
    expect((await listShoppingItems()).map((item) => item.name)).toEqual(['Dane urządzenia B']);
  });

  it('accepts compatible older schema 8 and initializes shopping as empty', async () => {
    await createShoppingItem({ name: 'Nie powinno wejść do starego pliku' });
    const transfer = await createDataTransferFile();
    const current = JSON.parse(transfer.text) as BackupDocument;
    const legacyStores = Object.fromEntries(Object.entries(current.data.stores).filter(([name]) => name !== 'shoppingItems'));
    const legacyBase: BackupDocument = {
      ...current,
      appVersion: '0.3.4',
      databaseSchemaVersion: 8,
      data: { ...current.data, appVersion: '0.3.4', databaseSchemaVersion: 8, stores: legacyStores },
    };
    const legacy = await resign(legacyBase, 8);
    const inspected = await inspectDataTransferText(JSON.stringify(legacy));
    await importDataTransfer(inspected.document);
    expect(await listShoppingItems()).toEqual([]);
  });

  it('blocks files from a newer database schema', async () => {
    const transfer = await createDataTransferFile();
    const current = JSON.parse(transfer.text) as BackupDocument;
    const newerSchema = DATABASE_SCHEMA_VERSION + 1;
    const newer = await resign({ ...current, databaseSchemaVersion: newerSchema, data: { ...current.data, databaseSchemaVersion: newerSchema } }, newerSchema);
    await expect(inspectDataTransferText(JSON.stringify(newer))).rejects.toThrow('nowszej wersji aplikacji');
  });

  it('does not serialize raw PDF/XLSX binary fields in the canonical transfer', async () => {
    const transfer = await createDataTransferFile();
    const lower = transfer.text.toLowerCase();
    expect(lower).not.toContain('arraybuffer');
    expect(lower).not.toContain('filehandle');
    expect(lower).not.toContain('application/pdf');
    expect(lower).not.toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(await listEvents()).toEqual([]);
  });
});
