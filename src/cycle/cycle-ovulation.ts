import { addCycleCalendarDays } from './cycle-prediction';
import type { CyclePrediction, CyclePredictionWindow } from './cycle.types';

export type CycleOvulationEstimateStatus = 'UNAVAILABLE' | 'READY';
export type CycleOvulationEstimateReason =
  | 'PERIOD_PREDICTION_NOT_READY'
  | 'PERIOD_PREDICTION_LOW_RELIABILITY'
  | 'MISSING_PERIOD_WINDOW';

export interface CycleOvulationEstimate {
  status: CycleOvulationEstimateStatus;
  window?: CyclePredictionWindow;
  reason?: CycleOvulationEstimateReason;
}

/**
 * Calendar-only derived estimate. It does not detect or confirm ovulation.
 * The range is intentionally broad: 10-16 days before the predicted next-period window.
 */
export function deriveOvulationEstimate(prediction: CyclePrediction): CycleOvulationEstimate {
  if (prediction.status !== 'READY') {
    return { status: 'UNAVAILABLE', reason: 'PERIOD_PREDICTION_NOT_READY' };
  }
  if (prediction.reliability === 'LOW') {
    return { status: 'UNAVAILABLE', reason: 'PERIOD_PREDICTION_LOW_RELIABILITY' };
  }
  if (!prediction.primaryWindow) {
    return { status: 'UNAVAILABLE', reason: 'MISSING_PERIOD_WINDOW' };
  }
  return {
    status: 'READY',
    window: {
      startDate: addCycleCalendarDays(prediction.primaryWindow.startDate, -16),
      endDate: addCycleCalendarDays(prediction.primaryWindow.endDate, -10),
    },
  };
}
