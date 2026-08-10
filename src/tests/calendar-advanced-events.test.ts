import { describe, expect, it } from 'vitest';
import {
  areDateKeysContiguous,
  dateKeysBetweenInclusive,
  eventDateKeys,
  eventOccursOnDate,
  inferSpanType,
  toLocalDateKey,
} from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';
import { validateEventDraft, validateManualMultiDateDraft } from '../events/event.validation';

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-a', title: 'Wyjazd', startDateTime: '2026-08-10T00:00', endDateTime: '2026-08-14T23:59',
    allDay: true, spanType: 'MULTI_DAY', category: 'PERSONAL', source: 'MANUAL',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', ...patch,
  };
}

describe('advanced calendar date model', () => {
  it('renderuje jedno all-day multi-day na każdym dniu zakresu', () => {
    const item = event();
    expect(eventDateKeys(item)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14']);
    expect(eventOccursOnDate(item, '2026-08-12')).toBe(true);
    expect(eventOccursOnDate(item, '2026-08-15')).toBe(false);
  });

  it('obsługuje przejście miesiąca', () => {
    expect(dateKeysBetweenInclusive('2026-08-29', '2026-09-03')).toEqual([
      '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    ]);
  });

  it('obsługuje przejście roku', () => {
    expect(dateKeysBetweenInclusive('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('nie przesuwa local-date przez parsowanie UTC', () => {
    expect(toLocalDateKey('2026-10-25T00:00')).toBe('2026-10-25');
    expect(toLocalDateKey('2026-03-29T23:59')).toBe('2026-03-29');
  });

  it('rozpoznaje wybór ciągły i nieciągły', () => {
    expect(areDateKeysContiguous(['2026-08-10', '2026-08-11', '2026-08-12'])).toBe(true);
    expect(areDateKeysContiguous(['2026-08-10', '2026-08-12', '2026-08-15'])).toBe(false);
  });

  it('waliduje all-day po datach, a timed po godzinach', () => {
    expect(validateEventDraft({ title: 'Urlop', startDateTime: '2026-08-10T00:00', endDateTime: '2026-08-14T23:59', allDay: true, spanType: 'MULTI_DAY', category: 'PERSONAL' }).valid).toBe(true);
    expect(validateEventDraft({ title: 'Błąd', startDateTime: '2026-08-14T00:00', endDateTime: '2026-08-10T23:59', allDay: true, spanType: 'MULTI_DAY', category: 'PERSONAL' }).valid).toBe(false);
    expect(inferSpanType('2026-08-10T14:00', '2026-08-14T18:00')).toBe('MULTI_DAY');
  });

  it('waliduje serię wielu dat i odrzuca duplikaty', () => {
    expect(validateManualMultiDateDraft({ title: 'Nauka', dates: ['2026-08-10', '2026-08-12', '2026-08-15'], startTime: '18:00', endTime: '20:00', allDay: false, category: 'STUDY' }).valid).toBe(true);
    expect(validateManualMultiDateDraft({ title: 'Nauka', dates: ['2026-08-10', '2026-08-10'], startTime: '18:00', endTime: '20:00', allDay: false, category: 'STUDY' }).valid).toBe(false);
  });
});
