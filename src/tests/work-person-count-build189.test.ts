import { describe, expect, it } from 'vitest';
import { formatPersonCount } from '../work/work.service';

describe('Build189 Polish coworker count copy', () => {
  it('uses correct Polish plural forms around the irregular 2-4 and 12-14 ranges', () => {
    expect(formatPersonCount(0)).toBe('0 osób');
    expect(formatPersonCount(1)).toBe('1 osoba');
    expect(formatPersonCount(2)).toBe('2 osoby');
    expect(formatPersonCount(4)).toBe('4 osoby');
    expect(formatPersonCount(5)).toBe('5 osób');
    expect(formatPersonCount(12)).toBe('12 osób');
    expect(formatPersonCount(14)).toBe('14 osób');
    expect(formatPersonCount(22)).toBe('22 osoby');
    expect(formatPersonCount(24)).toBe('24 osoby');
    expect(formatPersonCount(25)).toBe('25 osób');
  });

  it('keeps WorkView on the shared formatter instead of duplicating fragile ternaries', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile('src/work/WorkView.tsx', 'utf8'));
    expect(source).toContain('formatPersonCount(nearestCoworkers.length)');
    expect(source).toContain('formatPersonCount(coworkers.length)');
    expect(source).not.toContain("nearestCoworkers.length === 1 ? 'osoba razem'");
    expect(source).not.toContain("coworkers.length === 1 ? 'osoba na zmianie'");
  });
});
