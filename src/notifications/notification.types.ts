export type NotificationContentMode = 'DISCREET' | 'FULL';
export type NotificationCategory = 'CALENDAR' | 'STUDY' | 'WORK' | 'CYCLE' | 'BACKUP';

export interface NotificationPreferences {
  contentMode: NotificationContentMode;
  dailyReminderTime: string;
  calendar: { enabled: boolean; beforeMinutes: 15 | 30 | 60 | 120; dayBefore: boolean };
  study: { enabled: boolean; beforeMinutes: 15 | 30 | 60 | 120; dayBefore: boolean };
  work: { enabled: boolean; beforeMinutes: 15 | 30 | 60 | 120; dayBefore: boolean };
  cycle: { enabled: boolean; daysBeforeWindow: 1 | 2 | 3 | 5 | 7; onWindowStart: boolean };
  backup: { enabled: boolean; afterDays: 14 | 30 | 60 };
}

export interface NotificationRuntime {
  id: 'runtime';
  masterEnabled: boolean;
  suspended: boolean;
  installationId?: string;
  installationToken?: string;
  serverRegistrationState: 'DISABLED' | 'READY' | 'DEGRADED';
  lastSuccessfulSyncAt?: string;
  scheduleDigest?: string;
  pendingRemoteCleanup?: boolean;
  lastBackupExportAt?: string;
  backupReminderBaselineAt: string;
  updatedAt: string;
}

export interface NotificationReminderDraft {
  id: string;
  triggerAt: string;
  category: NotificationCategory;
  sourceEntityId: string;
  fullTitle: string;
  fullBody: string;
  discreetTitle: string;
  discreetBody: string;
}

export interface NotificationReminder extends NotificationReminderDraft {
  scheduleId: string;
  shownAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPlannerInput {
  events: import('../events/event.types').CalendarEvent[];
  prediction: import('../cycle/cycle.types').CyclePrediction;
  preferences: NotificationPreferences;
  now: Date;
  backupLastExportAt?: string;
  backupBaselineAt?: string;
  horizonDays?: number;
}

export interface PushSupport {
  supported: boolean;
  reason?: 'NO_SERVICE_WORKER' | 'NO_NOTIFICATION_API' | 'NO_PUSH_MANAGER' | 'INSECURE_CONTEXT' | 'IOS_REQUIRES_HOME_SCREEN';
}

export type NotificationSystemStatus = 'DISABLED' | 'ENABLED' | 'UNSUPPORTED' | 'DENIED' | 'DEGRADED';
