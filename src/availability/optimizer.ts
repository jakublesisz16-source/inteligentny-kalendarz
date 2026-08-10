import type {
  AvailabilityBlock,
  AvailabilityDayInput,
  AvailabilityOptimizationInput,
  AvailabilityOptimizationResult,
  AvailabilityTimeInterval,
} from './availability.types';

interface Candidate {
  key: string;
  date: string;
  startMinute: number;
  endMinute: number;
  minutes: number;
  preferredPenalty: number;
  naturalPenalty: number;
  explanation: string[];
}

interface SearchState {
  chosen: Candidate[];
  coverage: number;
  dayMinutes: Map<string, number>;
  workDays: Set<string>;
  preferredPenalty: number;
  naturalPenalty: number;
}

function roundDown(value: number, step: number): number { return Math.floor(value / step) * step; }
function roundUp(value: number, step: number): number { return Math.ceil(value / step) * step; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

export function formatAvailabilityMinute(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function mergeIntervals(intervals: AvailabilityTimeInterval[], min: number, max: number): Array<{ start: number; end: number }> {
  const clipped = intervals
    .map((item) => ({ start: clamp(item.startMinute, min, max), end: clamp(item.endMinute, min, max) }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of clipped) {
    const last = merged.at(-1);
    if (!last || interval.start > last.end) merged.push({ ...interval });
    else if (interval.end > last.end) last.end = interval.end;
  }
  return merged;
}

export function freeIntervalsForAvailabilityDay(day: AvailabilityDayInput): Array<{ start: number; end: number; minutes: number }> {
  if (!day.eligible || day.allowedEndMinute <= day.allowedStartMinute) return [];
  const blocks = mergeIntervals(day.blockingIntervals, day.allowedStartMinute, day.allowedEndMinute);
  const result: Array<{ start: number; end: number; minutes: number }> = [];
  let cursor = day.allowedStartMinute;
  for (const block of blocks) {
    if (block.start > cursor) result.push({ start: cursor, end: block.start, minutes: block.start - cursor });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < day.allowedEndMinute) result.push({ start: cursor, end: day.allowedEndMinute, minutes: day.allowedEndMinute - cursor });
  return result;
}

/** Manual preview uses the same hard time blocks but may allow a Saturday disabled only for automatic optimization. */
export function freeIntervalsForManualAvailabilityDay(day: AvailabilityDayInput): Array<{ start: number; end: number; minutes: number }> {
  if (!day.manualEligible || day.allowedEndMinute <= day.allowedStartMinute) return [];
  return freeIntervalsForAvailabilityDay({ ...day, eligible: true });
}

function preferredPenalty(day: AvailabilityDayInput, start: number, end: number): number {
  let penalty = 0;
  if (day.preferredStartMinute !== undefined && start < day.preferredStartMinute) penalty += day.preferredStartMinute - start;
  if (day.preferredEndMinute !== undefined && end > day.preferredEndMinute) penalty += end - day.preferredEndMinute;
  return penalty;
}

function naturalBoundaryPenalty(start: number, end: number): number {
  const boundaryScore = (value: number) => value % 60 === 0 ? 0 : value % 30 === 0 ? 1 : 2;
  return boundaryScore(start) + boundaryScore(end);
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
}

function candidateLengths(intervalMinutes: number, input: AvailabilityOptimizationInput, requestedMinutes: number): number[] {
  const step = input.stepMinutes;
  const minimum = input.minimumShiftMinutes ?? step;
  const maximum = Math.min(intervalMinutes, input.maximumShiftMinutes ?? intervalMinutes);
  if (maximum < minimum) return [];

  // Keep the search bounded on fully free days. The previous 15-minute sweep could create
  // thousands of candidates per day, which is unnecessary once the calendar is the default input.
  // We preserve exact target fits, common shift lengths, useful remainders and the full interval.
  const requested = clamp(roundDown(requestedMinutes, step), minimum, maximum);
  const common = [60, 90, 120, 180, 240, 300, 360, 420, 480];
  const values = [minimum, maximum, requested, roundDown(requestedMinutes / 2, step), roundDown(requestedMinutes / 3, step), ...common];
  for (const base of [60, 90, 120, 180, 240, 300, 360, 420, 480]) values.push(requestedMinutes - base);
  if (maximum > 0) values.push(requestedMinutes % maximum);
  values.push(requestedMinutes % 60, requestedMinutes % 120, requestedMinutes % 240);
  return uniqueNumbers(values
    .map((value) => clamp(roundDown(value, step), minimum, maximum))
    .filter((value) => value >= minimum && value <= maximum && value > 0));
}

function candidateStarts(day: AvailabilityDayInput, interval: { start: number; end: number }, length: number, step: number): number[] {
  const latest = interval.end - length;
  if (latest < interval.start) return [];
  const values = [interval.start, latest];
  if (day.preferredStartMinute !== undefined) values.push(clamp(roundUp(day.preferredStartMinute, step), interval.start, latest));
  if (day.preferredEndMinute !== undefined) values.push(clamp(roundDown(day.preferredEndMinute - length, step), interval.start, latest));

  // Sample natural half-hour anchors across the whole free window instead of enumerating them all.
  // This keeps choices such as 14:00-18:00 available inside 12:00-20:00 while staying fast
  // for a week containing several completely free days.
  const firstNatural = Math.ceil(interval.start / 30) * 30;
  const lastNatural = Math.floor(latest / 30) * 30;
  if (lastNatural >= firstNatural) {
    const naturalSlots = Math.floor((lastNatural - firstNatural) / 30) + 1;
    const samples = Math.min(10, naturalSlots);
    for (let index = 0; index < samples; index += 1) {
      const slotIndex = samples === 1 ? 0 : Math.round(((naturalSlots - 1) * index) / (samples - 1));
      values.push(firstNatural + slotIndex * 30);
    }
  }
  return uniqueNumbers(values.map((value) => clamp(roundUp(value, step), interval.start, latest)));
}

function minutesText(value: number): string {
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (!m) return `${h} h`;
  if (!h) return `${m} min`;
  return `${h} h ${m} min`;
}

function explanationForCandidate(day: AvailabilityDayInput, interval: { start: number; end: number }, length: number, remainingBefore: number): string[] {
  const facts: string[] = [];
  const previous = day.blockingIntervals
    .filter((item) => item.endMinute === interval.start && item.endMinute > item.startMinute)
    .sort((a, b) => (b.originalEndMinute ?? b.endMinute) - (a.originalEndMinute ?? a.endMinute))[0];
  if (previous) {
    const originalEnd = previous.originalEndMinute ?? previous.endMinute;
    if (previous.category === 'STUDY') facts.push(`Zajęcia kończą się o ${formatAvailabilityMinute(originalEnd)}.`);
    else if (previous.kind === 'WORK') facts.push(`Potwierdzona praca blokuje czas do ${formatAvailabilityMinute(originalEnd)}.`);
    else if (previous.kind === 'ROUTINE') facts.push(`${previous.label ?? 'Stałe ograniczenie'} blokuje czas do ${formatAvailabilityMinute(originalEnd)}.`);
    else if (previous.kind === 'DAY_RULE') facts.push(`Ręczne ograniczenie blokuje czas do ${formatAvailabilityMinute(previous.endMinute)}.`);
    else facts.push(`Kalendarz blokuje czas do ${formatAvailabilityMinute(originalEnd)}.`);
    if ((previous.bufferMinutes ?? 0) > 0) facts.push(`Uwzględniono ${previous.bufferMinutes} min buforu bezpieczeństwa.`);
    facts.push(`Najwcześniejszy bezpieczny początek to ${formatAvailabilityMinute(interval.start)}.`);
  } else {
    facts.push(`Bezpieczne okno: ${formatAvailabilityMinute(interval.start)}-${formatAvailabilityMinute(interval.end)}.`);
  }
  if (remainingBefore > 0) facts.push(`Przed tym uzupełnieniem brakuje ${minutesText(remainingBefore)} dyspozycyjności.`);
  facts.push(`Ten blok dodaje ${minutesText(length)}.`);
  return facts;
}

function generateCandidates(day: AvailabilityDayInput, input: AvailabilityOptimizationInput, requestedMinutes: number): Candidate[] {
  const rejected = new Set(day.rejectedCandidateKeys);
  const candidates: Candidate[] = [];
  for (const interval of freeIntervalsForAvailabilityDay(day)) {
    for (const length of candidateLengths(interval.minutes, input, requestedMinutes)) {
      for (const start of candidateStarts(day, interval, length, input.stepMinutes)) {
        const end = start + length;
        const key = `${day.date}|${formatAvailabilityMinute(start)}|${formatAvailabilityMinute(end)}`;
        if (rejected.has(key)) continue;
        candidates.push({
          key,
          date: day.date,
          startMinute: start,
          endMinute: end,
          minutes: length,
          preferredPenalty: preferredPenalty(day, start, end),
          naturalPenalty: naturalBoundaryPenalty(start, end),
          explanation: explanationForCandidate(day, interval, length, requestedMinutes),
        });
      }
    }
  }
  return [...new Map(candidates.map((item) => [item.key, item])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute || a.endMinute - b.endMinute);
}

function overlaps(a: Candidate, b: Candidate): boolean {
  return a.date === b.date && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function lockedCandidate(block: AvailabilityBlock): Candidate {
  const toMinute = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const start = toMinute(block.startTime);
  const end = toMinute(block.endTime);
  return {
    key: block.candidateKey,
    date: block.date,
    startMinute: start,
    endMinute: end,
    minutes: block.minutes,
    preferredPenalty: 0,
    naturalPenalty: 0,
    explanation: block.explanationFacts.map((fact) => fact.text),
  };
}

function stateKey(state: SearchState): string {
  const dayKey = [...state.dayMinutes.entries()].sort().map(([date, minutes]) => `${date}:${minutes}`).join(',');
  return `${state.coverage}|${dayKey}|${[...state.workDays].sort().join(',')}`;
}

function rankState(a: SearchState, b: SearchState, target: number): number {
  const aDeficit = Math.max(0, target - a.coverage);
  const bDeficit = Math.max(0, target - b.coverage);
  if (aDeficit !== bDeficit) return aDeficit - bDeficit;
  const aOver = Math.max(0, a.coverage - target);
  const bOver = Math.max(0, b.coverage - target);
  if (aOver !== bOver) return aOver - bOver;
  if (a.preferredPenalty !== b.preferredPenalty) return a.preferredPenalty - b.preferredPenalty;
  if (a.naturalPenalty !== b.naturalPenalty) return a.naturalPenalty - b.naturalPenalty;
  const aText = a.chosen.map((item) => item.key).sort().join(';');
  const bText = b.chosen.map((item) => item.key).sort().join(';');
  return aText.localeCompare(bText);
}

function stateValidForDay(state: SearchState, day: AvailabilityDayInput, input: AvailabilityOptimizationInput): boolean {
  const proposed = state.dayMinutes.get(day.date) ?? 0;
  if (input.maximumWorkMinutesPerDay !== undefined && day.confirmedWorkMinutes + proposed > input.maximumWorkMinutesPerDay) return false;
  const free = freeIntervalsForAvailabilityDay(day).reduce((sum, interval) => sum + interval.minutes, 0);
  if (free - proposed < day.flexibleRequiredMinutes) return false;
  return true;
}

function toBlock(candidate: Candidate, index: number): AvailabilityBlock {
  return {
    id: `availability-${candidate.date}-${String(index + 1).padStart(2, '0')}-${candidate.startMinute}-${candidate.endMinute}`,
    date: candidate.date,
    startTime: formatAvailabilityMinute(candidate.startMinute),
    endTime: formatAvailabilityMinute(candidate.endMinute),
    minutes: candidate.minutes,
    status: 'PROPOSED',
    locked: false,
    userEdited: false,
    origin: 'OPTIMIZER',
    validationState: 'VALID',
    candidateKey: candidate.key,
    explanationFacts: candidate.explanation.map((text, factIndex) => ({ code: `FACT_${factIndex + 1}`, text })),
  };
}

export function optimizeAvailability(input: AvailabilityOptimizationInput): AvailabilityOptimizationResult {
  const locked = input.days.flatMap((day) => day.lockedBlocks.filter((block) => block.locked && block.status !== 'REJECTED' && block.validationState !== 'CONFLICT').map(lockedCandidate));
  const lockedCoverage = locked.reduce((sum, item) => sum + item.minutes, 0);
  const remainingNeeded = Math.max(0, input.requiredAvailabilityMinutes - lockedCoverage);
  const baseDayMinutes = new Map<string, number>();
  const baseDays = new Set<string>();
  for (const item of locked) {
    baseDayMinutes.set(item.date, (baseDayMinutes.get(item.date) ?? 0) + item.minutes);
    baseDays.add(item.date);
  }
  const initial: SearchState = { chosen: [...locked], coverage: lockedCoverage, dayMinutes: baseDayMinutes, workDays: baseDays, preferredPenalty: 0, naturalPenalty: 0 };
  const candidates = remainingNeeded > 0
    ? input.days.flatMap((day) => generateCandidates(day, input, remainingNeeded)).filter((candidate) => !locked.some((item) => item.key === candidate.key))
    : [];
  const groups = [...new Set(candidates.map((item) => `${item.date}|${freeIntervalsForAvailabilityDay(input.days.find((day) => day.date === item.date)!).findIndex((interval) => item.startMinute >= interval.start && item.endMinute <= interval.end)}`))]
    .map((groupKey) => candidates.filter((item) => {
      const day = input.days.find((entry) => entry.date === item.date)!;
      const intervalIndex = freeIntervalsForAvailabilityDay(day).findIndex((interval) => item.startMinute >= interval.start && item.endMinute <= interval.end);
      return `${item.date}|${intervalIndex}` === groupKey;
    }));

  let states: SearchState[] = [initial];
  let evaluated = 1;
  const beamWidth = 900;
  for (const group of groups) {
    const next: SearchState[] = [];
    for (const state of states) {
      next.push(state);
      for (const candidate of group) {
        if (state.chosen.some((chosen) => overlaps(chosen, candidate))) continue;
        const day = input.days.find((item) => item.date === candidate.date)!;
        const dayMinutes = new Map(state.dayMinutes);
        dayMinutes.set(candidate.date, (dayMinutes.get(candidate.date) ?? 0) + candidate.minutes);
        const workDays = new Set(state.workDays);
        workDays.add(candidate.date);
        const candidateState: SearchState = {
          chosen: [...state.chosen, candidate],
          coverage: state.coverage + candidate.minutes,
          dayMinutes,
          workDays,
          preferredPenalty: state.preferredPenalty + candidate.preferredPenalty,
          naturalPenalty: state.naturalPenalty + candidate.naturalPenalty,
        };
        if (input.maximumWorkDaysPerWeek !== undefined) {
          const confirmedDays = new Set(input.days.filter((item) => item.confirmedWorkMinutes > 0).map((item) => item.date));
          const combined = new Set([...confirmedDays, ...candidateState.workDays]);
          if (combined.size > input.maximumWorkDaysPerWeek) continue;
        }
        if (!stateValidForDay(candidateState, day, input)) continue;
        next.push(candidateState);
        evaluated += 1;
      }
    }
    const unique = new Map<string, SearchState>();
    for (const state of next.sort((a, b) => rankState(a, b, input.requiredAvailabilityMinutes))) {
      const key = stateKey(state);
      if (!unique.has(key)) unique.set(key, state);
      if (unique.size >= beamWidth) break;
    }
    states = [...unique.values()];
  }

  states.sort((a, b) => rankState(a, b, input.requiredAvailabilityMinutes));
  const best = states[0] ?? initial;
  const maxCoverage = states.reduce((max, state) => Math.max(max, state.coverage), lockedCoverage);
  const existingLockedKeys = new Set(locked.map((item) => item.key));
  const selectedNew = best.chosen.filter((item) => !existingLockedKeys.has(item.key));
  const blocks = selectedNew.map(toBlock);
  const deficit = Math.max(0, input.requiredAvailabilityMinutes - best.coverage);
  const reasons = deficit > 0 ? input.days.filter((day) => !day.eligible && day.exclusionReason).map((day) => `${day.date}: ${day.exclusionReason}`) : [];
  return {
    blocks,
    coverageMinutes: best.coverage,
    maximumSafeCoverageMinutes: maxCoverage,
    deficitMinutes: deficit,
    candidateCount: candidates.length,
    evaluatedStateCount: evaluated,
    reasons: [...new Set(reasons)],
  };
}
