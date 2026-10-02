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
    expect(issues[0]?.description).toBe('a i b nachodzą na siebie przez 60 min.');
    expect(issues[0]?.description).not.toContain('To może wynikać');
  });
  it('does not warn merely because two events touch when travel is unknown', () => {
    const issues = analyzeCalendarConsistency([event('a','2026-08-12T12:00','2026-08-12T16:00'), event('b','2026-08-12T16:00','2026-08-12T18:00','WORK','WORK_PDF')]);
    expect(issues.some((issue) => issue.type === 'TOUCHING')).toBe(false);
    expect(issues.some((issue) => issue.type === 'HARD_OVERLAP')).toBe(false);
  });
  it('warns only when known addresses indicate a clearly too-short commute', () => {
    const issues = analyzeCalendarConsistency([
      event('study','2026-08-12T12:00','2026-08-12T16:00','STUDY','UNIVERSITY_XLSX',{ locationId: 'cio' }),
      event('work','2026-08-12T16:10','2026-08-12T20:00','WORK','WORK_PDF',{ locationId: 'tro' }),
    ], [], [], { locationAddressesById: { cio: 'ul. Ciołka 27', tro: 'ul. Trojdena 2a' } });
    const travel = issues.find((issue) => issue.type === 'TOUCHING');
    expect(travel?.title).toBe('Mało czasu na dojazd');
    expect(travel?.gapMinutes).toBe(10);
    expect(travel?.description).toBe('Przerwa między wydarzeniami może być krótka na dojazd.');
  });

  it('uses an informational hint for a borderline known commute without claiming exact ETA', () => {
    const issues = analyzeCalendarConsistency([
      event('study','2026-08-12T12:00','2026-08-12T16:00','STUDY','UNIVERSITY_XLSX',{ locationId: 'cio' }),
      event('work','2026-08-12T16:20','2026-08-12T20:00','WORK','WORK_PDF',{ locationId: 'tro' }),
    ], [], [], { locationAddressesById: { cio: 'ul. Ciołka 27', tro: 'ul. Trojdena 2a' } });
    const travel = issues.find((issue) => issue.type === 'TOUCHING');
    expect(travel?.planningImpact).toBe('INFO');
    expect(travel?.title).toBe('Mało czasu na dojazd');
    expect(travel?.description).not.toMatch(/\d+\s*min/u);
  });
  it('does not warn about commute when both events use the same known place', () => {
    const issues = analyzeCalendarConsistency([
      event('study','2026-08-12T12:00','2026-08-12T16:00','STUDY','UNIVERSITY_XLSX',{ locationId: 'campus' }),
      event('work','2026-08-12T16:00','2026-08-12T20:00','WORK','WORK_PDF',{ locationId: 'campus' }),
    ], [], [], { locationAddressesById: { campus: 'ul. Trojdena 2a' } });
    expect(issues.some((issue) => issue.type === 'TOUCHING')).toBe(false);
  });

  it('does not invent a commute warning when one location is unknown', () => {
    const issues = analyzeCalendarConsistency([
      event('study','2026-08-12T12:00','2026-08-12T16:00','STUDY','UNIVERSITY_XLSX'),
      event('work','2026-08-12T16:00','2026-08-12T20:00','WORK','WORK_PDF',{ locationId: 'work' }),
    ], [], [], { locationAddressesById: { work: 'ul. Trojdena 2a' } });
    expect(issues.some((issue) => issue.type === 'TOUCHING')).toBe(false);
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
