import { describe, expect, it } from 'vitest';
import { normalizeLocationIdentity, parseLocationText } from '../imports/xlsx/location-parser';

describe('location parser hardening', () => {
  it.each([
    ['ul. Testowa 1', 'ul. Testowa 1'],
    ['ul Testowa 1', 'ul. Testowa 1'],
    ['Testowa 1', 'Testowa 1'],
    ['al. Niepodległości 10', 'al. Niepodległości 10'],
    ['Aleja Niepodległości 10', 'al. Niepodległości 10'],
  ])('rozpoznaje adres %s', (input, expected) => {
    expect(parseLocationText(input).address).toBe(expected);
  });

  it('rozpoznaje nazwy placówek', () => {
    expect(parseLocationText('Szpital Grochowski').label).toBe('Szpital Grochowski');
    expect(parseLocationText('Kampus Lindleya').label).toBe('Kampus Lindleya');
  });

  it('normalizuje kosmetyczne warianty tej samej ulicy', () => {
    expect(normalizeLocationIdentity('ul. Testowa 1')).toBe(normalizeLocationIdentity('ul Testowa 1'));
    expect(normalizeLocationIdentity('Aleja Niepodległości 10')).toBe(normalizeLocationIdentity('al. Niepodległości 10'));
  });
});
