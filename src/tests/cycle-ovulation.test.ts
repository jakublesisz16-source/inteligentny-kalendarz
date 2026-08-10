import { describe, expect, it } from 'vitest';
import { deriveOvulationEstimate } from '../cycle/cycle-ovulation';
import type { CyclePrediction } from '../cycle/cycle.types';

function prediction(overrides: Partial<CyclePrediction> = {}): CyclePrediction {
  return {
    status: 'READY',
    reliability: 'MODERATE',
    diagnostics: {
      modelVersion: 'cycle-v1',
      completedCycleCount: 6,
      walkForwardSampleCount: 4,
      possibleMissedLogs: [],
      observationBreakCount: 0,
      possibleShiftScore: 0,
      regimeState: 'STABLE',
    },
    primaryWindow: { startDate: '2026-08-20', endDate: '2026-08-22' },
    ...overrides,
  };
}

describe('0.6.3 ostrożne szacowane okno owulacji', () => {
  it('returns one broad window only for READY + MODERATE', () => {
    expect(deriveOvulationEstimate(prediction())).toEqual({
      status: 'READY',
      window: { startDate: '2026-08-04', endDate: '2026-08-12' },
    });
  });

  it('accepts READY + HIGHER', () => {
    expect(deriveOvulationEstimate(prediction({ reliability: 'HIGHER' })).status).toBe('READY');
  });

  it('rejects READY + LOW', () => {
    expect(deriveOvulationEstimate(prediction({ reliability: 'LOW' }))).toEqual({
      status: 'UNAVAILABLE',
      reason: 'PERIOD_PREDICTION_LOW_RELIABILITY',
    });
  });

  it.each(['PRELIMINARY', 'UNAVAILABLE', 'UNRELIABLE', 'EXPIRED'] as const)('rejects %s period prediction', (status) => {
    const result = deriveOvulationEstimate(prediction({ status }));
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.window).toBeUndefined();
  });

  it('rejects READY without a primary window instead of inventing a fallback', () => {
    const input = prediction();
    delete input.primaryWindow;
    expect(deriveOvulationEstimate(input)).toEqual({
      status: 'UNAVAILABLE',
      reason: 'MISSING_PERIOD_WINDOW',
    });
  });

  it('uses start -16 and end -10 across month boundaries', () => {
    const result = deriveOvulationEstimate(prediction({ primaryWindow: { startDate: '2026-03-05', endDate: '2026-03-07' } }));
    expect(result.window).toEqual({ startDate: '2026-02-17', endDate: '2026-02-25' });
  });

  it('handles year boundaries', () => {
    const result = deriveOvulationEstimate(prediction({ primaryWindow: { startDate: '2027-01-05', endDate: '2027-01-07' } }));
    expect(result.window).toEqual({ startDate: '2026-12-20', endDate: '2026-12-28' });
  });

  it('handles leap day arithmetic', () => {
    const result = deriveOvulationEstimate(prediction({ primaryWindow: { startDate: '2024-03-10', endDate: '2024-03-12' } }));
    expect(result.window).toEqual({ startDate: '2024-02-23', endDate: '2024-03-02' });
  });

  it('keeps a single-day period window as a multi-day ovulation estimate', () => {
    const result = deriveOvulationEstimate(prediction({ primaryWindow: { startDate: '2026-08-20', endDate: '2026-08-20' } }));
    expect(result.window).toEqual({ startDate: '2026-08-04', endDate: '2026-08-10' });
    expect(result.window?.startDate).not.toBe(result.window?.endDate);
  });

  it('depends only on CyclePrediction, not journal, medication or pattern inputs', () => {
    const source = deriveOvulationEstimate.toString();
    expect(source).not.toContain('CycleJournal');
    expect(source).not.toContain('painMedicationTaken');
    expect(source).not.toContain('CyclePattern');
  });
});
