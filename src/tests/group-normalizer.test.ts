import { describe, expect, it } from 'vitest';
import { groupSetsIntersect, normalizeGroupText } from '../imports/xlsx/group-normalizer';

describe('normalizeGroupText hardening', () => {
  const cases: Array<[string, string[], boolean?]> = [
    ['grupa 1', ['1']],
    ['grupa 10', ['10']],
    ['Gr. 13', ['13']],
    ['gr 13', ['13']],
    ['grupa nr 13', ['13']],
    ['grupa 13a', ['13A']],
    ['grupa 13 a', ['13A']],
    ['13A', ['13A'], true],
    ['13 A', ['13A'], true],
    ['13A, 13B', ['13A', '13B'], true],
    ['13A/13B', ['13A', '13B'], true],
    ['13A i 13B', ['13A', '13B'], true],
    ['13A + 13B', ['13A', '13B'], true],
    ['grupa 13 a b, c', ['13A', '13B', '13C']],
    ['grupa 13a 13b 13c', ['13A', '13B', '13C']],
    ['grupa 13a i 13b', ['13A', '13B']],
  ];

  it.each(cases)('%s -> %j', (input, expected, allowBare = false) => {
    expect(normalizeGroupText(input, allowBare).groups).toEqual(expected);
  });

  it('normalizuje warianty kliniki', () => {
    expect(normalizeGroupText('grupa 13A - Klinika I')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
    expect(normalizeGroupText('grupa 13B (klinika ii)')).toMatchObject({ groups: ['13B'], clinic: 'Klinika II' });
    expect(normalizeGroupText('grupa 13A - Klinika 1')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
    expect(normalizeGroupText('grupa 13A - Klin. I')).toMatchObject({ groups: ['13A'], clinic: 'Klinika I' });
  });

  it('nie uznaje zwykłego numeru za grupę bez świadomego kontekstu', () => {
    expect(normalizeGroupText('13').groups).toEqual([]);
    expect(normalizeGroupText('204').groups).toEqual([]);
  });

  it('nie używa substring matching ani automatycznej hierarchii', () => {
    expect(groupSetsIntersect(['10'], ['1'])).toBe(false);
    expect(groupSetsIntersect(['11'], ['1'])).toBe(false);
    expect(groupSetsIntersect(['1'], ['10'])).toBe(false);
    expect(groupSetsIntersect(['13A'], ['13'])).toBe(false);
    expect(groupSetsIntersect(['13'], ['13A'])).toBe(false);
    expect(groupSetsIntersect(['13A'], ['13A'])).toBe(true);
  });
});
