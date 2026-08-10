import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackupFile,
  deleteDatabaseForTests,
  getAvailabilityPlan,
  getDayPlanningProfile,
  initializeDatabase,
  inspectBackupText,
  listAvailabilityPlans,
  restoreBackup,
  saveAvailabilityPlan,
  saveDayPlanningProfile,
} from '../storage/database';
import type { AvailabilityPlan } from '../availability/availability.types';
import type { BackupDocument } from '../safety/safety.types';

beforeEach(async () => { await deleteDatabaseForTests(); });

function plan(): AvailabilityPlan {
  return {
    id: 'availability-plan-2026-08-17',
    weekStart: '2026-08-17',
    weekEnd: '2026-08-23',
    createdAt: '2026-08-07T20:00:00.000Z',
    updatedAt: '2026-08-07T20:00:00.000Z',
    inputFingerprint: 'abc',
    status: 'ACCEPTED',
    targetWeeklyWorkMinutes: 1440,
    confirmedWorkMinutes: 480,
    requiredAvailabilityMinutes: 960,
    acceptedAvailabilityMinutes: 120,
    remainingMinutes: 840,
    maximumSafeCoverageMinutes: 960,
    deficitMinutes: 0,
    blocks: [{
      id: 'b1',
      date: '2026-08-18',
      startTime: '16:00',
      endTime: '18:00',
      minutes: 120,
      status: 'ACCEPTED',
      locked: true,
      userEdited: false,
      explanationFacts: [],
      candidateKey: '2026-08-18|16:00|18:00',
    }],
    sentSnapshots: [{
      id: 's1',
      createdAt: '2026-08-07T20:10:00.000Z',
      version: 1,
      totalMinutes: 120,
      blocks: [{ date: '2026-08-18', startTime: '16:00', endTime: '18:00', minutes: 120 }],
    }],
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openLegacySchema7(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 7);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('locations', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('dayPlanningProfiles', { keyPath: 'id' });
      request.transaction?.objectStore('dayPlanningProfiles').put({
        id: 'default',
        targetWeeklyWorkMinutes: 1440,
        allowSaturday: true,
        allowTradingSunday: false,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error ?? new Error('legacy schema open failed'));
  });
}

describe('schema 8 availability storage', () => {
  it('stores allowed hours and a simple availability plan', async () => {
    await initializeDatabase();
    await saveDayPlanningProfile({ targetWeeklyWorkMinutes: 1440, allowedWorkStart: '08:00', allowedWorkEnd: '22:00', allowSaturday: true, allowTradingSunday: false });
    await saveAvailabilityPlan(plan());
    expect((await getDayPlanningProfile())?.allowedWorkStart).toBe('08:00');
    expect((await getAvailabilityPlan('2026-08-17'))?.blocks[0]?.status).toBe('ACCEPTED');
  });

  it('migrates schema 7 to schema 8 without inventing availability plans', async () => {
    await openLegacySchema7();
    await initializeDatabase();
    expect((await getDayPlanningProfile())?.targetWeeklyWorkMinutes).toBe(1440);
    expect(await listAvailabilityPlans()).toEqual([]);
  });

  it('includes availability in backup', async () => {
    await initializeDatabase();
    await saveAvailabilityPlan(plan());
    const backup = await createBackupFile();
    expect(backup.summary.availabilityPlans).toBe(1);
    const inspected = await inspectBackupText(backup.text);
    expect(inspected.summary.availabilityPlans).toBe(1);
  });

  it('restores availability including immutable sent snapshot', async () => {
    await initializeDatabase();
    await saveAvailabilityPlan(plan());
    const backup = await createBackupFile();
    const inspected = await inspectBackupText(backup.text);
    await restoreBackup(inspected.document);
    const restored = await getAvailabilityPlan('2026-08-17');
    expect(restored?.sentSnapshots[0]?.version).toBe(1);
    expect((await listAvailabilityPlans()).length).toBe(1);
  });

  it('restores a valid schema 7 backup into schema 8 with empty availability plans', async () => {
    await initializeDatabase();
    await saveDayPlanningProfile({ targetWeeklyWorkMinutes: 1200, allowSaturday: false, allowTradingSunday: false });
    const current = await createBackupFile();
    const currentDocument = JSON.parse(current.text) as BackupDocument;
    const legacyData = {
      ...currentDocument.data,
      appVersion: '0.3.1',
      databaseSchemaVersion: 7,
      stores: Object.fromEntries(Object.entries(currentDocument.data.stores).filter(([name]) => name !== 'availabilityPlans')),
    };
    const unsigned = {
      format: currentDocument.format,
      backupVersion: currentDocument.backupVersion,
      appVersion: '0.3.1',
      databaseSchemaVersion: 7,
      createdAt: currentDocument.createdAt,
      data: legacyData,
    };
    const legacyDocument: BackupDocument = { ...unsigned, checksum: await sha256(JSON.stringify(unsigned)) };
    const inspected = await inspectBackupText(JSON.stringify(legacyDocument));
    await restoreBackup(inspected.document);
    expect((await getDayPlanningProfile())?.targetWeeklyWorkMinutes).toBe(1200);
    expect(await listAvailabilityPlans()).toEqual([]);
  });
});
