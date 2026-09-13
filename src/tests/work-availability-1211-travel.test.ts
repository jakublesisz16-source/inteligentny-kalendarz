import { describe, expect, it } from 'vitest';
import { travelBufferMinutesForEvent } from '../availability/availability-travel';
import type { CalendarEvent } from '../events/event.types';

function event(category: CalendarEvent['category'], locationId?: string): CalendarEvent {
  return {
    id: 'e', title: 'x', startDateTime: '2026-09-07T10:00', endDateTime: '2026-09-07T12:00',
    allDay: false, spanType: 'SINGLE_DAY', category, source: 'MANUAL', createdAt: 'x', updatedAt: 'x',
    ...(locationId ? { locationId } : {}),
  };
}

describe('1.2.0.11 commute-aware availability', () => {
  it('adds configured commute around study even when timetable location metadata is incomplete', () => {
    expect(travelBufferMinutesForEvent(event('STUDY'), 'work', 30)).toBe(30);
  });
  it('does not add commute when study and work explicitly use the same saved location', () => {
    expect(travelBufferMinutesForEvent(event('STUDY', 'work'), 'work', 30)).toBe(0);
  });
  it('adds commute for another known location but never around confirmed work itself', () => {
    expect(travelBufferMinutesForEvent(event('PERSONAL', 'other'), 'work', 25)).toBe(25);
    expect(travelBufferMinutesForEvent(event('WORK', 'work'), 'work', 25)).toBe(0);
  });
});
