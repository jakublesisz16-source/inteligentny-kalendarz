import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackupFile,
  createCyclePeriod,
  createDataTransferFile,
  createRestorePoint,
  deleteCyclePeriod,
  deleteDatabaseForTests,
  getLatestReversibleChange,
  importDataTransfer,
  initializeDatabase,
  inspectBackupText,
  listCyclePeriods,
  listLocations,
  restoreBackup,
  restoreRestorePoint,
  setCycleGapDecision,
  undoChange,
  updateCyclePeriod,
} from '../storage/database';
import type { BackupDocument } from '../safety/safety.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openLegacySchema9(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 9);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('locations', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('shoppingItems', { keyPath: 'id' });
      request.transaction?.objectStore('locations').put({ id: 'legacy-location', name: 'Stare miejsce', type: 'OTHER', address: 'Warszawa', createdAt: 'x', updatedAt: 'x' });
      request.transaction?.objectStore('shoppingItems').put({ id: 'legacy-shopping', name: 'Mleko', isPurchased: false, createdAt: 'x', updatedAt: 'x' });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error ?? new Error('legacy schema open failed'));
  });
}

describe('schema 10 cycle storage', () => {
  it('migrates schema 9 by adding cyclePeriods without losing old data', async () => {
    await openLegacySchema9();
    await initializeDatabase();
    expect((await listLocations()).some((item) => item.id === 'legacy-location')).toBe(true);
    expect(await listCyclePeriods()).toEqual([]);
  });

  it('adds, edits and undoes a period without inventing end date', async () => {
    await initializeDatabase();
    const period = await createCyclePeriod({ startDate: '2026-08-01' });
    expect(period.endDate).toBeUndefined();
    await updateCyclePeriod(period.id, { startDate: '2026-08-01', endDate: '2026-08-05', isUserMarkedAtypical: true });
    expect((await listCyclePeriods())[0]).toMatchObject({ endDate: '2026-08-05', isUserMarkedAtypical: true });
    const latest = await getLatestReversibleChange();
    await undoChange(latest!.id);
    expect((await listCyclePeriods())[0]?.endDate).toBeUndefined();
  });

  it('persists an observation break on the later period', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-01-01' });
    const later = await createCyclePeriod({ startDate: '2026-07-01' });
    await setCycleGapDecision(later.id, 'OBSERVATION_BREAK');
    expect((await listCyclePeriods()).find((item) => item.id === later.id)?.previousGapDecision).toBe('OBSERVATION_BREAK');
  });

  it('invalidates a gap decision when a related date is edited', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-01-01' });
    const later = await createCyclePeriod({ startDate: '2026-07-01' });
    await setCycleGapDecision(later.id, 'OBSERVATION_BREAK');
    await updateCyclePeriod(later.id, { startDate: '2026-06-30' });
    expect((await listCyclePeriods()).find((item) => item.id === later.id)?.previousGapDecision).toBeUndefined();
  });

  it('invalidates the old relation when inserting a period between two dates', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-01-01' });
    const later = await createCyclePeriod({ startDate: '2026-07-01' });
    await setCycleGapDecision(later.id, 'OBSERVATION_BREAK');
    await createCyclePeriod({ startDate: '2026-04-01' });
    expect((await listCyclePeriods()).find((item) => item.id === later.id)?.previousGapDecision).toBeUndefined();
  });

  it('undoes delete and restores the neighboring gap decision', async () => {
    await initializeDatabase();
    const first = await createCyclePeriod({ startDate: '2026-01-01' });
    const middle = await createCyclePeriod({ startDate: '2026-04-01' });
    const last = await createCyclePeriod({ startDate: '2026-07-01' });
    await setCycleGapDecision(last.id, 'OBSERVATION_BREAK');
    await deleteCyclePeriod(middle.id);
    expect((await listCyclePeriods()).find((item) => item.id === last.id)?.previousGapDecision).toBeUndefined();
    const change = await getLatestReversibleChange();
    await undoChange(change!.id);
    const restored = await listCyclePeriods();
    expect(restored.some((item) => item.id === first.id)).toBe(true);
    expect(restored.some((item) => item.id === middle.id)).toBe(true);
    expect(restored.find((item) => item.id === last.id)?.previousGapDecision).toBe('OBSERVATION_BREAK');
  });

  it('includes cycle history in backup and restore points', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-06-01', endDate: '2026-06-05' });
    const point = await createRestorePoint('Cykl test');
    await createCyclePeriod({ startDate: '2026-07-01' });
    expect(await listCyclePeriods()).toHaveLength(2);
    await restoreRestorePoint(point.id);
    expect(await listCyclePeriods()).toHaveLength(1);
    const backup = await createBackupFile();
    expect(backup.summary.cyclePeriods).toBe(1);
  });

  it('restores a schema 9 backup with empty cycle history', async () => {
    await initializeDatabase();
    const current = await createBackupFile();
    const document = JSON.parse(current.text) as BackupDocument;
    const legacyData = { ...document.data, appVersion: '0.3.7', databaseSchemaVersion: 9, stores: Object.fromEntries(Object.entries(document.data.stores).filter(([name]) => name !== 'cyclePeriods')) };
    const unsigned = { format: document.format, backupVersion: document.backupVersion, appVersion: '0.3.7', databaseSchemaVersion: 9, createdAt: document.createdAt, data: legacyData };
    const legacy: BackupDocument = { ...unsigned, checksum: await sha256(JSON.stringify(unsigned)) };
    const inspected = await inspectBackupText(JSON.stringify(legacy));
    await restoreBackup(inspected.document);
    expect(await listCyclePeriods()).toEqual([]);
  });

  it('transfers cycle periods and observation-break decisions in the canonical file', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-01-01' });
    const later = await createCyclePeriod({ startDate: '2026-07-01' });
    await setCycleGapDecision(later.id, 'OBSERVATION_BREAK');
    const transfer = await createDataTransferFile();
    expect(transfer.summary.cyclePeriods).toBe(2);
    const document = JSON.parse(transfer.text) as BackupDocument;
    await deleteDatabaseForTests();
    await importDataTransfer(document);
    expect((await listCyclePeriods()).find((item) => item.id === later.id)?.previousGapDecision).toBe('OBSERVATION_BREAK');
  });
});
