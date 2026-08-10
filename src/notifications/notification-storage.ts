import {
  getNotificationRuntime,
  getSettings,
  listCyclePeriods,
  listEvents,
  listNotificationReminders,
  replaceNotificationReminders,
  updateNotificationRuntime,
} from '../storage/database';
import { toLocalDateKey } from '../calendar/date.utils';
import { predictNextPeriod } from '../cycle/cycle-prediction';
import { planNotificationReminders } from './notification-planner';
import { syncRemoteSchedules } from './push-client';
import type { NotificationReminder } from './notification.types';

function randomScheduleId(): string {
  const randomUUID = (crypto as { randomUUID?: () => string }).randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(crypto);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function rebuildAndSyncNotifications(now = new Date()): Promise<{ localCount: number; sync: 'DISABLED' | 'READY' | 'DEGRADED' }> {
  const runtime = await getNotificationRuntime();
  if (!runtime.masterEnabled) {
    await replaceNotificationReminders([]);
    return { localCount: 0, sync: 'DISABLED' };
  }

  const [settings, events, periods, previous] = await Promise.all([
    getSettings(), listEvents(), listCyclePeriods(), listNotificationReminders(),
  ]);
  const planned = planNotificationReminders({
    events,
    prediction: predictNextPeriod(periods, toLocalDateKey(now)),
    preferences: settings.notificationPreferences,
    now,
    backupBaselineAt: runtime.backupReminderBaselineAt,
    ...(runtime.lastBackupExportAt ? { backupLastExportAt: runtime.lastBackupExportAt } : {}),
    horizonDays: 90,
  });
  const oldById = new Map(previous.map((item) => [item.id, item]));
  const timestamp = now.toISOString();
  const reminders: NotificationReminder[] = planned.map((draft) => {
    const old = oldById.get(draft.id);
    const same = old && old.triggerAt === draft.triggerAt && old.fullBody === draft.fullBody && old.discreetBody === draft.discreetBody;
    return {
      ...draft,
      scheduleId: same ? old.scheduleId : randomScheduleId(),
      ...(same && old.shownAt ? { shownAt: old.shownAt } : {}),
      createdAt: same ? old.createdAt : timestamp,
      updatedAt: timestamp,
    };
  });
  await replaceNotificationReminders(reminders);
  await updateNotificationRuntime({ suspended: false });

  const manifest = reminders.filter((item) => !item.shownAt).map((item) => ({ scheduleId: item.scheduleId, triggerAtUtc: item.triggerAt }));
  const digest = await sha256(JSON.stringify(manifest));
  if (runtime.scheduleDigest === digest && runtime.serverRegistrationState === 'READY') return { localCount: reminders.length, sync: 'READY' };
  try {
    await syncRemoteSchedules(manifest);
    await updateNotificationRuntime({ scheduleDigest: digest, lastSuccessfulSyncAt: new Date().toISOString(), serverRegistrationState: 'READY' });
    return { localCount: reminders.length, sync: 'READY' };
  } catch {
    await updateNotificationRuntime({ serverRegistrationState: 'DEGRADED' });
    return { localCount: reminders.length, sync: 'DEGRADED' };
  }
}
