import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackupFile,
  createCanonicalDataTransferDocument,
  createCyclePeriod,
  createDataTransferFile,
  deleteDatabaseForTests,
  getNotificationRuntime,
  getSettings,
  initializeDatabase,
  listCyclePeriods,
  listEvents,
  listNotificationReminders,
  replaceNotificationReminders,
  updateNotificationRuntime,
  updateSettings,
} from '../storage/database';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../notifications/notification-preferences';

beforeEach(async () => { await deleteDatabaseForTests(); });

async function openLegacySchema10(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('inteligentny-kalendarz', 10);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('events', { keyPath: 'id' });
      db.createObjectStore('locations', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
      const cycle = db.createObjectStore('cyclePeriods', { keyPath: 'id' });
      cycle.createIndex('startDate', 'startDate', { unique: true });
      request.transaction?.objectStore('events').put({ id: 'legacy-event', title: 'Stare wydarzenie', startDateTime: '2026-08-01T10:00:00', endDateTime: '2026-08-01T11:00:00', allDay: false, spanType: 'SINGLE_DAY', category: 'PERSONAL', source: 'MANUAL', createdAt: 'x', updatedAt: 'x' });
      request.transaction?.objectStore('cyclePeriods').put({ id: 'legacy-cycle', startDate: '2026-07-01', createdAt: 'x', updatedAt: 'x' });
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error ?? new Error('legacy schema open failed'));
  });
}

describe('notification storage compatibility under current schema', () => {
  it('preserves schema 10 user data while adding notification and newer stores', async () => {
    await openLegacySchema10();
    await initializeDatabase();
    expect((await listEvents()).some((item) => item.id === 'legacy-event')).toBe(true);
    expect((await listCyclePeriods()).some((item) => item.id === 'legacy-cycle')).toBe(true);
    expect(await listNotificationReminders()).toEqual([]);
    expect((await getNotificationRuntime()).masterEnabled).toBe(false);
  });

  it('normalizes old settings with safe notification defaults and master remains device-local OFF', async () => {
    await initializeDatabase();
    const settings = await getSettings();
    expect(settings.notificationPreferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect((await getNotificationRuntime()).masterEnabled).toBe(false);
  });

  it('does not include notification runtime, subscription state or derived reminders in backup/transfer', async () => {
    await initializeDatabase();
    await updateNotificationRuntime({ masterEnabled: true, installationId: 'installation-test', installationToken: 'a'.repeat(64), serverRegistrationState: 'READY' });
    await replaceNotificationReminders([{ id: 'local-reminder', scheduleId: 'opaque-schedule', triggerAt: '2026-09-01T10:00:00.000Z', category: 'CALENDAR', sourceEntityId: 'event-x', fullTitle: 'Sekret', fullBody: 'Prywatna treść', discreetTitle: 'IK', discreetBody: 'Przypomnienie', createdAt: 'x', updatedAt: 'x' }]);
    const backup = JSON.parse((await createBackupFile()).text) as { data: { stores: Record<string, unknown[]> } };
    expect(backup.data.stores.notificationRuntime).toBeUndefined();
    expect(backup.data.stores.notificationReminders).toBeUndefined();
    expect(JSON.stringify(backup)).not.toContain('Prywatna treść');
    const transfer = JSON.parse((await createDataTransferFile()).text) as { data: { stores: Record<string, unknown[]> } };
    expect(transfer.data.stores.notificationRuntime).toBeUndefined();
    expect(transfer.data.stores.notificationReminders).toBeUndefined();
  });

  it('keeps notification preferences in canonical settings data', async () => {
    await initializeDatabase();
    await updateSettings({ notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, contentMode: 'FULL', cycle: { ...DEFAULT_NOTIFICATION_PREFERENCES.cycle, daysBeforeWindow: 5 } } });
    const backup = JSON.parse((await createBackupFile()).text) as { data: { stores: Record<string, Array<Record<string, unknown>>> } };
    const appSettings = backup.data.stores.settings?.find((item) => item.id === 'app');
    expect(appSettings?.notificationPreferences).toMatchObject({ contentMode: 'FULL', cycle: { daysBeforeWindow: 5 } });
  });

  it('can capture canonical data for Excel without changing device-local export metadata', async () => {
    await initializeDatabase();
    expect((await getNotificationRuntime()).lastBackupExportAt).toBeUndefined();
    const document = await createCanonicalDataTransferDocument();
    expect(document.format).toBe('inteligentny-kalendarz-backup');
    expect((await getNotificationRuntime()).lastBackupExportAt).toBeUndefined();
  });

  it('records the latest conscious export only in device-local runtime', async () => {
    await initializeDatabase();
    expect((await getNotificationRuntime()).lastBackupExportAt).toBeUndefined();
    await createBackupFile();
    expect((await getNotificationRuntime()).lastBackupExportAt).toBeTruthy();
  });
});
