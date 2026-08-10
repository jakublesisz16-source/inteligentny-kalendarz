import type {
  CycleBleedingLevel,
  CycleJournalEntry,
  CyclePainLevel,
  CyclePeriod,
  CycleWellbeingLevel,
} from './cycle.types';

export type CyclePatternValue<T extends string> =
  | { kind: 'VALUE'; value: T }
  | { kind: 'MIXED' };

export interface CyclePatternSummary {
  completedPeriodCount: number;
  matchedJournalEntryCount: number;
  typicalPeriodDurationDays?: number;
  bleeding?: CyclePatternValue<CycleBleedingLevel>;
  pain?: CyclePatternValue<CyclePainLevel>;
  wellbeing?: CyclePatternValue<CycleWellbeingLevel>;
}

interface MatchedJournalEntry {
  periodId: string;
  entry: CycleJournalEntry;
}

const MIN_COMPLETED_PERIODS_FOR_DURATION = 3;
const MIN_FIELD_OBSERVATIONS = 3;
const MIN_DISTINCT_PERIODS_FOR_FIELD = 2;

function localDateOrdinal(value: string): number {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function inclusiveDays(startDate: string, endDate: string): number {
  return localDateOrdinal(endDate) - localDateOrdinal(startDate) + 1;
}

function medianRounded(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function dominantValue<T extends string>(
  matched: MatchedJournalEntry[],
  pick: (entry: CycleJournalEntry) => T | undefined,
): CyclePatternValue<T> | undefined {
  const observations = matched
    .map(({ periodId, entry }) => ({ periodId, value: pick(entry) }))
    .filter((item): item is { periodId: string; value: T } => item.value !== undefined);

  if (observations.length < MIN_FIELD_OBSERVATIONS) return undefined;
  if (new Set(observations.map((item) => item.periodId)).size < MIN_DISTINCT_PERIODS_FOR_FIELD) return undefined;

  const counts = new Map<T, number>();
  for (const { value } of observations) counts.set(value, (counts.get(value) ?? 0) + 1);

  let highest = 0;
  let leaders: T[] = [];
  for (const [value, count] of counts) {
    if (count > highest) {
      highest = count;
      leaders = [value];
    } else if (count === highest) {
      leaders.push(value);
    }
  }

  return leaders.length === 1 ? { kind: 'VALUE', value: leaders[0]! } : { kind: 'MIXED' };
}

export function buildCyclePatternSummary(
  periods: CyclePeriod[],
  journalEntries: CycleJournalEntry[],
): CyclePatternSummary {
  const completedPeriods = periods
    .filter((period): period is CyclePeriod & { endDate: string } => Boolean(period.endDate))
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

  const durations = completedPeriods.map((period) => inclusiveDays(period.startDate, period.endDate));

  const matched = journalEntries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .flatMap((entry) => {
      const period = completedPeriods.find((candidate) => entry.date >= candidate.startDate && entry.date <= candidate.endDate);
      return period ? [{ periodId: period.id, entry }] : [];
    });

  const typicalPeriodDurationDays = completedPeriods.length >= MIN_COMPLETED_PERIODS_FOR_DURATION
    ? medianRounded(durations)
    : undefined;
  const bleeding = dominantValue(matched, (entry) => entry.bleeding);
  const pain = dominantValue(matched, (entry) => entry.pain);
  const wellbeing = dominantValue(matched, (entry) => entry.wellbeing);

  return {
    completedPeriodCount: completedPeriods.length,
    matchedJournalEntryCount: matched.length,
    ...(typicalPeriodDurationDays !== undefined ? { typicalPeriodDurationDays } : {}),
    ...(bleeding ? { bleeding } : {}),
    ...(pain ? { pain } : {}),
    ...(wellbeing ? { wellbeing } : {}),
  };
}
