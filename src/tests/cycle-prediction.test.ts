import { describe, expect, it } from 'vitest';
import {
  buildCycleModel,
  CYCLE_MODEL_PARAMETERS,
  deriveCompletedCycleLengths,
  detectPossibleRegimeShift,
  isValidCycleDateKey,
  predictNextPeriod,
} from '../cycle/cycle-prediction';
import type { CyclePeriod } from '../cycle/cycle.types';

function addUtcDays(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function periodsFromLengths(lengths: number[]): CyclePeriod[] {
  const periods: CyclePeriod[] = [{ id: 'p0', startDate: '2025-01-01', createdAt: 'x', updatedAt: 'x' }];
  let cursor = '2025-01-01';
  lengths.forEach((length, index) => {
    cursor = addUtcDays(cursor, length);
    periods.push({ id: `p${index + 1}`, startDate: cursor, createdAt: 'x', updatedAt: 'x' });
  });
  return periods;
}

function lengths(periods: CyclePeriod[]): number[] {
  return deriveCompletedCycleLengths(periods).completed.map((item) => item.lengthDays);
}

describe('cycle-v1 prediction properties', () => {
  it('does not invent a 28-day cycle without history', () => {
    expect(predictNextPeriod([], '2026-08-08').status).toBe('UNAVAILABLE');
    expect(predictNextPeriod([{ id: 'p', startDate: '2026-08-01', createdAt: 'x', updatedAt: 'x' }], '2026-08-08').status).toBe('UNAVAILABLE');
  });

  it('keeps preliminary estimates cautious for 2-3 completed cycles', () => {
    const result = predictNextPeriod(periodsFromLengths([29, 30, 29]), '2025-04-01');
    expect(result.status).toBe('PRELIMINARY');
    expect(result.reliability).toBe('LOW');
  });

  it('does not produce a narrow preliminary estimate from a tiny contradictory history', () => {
    const result = predictNextPeriod(periodsFromLengths([60, 30]), '2025-03-15');
    expect(result.status).toBe('UNRELIABLE');
    expect(result.reliability).toBe('LOW');
    expect(result.diagnostics.finalUncertaintyDays).toBeGreaterThanOrEqual(15);
  });

  it('is deterministic and keeps probability internally sane', () => {
    const periods = periodsFromLengths([29, 30, 29, 31, 30, 29, 30]);
    const first = predictNextPeriod(periods, '2025-06-01');
    const serialized = JSON.stringify(first);
    for (let index = 0; index < 100; index += 1) expect(JSON.stringify(predictNextPeriod(periods, '2025-06-01'))).toBe(serialized);
    const sum = first.distribution?.reduce((total, point) => total + point.probability, 0) ?? 0;
    expect(sum).toBeCloseTo(1, 8);
    expect(first.distribution?.every((point) => Number.isFinite(point.probability) && point.probability >= 0)).toBe(true);
  });

  it('treats a single surprising month as uncertainty, not an automatic regime shift', () => {
    const periods = periodsFromLengths([29, 30, 29, 30, 29, 41]);
    const diagnostics = buildCycleModel(periods);
    expect(diagnostics.weightedMedianDays).toBeGreaterThanOrEqual(29);
    expect(diagnostics.weightedMedianDays).toBeLessThanOrEqual(30);
    expect(diagnostics.lastObservationSurprise).toBeGreaterThan(1);
    expect(detectPossibleRegimeShift(lengths(periods)).possible).toBe(false);
  });

  it('can recover after a single surprising month without deleting it', () => {
    const periods = periodsFromLengths([29, 30, 29, 30, 29, 41, 29, 30, 29]);
    const derived = lengths(periods);
    expect(derived).toContain(41);
    const diagnostics = buildCycleModel(periods);
    expect(diagnostics.weightedMedianDays).toBeGreaterThanOrEqual(29);
    expect(diagnostics.weightedMedianDays).toBeLessThanOrEqual(30);
  });

  it('detects a supported persistent shift only with enough history', () => {
    expect(detectPossibleRegimeShift([29, 30, 29, 33, 34]).possible).toBe(false);
    expect(detectPossibleRegimeShift([29, 30, 29, 30, 29, 33, 34, 35, 34, 36]).possible).toBe(true);
  });

  it('can refuse a misleadingly precise estimate for highly variable history', () => {
    const result = predictNextPeriod(periodsFromLengths([26, 38, 28, 42, 27, 36, 31, 45]), '2025-07-01');
    expect(result.status).toBe('UNRELIABLE');
  });

  it('flags a likely missed log and excludes unresolved gap from model input', () => {
    const periods = periodsFromLengths([29, 30, 29, 30]);
    const last = periods.at(-1)!;
    periods.push({ id: 'gap', startDate: addUtcDays(last.startDate, 60), createdAt: 'x', updatedAt: 'x' });
    const derived = deriveCompletedCycleLengths(periods);
    expect(derived.possibleMissedLogs).toHaveLength(1);
    expect(derived.completed).toHaveLength(4);
    expect(predictNextPeriod(periods, '2026-01-01').reason).toBe('POSSIBLE_MISSED_LOG');
  });

  it('recognizes multiple-missed-log shaped gaps without inventing dates', () => {
    for (const gap of [88, 90, 92]) {
      const periods = periodsFromLengths([29, 30, 29, 30]);
      const last = periods.at(-1)!;
      periods.push({ id: `gap-${gap}`, startDate: addUtcDays(last.startDate, gap), createdAt: 'x', updatedAt: 'x' });
      const derived = deriveCompletedCycleLengths(periods);
      expect(derived.possibleMissedLogs.length).toBeGreaterThan(0);
      expect(derived.completed.map((item) => item.lengthDays)).not.toContain(gap);
    }
  });

  it('keeps an observation break in history but out of biological variability', () => {
    const baseline = periodsFromLengths([29, 30, 29, 30]);
    const before = buildCycleModel(baseline);
    const last = baseline.at(-1)!;
    baseline.push({ id: 'break', startDate: addUtcDays(last.startDate, 180), previousGapDecision: 'OBSERVATION_BREAK', createdAt: 'x', updatedAt: 'x' });
    const after = buildCycleModel(baseline);
    expect(after.observationBreakCount).toBe(1);
    expect(after.completedCycleCount).toBe(before.completedCycleCount);
    expect(after.robustSpreadDays).toBe(before.robustSpreadDays);
  });

  it('keeps reliability low until enough fresh cycles exist after an observation break', () => {
    const periods = periodsFromLengths([29, 30, 29, 30]);
    const last = periods.at(-1)!;
    periods.push({ id: 'break', startDate: addUtcDays(last.startDate, 180), previousGapDecision: 'OBSERVATION_BREAK', createdAt: 'x', updatedAt: 'x' });
    expect(predictNextPeriod(periods, '2025-06-01').reliability).toBe('LOW');
    const afterBreak = periods.at(-1)!;
    periods.push({ id: 'fresh-1', startDate: addUtcDays(afterBreak.startDate, 30), createdAt: 'x', updatedAt: 'x' });
    expect(buildCycleModel(periods).completedCyclesSinceLastObservationBreak).toBe(1);
    expect(predictNextPeriod(periods, '2025-06-01').reliability).toBe('LOW');
  });

  it('uses a confirmed real long gap as an actual observation', () => {
    const periods = periodsFromLengths([29, 30, 29, 30]);
    const last = periods.at(-1)!;
    periods.push({ id: 'confirmed', startDate: addUtcDays(last.startDate, 60), previousGapDecision: 'CONFIRMED_SINGLE_CYCLE', createdAt: 'x', updatedAt: 'x' });
    expect(lengths(periods)).toContain(60);
  });

  it('does not change prediction math when user only marks a cycle atypical', () => {
    const base = periodsFromLengths([29, 30, 29, 30, 41, 29]);
    const marked = base.map((period, index) => index === 5 ? { ...period, isUserMarkedAtypical: true } : period);
    expect(JSON.stringify(buildCycleModel(marked))).toBe(JSON.stringify(buildCycleModel(base)));
  });

  it('uses perturbation families instead of depending on one exact synthetic fixture', () => {
    for (const sample of [[28, 30, 29, 31, 40], [30, 29, 31, 30, 42], [29, 31, 28, 30, 39]]) {
      expect(buildCycleModel(periodsFromLengths(sample)).lastObservationSurprise).toBeGreaterThan(1);
    }
  });


  it('uses one explicit uncertainty path instead of stacking anomaly multipliers', () => {
    const diagnostics = buildCycleModel(periodsFromLengths([29, 30, 29, 30, 29, 41]));
    const expected = Math.ceil(Math.max(
      CYCLE_MODEL_PARAMETERS.UNCERTAINTY_FLOOR_DAYS,
      diagnostics.robustSpreadDays ?? 0,
      diagnostics.walkForwardMedianAbsoluteError ?? 0,
    ));
    expect(diagnostics.finalUncertaintyDays).toBe(expected);
  });

  it('is not chaotic under small parameter perturbations for stable history', () => {
    const parameters = CYCLE_MODEL_PARAMETERS as unknown as {
      RECENCY_DECAY: number;
      POSSIBLE_SHIFT_THRESHOLD_DAYS: number;
    };
    const originalDecay = parameters.RECENCY_DECAY;
    const originalShiftThreshold = parameters.POSSIBLE_SHIFT_THRESHOLD_DAYS;
    const sample = periodsFromLengths([29, 30, 29, 30, 29, 30, 29, 30]);
    const baseline = buildCycleModel(sample);
    try {
      for (const decay of [originalDecay - 0.03, originalDecay + 0.03]) {
        parameters.RECENCY_DECAY = decay;
        const variant = buildCycleModel(sample);
        expect(Math.abs((variant.weightedMedianDays ?? 0) - (baseline.weightedMedianDays ?? 0))).toBeLessThanOrEqual(1);
        expect(Math.abs((variant.finalUncertaintyDays ?? 0) - (baseline.finalUncertaintyDays ?? 0))).toBeLessThanOrEqual(1);
      }
      parameters.RECENCY_DECAY = originalDecay;
      for (const threshold of [originalShiftThreshold - 0.5, originalShiftThreshold + 0.5]) {
        parameters.POSSIBLE_SHIFT_THRESHOLD_DAYS = threshold;
        expect(detectPossibleRegimeShift(lengths(sample)).possible).toBe(false);
      }
    } finally {
      parameters.RECENCY_DECAY = originalDecay;
      parameters.POSSIBLE_SHIFT_THRESHOLD_DAYS = originalShiftThreshold;
    }
  });

  it('rejects impossible calendar dates instead of normalizing them silently', () => {
    expect(isValidCycleDateKey('2024-02-29')).toBe(true);
    expect(isValidCycleDateKey('2026-02-29')).toBe(false);
    expect(isValidCycleDateKey('2026-02-31')).toBe(false);
  });

  it('keeps model guardrails explicit and non-zero', () => {
    expect(CYCLE_MODEL_PARAMETERS.UNCERTAINTY_FLOOR_DAYS).toBeGreaterThan(0);
    expect(CYCLE_MODEL_PARAMETERS.POSSIBLE_SHIFT_MIN_TOTAL_CYCLES).toBeGreaterThan(CYCLE_MODEL_PARAMETERS.POSSIBLE_SHIFT_RECENT_WINDOW);
  });
});
