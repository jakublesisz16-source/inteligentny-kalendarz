import type {
  CompletedCycle,
  CycleHistorySummary,
  CycleModelDiagnostics,
  CyclePeriod,
  CyclePrediction,
  CyclePredictionReliability,
  CycleProbabilityPoint,
  CycleRegimeState,
  CycleWalkForwardResult,
  PossibleMissedLog,
} from './cycle.types';

export const CYCLE_MODEL_VERSION = 'cycle-v1' as const;

// Model v1 parameters are modeling guardrails, not clinical thresholds.
export const CYCLE_MODEL_PARAMETERS = {
  RECENCY_DECAY: 0.9,
  POSSIBLE_SHIFT_RECENCY_DECAY: 0.76,
  MIN_COMPLETED_CYCLES_FOR_PRELIMINARY: 2,
  MIN_COMPLETED_CYCLES_FOR_STANDARD: 4,
  MIN_PRIOR_CYCLES_FOR_MISSED_LOG: 1,
  UNCERTAINTY_FLOOR_DAYS: 2,
  PRELIMINARY_UNCERTAINTY_FLOOR_DAYS: 4,
  SPARSE_RANGE_GUARD_MAX_CYCLES: 3,
  PRIMARY_TARGET_MASS: 0.6,
  WIDE_TARGET_MASS: 0.85,
  MISSED_LOG_MIN_MULTIPLE: 1.65,
  MISSED_LOG_MULTIPLE_TOLERANCE_DAYS: 5,
  MISSED_LOG_MAX_MULTIPLE_EVIDENCE: 4,
  POSSIBLE_SHIFT_MIN_TOTAL_CYCLES: 8,
  POSSIBLE_SHIFT_RECENT_WINDOW: 3,
  POSSIBLE_SHIFT_MIN_SUPPORT: 3,
  POSSIBLE_SHIFT_THRESHOLD_DAYS: 2,
  HIGH_VARIABILITY_RELATIVE_THRESHOLD: 0.22,
} as const;

const MS_PER_DAY = 86_400_000;

export function isValidCycleDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const normalized = new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10);
  return normalized === value;
}

function assertDateKey(value: string): void {
  if (!isValidCycleDateKey(value)) throw new Error(`Nieprawidłowa data cyklu: ${value}`);
}

export function localDateOrdinal(value: string): number {
  assertDateKey(value);
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / MS_PER_DAY);
}

export function cycleDaysBetween(startDate: string, endDate: string): number {
  return localDateOrdinal(endDate) - localDateOrdinal(startDate);
}

function localDateKeyFromOrdinal(ordinal: number): string {
  return new Date(ordinal * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addCycleCalendarDays(value: string, amount: number): string {
  return localDateKeyFromOrdinal(localDateOrdinal(value) + amount);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function weightedMedian(values: number[], weights: number[]): number {
  if (!values.length || values.length !== weights.length) return 0;
  const pairs = values.map((value, index) => ({ value, weight: Math.max(0, weights[index] ?? 0) })).sort((a, b) => a.value - b.value);
  const total = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  if (total <= 0) return median(values);
  let cumulative = 0;
  for (const pair of pairs) {
    cumulative += pair.weight;
    if (cumulative >= total / 2) return pair.value;
  }
  return pairs[pairs.length - 1]!.value;
}

function recencyWeights(count: number, decay: number): number[] {
  return Array.from({ length: count }, (_, index) => Math.pow(decay, count - index - 1));
}

function robustSpread(values: number[], weights: number[], center: number): number {
  if (!values.length) return 0;
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = weightedMedian(deviations, weights);
  return mad * 1.4826;
}

function observedRange(values: number[]): { min: number; max: number } | undefined {
  if (!values.length) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function uncertaintyForSample(values: number[], spread: number, historicalMae: number): number {
  const preliminary = values.length < CYCLE_MODEL_PARAMETERS.MIN_COMPLETED_CYCLES_FOR_STANDARD;
  const floor = preliminary
    ? CYCLE_MODEL_PARAMETERS.PRELIMINARY_UNCERTAINTY_FLOOR_DAYS
    : CYCLE_MODEL_PARAMETERS.UNCERTAINTY_FLOOR_DAYS;
  const range = observedRange(values);
  const sparseRangeGuard = values.length <= CYCLE_MODEL_PARAMETERS.SPARSE_RANGE_GUARD_MAX_CYCLES && range
    ? (range.max - range.min) / 2
    : 0;
  return Math.ceil(Math.max(floor, spread, historicalMae, sparseRangeGuard));
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const fraction = position - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

function isCloseToMultiple(gapDays: number, typicalDays: number, spreadDays: number): { multiple: number; close: boolean } {
  let bestMultiple = 2;
  let bestDistance = Number.POSITIVE_INFINITY;
  const tolerance = Math.max(CYCLE_MODEL_PARAMETERS.MISSED_LOG_MULTIPLE_TOLERANCE_DAYS, Math.ceil(spreadDays * 2));
  for (let multiple = 2; multiple <= CYCLE_MODEL_PARAMETERS.MISSED_LOG_MAX_MULTIPLE_EVIDENCE; multiple += 1) {
    const distance = Math.abs(gapDays - typicalDays * multiple);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMultiple = multiple;
    }
  }
  return { multiple: bestMultiple, close: bestDistance <= tolerance };
}

export function detectPossibleMissedLog(
  gapDays: number,
  priorLengths: number[],
): { possible: boolean; typicalDays: number; closestMultiple: number } {
  if (priorLengths.length < CYCLE_MODEL_PARAMETERS.MIN_PRIOR_CYCLES_FOR_MISSED_LOG) {
    return { possible: false, typicalDays: median(priorLengths), closestMultiple: 1 };
  }
  const weights = recencyWeights(priorLengths.length, CYCLE_MODEL_PARAMETERS.RECENCY_DECAY);
  const typical = weightedMedian(priorLengths, weights);
  const spread = robustSpread(priorLengths, weights, typical);
  const multiple = isCloseToMultiple(gapDays, typical, spread);
  const clearlyLong = gapDays >= typical * CYCLE_MODEL_PARAMETERS.MISSED_LOG_MIN_MULTIPLE;
  const extremeBeyondHistory = gapDays > typical + Math.max(12, spread * 4);
  return {
    possible: clearlyLong && (multiple.close || extremeBeyondHistory),
    typicalDays: typical,
    closestMultiple: multiple.multiple,
  };
}

export function deriveCompletedCycleLengths(periods: CyclePeriod[]): {
  completed: CompletedCycle[];
  possibleMissedLogs: PossibleMissedLog[];
  observationBreakCount: number;
} {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const completed: CompletedCycle[] = [];
  const possibleMissedLogs: PossibleMissedLog[] = [];
  let observationBreakCount = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const gapDays = cycleDaysBetween(previous.startDate, current.startDate);
    if (gapDays <= 0) continue;

    if (current.previousGapDecision === 'OBSERVATION_BREAK') {
      observationBreakCount += 1;
      continue;
    }

    if (current.previousGapDecision !== 'CONFIRMED_SINGLE_CYCLE') {
      const prior = completed.map((item) => item.lengthDays);
      const missed = detectPossibleMissedLog(gapDays, prior);
      if (missed.possible) {
        possibleMissedLogs.push({
          fromPeriodId: previous.id,
          toPeriodId: current.id,
          startDate: previous.startDate,
          nextStartDate: current.startDate,
          gapDays,
          typicalDays: missed.typicalDays,
          closestMultiple: missed.closestMultiple,
        });
        continue;
      }
    }

    completed.push({
      fromPeriodId: previous.id,
      toPeriodId: current.id,
      startDate: previous.startDate,
      nextStartDate: current.startDate,
      lengthDays: gapDays,
    });
  }

  return { completed, possibleMissedLogs, observationBreakCount };
}

function baseModel(values: number[], decay: number): { center: number; spread: number } {
  const weights = recencyWeights(values.length, decay);
  const center = weightedMedian(values, weights);
  const spread = robustSpread(values, weights, center);
  return { center, spread };
}

function shiftScore(values: number[]): number {
  const p = CYCLE_MODEL_PARAMETERS;
  if (values.length < p.POSSIBLE_SHIFT_MIN_TOTAL_CYCLES) return 0;
  const recentSize = p.POSSIBLE_SHIFT_RECENT_WINDOW;
  const recent = values.slice(-recentSize);
  const previous = values.slice(0, -recentSize);
  if (recent.length < p.POSSIBLE_SHIFT_MIN_SUPPORT || previous.length < p.POSSIBLE_SHIFT_MIN_SUPPORT) return 0;
  const previousCenter = median(previous);
  const recentCenter = median(recent);
  const previousSpread = median(previous.map((value) => Math.abs(value - previousCenter))) * 1.4826;
  const threshold = Math.max(p.POSSIBLE_SHIFT_THRESHOLD_DAYS, previousSpread * 1.5);
  const direction = Math.sign(recentCenter - previousCenter);
  const support = recent.filter((value) => Math.sign(value - previousCenter) === direction && Math.abs(value - previousCenter) >= threshold / 2).length;
  if (!direction || support < p.POSSIBLE_SHIFT_MIN_SUPPORT) return 0;
  return Math.abs(recentCenter - previousCenter) / Math.max(1, threshold);
}

export function detectPossibleRegimeShift(values: number[]): { possible: boolean; score: number } {
  const score = shiftScore(values);
  return { possible: score >= 1, score };
}

export function buildWalkForwardCalibration(values: number[]): CycleWalkForwardResult[] {
  const results: CycleWalkForwardResult[] = [];
  for (let targetIndex = 2; targetIndex < values.length; targetIndex += 1) {
    const prior = values.slice(0, targetIndex);
    const shift = detectPossibleRegimeShift(prior);
    const decay = shift.possible ? CYCLE_MODEL_PARAMETERS.POSSIBLE_SHIFT_RECENCY_DECAY : CYCLE_MODEL_PARAMETERS.RECENCY_DECAY;
    const model = baseModel(prior, decay);
    const priorResults = results;
    const priorMae = priorResults.length ? median(priorResults.map((item) => item.absoluteErrorDays)) : 0;
    const uncertainty = uncertaintyForSample(prior, model.spread, priorMae);
    const actual = values[targetIndex]!;
    const error = Math.abs(actual - model.center);
    results.push({
      targetIndex,
      actualLengthDays: actual,
      predictedCenterDays: model.center,
      absoluteErrorDays: error,
      primaryHit: error <= uncertainty,
      wideHit: error <= uncertainty * 2,
    });
  }
  return results;
}

export function calculateObservationSurprise(values: number[]): number | undefined {
  if (values.length < 3) return undefined;
  const prior = values.slice(0, -1);
  const target = values[values.length - 1]!;
  const shift = detectPossibleRegimeShift(prior);
  const decay = shift.possible ? CYCLE_MODEL_PARAMETERS.POSSIBLE_SHIFT_RECENCY_DECAY : CYCLE_MODEL_PARAMETERS.RECENCY_DECAY;
  const model = baseModel(prior, decay);
  const calibration = buildWalkForwardCalibration(prior);
  const mae = calibration.length ? median(calibration.map((item) => item.absoluteErrorDays)) : 0;
  const scale = uncertaintyForSample(prior, model.spread, mae);
  return Math.abs(target - model.center) / Math.max(1, scale);
}

function buildDistribution(center: number, scale: number): CycleProbabilityPoint[] {
  const sigma = Math.max(CYCLE_MODEL_PARAMETERS.UNCERTAINTY_FLOOR_DAYS, scale);
  const radius = Math.max(10, Math.ceil(sigma * 5));
  const min = Math.max(1, Math.floor(center - radius));
  const max = Math.ceil(center + radius);
  const raw = Array.from({ length: max - min + 1 }, (_, index) => {
    const cycleLengthDays = min + index;
    const distance = (cycleLengthDays - center) / sigma;
    const weight = Math.exp(-0.5 * distance * distance);
    return { cycleLengthDays, probability: weight };
  });
  const total = raw.reduce((sum, point) => sum + point.probability, 0);
  return raw.map((point) => ({ ...point, probability: point.probability / total }));
}

function centralMassWindow(distribution: CycleProbabilityPoint[], targetMass: number): { min: number; max: number } {
  const ordered = [...distribution].sort((a, b) => b.probability - a.probability || a.cycleLengthDays - b.cycleLengthDays);
  let mass = 0;
  const selected: number[] = [];
  for (const point of ordered) {
    selected.push(point.cycleLengthDays);
    mass += point.probability;
    if (mass >= targetMass) break;
  }
  return { min: Math.min(...selected), max: Math.max(...selected) };
}

function reliabilityFor(input: {
  count: number;
  finalUncertainty: number;
  center: number;
  surprise?: number;
  shift: boolean;
  calibrationCount: number;
}): CyclePredictionReliability {
  if (input.count < CYCLE_MODEL_PARAMETERS.MIN_COMPLETED_CYCLES_FOR_STANDARD) return 'LOW';
  if (input.shift || (input.surprise ?? 0) >= 2.5) return 'LOW';
  const relative = input.finalUncertainty / Math.max(1, input.center);
  if (relative >= 0.14 || input.calibrationCount < 2) return 'LOW';
  if (relative <= 0.07 && input.count >= 7 && input.calibrationCount >= 4) return 'HIGHER';
  return 'MODERATE';
}

function regimeStateFor(values: number[], finalUncertainty: number, center: number, surprise?: number): CycleRegimeState {
  const shift = detectPossibleRegimeShift(values);
  if (finalUncertainty / Math.max(1, center) >= CYCLE_MODEL_PARAMETERS.HIGH_VARIABILITY_RELATIVE_THRESHOLD) return 'UNRELIABLE';
  if (shift.possible) return 'POSSIBLE_SHIFT';
  if ((surprise ?? 0) >= 2.5) return 'ELEVATED_UNCERTAINTY';
  return 'STABLE';
}

function completedCyclesSinceLastObservationBreak(periods: CyclePeriod[], completed: CompletedCycle[]): number | undefined {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let lastBreakIndex = -1;
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index]?.previousGapDecision === 'OBSERVATION_BREAK') lastBreakIndex = index;
  }
  if (lastBreakIndex < 0) return undefined;
  const allowedFromIds = new Set(sorted.slice(lastBreakIndex).map((period) => period.id));
  return completed.filter((cycle) => allowedFromIds.has(cycle.fromPeriodId)).length;
}

export function buildCycleModel(periods: CyclePeriod[]): CycleModelDiagnostics {
  const derived = deriveCompletedCycleLengths(periods);
  const values = derived.completed.map((item) => item.lengthDays);
  const shift = detectPossibleRegimeShift(values);
  const decay = shift.possible ? CYCLE_MODEL_PARAMETERS.POSSIBLE_SHIFT_RECENCY_DECAY : CYCLE_MODEL_PARAMETERS.RECENCY_DECAY;
  const calibration = buildWalkForwardCalibration(values);
  const model = values.length ? baseModel(values, decay) : undefined;
  const mae = calibration.length ? median(calibration.map((item) => item.absoluteErrorDays)) : undefined;
  const surprise = calculateObservationSurprise(values);
  const finalUncertainty = model ? uncertaintyForSample(values, model.spread, mae ?? 0) : undefined;
  const regimeState = model && finalUncertainty !== undefined ? regimeStateFor(values, finalUncertainty, model.center, surprise) : 'STABLE';
  const postBreakCompleted = completedCyclesSinceLastObservationBreak(periods, derived.completed);
  return {
    modelVersion: CYCLE_MODEL_VERSION,
    completedCycleCount: values.length,
    ...(model ? { weightedMedianDays: model.center, robustSpreadDays: model.spread } : {}),
    walkForwardSampleCount: calibration.length,
    ...(mae !== undefined ? { walkForwardMedianAbsoluteError: mae } : {}),
    ...(calibration.length ? {
      primaryCoverageEstimate: calibration.filter((item) => item.primaryHit).length / calibration.length,
      wideCoverageEstimate: calibration.filter((item) => item.wideHit).length / calibration.length,
    } : {}),
    ...(surprise !== undefined ? { lastObservationSurprise: surprise } : {}),
    possibleMissedLogs: derived.possibleMissedLogs,
    observationBreakCount: derived.observationBreakCount,
    ...(postBreakCompleted !== undefined ? { completedCyclesSinceLastObservationBreak: postBreakCompleted } : {}),
    possibleShiftScore: shift.score,
    regimeState,
    ...(finalUncertainty !== undefined ? { finalUncertaintyDays: finalUncertainty } : {}),
  };
}

export function predictNextPeriod(periods: CyclePeriod[], todayDate: string): CyclePrediction {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const diagnostics = buildCycleModel(sorted);
  const values = deriveCompletedCycleLengths(sorted).completed.map((item) => item.lengthDays);
  if (diagnostics.possibleMissedLogs.length) {
    return { status: 'UNRELIABLE', reliability: 'LOW', diagnostics, reason: 'POSSIBLE_MISSED_LOG' };
  }
  if (values.length < CYCLE_MODEL_PARAMETERS.MIN_COMPLETED_CYCLES_FOR_PRELIMINARY) {
    return { status: 'UNAVAILABLE', reliability: 'LOW', diagnostics, reason: 'INSUFFICIENT_DATA' };
  }
  const last = sorted[sorted.length - 1];
  if (!last || diagnostics.weightedMedianDays === undefined || diagnostics.finalUncertaintyDays === undefined) {
    return { status: 'UNAVAILABLE', reliability: 'LOW', diagnostics, reason: 'INSUFFICIENT_DATA' };
  }
  const distribution = buildDistribution(diagnostics.weightedMedianDays, diagnostics.finalUncertaintyDays);
  const primaryLengths = centralMassWindow(distribution, CYCLE_MODEL_PARAMETERS.PRIMARY_TARGET_MASS);
  const wideLengths = centralMassWindow(distribution, CYCLE_MODEL_PARAMETERS.WIDE_TARGET_MASS);
  const primaryWindow = {
    startDate: addCycleCalendarDays(last.startDate, primaryLengths.min),
    endDate: addCycleCalendarDays(last.startDate, primaryLengths.max),
  };
  const wideWindow = {
    startDate: addCycleCalendarDays(last.startDate, wideLengths.min),
    endDate: addCycleCalendarDays(last.startDate, wideLengths.max),
  };
  const shift = diagnostics.regimeState === 'POSSIBLE_SHIFT';
  const baseReliability = reliabilityFor({
    count: values.length,
    finalUncertainty: diagnostics.finalUncertaintyDays,
    center: diagnostics.weightedMedianDays,
    ...(diagnostics.lastObservationSurprise !== undefined ? { surprise: diagnostics.lastObservationSurprise } : {}),
    shift,
    calibrationCount: diagnostics.walkForwardSampleCount,
  });
  const reliability = diagnostics.completedCyclesSinceLastObservationBreak !== undefined
    && diagnostics.completedCyclesSinceLastObservationBreak < 2
    ? 'LOW'
    : baseReliability;
  const relativeUncertainty = diagnostics.finalUncertaintyDays / Math.max(1, diagnostics.weightedMedianDays);
  if (relativeUncertainty >= CYCLE_MODEL_PARAMETERS.HIGH_VARIABILITY_RELATIVE_THRESHOLD || diagnostics.regimeState === 'UNRELIABLE') {
    return { status: 'UNRELIABLE', reliability: 'LOW', diagnostics, wideWindow, distribution, reason: 'HIGH_VARIABILITY' };
  }
  if (todayDate > wideWindow.endDate) {
    return { status: 'EXPIRED', reliability: 'LOW', diagnostics, wideWindow, distribution, reason: 'EXPIRED_ESTIMATE' };
  }
  const status = values.length < CYCLE_MODEL_PARAMETERS.MIN_COMPLETED_CYCLES_FOR_STANDARD ? 'PRELIMINARY' : 'READY';
  return { status, reliability, diagnostics, primaryWindow, wideWindow, distribution };
}

export function buildCycleHistorySummary(periods: CyclePeriod[]): CycleHistorySummary {
  const { completed } = deriveCompletedCycleLengths(periods);
  const values = completed.map((item) => item.lengthDays);
  const range = observedRange(values);
  const model = buildCycleModel(periods);
  const typicalLow = values.length ? Math.round(quantile(values, 0.25)) : undefined;
  const typicalHigh = values.length ? Math.round(quantile(values, 0.75)) : undefined;
  return {
    periodCount: periods.length,
    completedCycleCount: values.length,
    ...(typicalLow !== undefined && typicalHigh !== undefined ? {
      typicalLabel: typicalLow === typicalHigh ? `${typicalLow} dni` : `${typicalLow}-${typicalHigh} dni`,
    } : {}),
    ...(range ? { observedRangeLabel: `${range.min}-${range.max} dni` } : {}),
    variable: model.regimeState === 'UNRELIABLE' || model.regimeState === 'POSSIBLE_SHIFT' || (model.finalUncertaintyDays ?? 0) >= 4,
  };
}
