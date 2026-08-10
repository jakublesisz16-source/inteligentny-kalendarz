export type AvailabilityPlanStatus = 'DRAFT' | 'ACCEPTED' | 'STALE';
export type AvailabilityBlockStatus = 'PROPOSED' | 'ACCEPTED' | 'EDITED' | 'REJECTED';
export type AvailabilityBlockOrigin = 'OPTIMIZER' | 'MANUAL';
export type AvailabilityBlockValidationState = 'VALID' | 'CONFLICT';

export interface AvailabilityExplanationFact {
  code: string;
  text: string;
}

export interface AvailabilityBlockedInterval {
  id: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityDayRule {
  date: string;
  excluded: boolean;
  earliestTime?: string;
  latestTime?: string;
  blockedIntervals: AvailabilityBlockedInterval[];
  updatedAt: string;
}

export interface AvailabilityBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  status: AvailabilityBlockStatus;
  locked: boolean;
  userEdited: boolean;
  explanationFacts: AvailabilityExplanationFact[];
  candidateKey: string;
  /** Optional for backwards compatibility with plans created before 0.3.3-hotfix.1. */
  origin?: AvailabilityBlockOrigin;
  /** Derived validation state. Conflicting historical blocks stay visible but do not count as safe coverage. */
  validationState?: AvailabilityBlockValidationState;
  validationMessage?: string;
}

export interface AvailabilitySentSnapshot {
  id: string;
  createdAt: string;
  version: number;
  totalMinutes: number;
  blocks: Array<Pick<AvailabilityBlock, 'date' | 'startTime' | 'endTime' | 'minutes'>>;
}

export interface AvailabilityPlan {
  id: string;
  weekStart: string;
  weekEnd: string;
  createdAt: string;
  updatedAt: string;
  inputFingerprint: string;
  status: AvailabilityPlanStatus;
  targetWeeklyWorkMinutes: number;
  confirmedWorkMinutes: number;
  requiredAvailabilityMinutes: number;
  acceptedAvailabilityMinutes: number;
  remainingMinutes: number;
  maximumSafeCoverageMinutes: number;
  deficitMinutes: number;
  blocks: AvailabilityBlock[];
  sentSnapshots: AvailabilitySentSnapshot[];
  /** Day-specific exceptions. Stored inside the weekly plan to avoid another IndexedDB store. */
  dayRules?: AvailabilityDayRule[];
  diagnostics?: {
    candidateCount: number;
    evaluatedStateCount: number;
    reasons: string[];
  };
}

export interface AvailabilityTimeInterval {
  startMinute: number;
  endMinute: number;
  kind: 'EVENT' | 'WORK' | 'ROUTINE' | 'CONSISTENCY' | 'DAY_RULE';
  label?: string;
  category?: string;
  originalStartMinute?: number;
  originalEndMinute?: number;
  bufferMinutes?: number;
}

export interface AvailabilityDayInput {
  date: string;
  weekday: number;
  /** Whether the automatic optimizer may use this day. */
  eligible: boolean;
  /** Whether a deliberate manual block may be saved on this day. Saturday can be manual even when auto Saturday is disabled. */
  manualEligible: boolean;
  tradingSunday: boolean;
  exclusionReason?: string;
  allowedStartMinute: number;
  allowedEndMinute: number;
  preferredStartMinute?: number;
  preferredEndMinute?: number;
  confirmedWorkMinutes: number;
  blockingIntervals: AvailabilityTimeInterval[];
  flexibleRequiredMinutes: number;
  lockedBlocks: AvailabilityBlock[];
  rejectedCandidateKeys: string[];
}

export interface AvailabilityOptimizationInput {
  weekStart: string;
  weekEnd: string;
  targetWeeklyWorkMinutes: number;
  confirmedWorkMinutes: number;
  requiredAvailabilityMinutes: number;
  minimumShiftMinutes?: number;
  maximumShiftMinutes?: number;
  maximumWorkDaysPerWeek?: number;
  maximumWorkMinutesPerDay?: number;
  stepMinutes: number;
  days: AvailabilityDayInput[];
}

export interface AvailabilityOptimizationResult {
  blocks: AvailabilityBlock[];
  coverageMinutes: number;
  maximumSafeCoverageMinutes: number;
  deficitMinutes: number;
  candidateCount: number;
  evaluatedStateCount: number;
  reasons: string[];
}

export interface AvailabilityDayOverview {
  weekStart: string;
  date: string;
  plan?: AvailabilityPlan;
  rule?: AvailabilityDayRule;
  blocks: AvailabilityBlock[];
  safeIntervals: Array<{ startTime: string; endTime: string; minutes: number }>;
  tradingSunday: boolean;
  isSunday: boolean;
  globalAllowedStart?: string;
  globalAllowedEnd?: string;
}
