export type LocalDateString = string;

export type CycleGapDecision = 'CONFIRMED_SINGLE_CYCLE' | 'OBSERVATION_BREAK';

export interface CyclePeriod {
  id: string;
  startDate: LocalDateString;
  endDate?: LocalDateString;
  isUserMarkedAtypical?: boolean;
  previousGapDecision?: CycleGapDecision;
  createdAt: string;
  updatedAt: string;
}

export interface CyclePeriodDraft {
  startDate: LocalDateString;
  endDate?: LocalDateString;
  isUserMarkedAtypical?: boolean;
}


export const CYCLE_BLEEDING_LEVELS = ['NONE', 'SPOTTING', 'LIGHT', 'MODERATE', 'HEAVY'] as const;
export type CycleBleedingLevel = (typeof CYCLE_BLEEDING_LEVELS)[number];

export const CYCLE_PAIN_LEVELS = ['NONE', 'MILD', 'MODERATE', 'STRONG'] as const;
export type CyclePainLevel = (typeof CYCLE_PAIN_LEVELS)[number];

export const CYCLE_WELLBEING_LEVELS = ['GOOD', 'NEUTRAL', 'LOW'] as const;
export type CycleWellbeingLevel = (typeof CYCLE_WELLBEING_LEVELS)[number];

export interface CycleJournalEntry {
  id: string;
  date: LocalDateString;
  bleeding?: CycleBleedingLevel;
  pain?: CyclePainLevel;
  wellbeing?: CycleWellbeingLevel;
  painMedicationTaken?: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CycleJournalEntryDraft {
  date: LocalDateString;
  bleeding?: CycleBleedingLevel;
  pain?: CyclePainLevel;
  wellbeing?: CycleWellbeingLevel;
  painMedicationTaken?: boolean;
  note?: string;
}

export interface CompletedCycle {
  fromPeriodId: string;
  toPeriodId: string;
  startDate: LocalDateString;
  nextStartDate: LocalDateString;
  lengthDays: number;
}

export interface PossibleMissedLog {
  fromPeriodId: string;
  toPeriodId: string;
  startDate: LocalDateString;
  nextStartDate: LocalDateString;
  gapDays: number;
  typicalDays: number;
  closestMultiple: number;
}

export type CyclePredictionStatus = 'UNAVAILABLE' | 'PRELIMINARY' | 'READY' | 'UNRELIABLE' | 'EXPIRED';
export type CyclePredictionReliability = 'LOW' | 'MODERATE' | 'HIGHER';
export type CycleRegimeState = 'STABLE' | 'ELEVATED_UNCERTAINTY' | 'POSSIBLE_SHIFT' | 'UNRELIABLE';

export interface CyclePredictionWindow {
  startDate: LocalDateString;
  endDate: LocalDateString;
}

export interface CycleProbabilityPoint {
  cycleLengthDays: number;
  probability: number;
}

export interface CycleWalkForwardResult {
  targetIndex: number;
  actualLengthDays: number;
  predictedCenterDays: number;
  absoluteErrorDays: number;
  primaryHit: boolean;
  wideHit: boolean;
}

export interface CycleModelDiagnostics {
  modelVersion: 'cycle-v1';
  completedCycleCount: number;
  weightedMedianDays?: number;
  robustSpreadDays?: number;
  walkForwardSampleCount: number;
  walkForwardMedianAbsoluteError?: number;
  primaryCoverageEstimate?: number;
  wideCoverageEstimate?: number;
  lastObservationSurprise?: number;
  possibleMissedLogs: PossibleMissedLog[];
  observationBreakCount: number;
  completedCyclesSinceLastObservationBreak?: number;
  possibleShiftScore: number;
  regimeState: CycleRegimeState;
  finalUncertaintyDays?: number;
}

export interface CyclePrediction {
  status: CyclePredictionStatus;
  reliability: CyclePredictionReliability;
  diagnostics: CycleModelDiagnostics;
  primaryWindow?: CyclePredictionWindow;
  wideWindow?: CyclePredictionWindow;
  distribution?: CycleProbabilityPoint[];
  reason?: 'INSUFFICIENT_DATA' | 'POSSIBLE_MISSED_LOG' | 'HIGH_VARIABILITY' | 'EXPIRED_ESTIMATE';
}

export interface CycleHistorySummary {
  periodCount: number;
  completedCycleCount: number;
  typicalLabel?: string;
  observedRangeLabel?: string;
  variable: boolean;
}
