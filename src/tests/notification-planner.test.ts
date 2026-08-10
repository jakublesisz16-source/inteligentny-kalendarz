import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../notifications/notification-preferences';
import { planNotificationReminders } from '../notifications/notification-planner';
import type { CyclePrediction } from '../cycle/cycle.types';

const unavailable: CyclePrediction = {
  status: 'UNAVAILABLE', reliability: 'LOW', reason: 'INSUFFICIENT_DATA',
  diagnostics: { modelVersion: 'cycle-v1', completedCycleCount: 0, walkForwardSampleCount: 0, possibleMissedLogs: [], observationBreakCount: 0, possibleShiftScore: 0, regimeState: 'STABLE' },
};

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1', title: 'Wizyta', startDateTime: '2026-08-11T10:00:00', endDateTime: '2026-08-11T11:00:00',
    allDay: false, spanType: 'SINGLE_DAY', category: 'PERSONAL', source: 'MANUAL', createdAt: 'x', updatedAt: 'x', ...overrides,
  };
}

function plan(events: CalendarEvent[], now = new Date(2026, 7, 10, 8, 0), prediction = unavailable) {
  return planNotificationReminders({ events, prediction, preferences: DEFAULT_NOTIFICATION_PREFERENCES, now, backupBaselineAt: now.toISOString() });
}

describe('notification planner', () => {
  it('plans a calendar reminder 60 minutes before an event', () => {
    const result = plan([event()]);
    const reminder = result.find((item) => item.category === 'CALENDAR');
    expect(reminder?.triggerAt).toBe(new Date(2026, 7, 11, 9, 0).toISOString());
  });

  it('does not plan calendar reminders whose trigger is already in the past', () => {
    const result = plan([event({ startDateTime: '2026-08-10T08:30:00', endDateTime: '2026-08-10T09:30:00' })]);
    expect(result.some((item) => item.category === 'CALENDAR' && item.sourceEntityId === 'event-1')).toBe(false);
  });

  it('uses only the active study events stored as UNIVERSITY_XLSX events', () => {
    const study = event({ id: 'study', category: 'STUDY', source: 'UNIVERSITY_XLSX', title: 'Chirurgia' });
    const manualStudyLike = event({ id: 'preview-like', category: 'STUDY', source: 'MANUAL', title: 'Podgląd' });
    const result = plan([study, manualStudyLike]);
    expect(result.some((item) => item.sourceEntityId === 'study')).toBe(true);
    expect(result.some((item) => item.sourceEntityId === 'preview-like')).toBe(false);
  });

  it('plans WORK events from imported or deliberate manual work, while Availability is not an event source', () => {
    const work = event({ id: 'work', category: 'WORK', source: 'WORK_PDF', title: 'Praca' });
    const manualWork = event({ id: 'manual-work', category: 'WORK', source: 'MANUAL', title: 'Praca ręczna' });
    const result = plan([work, manualWork]);
    expect(result.some((item) => item.sourceEntityId === 'work')).toBe(true);
    expect(result.some((item) => item.sourceEntityId === 'manual-work')).toBe(true);
  });

  it('does not create a 60-minute reminder for all-day events', () => {
    const result = plan([event({ allDay: true, startDateTime: '2026-08-11T00:00:00', endDateTime: '2026-08-11T23:59:00' })]);
    expect(result.some((item) => item.id.includes('before-60'))).toBe(false);
  });

  it('uses local 19:00 for day-before reminders, including calendar-date boundaries', () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, study: { ...DEFAULT_NOTIFICATION_PREFERENCES.study, beforeMinutes: 60 as const, dayBefore: true } };
    const result = planNotificationReminders({ events: [event({ id: 'study', category: 'STUDY', source: 'UNIVERSITY_XLSX', startDateTime: '2026-03-30T08:00:00', endDateTime: '2026-03-30T09:00:00' })], prediction: unavailable, preferences, now: new Date(2026, 2, 28, 8, 0), backupBaselineAt: new Date(2026, 2, 28, 8, 0).toISOString() });
    const dayBefore = result.find((item) => item.id.endsWith('day-before'));
    expect(dayBefore?.triggerAt).toBe(new Date(2026, 2, 29, 19, 0).toISOString());
  });

  it('creates Cycle reminders only for READY and the primary window', () => {
    const ready: CyclePrediction = { ...unavailable, status: 'READY', reliability: 'MODERATE', primaryWindow: { startDate: '2026-08-20', endDate: '2026-08-23' }, wideWindow: { startDate: '2026-08-18', endDate: '2026-08-25' } };
    const result = plan([], new Date(2026, 7, 10, 8, 0), ready);
    expect(result.filter((item) => item.category === 'CYCLE')).toHaveLength(2);
    expect(result.find((item) => item.id.includes('before'))?.triggerAt).toBe(new Date(2026, 7, 17, 19, 0).toISOString());
    for (const status of ['PRELIMINARY', 'UNRELIABLE', 'EXPIRED', 'UNAVAILABLE'] as const) {
      expect(plan([], new Date(2026, 7, 10, 8, 0), { ...ready, status }).some((item) => item.category === 'CYCLE')).toBe(false);
    }
  });

  it('does not leak sensitive details into discreet Cycle text', () => {
    const ready: CyclePrediction = { ...unavailable, status: 'READY', primaryWindow: { startDate: '2026-08-20', endDate: '2026-08-23' } };
    const cycle = plan([], new Date(2026, 7, 10, 8, 0), ready).find((item) => item.category === 'CYCLE');
    expect(cycle?.discreetBody.toLowerCase()).not.toMatch(/miesiącz|okres|cykl/);
  });

  it('plans backup from a local baseline instead of alerting immediately', () => {
    const now = new Date(2026, 7, 10, 8, 0);
    const result = planNotificationReminders({ events: [], prediction: unavailable, preferences: DEFAULT_NOTIFICATION_PREFERENCES, now, backupBaselineAt: now.toISOString() });
    const backup = result.find((item) => item.category === 'BACKUP');
    expect(backup?.triggerAt).toBe(new Date(2026, 8, 9, 19, 0).toISOString());
  });
});
