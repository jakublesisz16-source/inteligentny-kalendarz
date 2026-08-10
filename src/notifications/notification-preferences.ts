import type { NotificationPreferences } from './notification.types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  contentMode: 'DISCREET',
  dailyReminderTime: '19:00',
  calendar: { enabled: true, beforeMinutes: 60, dayBefore: false },
  study: { enabled: true, beforeMinutes: 60, dayBefore: true },
  work: { enabled: true, beforeMinutes: 60, dayBefore: true },
  cycle: { enabled: true, daysBeforeWindow: 3, onWindowStart: true },
  backup: { enabled: true, afterDays: 30 },
};

export function normalizeNotificationPreferences(value?: Partial<NotificationPreferences>): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...value,
    calendar: { ...DEFAULT_NOTIFICATION_PREFERENCES.calendar, ...value?.calendar },
    study: { ...DEFAULT_NOTIFICATION_PREFERENCES.study, ...value?.study },
    work: { ...DEFAULT_NOTIFICATION_PREFERENCES.work, ...value?.work },
    cycle: { ...DEFAULT_NOTIFICATION_PREFERENCES.cycle, ...value?.cycle },
    backup: { ...DEFAULT_NOTIFICATION_PREFERENCES.backup, ...value?.backup },
  };
}
