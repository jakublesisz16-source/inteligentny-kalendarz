import { describe, expect, it } from 'vitest';
import { buildGoogleMapsDirectionsUrl } from '../locations/google-maps';

function destinationFrom(url: string): string | null {
  return new URL(url).searchParams.get('destination');
}

describe('Google Maps directions URL', () => {
  it('builds a directions URL from location name and address', () => {
    const url = buildGoogleMapsDirectionsUrl({ name: 'Szpital Kliniczny', address: 'ul. Testowa 5, Warszawa' });
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?/);
    expect(new URL(url!).searchParams.get('api')).toBe('1');
    expect(destinationFrom(url!)).toBe('Szpital Kliniczny, ul. Testowa 5, Warszawa');
  });

  it('preserves Polish characters after URL decoding', () => {
    const url = buildGoogleMapsDirectionsUrl({ name: 'Łóżkowa Żółć', address: 'ul. Gęślą Jaźń 7, Świętochłowice' });
    expect(destinationFrom(url!)).toBe('Łóżkowa Żółć, ul. Gęślą Jaźń 7, Świętochłowice');
  });

  it('encodes query-sensitive characters safely', () => {
    const url = buildGoogleMapsDirectionsUrl({ name: 'A/B & C', address: 'al. X/Y 1 & 2, Warszawa' });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get('api')).toBe('1');
    expect(parsed.searchParams.get('destination')).toBe('A/B & C, al. X/Y 1 & 2, Warszawa');
    expect([...parsed.searchParams.keys()].sort()).toEqual(['api', 'destination']);
  });

  it('trims name and address before building destination', () => {
    const url = buildGoogleMapsDirectionsUrl({ name: '  Szpital  ', address: '  ul. Testowa 5  ' });
    expect(destinationFrom(url!)).toBe('Szpital, ul. Testowa 5');
  });

  it('does not build a route for an empty address', () => {
    expect(buildGoogleMapsDirectionsUrl({ name: 'Sala 214', address: '   ' })).toBeUndefined();
  });

  it('can build a route from an address when the location name is empty', () => {
    const url = buildGoogleMapsDirectionsUrl({ name: '   ', address: 'ul. Testowa 1, Warszawa' });
    expect(destinationFrom(url!)).toBe('ul. Testowa 1, Warszawa');
  });
});
