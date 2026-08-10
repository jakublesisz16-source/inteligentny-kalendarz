import { describe, expect, it } from 'vitest';
import type { AvailabilityWorkComparison } from '../work/availability-work-comparison';
import { aggregateAvailabilityComparisonResults, buildWorkMonthlySummary, dedupeConfirmedWorkShifts, formatWorkSummaryMinutes, type WorkSummaryShift } from '../work/work-summary';

function shift(id: string, startDateTime: string, endDateTime: string, source: WorkSummaryShift['source'] = 'WORK_PDF'): WorkSummaryShift {
  return { id, startDateTime, endDateTime, source };
}

function comparison(within: number, partial: number, outside: number): AvailabilityWorkComparison {
  return {
    snapshotId: 's', snapshotVersion: 1, shiftCount: within + partial + outside,
    fullyWithinCount: within, partiallyOutsideCount: partial, fullyOutsideCount: outside,
    totalWorkMinutes: 0, totalCoveredMinutes: 0, totalOutsideMinutes: 0, unusedAvailabilityMinutes: 0,
    perShift: [], unusedAvailabilityBlocks: [],
  };
}

describe('0.3.4 work monthly summary', () => {
  it('liczy total, zmiany, dni pracy, średnią i najdłuższą zmianę', () => {
    const result = buildWorkMonthlySummary('2026-08', [
      shift('a', '2026-08-03T10:00', '2026-08-03T15:00'),
      shift('b', '2026-08-04T10:00', '2026-08-04T17:30'),
      shift('c', '2026-08-05T12:00', '2026-08-05T16:30'),
    ]);
    expect(result.totalMinutes).toBe(1020);
    expect(result.shiftCount).toBe(3);
    expect(result.workDayCount).toBe(3);
    expect(result.averageShiftMinutes).toBe(340);
    expect(result.longestShiftMinutes).toBe(450);
  });

  it('liczy dwa shifty jednego dnia jako jeden dzień pracy', () => {
    const result = buildWorkMonthlySummary('2026-08', [
      shift('a', '2026-08-03T08:00', '2026-08-03T12:00'),
      shift('b', '2026-08-03T16:00', '2026-08-03T20:00'),
      shift('c', '2026-08-04T08:00', '2026-08-04T12:00'),
    ]);
    expect(result.shiftCount).toBe(3);
    expect(result.workDayCount).toBe(2);
  });

  it('buduje tygodnie poniedziałek-niedziela', () => {
    const result = buildWorkMonthlySummary('2026-08', [
      shift('a', '2026-08-03T08:00', '2026-08-03T16:00'),
      shift('b', '2026-08-05T10:00', '2026-08-05T16:00'),
      shift('c', '2026-08-11T10:00', '2026-08-11T17:00'),
      shift('d', '2026-08-18T10:00', '2026-08-18T18:00'),
      shift('e', '2026-08-22T10:00', '2026-08-22T16:00'),
    ]);
    expect(result.weeklyBuckets.map((bucket) => bucket.minutes)).toEqual([840, 420, 840]);
  });

  it('liczy soboty i niedziele jako dni z pracą', () => {
    const result = buildWorkMonthlySummary('2026-08', [
      shift('a', '2026-08-01T10:00', '2026-08-01T16:00'),
      shift('b', '2026-08-08T10:00', '2026-08-08T16:00'),
      shift('c', '2026-08-09T10:00', '2026-08-09T16:00'),
    ]);
    expect(result.saturdayCount).toBe(2);
    expect(result.sundayCount).toBe(1);
  });

  it('deduplikuje identyczny MANUAL i WORK_PDF preferując PDF', () => {
    const deduped = dedupeConfirmedWorkShifts([
      shift('manual', '2026-08-03T17:00', '2026-08-03T22:00', 'MANUAL'),
      shift('pdf', '2026-08-03T17:00', '2026-08-03T22:00', 'WORK_PDF'),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.source).toBe('WORK_PDF');
    expect(buildWorkMonthlySummary('2026-08', deduped).totalMinutes).toBe(300);
  });

  it('obsługuje zmianę przez północ', () => {
    const result = buildWorkMonthlySummary('2026-08', [shift('a', '2026-08-18T22:00', '2026-08-19T02:00')]);
    expect(result.totalMinutes).toBe(240);
  });

  it('dzieli minuty na granicy miesiąca bez podwójnego liczenia', () => {
    const item = shift('a', '2026-08-31T22:00', '2026-09-01T02:00');
    expect(buildWorkMonthlySummary('2026-08', [item]).totalMinutes).toBe(120);
    expect(buildWorkMonthlySummary('2026-09', [item]).totalMinutes).toBe(120);
  });

  it('agreguje wynik istniejącego comparison engine', () => {
    expect(aggregateAvailabilityComparisonResults([comparison(7, 1, 0), comparison(7, 0, 1)])).toEqual({
      fullyWithinCount: 14,
      partiallyOutsideCount: 1,
      fullyOutsideCount: 1,
      comparedShiftCount: 16,
    });
  });

  it('formatuje godziny po ludzku', () => {
    expect(formatWorkSummaryMinutes(60)).toBe('1 h');
    expect(formatWorkSummaryMinutes(90)).toBe('1 h 30 min');
    expect(formatWorkSummaryMinutes(428)).toBe('7 h 08 min');
    expect(formatWorkSummaryMinutes(6840)).toBe('114 h');
  });
});
