import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { analyzeCalendarConsistency } from '../planning/consistency';

function event(id: string, start: string, end: string, category: CalendarEvent['category'] = 'STUDY', source: CalendarEvent['source'] = 'UNIVERSITY_XLSX', extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return { id, title: id, startDateTime: start, endDateTime: end, allDay: false, spanType: start.slice(0,10) === end.slice(0,10) ? 'SINGLE_DAY' : 'MULTI_DAY', category, source, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...extra };
}

describe('CalendarConsistencyEngine 0.3.1', () => {
  it('detects study-study source inconsistency with exact overlap minutes', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T15:00','2026-08-12T18:00')]);
    expect(issues[0]?.type).toBe('SOURCE_INCONSISTENCY');
    expect(issues[0]?.overlapMinutes).toBe(60);
    expect(issues[0]?.planningImpact).toBe('BLOCKING');
  });
  it('distinguishes touching from overlap', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T16:00','2026-08-12T18:00','WORK','WORK_PDF')]);
    expect(issues.some((issue) => issue.type === 'TOUCHING')).toBe(true);
    expect(issues.some((issue) => issue.type === 'HARD_OVERLAP')).toBe(false);
  });
  it('detects study-work overlap', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T14:00','2026-08-12T16:00'), event('b','2026-08-12T15:00','2026-08-12T20:00','WORK','WORK_PDF')]);
    expect(issues.find((issue) => issue.type === 'HARD_OVERLAP')?.overlapMinutes).toBe(60);
  });
  it('handles an event crossing midnight and year boundary', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-12-31T23:00','2027-01-01T02:00','WORK','WORK_PDF'), event('b','2027-01-01T01:30','2027-01-01T03:00','PERSONAL','MANUAL')]);
    expect(issues.find((issue) => issue.type === 'HARD_OVERLAP')?.overlapMinutes).toBe(30);
  });
  it('does not block timed events with a non-blocking all-day item', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T00:00','2026-08-12T23:59','PERSONAL','MANUAL',{allDay:true,availabilityImpact:'NON_BLOCKING'}), event('b','2026-08-12T10:00','2026-08-12T12:00')]);
    expect(issues).toHaveLength(0);
  });
  it('detects blocking all-day conflict', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T00:00','2026-08-12T23:59','PERSONAL','MANUAL',{allDay:true,availabilityImpact:'BLOCKING'}), event('b','2026-08-12T10:00','2026-08-12T12:00','WORK','WORK_PDF')]);
    expect(issues.some((issue) => issue.type === 'ALL_DAY_CONFLICT')).toBe(true);
  });
  it('detects potential duplicate manual and PDF work', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T10:00','2026-08-12T18:00','WORK','MANUAL'), event('b','2026-08-12T10:00','2026-08-12T18:00','WORK','WORK_PDF')]);
    expect(issues.some((issue) => issue.type === 'POTENTIAL_DUPLICATE')).toBe(true);
  });
  it('uses acknowledgement fingerprint only for the unchanged conflict', () => {
    const original = analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T15:00','2026-08-12T18:00')]);
    const ack = [{ id:'ack', fingerprint: original[0]!.fingerprint, acknowledgedAt:'2026-08-07T00:00:00Z' }];
    expect(analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T15:00','2026-08-12T18:00')],[],ack)[0]?.acknowledged).toBe(true);
    expect(analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T15:30','2026-08-12T18:00')],[],ack)[0]?.acknowledged).toBe(false);
  });
});
