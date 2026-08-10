import { describe, expect, it } from 'vitest';
import { coworkerOverlaps, formatWorkMinutes, sortCoworkerOverlaps } from '../work/work.service';
import type { CoworkerOverlap, WorkCoworkerShift } from '../work/work.types';

function overlap(name: string, minutes: number, start: string): CoworkerOverlap {
  return { displayName: name, coworkerStartTime: '10:00', coworkerEndTime: '22:00', overlapStartTime: start, overlapEndTime: '22:00', overlapMinutes: minutes };
}

describe('0.3.3-hotfix.4 work readability helpers', () => {
  it('sortuje najpierw po długości wspólnego czasu', () => {
    const result = sortCoworkerOverlaps([overlap('C', 120, '20:00'), overlap('A', 300, '17:00'), overlap('B', 240, '18:00')]);
    expect(result.map((item) => item.displayName)).toEqual(['A', 'B', 'C']);
  });

  it('przy remisie wybiera wcześniejszy początek overlapu, potem nazwę', () => {
    const result = sortCoworkerOverlaps([overlap('Zeta', 240, '18:00'), overlap('Beta', 240, '17:00'), overlap('Alfa', 240, '17:00')]);
    expect(result.map((item) => item.displayName)).toEqual(['Alfa', 'Beta', 'Zeta']);
  });

  it('touching nie jest wspólną zmianą', () => {
    const shifts: WorkCoworkerShift[] = [{ id: 'a', importId: 'i', date: '2026-08-10', displayName: 'Osoba Testowa', normalizedName: 'OSOBA TESTOWA', startTime: '12:00', endTime: '17:00', minutes: 300, sourcePage: 1 }];
    expect(coworkerOverlaps('2026-08-10', '17:00', '22:00', shifts)).toHaveLength(0);
  });

  it('formatuje czas bez zbędnych minut', () => {
    expect(formatWorkMinutes(300)).toBe('5 h');
    expect(formatWorkMinutes(450)).toBe('7 h 30 min');
    expect(formatWorkMinutes(255)).toBe('4 h 15 min');
  });
});
