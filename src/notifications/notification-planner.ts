import type { CalendarEvent } from '../events/event.types';
import type { NotificationPlannerInput, NotificationReminderDraft } from './notification.types';

const DAY_MS = 24 * 60 * 60 * 1000;

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function combineLocalDateAndTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year!, month! - 1, day!, hour ?? 0, minute ?? 0, 0, 0);
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addLocalDays(dateKey: string, amount: number): string {
  const date = combineLocalDateAndTime(dateKey, '12:00');
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function withinWindow(trigger: Date, now: Date, horizonEnd: Date): boolean {
  return trigger.getTime() > now.getTime() && trigger.getTime() <= horizonEnd.getTime();
}

function eventReminder(params: {
  event: CalendarEvent;
  trigger: Date;
  suffix: string;
  category: 'CALENDAR' | 'STUDY' | 'WORK';
  discreetBody: string;
  fullBody: string;
}): NotificationReminderDraft {
  return {
    id: `rem-${params.category.toLowerCase()}-${safeId(params.event.id)}-${params.suffix}`,
    triggerAt: params.trigger.toISOString(),
    category: params.category,
    sourceEntityId: params.event.id,
    fullTitle: params.category === 'STUDY' ? 'Studia' : params.category === 'WORK' ? 'Praca' : 'Kalendarz',
    fullBody: params.fullBody,
    discreetTitle: 'Inteligentny Kalendarz',
    discreetBody: params.discreetBody,
  };
}

function planEventCategory(
  events: CalendarEvent[],
  category: 'CALENDAR' | 'STUDY' | 'WORK',
  beforeMinutes: 15 | 30 | 60 | 120,
  dayBefore: boolean,
  dailyReminderTime: string,
  now: Date,
  horizonEnd: Date,
): NotificationReminderDraft[] {
  const reminders: NotificationReminderDraft[] = [];
  for (const event of events) {
    const start = new Date(event.startDateTime);
    if (Number.isNaN(start.getTime())) continue;
    const startDateKey = event.startDateTime.slice(0, 10);

    if (!event.allDay) {
      const trigger = new Date(start.getTime() - beforeMinutes * 60_000);
      if (withinWindow(trigger, now, horizonEnd)) {
        reminders.push(eventReminder({
          event,
          trigger,
          suffix: `before-${beforeMinutes}`,
          category,
          discreetBody: 'Masz ważne przypomnienie w Inteligentnym Kalendarzu.',
          fullBody: `${event.title} - za ${beforeMinutes} min.`,
        }));
      }
    }

    if (dayBefore) {
      const trigger = combineLocalDateAndTime(addLocalDays(startDateKey, -1), dailyReminderTime);
      if (withinWindow(trigger, now, horizonEnd)) {
        reminders.push(eventReminder({
          event,
          trigger,
          suffix: 'day-before',
          category,
          discreetBody: 'Masz ważne przypomnienie na jutro.',
          fullBody: `Jutro: ${event.title}.`,
        }));
      }
    }
  }
  return reminders;
}

export function planNotificationReminders(input: NotificationPlannerInput): NotificationReminderDraft[] {
  const horizonEnd = new Date(input.now.getTime() + (input.horizonDays ?? 90) * DAY_MS);
  const result: NotificationReminderDraft[] = [];
  const { preferences } = input;

  if (preferences.calendar.enabled) {
    result.push(...planEventCategory(
      input.events.filter((event) => event.category !== 'STUDY' && event.category !== 'WORK'),
      'CALENDAR', preferences.calendar.beforeMinutes, preferences.calendar.dayBefore,
      preferences.dailyReminderTime, input.now, horizonEnd,
    ));
  }
  if (preferences.study.enabled) {
    result.push(...planEventCategory(
      input.events.filter((event) => event.category === 'STUDY' && event.source === 'UNIVERSITY_XLSX'),
      'STUDY', preferences.study.beforeMinutes, preferences.study.dayBefore,
      preferences.dailyReminderTime, input.now, horizonEnd,
    ));
  }
  if (preferences.work.enabled) {
    result.push(...planEventCategory(
      input.events.filter((event) => event.category === 'WORK'),
      'WORK', preferences.work.beforeMinutes, preferences.work.dayBefore,
      preferences.dailyReminderTime, input.now, horizonEnd,
    ));
  }

  if (preferences.cycle.enabled && input.prediction.status === 'READY' && input.prediction.primaryWindow) {
    const startDate = input.prediction.primaryWindow.startDate;
    const beforeDate = addLocalDays(startDate, -preferences.cycle.daysBeforeWindow);
    const beforeTrigger = combineLocalDateAndTime(beforeDate, preferences.dailyReminderTime);
    if (withinWindow(beforeTrigger, input.now, horizonEnd)) {
      result.push({
        id: `rem-cycle-window-before-${startDate}-${preferences.cycle.daysBeforeWindow}`,
        triggerAt: beforeTrigger.toISOString(),
        category: 'CYCLE',
        sourceEntityId: `cycle-window-${startDate}`,
        fullTitle: 'Cykl',
        fullBody: 'Zbliża się przewidywane okno miesiączki. To szacunek na podstawie Twojej historii.',
        discreetTitle: 'Inteligentny Kalendarz',
        discreetBody: 'Masz prywatne przypomnienie w Inteligentnym Kalendarzu.',
      });
    }
    if (preferences.cycle.onWindowStart) {
      const startTrigger = combineLocalDateAndTime(startDate, preferences.dailyReminderTime);
      if (withinWindow(startTrigger, input.now, horizonEnd)) {
        result.push({
          id: `rem-cycle-window-start-${startDate}`,
          triggerAt: startTrigger.toISOString(),
          category: 'CYCLE',
          sourceEntityId: `cycle-window-${startDate}`,
          fullTitle: 'Cykl',
          fullBody: 'Rozpoczyna się przewidywane okno miesiączki. Rzeczywisty termin może być inny.',
          discreetTitle: 'Inteligentny Kalendarz',
          discreetBody: 'Masz prywatne przypomnienie w Inteligentnym Kalendarzu.',
        });
      }
    }
  }

  if (preferences.backup.enabled) {
    const baseline = input.backupLastExportAt ?? input.backupBaselineAt;
    if (baseline) {
      const baselineDate = new Date(baseline);
      if (Number.isNaN(baselineDate.getTime())) return result.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt) || a.id.localeCompare(b.id));
      const dueDate = addLocalDays(localDateKey(baselineDate), preferences.backup.afterDays);
      const trigger = combineLocalDateAndTime(dueDate, preferences.dailyReminderTime);
      if (withinWindow(trigger, input.now, horizonEnd)) {
        result.push({
          id: `rem-backup-${dueDate}-${preferences.backup.afterDays}`,
          triggerAt: trigger.toISOString(),
          category: 'BACKUP',
          sourceEntityId: 'backup',
          fullTitle: 'Kopia danych',
          fullBody: `Od ostatniej kopii danych minęło ${preferences.backup.afterDays} dni.`,
          discreetTitle: 'Inteligentny Kalendarz',
          discreetBody: 'Warto sprawdzić kopię swoich danych.',
        });
      }
    }
  }

  return result.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt) || a.id.localeCompare(b.id));
}
