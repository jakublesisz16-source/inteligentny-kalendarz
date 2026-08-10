import { describe, expect, it } from 'vitest';
import { nextJournalTimestampIso } from '../safety/change-journal-order';

describe('Change Journal timestamp ordering', () => {
  it('moves forward by one millisecond when the candidate ties the latest stored timestamp', () => {
    expect(nextJournalTimestampIso(
      '2026-08-10T12:00:00.000Z',
      ['2026-08-10T12:00:00.000Z'],
    )).toBe('2026-08-10T12:00:00.001Z');
  });

  it('stays strictly newer when the wall clock moves behind the stored journal', () => {
    expect(nextJournalTimestampIso(
      '2026-08-10T12:00:00.000Z',
      ['2026-08-10T12:00:05.000Z'],
    )).toBe('2026-08-10T12:00:05.001Z');
  });

  it('ignores invalid historical timestamps while preserving a valid newer candidate', () => {
    expect(nextJournalTimestampIso(
      '2026-08-10T12:00:10.000Z',
      ['invalid', '2026-08-10T12:00:05.000Z'],
    )).toBe('2026-08-10T12:00:10.000Z');
  });
});
