import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import { approximateTransitMinutesBetweenAddresses, approximateTravelSignalForGap, isClearlyTooShortForApproximateTransit } from '../planning/approximate-travel';
import { analyzeCalendarConsistency } from '../planning/consistency';

function event(id: string, start: string, end: string, locationId?: string): CalendarEvent {
  return {
    id,
    title: id,
    startDateTime: start,
    endDateTime: end,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    ...(locationId ? { locationId } : {}),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const known = {
  cio: 'ul. Ciołka 27',
  tro: 'ul. Trojdena 2a',
  lin: 'ul. Lindleya 4',
};

describe('Build270 lightweight approximate commute', () => {
  it('uses rounded offline estimates only for known address pairs', () => {
    expect(approximateTransitMinutesBetweenAddresses(known.cio, known.tro)).toBe(30);
    expect(approximateTransitMinutesBetweenAddresses(known.tro, known.cio)).toBe(30);
    expect(approximateTransitMinutesBetweenAddresses('Nieznany adres', known.tro)).toBeUndefined();
  });

  it('keeps exact minutes internal and classifies only known short transitions', () => {
    expect(approximateTravelSignalForGap(30, 30)).toBeUndefined();
    expect(approximateTravelSignalForGap(20, 30)).toBe('TIGHT');
    expect(approximateTravelSignalForGap(15, 30)).toBe('CLEARLY_TOO_SHORT');
    expect(isClearlyTooShortForApproximateTransit(20, 30)).toBe(false);
    expect(isClearlyTooShortForApproximateTransit(15, 30)).toBe(true);
  });

  it('warns simply when a known same-day transition is clearly too short', () => {
    const issues = analyzeCalendarConsistency([
      event('A', '2026-10-12T12:00', '2026-10-12T16:00', 'cio'),
      event('B', '2026-10-12T16:10', '2026-10-12T18:00', 'tro'),
    ], [], [], { locationAddressesById: { cio: known.cio, tro: known.tro } });
    const travel = issues.find((issue) => issue.type === 'TOUCHING');
    expect(travel?.title).toBe('Mało czasu na dojazd');
    expect(travel?.description).toBe('Przerwa między wydarzeniami może być krótka na dojazd.');
    expect(travel?.description).not.toMatch(/\d+\s*min/u);
  });

  it('uses a quiet information state when the known transition is only tight', () => {
    const issues = analyzeCalendarConsistency([
      event('A', '2026-10-12T12:00', '2026-10-12T16:00', 'cio'),
      event('B', '2026-10-12T16:20', '2026-10-12T18:00', 'tro'),
    ], [], [], { locationAddressesById: { cio: known.cio, tro: known.tro } });
    const travel = issues.find((issue) => issue.type === 'TOUCHING');
    expect(travel?.planningImpact).toBe('INFO');
    expect(travel?.title).toBe('Mało czasu na dojazd');
    expect(travel?.description).toBe('Przerwa między wydarzeniami może być krótka na dojazd.');
    expect(travel?.description).not.toMatch(/\d+\s*min/u);
  });

  it('stays silent for unknown pairs, same places and non-consecutive transitions', () => {
    const unknown = analyzeCalendarConsistency([
      event('A', '2026-10-12T12:00', '2026-10-12T16:00', 'x'),
      event('B', '2026-10-12T16:05', '2026-10-12T18:00', 'y'),
    ], [], [], { locationAddressesById: { x: 'Nieznany 1', y: 'Nieznany 2' } });
    expect(unknown.some((issue) => issue.type === 'TOUCHING')).toBe(false);

    const same = analyzeCalendarConsistency([
      event('A', '2026-10-12T12:00', '2026-10-12T16:00', 'tro'),
      event('B', '2026-10-12T16:05', '2026-10-12T18:00', 'tro'),
    ], [], [], { locationAddressesById: { tro: known.tro } });
    expect(same.some((issue) => issue.type === 'TOUCHING')).toBe(false);

    const withMiddle = analyzeCalendarConsistency([
      event('A', '2026-10-12T12:00', '2026-10-12T16:00', 'cio'),
      event('M', '2026-10-12T16:05', '2026-10-12T16:15', 'lin'),
      event('B', '2026-10-12T16:20', '2026-10-12T18:00', 'tro'),
    ], [], [], { locationAddressesById: { cio: known.cio, lin: known.lin, tro: known.tro } });
    const directAB = withMiddle.find((issue) => issue.type === 'TOUCHING' && issue.eventIds.includes('A') && issue.eventIds.includes('B'));
    expect(directAB).toBeUndefined();
  });
});
