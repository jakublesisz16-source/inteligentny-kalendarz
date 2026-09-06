import { describe, expect, it } from 'vitest';
import { findBestFooterHint, normalizeLocationIdentity, parseLocationText } from '../imports/xlsx/location-parser';

describe('location parser hardening', () => {
  it.each([
    ['ul. Testowa 1', 'ul. Testowa 1'],
    ['ul Testowa 1', 'ul. Testowa 1'],
    ['Testowa 1', 'Testowa 1'],
    ['al. Niepodległości 10', 'al. Niepodległości 10'],
    ['Aleja Niepodległości 10', 'al. Niepodległości 10'],
    ['ul.Niekłańska 4/24 - pierwsze spotkanie', 'ul. Niekłańska 4/24'],
    ['Milenijna 4', 'Milenijna 4'],
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

  it('rozpoznaje jednostkę jako etykietę, gdy nie ma adresu', () => {
    expect(parseLocationText('Prof. Test, Zakład Propedeutyki Pielęgniarstwa').label).toBe('Zakład Propedeutyki Pielęgniarstwa');
  });

  it('nie bierze nazwy zajęć z liczbą godzin za adres', () => {
    expect(parseLocationText('POZ seminaria 15g').address).toBeUndefined();
  });

  it('nie myli nazwiska z podobną nazwą ulicy', () => {
    const hints = [
      { key: 'Prof. A. Banaszkiewicz, Klinika Dziecięca, ul. Żwirki i Wigury 63A', rawText: '', address: 'ul. Żwirki i Wigury 63A' },
      { key: 'Inna Klinika, ul. Banacha 1a', rawText: '', address: 'ul. Banacha 1a' },
    ];
    expect(findBestFooterHint('Prof. A. Banaszkiewicz', hints)?.address).toBe('ul. Żwirki i Wigury 63A');
  });

  it('łączy krótką odmianę nazwiska Mucha/Muchy bez globalnego skracania słów', () => {
    const hints = [{ key: 'zajęcia u Prof. K. Muchy, ul. Testowa 1', rawText: '', address: 'ul. Testowa 1' }];
    expect(findBestFooterHint('Prof. K. Mucha', hints)?.address).toBe('ul. Testowa 1');
  });

  it('nie dopasowuje wielowyrazowych nazw po jednym ogólnym słowie', () => {
    const hints = [{ key: 'OPIEKA OPERACYJNA seminaria, ul. Testowa 1', rawText: '', address: 'ul. Testowa 1' }];
    expect(findBestFooterHint('OPIEKA DZIECIĘCA zajęcia praktyczne', hints)).toBeUndefined();
  });

  it('nie używa samego rodzaju zajęć jako tożsamości lokalizacji', () => {
    const hints = [{ key: 'INNY PRZEDMIOT zajęcia praktyczne, ul. Testowa 2', rawText: '', address: 'ul. Testowa 2' }];
    expect(findBestFooterHint('NOWY PRZEDMIOT zajęcia praktyczne', hints)).toBeUndefined();
  });

  it('zachowuje dopasowanie jednowyrazowego identyfikatora mimo dopisku godzin', () => {
    const hints = [{ key: 'POZ seminaria, ul. Testowa 3', rawText: '', address: 'ul. Testowa 3' }];
    expect(findBestFooterHint('POZ seminaria 15g', hints)?.address).toBe('ul. Testowa 3');
  });

});
