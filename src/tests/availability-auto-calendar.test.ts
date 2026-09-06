import { describe, expect, it } from 'vitest';
import { effectiveBounds } from '../availability/availability-day-rules';
import { resolveAvailabilityEligibility } from '../availability/availability-eligibility';
import { freeIntervalsForAvailabilityDay, optimizeAvailability } from '../availability/optimizer';
import type { AvailabilityBlock, AvailabilityDayInput, AvailabilityOptimizationInput } from '../availability/availability.types';

const GLOBAL_START = 8 * 60;
const GLOBAL_END = 22 * 60;

function day(date: string, weekday: number, extra: Partial<AvailabilityDayInput> = {}): AvailabilityDayInput {
  return {
    date,
    weekday,
    eligible: true,
    manualEligible: true,
    tradingSunday: false,
    allowedStartMinute: GLOBAL_START,
    allowedEndMinute: GLOBAL_END,
    confirmedWorkMinutes: 0,
    blockingIntervals: [],
    flexibleRequiredMinutes: 0,
    lockedBlocks: [],
    rejectedCandidateKeys: [],
    ...extra,
  };
}

function input(required: number, days: AvailabilityDayInput[], extra: Partial<AvailabilityOptimizationInput> = {}): AvailabilityOptimizationInput {
  return {
    weekStart: '2026-08-17',
    weekEnd: '2026-08-23',
    targetWeeklyWorkMinutes: required,
    confirmedWorkMinutes: 0,
    requiredAvailabilityMinutes: required,
    stepMinutes: 15,
    days,
    ...extra,
  };
}

describe('0.3.3-hotfix.3 calendar-first availability', () => {
  it('treats missing day rule as automatic use of global bounds', () => {
    expect(effectiveBounds(GLOBAL_START, GLOBAL_END, undefined)).toEqual({ start: GLOBAL_START, end: GLOBAL_END });
    expect(freeIntervalsForAvailabilityDay(day('2026-08-17', 1)).map((item) => [item.start, item.end])).toEqual([[GLOBAL_START, GLOBAL_END]]);
  });

  it('derives the start after study and its buffer without earliestTime', () => {
    const monday = day('2026-08-17', 1, {
      blockingIntervals: [{ startMinute: GLOBAL_START, endMinute: 14 * 60 + 30, kind: 'EVENT', category: 'STUDY', originalStartMinute: 8 * 60, originalEndMinute: 14 * 60, bufferMinutes: 30 }],
    });
    expect(freeIntervalsForAvailabilityDay(monday).map((item) => [item.start, item.end])).toEqual([[14 * 60 + 30, GLOBAL_END]]);
  });

  it('uses a completely free day automatically', () => {
    expect(freeIntervalsForAvailabilityDay(day('2026-08-18', 2))).toEqual([{ start: GLOBAL_START, end: GLOBAL_END, minutes: 14 * 60 }]);
  });

  it('splits automatic windows around another blocking event', () => {
    const tuesday = day('2026-08-18', 2, { blockingIntervals: [{ startMinute: 15 * 60, endMinute: 16 * 60, kind: 'EVENT' }] });
    expect(freeIntervalsForAvailabilityDay(tuesday).map((item) => [item.start, item.end])).toEqual([[GLOBAL_START, 15 * 60], [16 * 60, GLOBAL_END]]);
  });

  it('applies optional only-until and returns to automatic bounds when removed', () => {
    expect(effectiveBounds(GLOBAL_START, GLOBAL_END, { date: '2026-08-20', excluded: false, latestTime: '20:00', blockedIntervals: [], updatedAt: 'x' })).toEqual({ start: GLOBAL_START, end: 20 * 60 });
    expect(effectiveBounds(GLOBAL_START, GLOBAL_END, undefined)).toEqual({ start: GLOBAL_START, end: GLOBAL_END });
  });

  it('applies optional only-from without requiring a latestTime', () => {
    expect(effectiveBounds(GLOBAL_START, GLOBAL_END, { date: '2026-08-20', excluded: false, earliestTime: '14:00', blockedIntervals: [], updatedAt: 'x' })).toEqual({ start: 14 * 60, end: GLOBAL_END });
  });

  it('respects an excluded day while days without a rule remain eligible', () => {
    expect(freeIntervalsForAvailabilityDay(day('2026-08-19', 3, { eligible: false }))).toHaveLength(0);
    expect(freeIntervalsForAvailabilityDay(day('2026-08-20', 4))).toHaveLength(1);
  });

  it('respects optional blocked hours without defining daily from/to', () => {
    const friday = day('2026-08-21', 5, { blockingIntervals: [{ startMinute: 18 * 60, endMinute: 20 * 60, kind: 'DAY_RULE' }] });
    expect(freeIntervalsForAvailabilityDay(friday).map((item) => [item.start, item.end])).toEqual([[GLOBAL_START, 18 * 60], [20 * 60, GLOBAL_END]]);
  });

  it('fills the weekly target from calendar windows with zero manual blocks', () => {
    const result = optimizeAvailability(input(16 * 60, [day('2026-08-17', 1), day('2026-08-18', 2)]));
    expect(result.coverageMinutes).toBe(16 * 60);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('keeps a manual decision and fills only the remaining target', () => {
    const locked: AvailabilityBlock = { id: 'manual', date: '2026-08-17', startTime: '16:00', endTime: '20:00', minutes: 240, status: 'ACCEPTED', locked: true, userEdited: true, origin: 'MANUAL', validationState: 'VALID', candidateKey: '2026-08-17|16:00|20:00', explanationFacts: [] };
    const result = optimizeAvailability(input(10 * 60, [day('2026-08-17', 1, { lockedBlocks: [locked] }), day('2026-08-18', 2)]));
    expect(result.coverageMinutes).toBe(10 * 60);
    expect(result.blocks.reduce((sum, block) => sum + block.minutes, 0)).toBe(6 * 60);
  });

  it('still accepts three short 2h windows when no minimum shift is set', () => {
    const short = (date: string, weekday: number, start: number) => day(date, weekday, {
      allowedStartMinute: start,
      allowedEndMinute: start + 120,
    });
    const result = optimizeAvailability(input(360, [short('2026-08-17', 1, 16 * 60), short('2026-08-19', 3, 17 * 60), short('2026-08-21', 5, 18 * 60)]));
    expect(result.blocks.map((block) => block.minutes)).toEqual([120, 120, 120]);
  });


  it('allows automatic Saturday only when the global option is enabled', () => {
    expect(resolveAvailabilityEligibility({ weekday: 6, excluded: false, allowSaturday: false, allowTradingSunday: false, tradingSunday: false })).toMatchObject({ eligible: false, manualEligible: true });
    expect(resolveAvailabilityEligibility({ weekday: 6, excluded: false, allowSaturday: true, allowTradingSunday: false, tradingSunday: false })).toMatchObject({ eligible: true, manualEligible: true });
  });

  it('uses Sunday automatically only when this exact date is trading and the option is enabled', () => {
    expect(resolveAvailabilityEligibility({ weekday: 0, excluded: false, allowSaturday: true, allowTradingSunday: true, tradingSunday: true })).toMatchObject({ eligible: true, manualEligible: true });
    expect(resolveAvailabilityEligibility({ weekday: 0, excluded: false, allowSaturday: true, allowTradingSunday: true, tradingSunday: false })).toMatchObject({ eligible: false, manualEligible: false });
    expect(resolveAvailabilityEligibility({ weekday: 0, excluded: false, allowSaturday: true, allowTradingSunday: false, tradingSunday: true })).toMatchObject({ eligible: false, manualEligible: true });
  });

  it('keeps candidate generation bounded for a fully free week', () => {
    const days = [
      day('2026-08-17', 1), day('2026-08-18', 2), day('2026-08-19', 3), day('2026-08-20', 4),
      day('2026-08-21', 5), day('2026-08-22', 6), day('2026-08-23', 0, { tradingSunday: true }),
    ];
    const result = optimizeAvailability(input(24 * 60, days));
    expect(result.coverageMinutes).toBe(24 * 60);
    expect(result.candidateCount).toBeLessThan(1200);
  }, 15000);

  it('is deterministic across ten runs without daily from/to rules', () => {
    const days = [day('2026-08-17', 1), day('2026-08-18', 2), day('2026-08-22', 6)];
    const signature = JSON.stringify(optimizeAvailability(input(12 * 60, days)).blocks.map((block) => [block.date, block.startTime, block.endTime]));
    for (let run = 0; run < 10; run += 1) {
      expect(JSON.stringify(optimizeAvailability(input(12 * 60, days)).blocks.map((block) => [block.date, block.startTime, block.endTime]))).toBe(signature);
    }
  }, 15000);
});
