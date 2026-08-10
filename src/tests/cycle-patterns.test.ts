import { describe, expect, it } from 'vitest';
import { buildCyclePatternSummary } from '../cycle/cycle-patterns';
import type { CycleJournalEntry, CyclePeriod } from '../cycle/cycle.types';

function period(id: string, startDate: string, endDate?: string, isUserMarkedAtypical = false): CyclePeriod {
  return {
    id,
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(isUserMarkedAtypical ? { isUserMarkedAtypical: true } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function journal(id: string, date: string, values: Partial<Pick<CycleJournalEntry, 'bleeding' | 'pain' | 'wellbeing' | 'painMedicationTaken' | 'note'>> = {}): CycleJournalEntry {
  return {
    id,
    date,
    ...values,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const completedPeriods = [
  period('p1', '2026-01-01', '2026-01-05'),
  period('p2', '2026-02-01', '2026-02-06'),
  period('p3', '2026-03-01', '2026-03-05'),
];

describe('0.6.1 minimalistyczne Własne wzorce Cyklu', () => {
  it('returns no patterns for empty data and requires three completed periods for typical duration', () => {
    expect(buildCyclePatternSummary([], [])).toEqual({ completedPeriodCount: 0, matchedJournalEntryCount: 0 });

    const two = buildCyclePatternSummary(completedPeriods.slice(0, 2), []);
    expect(two.completedPeriodCount).toBe(2);
    expect(two.typicalPeriodDurationDays).toBeUndefined();
  });

  it('uses inclusive completed-period duration and deterministic rounded median', () => {
    const three = buildCyclePatternSummary(completedPeriods, []);
    expect(three.typicalPeriodDurationDays).toBe(5);

    const four = buildCyclePatternSummary([
      ...completedPeriods,
      period('p4', '2026-04-01', '2026-04-07'),
    ], []);
    expect(four.typicalPeriodDurationDays).toBe(6);
  });

  it('ignores open periods for both duration and journal matching', () => {
    const summary = buildCyclePatternSummary(
      [...completedPeriods.slice(0, 2), period('open', '2026-03-01')],
      [journal('j1', '2026-03-01', { pain: 'STRONG' })],
    );
    expect(summary.completedPeriodCount).toBe(2);
    expect(summary.matchedJournalEntryCount).toBe(0);
    expect(summary.pain).toBeUndefined();
  });

  it('uses only journal entries from completed periods and requires three observations from two periods', () => {
    const onePeriodOnly = buildCyclePatternSummary(completedPeriods, [
      journal('j1', '2026-01-01', { bleeding: 'LIGHT' }),
      journal('j2', '2026-01-02', { bleeding: 'LIGHT' }),
      journal('j3', '2026-01-03', { bleeding: 'MODERATE' }),
      journal('outside', '2026-01-20', { bleeding: 'HEAVY' }),
    ]);
    expect(onePeriodOnly.matchedJournalEntryCount).toBe(3);
    expect(onePeriodOnly.bleeding).toBeUndefined();

    const enough = buildCyclePatternSummary(completedPeriods, [
      journal('j1', '2026-01-01', { bleeding: 'LIGHT' }),
      journal('j2', '2026-01-02', { bleeding: 'LIGHT' }),
      journal('j3', '2026-02-01', { bleeding: 'MODERATE' }),
      journal('outside', '2026-02-20', { bleeding: 'HEAVY' }),
    ]);
    expect(enough.matchedJournalEntryCount).toBe(3);
    expect(enough.bleeding).toEqual({ kind: 'VALUE', value: 'LIGHT' });
  });

  it('distinguishes NONE from undefined when counting observations', () => {
    const summary = buildCyclePatternSummary(completedPeriods, [
      journal('j1', '2026-01-01', { pain: 'NONE' }),
      journal('j2', '2026-01-02'),
      journal('j3', '2026-02-01', { pain: 'NONE' }),
      journal('j4', '2026-02-02', { pain: 'MILD' }),
    ]);
    expect(summary.pain).toEqual({ kind: 'VALUE', value: 'NONE' });
  });

  it('returns MIXED on a true top-count tie instead of choosing enum order', () => {
    const summary = buildCyclePatternSummary(completedPeriods, [
      journal('j1', '2026-01-01', { wellbeing: 'GOOD' }),
      journal('j2', '2026-01-02', { wellbeing: 'NEUTRAL' }),
      journal('j3', '2026-02-01', { wellbeing: 'GOOD' }),
      journal('j4', '2026-02-02', { wellbeing: 'NEUTRAL' }),
    ]);
    expect(summary.wellbeing).toEqual({ kind: 'MIXED' });
  });

  it('does not analyze painMedicationTaken in Własne wzorce', () => {
    const baseEntries = [
      journal('j1', '2026-01-01', { pain: 'MILD', painMedicationTaken: false }),
      journal('j2', '2026-01-02', { pain: 'MILD', painMedicationTaken: true }),
      journal('j3', '2026-02-01', { pain: 'STRONG' }),
    ];
    const toggled = baseEntries.map((entry) => ({ ...entry, painMedicationTaken: entry.painMedicationTaken === undefined ? true : !entry.painMedicationTaken }));
    expect(buildCyclePatternSummary(completedPeriods, toggled)).toEqual(buildCyclePatternSummary(completedPeriods, baseEntries));
  });

  it('does not analyze note content', () => {
    const baseEntries = [
      journal('j1', '2026-01-01', { bleeding: 'MODERATE', note: 'fixture alpha' }),
      journal('j2', '2026-01-02', { bleeding: 'MODERATE', note: 'fixture beta' }),
      journal('j3', '2026-02-01', { bleeding: 'LIGHT', note: 'fixture gamma' }),
    ];
    const changedNotes = baseEntries.map((entry, index) => ({ ...entry, note: `completely different ${index}` }));
    expect(buildCyclePatternSummary(completedPeriods, changedNotes)).toEqual(buildCyclePatternSummary(completedPeriods, baseEntries));
  });

  it('is independent of input order', () => {
    const entries = [
      journal('j1', '2026-01-01', { pain: 'MILD', wellbeing: 'GOOD' }),
      journal('j2', '2026-01-02', { pain: 'MILD', wellbeing: 'NEUTRAL' }),
      journal('j3', '2026-02-01', { pain: 'STRONG', wellbeing: 'GOOD' }),
    ];
    const forward = buildCyclePatternSummary(completedPeriods, entries);
    const reversed = buildCyclePatternSummary([...completedPeriods].reverse(), [...entries].reverse());
    expect(reversed).toEqual(forward);
  });

  it('keeps isUserMarkedAtypical as metadata and includes that completed period', () => {
    const periods = [
      period('p1', '2026-01-01', '2026-01-05'),
      period('p2', '2026-02-01', '2026-02-10', true),
      period('p3', '2026-03-01', '2026-03-05'),
    ];
    const summary = buildCyclePatternSummary(periods, []);
    expect(summary.completedPeriodCount).toBe(3);
    expect(summary.typicalPeriodDurationDays).toBe(5);
  });
});
