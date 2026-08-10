import { addDaysToDateKey, eventOccursOnDate, toLocalDateKey } from '../calendar/date.utils';
import type { CalendarEvent } from '../events/event.types';
import type { CalendarConsistencyIssue, DailyRoutineRule, DayPlanningProfile } from '../planning/planning.types';
import {
  getAvailabilityPlan,
  getConfirmedWorkMinutes,
  getDayPlanningProfile,
  listActiveDayConstraints,
  listAvailabilityPlans,
  listCalendarConsistencyIssues,
  listConfirmedWorkBlocks,
  listDailyRoutineRules,
  listDayAttributes,
  listEvents,
  saveAvailabilityPlan,
} from '../storage/database';
import { effectiveBounds, minuteToTime, normalizeBlockedIntervals, timeToMinute, validateDayRule } from './availability-day-rules';
import { resolveAvailabilityEligibility } from './availability-eligibility';
import { freeIntervalsForAvailabilityDay, freeIntervalsForManualAvailabilityDay, optimizeAvailability } from './optimizer';
import type {
  AvailabilityBlock,
  AvailabilityDayInput,
  AvailabilityDayOverview,
  AvailabilityDayRule,
  AvailabilityOptimizationInput,
  AvailabilityPlan,
  AvailabilitySentSnapshot,
  AvailabilityTimeInterval,
} from './availability.types';

function nowIso(): string { return new Date().toISOString(); }
function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class AvailabilityOverlapError extends Error {
  overlapIds: string[];
  mergedStartTime: string;
  mergedEndTime: string;
  constructor(overlapIds: string[], mergedStartTime: string, mergedEndTime: string) {
    super(`Ta dyspozycyjność nachodzi na istniejący blok. Można scalić zakres do ${mergedStartTime}-${mergedEndTime}.`);
    this.name = 'AvailabilityOverlapError';
    this.overlapIds = overlapIds;
    this.mergedStartTime = mergedStartTime;
    this.mergedEndTime = mergedEndTime;
  }
}

export class AvailabilityDayRuleConflictError extends Error {
  constructor() {
    super('Ten dzień ma już zapisaną dyspozycyjność. Aby wykluczyć cały dzień, usuń ją razem z wykluczeniem.');
    this.name = 'AvailabilityDayRuleConflictError';
  }
}

export function startOfWeekKey(date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - mondayOffset);
  return toLocalDateKey(local);
}

export function startOfWeekForDateKey(date: string): string { return startOfWeekKey(new Date(`${date}T12:00:00`)); }
export function weekEndKey(weekStart: string): string { return addDaysToDateKey(weekStart, 6); }

function minuteWithinDate(value: string, date: string, isEnd = false): number {
  const key = value.slice(0, 10);
  if (key < date) return 0;
  if (key > date) return 1440;
  const [h, m] = value.slice(11, 16).split(':').map(Number);
  const minute = (h ?? 0) * 60 + (m ?? 0);
  if (isEnd && value.slice(11, 16) === '00:00' && key > date) return 1440;
  return minute;
}

function eventIntervalForDate(event: CalendarEvent, date: string, buffer: number): AvailabilityTimeInterval | null {
  if (!eventOccursOnDate(event, date)) return null;
  if (event.allDay) {
    if (event.availabilityImpact !== 'BLOCKING') return null;
    return { startMinute: 0, endMinute: 1440, kind: 'EVENT', label: event.title, category: event.category, originalStartMinute: 0, originalEndMinute: 1440, bufferMinutes: 0 };
  }
  if (event.availabilityImpact === 'NON_BLOCKING') return null;
  const start = minuteWithinDate(event.startDateTime, date);
  const end = minuteWithinDate(event.endDateTime, date, true);
  const applyBuffer = event.category !== 'WORK' ? buffer : 0;
  return {
    startMinute: Math.max(0, start - applyBuffer),
    endMinute: Math.min(1440, end + applyBuffer),
    kind: event.category === 'WORK' ? 'WORK' : 'EVENT',
    label: event.title,
    category: event.category,
    originalStartMinute: start,
    originalEndMinute: end,
    bufferMinutes: applyBuffer,
  };
}

function routineIntervals(rule: DailyRoutineRule, date: string): AvailabilityTimeInterval[] {
  if (!rule.active || rule.type !== 'FIXED' || rule.priority !== 'REQUIRED' || !rule.fixedStart || !rule.fixedEnd) return [];
  const current = new Date(`${date}T12:00:00`);
  const applies = (day: Date) => !rule.daysOfWeek.length || rule.daysOfWeek.includes(day.getDay());
  const start = timeToMinute(rule.fixedStart, 0);
  const end = timeToMinute(rule.fixedEnd, 0);
  if (end > start) return applies(current) ? [{ startMinute: start, endMinute: end, kind: 'ROUTINE', label: rule.name, originalStartMinute: start, originalEndMinute: end }] : [];
  const previous = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
  const intervals: AvailabilityTimeInterval[] = [];
  if (applies(previous) && end > 0) intervals.push({ startMinute: 0, endMinute: end, kind: 'ROUTINE', label: rule.name, originalStartMinute: 0, originalEndMinute: end });
  if (applies(current) && start < 1440) intervals.push({ startMinute: start, endMinute: 1440, kind: 'ROUTINE', label: rule.name, originalStartMinute: start, originalEndMinute: 1440 });
  return intervals;
}

function issueInterval(issue: CalendarConsistencyIssue, date: string): AvailabilityTimeInterval | null {
  if (issue.planningImpact !== 'BLOCKING') return null;
  if (issue.endDateTime.slice(0, 10) < date || issue.startDateTime.slice(0, 10) > date) return null;
  return {
    startMinute: minuteWithinDate(issue.startDateTime, date),
    endMinute: minuteWithinDate(issue.endDateTime, date, true),
    kind: 'CONSISTENCY',
    label: issue.title,
  };
}

function profileInput(profile: DayPlanningProfile): Omit<DayPlanningProfile, 'id' | 'createdAt' | 'updatedAt'> {
  const result: Omit<DayPlanningProfile, 'id' | 'createdAt' | 'updatedAt'> = {};
  if (profile.targetWeeklyWorkMinutes !== undefined) result.targetWeeklyWorkMinutes = profile.targetWeeklyWorkMinutes;
  if (profile.allowedWorkStart !== undefined) result.allowedWorkStart = profile.allowedWorkStart;
  if (profile.allowedWorkEnd !== undefined) result.allowedWorkEnd = profile.allowedWorkEnd;
  if (profile.preferredWorkStart !== undefined) result.preferredWorkStart = profile.preferredWorkStart;
  if (profile.preferredWorkEnd !== undefined) result.preferredWorkEnd = profile.preferredWorkEnd;
  if (profile.minimumShiftMinutes !== undefined) result.minimumShiftMinutes = profile.minimumShiftMinutes;
  if (profile.maximumShiftMinutes !== undefined) result.maximumShiftMinutes = profile.maximumShiftMinutes;
  if (profile.maximumWorkDaysPerWeek !== undefined) result.maximumWorkDaysPerWeek = profile.maximumWorkDaysPerWeek;
  if (profile.maximumWorkMinutesPerDay !== undefined) result.maximumWorkMinutesPerDay = profile.maximumWorkMinutesPerDay;
  if (profile.minimumFullFreeDaysPerWeek !== undefined) result.minimumFullFreeDaysPerWeek = profile.minimumFullFreeDaysPerWeek;
  if (profile.allowSaturday !== undefined) result.allowSaturday = profile.allowSaturday;
  if (profile.allowTradingSunday !== undefined) result.allowTradingSunday = profile.allowTradingSunday;
  if (profile.defaultBufferMinutes !== undefined) result.defaultBufferMinutes = profile.defaultBufferMinutes;
  return result;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableEvent(event: CalendarEvent) {
  return [event.id, event.startDateTime, event.endDateTime, event.category, event.source, event.availabilityImpact ?? 'BLOCKING'];
}

function blockMinutes(block: AvailabilityBlock): { start: number; end: number } {
  return { start: timeToMinute(block.startTime, 0), end: timeToMinute(block.endTime, 0) };
}
function intervalsOverlap(start: number, end: number, otherStart: number, otherEnd: number): boolean { return start < otherEnd && otherStart < end; }
function isAccepted(block: AvailabilityBlock): boolean { return block.status === 'ACCEPTED' || block.status === 'EDITED'; }
function isManualDecision(block: AvailabilityBlock): boolean { return block.origin === 'MANUAL' || block.userEdited; }
function isSafeAccepted(block: AvailabilityBlock): boolean { return isAccepted(block) && block.validationState !== 'CONFLICT'; }
function dayRuleFor(plan: AvailabilityPlan | undefined, date: string): AvailabilityDayRule | undefined { return plan?.dayRules?.find((rule) => rule.date === date); }

export function acceptedAvailabilityCoverageMinutes(blocks: AvailabilityBlock[]): number {
  const byDate = new Map<string, Array<{ start: number; end: number }>>();
  for (const block of blocks.filter(isSafeAccepted)) {
    const range = blockMinutes(block);
    byDate.set(block.date, [...(byDate.get(block.date) ?? []), range]);
  }
  let total = 0;
  for (const ranges of byDate.values()) {
    const sorted = ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: Array<{ start: number; end: number }> = [];
    for (const range of sorted) {
      const last = merged.at(-1);
      if (!last || range.start > last.end) merged.push({ ...range });
      else last.end = Math.max(last.end, range.end);
    }
    total += merged.reduce((sum, range) => sum + range.end - range.start, 0);
  }
  return total;
}

function validateBasicBlock(block: AvailabilityBlock, day: AvailabilityDayInput, input: AvailabilityOptimizationInput): string | undefined {
  const { start, end } = blockMinutes(block);
  const manual = isManualDecision(block);
  if (end <= start) return 'Godzina końca musi być późniejsza od początku.';
  if (manual ? !day.manualEligible : !day.eligible) return day.exclusionReason ?? 'Ten dzień nie może być użyty do dyspozycyjności.';
  if (start < day.allowedStartMinute || end > day.allowedEndMinute) return `Dyspozycyjność musi mieścić się w godzinach ${minuteToTime(day.allowedStartMinute)}-${minuteToTime(day.allowedEndMinute)}.`;
  const collision = day.blockingIntervals.find((item) => intervalsOverlap(start, end, item.startMinute, item.endMinute));
  if (collision) {
    if (collision.category === 'STUDY') return `Zajęcia blokują czas ${minuteToTime(Math.max(start, collision.startMinute))}-${minuteToTime(Math.min(end, collision.endMinute))}.`;
    if (collision.kind === 'WORK') return 'Ten czas nachodzi na potwierdzoną pracę.';
    if (collision.kind === 'DAY_RULE') return 'Ten czas został ręcznie oznaczony jako niedostępny.';
    if (collision.kind === 'ROUTINE') return `Ten czas nachodzi na wymagane ograniczenie „${collision.label ?? 'stała pora'}”.`;
    if (collision.kind === 'CONSISTENCY') return 'Ten czas jest objęty twardą niespójnością kalendarza.';
    return 'Ten czas nachodzi na blokujące wydarzenie.';
  }
  if (input.minimumShiftMinutes !== undefined && block.minutes < input.minimumShiftMinutes) return `Blok jest krótszy niż ustawione minimum ${input.minimumShiftMinutes} min.`;
  if (input.maximumShiftMinutes !== undefined && block.minutes > input.maximumShiftMinutes) return `Blok jest dłuższy niż ustawione maksimum ${input.maximumShiftMinutes} min.`;
  return undefined;
}

function revalidateAcceptedBlocks(blocks: AvailabilityBlock[], input: AvailabilityOptimizationInput): AvailabilityBlock[] {
  const result = blocks.map((block) => ({ ...block, origin: block.origin ?? 'OPTIMIZER', validationState: block.validationState ?? 'VALID' as const }));
  const active = result.filter(isAccepted);
  const messages = new Map<string, string>();

  for (const block of active) {
    const day = input.days.find((item) => item.date === block.date);
    const message = day ? validateBasicBlock(block, day, input) : 'Dyspozycyjność jest poza tym tygodniem.';
    if (message) messages.set(block.id, message);
  }

  for (const day of input.days) {
    const dayBlocks = active.filter((block) => block.date === day.date && !messages.has(block.id)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < dayBlocks.length; index += 1) {
      const previous = dayBlocks[index - 1]!;
      const current = dayBlocks[index]!;
      const a = blockMinutes(previous); const b = blockMinutes(current);
      if (intervalsOverlap(a.start, a.end, b.start, b.end)) {
        messages.set(previous.id, 'Ten blok nachodzi na inną zapisaną dyspozycyjność.');
        messages.set(current.id, 'Ten blok nachodzi na inną zapisaną dyspozycyjność.');
      }
    }
    const safe = dayBlocks.filter((block) => !messages.has(block.id));
    const total = safe.reduce((sum, block) => sum + block.minutes, 0);
    if (input.maximumWorkMinutesPerDay !== undefined && day.confirmedWorkMinutes + total > input.maximumWorkMinutesPerDay) {
      for (const block of safe) messages.set(block.id, 'Łączna praca i dyspozycyjność przekracza aktualny limit godzin tego dnia.');
    }
    const freeMinutes = freeIntervalsForManualAvailabilityDay(day).reduce((sum, interval) => sum + interval.minutes, 0);
    if (freeMinutes - total < day.flexibleRequiredMinutes) {
      for (const block of safe) messages.set(block.id, 'Po tej dyspozycyjności nie zostaje wymagany czas na elastyczne obowiązki.');
    }
  }

  if (input.maximumWorkDaysPerWeek !== undefined) {
    const confirmedDates = new Set(input.days.filter((day) => day.confirmedWorkMinutes > 0).map((day) => day.date));
    const availabilityDates = [...new Set(active.filter((block) => !messages.has(block.id)).map((block) => block.date))].filter((date) => !confirmedDates.has(date)).sort();
    const slots = Math.max(0, input.maximumWorkDaysPerWeek - confirmedDates.size);
    const excess = availabilityDates.slice(slots);
    for (const date of excess) for (const block of active.filter((item) => item.date === date)) messages.set(block.id, 'Ten blok przekracza aktualny tygodniowy limit dni pracy i dyspozycyjności.');
  }

  return result.map((block) => {
    const message = messages.get(block.id);
    if (!isAccepted(block)) return { ...block, validationState: block.validationState ?? 'VALID' };
    if (message) return { ...block, validationState: 'CONFLICT' as const, validationMessage: message };
    const { validationMessage: _validationMessage, ...withoutMessage } = block;
    return { ...withoutMessage, validationState: 'VALID' as const };
  });
}

export async function buildAvailabilityInput(weekStart: string, currentPlan?: AvailabilityPlan): Promise<{ input: AvailabilityOptimizationInput; fingerprint: string; profile: DayPlanningProfile; validatedBlocks: AvailabilityBlock[] }> {
  const weekEnd = weekEndKey(weekStart);
  const [profile, events, constraints, attributes, routines, issues, confirmedBlocks, confirmedSummary] = await Promise.all([
    getDayPlanningProfile(), listEvents(), listActiveDayConstraints(weekStart, weekEnd), listDayAttributes(), listDailyRoutineRules(), listCalendarConsistencyIssues(), listConfirmedWorkBlocks(weekStart, weekEnd), getConfirmedWorkMinutes(weekStart, weekEnd),
  ]);
  if (!profile?.targetWeeklyWorkMinutes) throw new Error('Najpierw ustaw tygodniowy cel godzin pracy.');
  if (!profile.allowedWorkStart || !profile.allowedWorkEnd) throw new Error('Ustaw jednorazowo standardowe ramy pracy w ustawieniach Dyspozycyjności.');
  const globalStart = timeToMinute(profile.allowedWorkStart, 0);
  const globalEnd = timeToMinute(profile.allowedWorkEnd, 1440);
  if (globalEnd <= globalStart) throw new Error('Zakres możliwych godzin pracy musi kończyć się później niż się zaczyna.');
  const buffer = Math.max(0, profile.defaultBufferMinutes ?? 0);
  const trading = new Set(attributes.filter((item) => item.active && item.type === 'TRADING_SUNDAY').map((item) => item.date));
  const legacyExcluded = new Set(constraints.filter((item) => item.active && item.type === 'EXCLUDE_FROM_WORK_AVAILABILITY').map((item) => item.date));
  const rejected = currentPlan?.blocks.filter((block) => block.status === 'REJECTED').map((block) => block.candidateKey) ?? [];
  const days: AvailabilityDayInput[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysToDateKey(weekStart, offset);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const rule = dayRuleFor(currentPlan, date);
    const bounds = effectiveBounds(globalStart, globalEnd, rule);
    const isTradingSunday = trading.has(date);
    const excluded = legacyExcluded.has(date) || Boolean(rule?.excluded);
    const eligibility = resolveAvailabilityEligibility({
      weekday,
      excluded,
      allowSaturday: profile.allowSaturday ?? false,
      allowTradingSunday: profile.allowTradingSunday ?? false,
      tradingSunday: isTradingSunday,
    });
    const { eligible, manualEligible, exclusionReason } = eligibility;

    const dayEvents = events.filter((event) => eventOccursOnDate(event, date));
    const blockingIntervals = dayEvents.map((event) => eventIntervalForDate(event, date, buffer)).filter((item): item is AvailabilityTimeInterval => Boolean(item));
    for (const routine of routines) blockingIntervals.push(...routineIntervals(routine, date));
    for (const issue of issues) { const interval = issueInterval(issue, date); if (interval) blockingIntervals.push(interval); }
    for (const blocked of normalizeBlockedIntervals(rule?.blockedIntervals ?? [])) blockingIntervals.push({ startMinute: timeToMinute(blocked.startTime), endMinute: timeToMinute(blocked.endTime), kind: 'DAY_RULE', label: 'Ręcznie niedostępne godziny' });

    const flexibleRequiredMinutes = routines.filter((ruleItem) => ruleItem.active && ruleItem.type === 'FLEXIBLE' && ruleItem.priority === 'REQUIRED' && (!ruleItem.daysOfWeek.length || ruleItem.daysOfWeek.includes(weekday))).reduce((sum, ruleItem) => sum + ruleItem.durationMinutes, 0);
    const confirmedWorkMinutes = confirmedBlocks.filter((item) => item.date === date).reduce((sum, item) => sum + item.minutes, 0);
    const day: AvailabilityDayInput = {
      date, weekday, eligible, manualEligible, tradingSunday: isTradingSunday,
      allowedStartMinute: bounds.start, allowedEndMinute: bounds.end,
      confirmedWorkMinutes, blockingIntervals, flexibleRequiredMinutes,
      lockedBlocks: [], rejectedCandidateKeys: rejected.filter((key) => key.startsWith(`${date}|`)),
    };
    if (exclusionReason) day.exclusionReason = exclusionReason;
    if (profile.preferredWorkStart) day.preferredStartMinute = timeToMinute(profile.preferredWorkStart, bounds.start);
    if (profile.preferredWorkEnd) day.preferredEndMinute = timeToMinute(profile.preferredWorkEnd, bounds.end);
    days.push(day);
  }

  const target = profile.targetWeeklyWorkMinutes;
  const required = Math.max(0, target - confirmedSummary.totalConfirmedWorkMinutes);
  const input: AvailabilityOptimizationInput = { weekStart, weekEnd, targetWeeklyWorkMinutes: target, confirmedWorkMinutes: confirmedSummary.totalConfirmedWorkMinutes, requiredAvailabilityMinutes: required, stepMinutes: 15, days };
  if (profile.minimumShiftMinutes !== undefined) input.minimumShiftMinutes = profile.minimumShiftMinutes;
  if (profile.maximumShiftMinutes !== undefined) input.maximumShiftMinutes = profile.maximumShiftMinutes;
  if (profile.maximumWorkDaysPerWeek !== undefined) input.maximumWorkDaysPerWeek = profile.maximumWorkDaysPerWeek;
  if (profile.maximumWorkMinutesPerDay !== undefined) input.maximumWorkMinutesPerDay = profile.maximumWorkMinutesPerDay;

  const validatedBlocks = revalidateAcceptedBlocks(currentPlan?.blocks ?? [], input);
  for (const day of days) day.lockedBlocks = validatedBlocks.filter((block) => block.date === day.date && block.locked && isSafeAccepted(block));

  const canonical = JSON.stringify({
    weekStart, weekEnd, profile: profileInput(profile),
    events: events.filter((event) => event.endDateTime.slice(0, 10) >= weekStart && event.startDateTime.slice(0, 10) <= weekEnd).map(stableEvent).sort(),
    constraints: [...legacyExcluded].sort(),
    trading: [...trading].filter((date) => date >= weekStart && date <= weekEnd).sort(),
    routines: routines.filter((ruleItem) => ruleItem.active).map((ruleItem) => [ruleItem.id, ruleItem.type, ruleItem.priority, ruleItem.daysOfWeek, ruleItem.durationMinutes, ruleItem.fixedStart, ruleItem.fixedEnd]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    dayRules: (currentPlan?.dayRules ?? []).map((rule) => [rule.date, rule.excluded, rule.earliestTime, rule.latestTime, normalizeBlockedIntervals(rule.blockedIntervals).map((item) => [item.startTime, item.endTime])]).sort(),
    locked: validatedBlocks.filter(isAccepted).map((block) => [block.date, block.startTime, block.endTime, block.status, block.origin ?? 'OPTIMIZER', block.userEdited]).sort(),
  });
  return { input, fingerprint: await sha256(canonical), profile, validatedBlocks };
}

function planShell(weekStart: string, input: AvailabilityOptimizationInput, fingerprint: string): AvailabilityPlan {
  const timestamp = nowIso();
  return {
    id: `availability-plan-${weekStart}`, weekStart, weekEnd: weekEndKey(weekStart), createdAt: timestamp, updatedAt: timestamp,
    inputFingerprint: fingerprint, status: 'DRAFT', targetWeeklyWorkMinutes: input.targetWeeklyWorkMinutes,
    confirmedWorkMinutes: input.confirmedWorkMinutes, requiredAvailabilityMinutes: input.requiredAvailabilityMinutes,
    acceptedAvailabilityMinutes: 0, remainingMinutes: input.requiredAvailabilityMinutes, maximumSafeCoverageMinutes: 0, deficitMinutes: input.requiredAvailabilityMinutes,
    blocks: [], sentSnapshots: [], dayRules: [],
  };
}

async function currentOrShell(weekStart: string): Promise<AvailabilityPlan> {
  const current = await getAvailabilityPlan(weekStart);
  if (current) return { ...current, dayRules: current.dayRules ?? [], blocks: current.blocks.map((block) => ({ ...block, origin: block.origin ?? 'OPTIMIZER' })) };
  const built = await buildAvailabilityInput(weekStart);
  return planShell(weekStart, built.input, built.fingerprint);
}

function withDerivedMetrics(plan: AvailabilityPlan, input: AvailabilityOptimizationInput, validatedBlocks: AvailabilityBlock[], fingerprint: string, status?: AvailabilityPlan['status']): AvailabilityPlan {
  const accepted = acceptedAvailabilityCoverageMinutes(validatedBlocks);
  return {
    ...plan,
    blocks: validatedBlocks,
    inputFingerprint: fingerprint,
    targetWeeklyWorkMinutes: input.targetWeeklyWorkMinutes,
    confirmedWorkMinutes: input.confirmedWorkMinutes,
    requiredAvailabilityMinutes: input.requiredAvailabilityMinutes,
    acceptedAvailabilityMinutes: accepted,
    remainingMinutes: Math.max(0, input.requiredAvailabilityMinutes - accepted),
    status: status ?? plan.status,
    updatedAt: nowIso(),
  };
}

export async function generateAvailabilityPlan(weekStart: string): Promise<AvailabilityPlan> {
  const current = await getAvailabilityPlan(weekStart);
  const built = await buildAvailabilityInput(weekStart, current);
  const result = optimizeAvailability(built.input);
  const preserved = built.validatedBlocks.filter((block) => isAccepted(block) || block.status === 'REJECTED');
  const blocks = [...preserved, ...result.blocks];
  const acceptedMinutes = acceptedAvailabilityCoverageMinutes(blocks);
  const timestamp = nowIso();
  const plan: AvailabilityPlan = {
    id: current?.id ?? `availability-plan-${weekStart}`, weekStart, weekEnd: weekEndKey(weekStart), createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp,
    inputFingerprint: built.fingerprint, status: acceptedMinutes ? 'ACCEPTED' : 'DRAFT',
    targetWeeklyWorkMinutes: built.input.targetWeeklyWorkMinutes, confirmedWorkMinutes: built.input.confirmedWorkMinutes, requiredAvailabilityMinutes: built.input.requiredAvailabilityMinutes,
    acceptedAvailabilityMinutes: acceptedMinutes, remainingMinutes: Math.max(0, built.input.requiredAvailabilityMinutes - acceptedMinutes),
    maximumSafeCoverageMinutes: result.maximumSafeCoverageMinutes, deficitMinutes: result.deficitMinutes,
    blocks, sentSnapshots: current?.sentSnapshots ?? [], dayRules: current?.dayRules ?? [],
    diagnostics: { candidateCount: result.candidateCount, evaluatedStateCount: result.evaluatedStateCount, reasons: result.reasons },
  };
  return saveAvailabilityPlan(plan, 'GENERATE_AVAILABILITY_PLAN', current ? 'Uzupełniono brakujące godziny dyspozycyjności' : 'Utworzono dyspozycyjność');
}

export async function refreshAvailabilityPlanStatus(weekStart: string): Promise<AvailabilityPlan | undefined> {
  const current = await getAvailabilityPlan(weekStart);
  if (!current) return undefined;
  try {
    const built = await buildAvailabilityInput(weekStart, current);
    const blockStateChanged = JSON.stringify(current.blocks.map((b) => [b.id, b.validationState, b.validationMessage, b.origin])) !== JSON.stringify(built.validatedBlocks.map((b) => [b.id, b.validationState, b.validationMessage, b.origin]));
    if (built.fingerprint === current.inputFingerprint && current.confirmedWorkMinutes === built.input.confirmedWorkMinutes && current.targetWeeklyWorkMinutes === built.input.targetWeeklyWorkMinutes && !blockStateChanged) return current;
    if (current.status === 'STALE' && !blockStateChanged && current.confirmedWorkMinutes === built.input.confirmedWorkMinutes && current.targetWeeklyWorkMinutes === built.input.targetWeeklyWorkMinutes) return current;
    const next = withDerivedMetrics({ ...current, status: 'STALE' }, built.input, built.validatedBlocks, built.fingerprint, 'STALE');
    return saveAvailabilityPlan(next, 'GENERATE_AVAILABILITY_PLAN', 'Kalendarz lub ograniczenia zmieniły się - dyspozycyjność wymaga sprawdzenia');
  } catch {
    if (current.status === 'STALE') return current;
    return saveAvailabilityPlan({ ...current, status: 'STALE', updatedAt: nowIso() }, 'GENERATE_AVAILABILITY_PLAN', 'Dyspozycyjność wymaga ponownego sprawdzenia');
  }
}

function validOtherBlocks(plan: AvailabilityPlan, excludeId?: string): AvailabilityBlock[] {
  return plan.blocks.filter((block) => block.id !== excludeId && isSafeAccepted(block));
}

function validateBlockForSave(block: AvailabilityBlock, input: AvailabilityOptimizationInput, plan: AvailabilityPlan, excludeId?: string): void {
  const day = input.days.find((item) => item.date === block.date);
  if (!day) throw new Error('Data musi należeć do wybranego tygodnia.');
  const basic = validateBasicBlock(block, day, input);
  if (basic) throw new Error(basic);
  const { start, end } = blockMinutes(block);
  const others = validOtherBlocks(plan, excludeId);
  const overlap = others.find((other) => other.date === block.date && intervalsOverlap(start, end, blockMinutes(other).start, blockMinutes(other).end));
  if (overlap) {
    const otherRange = blockMinutes(overlap);
    throw new AvailabilityOverlapError([overlap.id], minuteToTime(Math.min(start, otherRange.start)), minuteToTime(Math.max(end, otherRange.end)));
  }
  const sameDayMinutes = others.filter((other) => other.date === block.date).reduce((sum, other) => sum + other.minutes, 0);
  if (input.maximumWorkMinutesPerDay !== undefined && day.confirmedWorkMinutes + sameDayMinutes + block.minutes > input.maximumWorkMinutesPerDay) throw new Error('Ta dyspozycyjność przekroczyłaby dzienny limit pracy i dyspozycyjności.');
  const freeMinutes = freeIntervalsForManualAvailabilityDay(day).reduce((sum, interval) => sum + interval.minutes, 0);
  if (freeMinutes - sameDayMinutes - block.minutes < day.flexibleRequiredMinutes) throw new Error(`Po tej zmianie nie zostanie wymagane ${day.flexibleRequiredMinutes >= 60 && day.flexibleRequiredMinutes % 60 === 0 ? `${day.flexibleRequiredMinutes / 60} h` : `${day.flexibleRequiredMinutes} min`} na elastyczne obowiązki.`);
  if (input.maximumWorkDaysPerWeek !== undefined) {
    const dates = new Set(input.days.filter((item) => item.confirmedWorkMinutes > 0).map((item) => item.date));
    for (const other of others) dates.add(other.date);
    dates.add(block.date);
    if (dates.size > input.maximumWorkDaysPerWeek) throw new Error('Ta dyspozycyjność przekroczyłaby tygodniowy limit dni pracy i dyspozycyjności.');
  }
}

export async function addManualAvailabilityBlock(weekStart: string, data: { date: string; startTime: string; endTime: string }, mergeOverlaps = false): Promise<AvailabilityPlan> {
  let current = await currentOrShell(weekStart);
  const start = timeToMinute(data.startTime, -1); const end = timeToMinute(data.endTime, -1);
  if (start < 0 || end <= start) throw new Error('Godzina końca musi być późniejsza od początku.');
  const draft: AvailabilityBlock = {
    id: makeId('availability-manual'), date: data.date, startTime: data.startTime, endTime: data.endTime, minutes: end - start,
    status: 'ACCEPTED', locked: true, userEdited: true, origin: 'MANUAL', validationState: 'VALID',
    candidateKey: `${data.date}|${data.startTime}|${data.endTime}`,
    explanationFacts: [{ code: 'MANUAL', text: 'Ta dyspozycyjność została wpisana ręcznie.' }],
  };
  let built = await buildAvailabilityInput(weekStart, current);
  const overlaps = current.blocks.filter((block) => block.status !== 'REJECTED' && block.date === data.date && intervalsOverlap(start, end, blockMinutes(block).start, blockMinutes(block).end));
  if (overlaps.length && !mergeOverlaps) {
    const ranges = overlaps.map(blockMinutes);
    throw new AvailabilityOverlapError(overlaps.map((item) => item.id), minuteToTime(Math.min(start, ...ranges.map((r) => r.start))), minuteToTime(Math.max(end, ...ranges.map((r) => r.end))));
  }
  if (overlaps.length && mergeOverlaps) {
    const mergedStart = Math.min(start, ...overlaps.map((item) => blockMinutes(item).start));
    const mergedEnd = Math.max(end, ...overlaps.map((item) => blockMinutes(item).end));
    draft.startTime = minuteToTime(mergedStart); draft.endTime = minuteToTime(mergedEnd); draft.minutes = mergedEnd - mergedStart; draft.candidateKey = `${data.date}|${draft.startTime}|${draft.endTime}`;
    current = { ...current, blocks: current.blocks.map((block) => overlaps.some((item) => item.id === block.id) ? { ...block, status: 'REJECTED' as const, locked: false } : block) };
    built = await buildAvailabilityInput(weekStart, current);
  }
  validateBlockForSave(draft, built.input, current);
  let next: AvailabilityPlan = { ...current, blocks: [...current.blocks, draft], status: 'ACCEPTED', updatedAt: nowIso() };
  built = await buildAvailabilityInput(weekStart, next);
  next = withDerivedMetrics(next, built.input, built.validatedBlocks, built.fingerprint, 'ACCEPTED');
  return saveAvailabilityPlan(next, overlaps.length && mergeOverlaps ? 'MERGE_AVAILABILITY_BLOCKS' : 'ADD_MANUAL_AVAILABILITY_BLOCK', overlaps.length && mergeOverlaps ? 'Scalono ręczną dyspozycyjność' : 'Dodano ręczną dyspozycyjność');
}

export async function updateAvailabilityBlock(weekStart: string, blockId: string, action: 'ACCEPT' | 'REJECT' | 'EDIT', edit?: { date: string; startTime: string; endTime: string; mergeOverlaps?: boolean }): Promise<AvailabilityPlan> {
  let current = await currentOrShell(weekStart);
  const block = current.blocks.find((item) => item.id === blockId);
  if (!block) throw new Error('Nie znaleziono bloku dyspozycyjności.');
  let operation: 'ACCEPT_AVAILABILITY_BLOCK' | 'EDIT_AVAILABILITY_BLOCK' | 'REJECT_AVAILABILITY_BLOCK' | 'MERGE_AVAILABILITY_BLOCKS';
  if (action === 'REJECT') {
    const blocks = current.blocks.map((item) => item.id === blockId ? { ...item, status: 'REJECTED' as const, locked: false } : item);
    const built = await buildAvailabilityInput(weekStart, { ...current, blocks });
    const next = withDerivedMetrics({ ...current, blocks }, built.input, built.validatedBlocks, built.fingerprint, acceptedAvailabilityCoverageMinutes(blocks) ? 'ACCEPTED' : 'DRAFT');
    return saveAvailabilityPlan(next, block.origin === 'MANUAL' ? 'REMOVE_AVAILABILITY_BLOCK' : 'REJECT_AVAILABILITY_BLOCK', block.origin === 'MANUAL' ? 'Usunięto ręczną dyspozycyjność' : 'Odrzucono blok dyspozycyjności');
  }
  if (action === 'ACCEPT') {
    const candidate = { ...block, status: 'ACCEPTED' as const, locked: true, origin: block.origin ?? 'OPTIMIZER', validationState: 'VALID' as const };
    const validationPlan = { ...current, blocks: current.blocks.filter((item) => item.id !== blockId) };
    const built = await buildAvailabilityInput(weekStart, validationPlan);
    validateBlockForSave(candidate, built.input, validationPlan);
    const blocks = current.blocks.map((item) => item.id === blockId ? candidate : item);
    const refreshed = await buildAvailabilityInput(weekStart, { ...current, blocks });
    const next = withDerivedMetrics({ ...current, blocks }, refreshed.input, refreshed.validatedBlocks, refreshed.fingerprint, 'ACCEPTED');
    return saveAvailabilityPlan(next, 'ACCEPT_AVAILABILITY_BLOCK', 'Zaakceptowano blok dyspozycyjności');
  }
  if (!edit) throw new Error('Brak nowych godzin dyspozycyjności.');
  const start = timeToMinute(edit.startTime, -1); const end = timeToMinute(edit.endTime, -1);
  if (start < 0 || end <= start) throw new Error('Godzina końca musi być późniejsza od początku.');
  let nextBlock: AvailabilityBlock = { ...block, date: edit.date, startTime: edit.startTime, endTime: edit.endTime, minutes: end - start, status: 'EDITED', locked: true, userEdited: true, validationState: 'VALID', candidateKey: `${edit.date}|${edit.startTime}|${edit.endTime}`, explanationFacts: [{ code: 'USER_EDIT', text: 'Godziny zostały ustawione ręcznie i sprawdzone z kalendarzem.' }] };
  let otherBlocks = current.blocks.filter((item) => item.id !== blockId);
  const overlaps = otherBlocks.filter((item) => item.status !== 'REJECTED' && item.date === edit.date && intervalsOverlap(start, end, blockMinutes(item).start, blockMinutes(item).end));
  if (overlaps.length && !edit.mergeOverlaps) {
    const ranges = overlaps.map(blockMinutes);
    throw new AvailabilityOverlapError(overlaps.map((item) => item.id), minuteToTime(Math.min(start, ...ranges.map((r) => r.start))), minuteToTime(Math.max(end, ...ranges.map((r) => r.end))));
  }
  if (overlaps.length && edit.mergeOverlaps) {
    const mergedStart = Math.min(start, ...overlaps.map((item) => blockMinutes(item).start));
    const mergedEnd = Math.max(end, ...overlaps.map((item) => blockMinutes(item).end));
    nextBlock = { ...nextBlock, startTime: minuteToTime(mergedStart), endTime: minuteToTime(mergedEnd), minutes: mergedEnd - mergedStart, candidateKey: `${edit.date}|${minuteToTime(mergedStart)}|${minuteToTime(mergedEnd)}` };
    otherBlocks = otherBlocks.map((item) => overlaps.some((overlap) => overlap.id === item.id) ? { ...item, status: 'REJECTED' as const, locked: false } : item);
    operation = 'MERGE_AVAILABILITY_BLOCKS';
  } else operation = 'EDIT_AVAILABILITY_BLOCK';
  const validationPlan = { ...current, blocks: otherBlocks };
  const built = await buildAvailabilityInput(weekStart, validationPlan);
  validateBlockForSave(nextBlock, built.input, validationPlan);
  const blocks = [...otherBlocks, nextBlock];
  const refreshed = await buildAvailabilityInput(weekStart, { ...current, blocks });
  const next = withDerivedMetrics({ ...current, blocks }, refreshed.input, refreshed.validatedBlocks, refreshed.fingerprint, 'ACCEPTED');
  return saveAvailabilityPlan(next, operation, operation === 'MERGE_AVAILABILITY_BLOCKS' ? 'Scalono dyspozycyjność' : 'Edytowano dyspozycyjność');
}

export async function removeAvailabilityBlock(weekStart: string, blockId: string): Promise<AvailabilityPlan> { return updateAvailabilityBlock(weekStart, blockId, 'REJECT'); }

export async function setAvailabilityDayRule(weekStart: string, draft: Omit<AvailabilityDayRule, 'updatedAt'>, removeExisting = false): Promise<AvailabilityPlan> {
  let current = await currentOrShell(weekStart);
  const profile = await getDayPlanningProfile();
  const rule: AvailabilityDayRule = { ...draft, blockedIntervals: normalizeBlockedIntervals(draft.blockedIntervals), updatedAt: nowIso() };
  validateDayRule(rule, profile?.allowedWorkStart, profile?.allowedWorkEnd);
  const activeForDate = current.blocks.filter((block) => block.date === rule.date && isAccepted(block));
  if (rule.excluded && activeForDate.length && !removeExisting) throw new AvailabilityDayRuleConflictError();
  if (rule.excluded && removeExisting) current = { ...current, blocks: current.blocks.map((block) => block.date === rule.date && isAccepted(block) ? { ...block, status: 'REJECTED' as const, locked: false } : block) };
  const hasContent = rule.excluded || Boolean(rule.earliestTime) || Boolean(rule.latestTime) || rule.blockedIntervals.length > 0;
  const dayRules = hasContent ? [...(current.dayRules ?? []).filter((item) => item.date !== rule.date), rule].sort((a, b) => a.date.localeCompare(b.date)) : (current.dayRules ?? []).filter((item) => item.date !== rule.date);
  let next: AvailabilityPlan = { ...current, dayRules, updatedAt: nowIso(), status: current.blocks.length ? 'STALE' : current.status };
  const built = await buildAvailabilityInput(weekStart, next);
  next = withDerivedMetrics(next, built.input, built.validatedBlocks, built.fingerprint, current.blocks.length ? 'STALE' : next.status);
  return saveAvailabilityPlan(next, 'SET_AVAILABILITY_DAY_RULE', hasContent ? 'Zmieniono ograniczenia dyspozycyjności dnia' : 'Usunięto ograniczenia dyspozycyjności dnia');
}

export async function clearAvailabilityDayRule(weekStart: string, date: string): Promise<AvailabilityPlan> {
  return setAvailabilityDayRule(weekStart, { date, excluded: false, blockedIntervals: [] });
}

export async function getAvailabilityDayOverview(date: string): Promise<AvailabilityDayOverview> {
  const weekStart = startOfWeekForDateKey(date);
  const plan = await getAvailabilityPlan(weekStart);
  const built = await buildAvailabilityInput(weekStart, plan);
  const day = built.input.days.find((item) => item.date === date);
  if (!day) throw new Error('Nie znaleziono dnia w tygodniu.');
  const safeIntervals = freeIntervalsForManualAvailabilityDay(day).map((interval) => ({ startTime: minuteToTime(interval.start), endTime: minuteToTime(interval.end), minutes: interval.minutes }));
  const rule = dayRuleFor(plan, date);
  return {
    weekStart, date,
    ...(plan ? { plan } : {}),
    ...(rule ? { rule } : {}),
    blocks: built.validatedBlocks.filter((block) => block.date === date && block.status !== 'REJECTED').sort((a, b) => a.startTime.localeCompare(b.startTime)),
    safeIntervals, tradingSunday: day.tradingSunday, isSunday: day.weekday === 0,
    ...(built.profile.allowedWorkStart ? { globalAllowedStart: built.profile.allowedWorkStart } : {}),
    ...(built.profile.allowedWorkEnd ? { globalAllowedEnd: built.profile.allowedWorkEnd } : {}),
  };
}

export async function acceptAvailabilityPlan(weekStart: string): Promise<AvailabilityPlan> {
  const current = await currentOrShell(weekStart);
  if (current.status === 'STALE') throw new Error('Najpierw przelicz dyspozycyjność po zmianach w kalendarzu.');
  const blocks = current.blocks.map((block) => block.status === 'PROPOSED' ? { ...block, status: 'ACCEPTED' as const, locked: true, origin: block.origin ?? 'OPTIMIZER', validationState: 'VALID' as const } : block);
  const built = await buildAvailabilityInput(weekStart, { ...current, blocks });
  if (built.validatedBlocks.some((block) => isAccepted(block) && block.validationState === 'CONFLICT')) throw new Error('Co najmniej jeden blok nie jest już bezpieczny. Przelicz plan przed akceptacją.');
  const next = withDerivedMetrics({ ...current, blocks }, built.input, built.validatedBlocks, built.fingerprint, 'ACCEPTED');
  return saveAvailabilityPlan(next, 'ACCEPT_AVAILABILITY_PLAN', 'Zaakceptowano cały plan dyspozycyjności');
}

export async function markAvailabilitySent(weekStart: string): Promise<AvailabilityPlan> {
  const current = await currentOrShell(weekStart);
  const active = current.blocks.filter(isSafeAccepted);
  if (!active.length) throw new Error('Najpierw zapisz lub zaakceptuj dyspozycyjność.');
  if (current.blocks.some((block) => isAccepted(block) && block.validationState === 'CONFLICT')) throw new Error('Najpierw popraw konfliktującą dyspozycyjność.');
  const snapshot: AvailabilitySentSnapshot = {
    id: makeId('availability-sent'), createdAt: nowIso(), version: current.sentSnapshots.length + 1,
    totalMinutes: acceptedAvailabilityCoverageMinutes(active),
    blocks: active.map(({ date, startTime, endTime, minutes }) => ({ date, startTime, endTime, minutes })),
  };
  const next: AvailabilityPlan = { ...current, updatedAt: nowIso(), sentSnapshots: [...current.sentSnapshots, snapshot] };
  return saveAvailabilityPlan(next, 'MARK_AVAILABILITY_SENT', `Oznaczono dyspozycyjność jako wysłaną - wersja ${snapshot.version}`);
}

export async function refreshAllAvailabilityPlanStatuses(): Promise<AvailabilityPlan[]> {
  const plans = await listAvailabilityPlans();
  const refreshed: AvailabilityPlan[] = [];
  for (const plan of plans) refreshed.push((await refreshAvailabilityPlanStatus(plan.weekStart)) ?? plan);
  return refreshed;
}

export async function currentAvailabilityPlans(): Promise<AvailabilityPlan[]> { return listAvailabilityPlans(); }
