import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBackupFile,
  createCycleJournalEntry,
  createCyclePeriod,
  createDataTransferFile,
  createRestorePoint,
  deleteCycleJournalEntry,
  deleteDatabaseForTests,
  getCycleJournalEntryByDate,
  getLatestReversibleChange,
  importDataTransfer,
  initializeDatabase,
  inspectBackupText,
  listChangeJournal,
  listCycleJournalEntries,
  listCyclePeriods,
  restoreBackup,
  restoreRestorePoint,
  undoChange,
  updateCycleJournalEntry,
} from '../storage/database';
import { DATABASE_SCHEMA_VERSION } from '../core/version';
import { predictNextPeriod } from '../cycle/cycle-prediction';
import type { BackupDocument } from '../safety/safety.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openLegacySchema11(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 11);
    request.onupgradeneeded = () => {
      const db = request.result;
      const periods = db.createObjectStore('cyclePeriods', { keyPath: 'id' });
      periods.createIndex('startDate', 'startDate', { unique: true });
      db.createObjectStore('restorePoints', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      request.transaction?.objectStore('cyclePeriods').put({
        id: 'legacy-period', startDate: '2026-07-01', endDate: '2026-07-05', createdAt: 'x', updatedAt: 'x',
      });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error ?? new Error('legacy schema open failed'));
  });
}

async function resignAsSchema(document: BackupDocument, schemaVersion: number, omitJournal = false): Promise<BackupDocument> {
  const stores = omitJournal
    ? Object.fromEntries(Object.entries(document.data.stores).filter(([name]) => name !== 'cycleJournalEntries'))
    : document.data.stores;
  const data = { ...document.data, appVersion: schemaVersion === 11 ? '0.5.4' : document.data.appVersion, databaseSchemaVersion: schemaVersion, stores };
  const unsigned = {
    format: document.format,
    backupVersion: document.backupVersion,
    appVersion: schemaVersion === 11 ? '0.5.4' : document.appVersion,
    databaseSchemaVersion: schemaVersion,
    createdAt: document.createdAt,
    data,
  };
  return { ...unsigned, checksum: await sha256(JSON.stringify(unsigned)) };
}

describe('0.6.0 Cycle Journal storage', () => {
  it('migrates legacy schema 11 to current schema, preserves cycle periods and creates a unique date index', async () => {
    await openLegacySchema11();
    await initializeDatabase();
    expect(DATABASE_SCHEMA_VERSION).toBe(13);
    expect((await listCyclePeriods()).map((item) => item.id)).toContain('legacy-period');
    expect(await listCycleJournalEntries()).toEqual([]);

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('inteligentny-kalendarz', DATABASE_SCHEMA_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('cycleJournalEntries', 'readonly');
    const index = tx.objectStore('cycleJournalEntries').index('date');
    expect(index.unique).toBe(true);
    db.close();
  });

  it('creates, gets, lists, edits and changes the date of one entry', async () => {
    await initializeDatabase();
    const created = await createCycleJournalEntry({ date: '2026-08-01', bleeding: 'LIGHT', pain: 'MILD', wellbeing: 'GOOD', note: '  test  ' });
    expect(created.note).toBe('test');
    expect((await getCycleJournalEntryByDate('2026-08-01'))?.id).toBe(created.id);
    expect(await listCycleJournalEntries()).toHaveLength(1);

    const updated = await updateCycleJournalEntry(created.id, { date: '2026-08-02', bleeding: 'NONE', pain: 'MODERATE' });
    expect(updated).toMatchObject({ date: '2026-08-02', bleeding: 'NONE', pain: 'MODERATE' });
    expect(updated.wellbeing).toBeUndefined();
    expect(await getCycleJournalEntryByDate('2026-08-01')).toBeUndefined();
  });

  it('sorts by date and rejects duplicates, future dates and empty entries', async () => {
    await initializeDatabase();
    await createCycleJournalEntry({ date: '2026-08-03', wellbeing: 'NEUTRAL' });
    await createCycleJournalEntry({ date: '2026-08-01', note: 'obserwacja' });
    expect((await listCycleJournalEntries()).map((item) => item.date)).toEqual(['2026-08-01', '2026-08-03']);
    await expect(createCycleJournalEntry({ date: '2026-08-03', pain: 'NONE' })).rejects.toThrow('Ten dzień ma już wpis dziennika.');
    await expect(createCycleJournalEntry({ date: '2999-01-01', pain: 'NONE' })).rejects.toThrow('przyszłości');
    await expect(createCycleJournalEntry({ date: '2026-08-04' })).rejects.toThrow('przynajmniej jedną obserwację');
  });

  it('keeps NONE distinct from an omitted value and validates enum values and note length', async () => {
    await initializeDatabase();
    const none = await createCycleJournalEntry({ date: '2026-08-01', bleeding: 'NONE', pain: 'NONE' });
    expect(none.bleeding).toBe('NONE');
    expect(none.pain).toBe('NONE');
    expect(none.wellbeing).toBeUndefined();
    await expect(createCycleJournalEntry({ date: '2026-08-02', bleeding: 'INVALID' as never })).rejects.toThrow('krwawienia');
    await expect(createCycleJournalEntry({ date: '2026-08-02', note: 'x'.repeat(501) })).rejects.toThrow('500');
  });

  it('preserves undefined, false and true for pain medication without truthiness loss', async () => {
    await initializeDatabase();
    const no = await createCycleJournalEntry({ date: '2026-08-01', painMedicationTaken: false });
    expect(no.painMedicationTaken).toBe(false);
    expect(no.bleeding).toBeUndefined();
    expect(no.pain).toBeUndefined();
    expect(no.wellbeing).toBeUndefined();

    const yes = await createCycleJournalEntry({ date: '2026-08-02', painMedicationTaken: true });
    expect(yes.painMedicationTaken).toBe(true);

    const changedToYes = await updateCycleJournalEntry(no.id, { date: '2026-08-01', painMedicationTaken: true });
    expect(changedToYes.painMedicationTaken).toBe(true);
    const changedBackToNo = await updateCycleJournalEntry(no.id, { date: '2026-08-01', painMedicationTaken: false });
    expect(changedBackToNo.painMedicationTaken).toBe(false);
    const cleared = await updateCycleJournalEntry(no.id, { date: '2026-08-01', note: 'zostaje tylko notatka' });
    expect(cleared.painMedicationTaken).toBeUndefined();

    await expect(createCycleJournalEntry({ date: '2026-08-03', painMedicationTaken: 'false' as never })).rejects.toThrow('leku przeciwbólowego');
    await expect(createCycleJournalEntry({ date: '2026-08-03', painMedicationTaken: 1 as never })).rejects.toThrow('leku przeciwbólowego');
    await expect(createCycleJournalEntry({ date: '2026-08-03', painMedicationTaken: null as never })).rejects.toThrow('leku przeciwbólowego');
  });

  it('undoes add, edit and delete exactly', async () => {
    await initializeDatabase();
    const created = await createCycleJournalEntry({ date: '2026-08-01', bleeding: 'LIGHT' });
    let change = await getLatestReversibleChange();
    await undoChange(change!.id);
    expect(await listCycleJournalEntries()).toEqual([]);

    const restored = await createCycleJournalEntry({ date: '2026-08-01', bleeding: 'LIGHT' });
    await updateCycleJournalEntry(restored.id, { date: '2026-08-01', bleeding: 'HEAVY', wellbeing: 'LOW' });
    change = await getLatestReversibleChange();
    await undoChange(change!.id);
    expect(await getCycleJournalEntryByDate('2026-08-01')).toMatchObject({ bleeding: 'LIGHT' });

    await deleteCycleJournalEntry(restored.id);
    change = await getLatestReversibleChange();
    await undoChange(change!.id);
    expect(await getCycleJournalEntryByDate('2026-08-01')).toMatchObject({ id: restored.id, bleeding: 'LIGHT' });
    expect(created.date).toBe('2026-08-01');
  });

  it('undo restores painMedicationTaken=false exactly after an edit to true', async () => {
    await initializeDatabase();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-10T12:00:00.000Z'));
    try {
      const entry = await createCycleJournalEntry({ date: '2026-08-01', painMedicationTaken: false });
      await updateCycleJournalEntry(entry.id, { date: '2026-08-01', painMedicationTaken: true });
      const journal = (await listChangeJournal()).filter((item) => item.entityIds.includes(entry.id));
      const added = journal.find((item) => item.operationType === 'ADD_CYCLE_JOURNAL_ENTRY');
      const edited = journal.find((item) => item.operationType === 'EDIT_CYCLE_JOURNAL_ENTRY');
      expect(added).toBeDefined();
      expect(edited).toBeDefined();
      expect(Date.parse(edited!.timestamp) - Date.parse(added!.timestamp)).toBe(1);
      const change = await getLatestReversibleChange();
      expect(change?.operationType).toBe('EDIT_CYCLE_JOURNAL_ENTRY');
      await undoChange(change!.id);
      expect((await getCycleJournalEntryByDate('2026-08-01'))?.painMedicationTaken).toBe(false);
    } finally {
      clock.mockRestore();
    }
  });

  it('backup, restore and data transfer preserve both false and true medication values', async () => {
    await initializeDatabase();
    await createCycleJournalEntry({ date: '2026-08-01', painMedicationTaken: false });
    await createCycleJournalEntry({ date: '2026-08-02', painMedicationTaken: true });
    const backup = await createBackupFile();
    const inspected = await inspectBackupText(backup.text);
    await deleteDatabaseForTests();
    await restoreBackup(inspected.document);
    expect((await getCycleJournalEntryByDate('2026-08-01'))?.painMedicationTaken).toBe(false);
    expect((await getCycleJournalEntryByDate('2026-08-02'))?.painMedicationTaken).toBe(true);

    const transfer = await createDataTransferFile();
    const transferDoc = JSON.parse(transfer.text) as BackupDocument;
    await deleteDatabaseForTests();
    await importDataTransfer(transferDoc);
    expect((await getCycleJournalEntryByDate('2026-08-01'))?.painMedicationTaken).toBe(false);
    expect((await getCycleJournalEntryByDate('2026-08-02'))?.painMedicationTaken).toBe(true);
  });

  it('includes journal entries in backup, restore points and data transfer', async () => {
    await initializeDatabase();
    await createCycleJournalEntry({ date: '2026-08-01', bleeding: 'SPOTTING', note: 'fixture' });
    const point = await createRestorePoint('Dziennik test');
    await createCycleJournalEntry({ date: '2026-08-02', pain: 'STRONG' });
    await restoreRestorePoint(point.id);
    expect((await listCycleJournalEntries()).map((item) => item.date)).toEqual(['2026-08-01']);

    const backup = await createBackupFile();
    expect(backup.summary.cycleJournalEntries).toBe(1);
    const backupDoc = JSON.parse(backup.text) as BackupDocument;
    expect(backupDoc.data.stores.cycleJournalEntries).toHaveLength(1);

    const transfer = await createDataTransferFile();
    expect(transfer.summary.cycleJournalEntries).toBe(1);
    const transferDoc = JSON.parse(transfer.text) as BackupDocument;
    await deleteDatabaseForTests();
    await importDataTransfer(transferDoc);
    expect(await getCycleJournalEntryByDate('2026-08-01')).toMatchObject({ bleeding: 'SPOTTING', note: 'fixture' });
  });

  it('restores a schema 11 backup with an empty journal and keeps cycle history', async () => {
    await initializeDatabase();
    await createCyclePeriod({ startDate: '2026-07-01' });
    await createCycleJournalEntry({ date: '2026-07-02', pain: 'MILD' });
    const current = JSON.parse((await createBackupFile()).text) as BackupDocument;
    const legacy = await resignAsSchema(current, 11, true);
    const inspected = await inspectBackupText(JSON.stringify(legacy));
    await restoreBackup(inspected.document);
    expect(await listCycleJournalEntries()).toEqual([]);
    expect(await listCyclePeriods()).toHaveLength(1);
  });

  it('does not change cycle-v1 prediction when journal entries change', async () => {
    await initializeDatabase();
    for (const startDate of ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23']) await createCyclePeriod({ startDate });
    const periods = await listCyclePeriods();
    const before = predictNextPeriod(periods, '2026-05-01');
    const entry = await createCycleJournalEntry({ date: '2026-04-24', bleeding: 'HEAVY', pain: 'STRONG', wellbeing: 'LOW' });
    await updateCycleJournalEntry(entry.id, { date: '2026-04-24', bleeding: 'NONE', wellbeing: 'GOOD' });
    await deleteCycleJournalEntry(entry.id);
    const after = predictNextPeriod(await listCyclePeriods(), '2026-05-01');
    expect(after).toEqual(before);
  });
});
