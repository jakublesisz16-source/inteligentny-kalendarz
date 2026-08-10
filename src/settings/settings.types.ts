import type { NotificationPreferences } from '../notifications/notification.types';
import type { DecorativeBackgroundMode } from './appearance';

export type StartView = 'today' | 'calendar';
export type TimeFormat = '24h' | '12h';

export interface AppSettings {
  id: 'app';
  preferredStartView: StartView;
  homeLocationId?: string;
  workLocationId?: string;
  timeFormat: TimeFormat;
  notificationPreferences: NotificationPreferences;
  decorativeBackgroundMode: DecorativeBackgroundMode;
  updatedAt: string;
}

export interface AppSettingsPatch {
  preferredStartView?: StartView;
  homeLocationId?: string | null;
  workLocationId?: string | null;
  timeFormat?: TimeFormat;
  notificationPreferences?: NotificationPreferences;
  decorativeBackgroundMode?: DecorativeBackgroundMode;
}
