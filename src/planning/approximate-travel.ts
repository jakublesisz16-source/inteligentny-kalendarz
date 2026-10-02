/**
 * Lekka, offline'owa heurystyka dojazdu dla znanych lokalizacji używanych
 * w bieżącym planie. Minuty są celowo zaokrąglone i służą wyłącznie do
 * wykrywania oczywiście zbyt krótkiej przerwy - nigdy do pokazywania ETA.
 */

export const APPROXIMATE_TRAVEL_WARNING_MARGIN_MINUTES = 10;

export type ApproximateTravelSignal = 'TIGHT' | 'CLEARLY_TOO_SHORT';
export const MAX_APPROXIMATE_TRAVEL_MINUTES = 35;

type KnownPlace =
  | 'BANACHA_1'
  | 'BANACHA_1A'
  | 'CIOLKA_27'
  | 'JADZWINGOW_9'
  | 'LINDLEYA_4'
  | 'NOWOGRODZKA_59'
  | 'PAWINSKIEGO_3A'
  | 'PAWINSKIEGO_3C'
  | 'TROJDENA_2A'
  | 'ZWIRKI_63A';

function fold(value: string): string {
  return value
    .replace(/[łŁ]/gu, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\bul\.?\b/gu, ' ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function knownPlace(address: string): KnownPlace | undefined {
  const value = fold(address);
  if (/\bbanacha 1a\b/u.test(value)) return 'BANACHA_1A';
  if (/\bbanacha 1\b/u.test(value)) return 'BANACHA_1';
  if (/\bciolka 27\b/u.test(value)) return 'CIOLKA_27';
  if (/\bjadzwingow 9\b/u.test(value)) return 'JADZWINGOW_9';
  if (/\blindleya 4\b/u.test(value)) return 'LINDLEYA_4';
  if (/\bnowogrodzka 59\b/u.test(value)) return 'NOWOGRODZKA_59';
  if (/\bpawinskiego 3a\b/u.test(value)) return 'PAWINSKIEGO_3A';
  if (/\bpawinskiego 3c\b/u.test(value)) return 'PAWINSKIEGO_3C';
  if (/\btrojdena 2a\b/u.test(value)) return 'TROJDENA_2A';
  if (/\bzwirki i wigury 63a\b/u.test(value)) return 'ZWIRKI_63A';
  return undefined;
}

function pair(a: KnownPlace, b: KnownPlace): string {
  return [a, b].sort().join('|');
}

const APPROXIMATE_TRANSIT_MINUTES = new Map<string, number>([
  [pair('BANACHA_1', 'BANACHA_1A'), 5],
  [pair('BANACHA_1', 'CIOLKA_27'), 30],
  [pair('BANACHA_1A', 'CIOLKA_27'), 30],
  [pair('BANACHA_1', 'TROJDENA_2A'), 10],
  [pair('BANACHA_1A', 'TROJDENA_2A'), 10],
  [pair('BANACHA_1', 'ZWIRKI_63A'), 15],
  [pair('BANACHA_1A', 'ZWIRKI_63A'), 15],
  [pair('BANACHA_1', 'LINDLEYA_4'), 20],
  [pair('BANACHA_1A', 'LINDLEYA_4'), 20],
  [pair('BANACHA_1', 'NOWOGRODZKA_59'), 20],
  [pair('BANACHA_1A', 'NOWOGRODZKA_59'), 20],
  [pair('BANACHA_1', 'PAWINSKIEGO_3A'), 10],
  [pair('BANACHA_1', 'PAWINSKIEGO_3C'), 10],
  [pair('BANACHA_1A', 'PAWINSKIEGO_3A'), 10],
  [pair('BANACHA_1A', 'PAWINSKIEGO_3C'), 10],
  [pair('BANACHA_1', 'JADZWINGOW_9'), 25],
  [pair('BANACHA_1A', 'JADZWINGOW_9'), 25],
  [pair('CIOLKA_27', 'TROJDENA_2A'), 30],
  [pair('CIOLKA_27', 'ZWIRKI_63A'), 30],
  [pair('CIOLKA_27', 'LINDLEYA_4'), 25],
  [pair('CIOLKA_27', 'NOWOGRODZKA_59'), 25],
  [pair('CIOLKA_27', 'PAWINSKIEGO_3A'), 30],
  [pair('CIOLKA_27', 'PAWINSKIEGO_3C'), 30],
  [pair('CIOLKA_27', 'JADZWINGOW_9'), 30],
  [pair('JADZWINGOW_9', 'LINDLEYA_4'), 25],
  [pair('JADZWINGOW_9', 'NOWOGRODZKA_59'), 25],
  [pair('JADZWINGOW_9', 'PAWINSKIEGO_3A'), 20],
  [pair('JADZWINGOW_9', 'PAWINSKIEGO_3C'), 20],
  [pair('JADZWINGOW_9', 'TROJDENA_2A'), 25],
  [pair('JADZWINGOW_9', 'ZWIRKI_63A'), 30],
  [pair('LINDLEYA_4', 'NOWOGRODZKA_59'), 10],
  [pair('LINDLEYA_4', 'PAWINSKIEGO_3A'), 20],
  [pair('LINDLEYA_4', 'PAWINSKIEGO_3C'), 20],
  [pair('LINDLEYA_4', 'TROJDENA_2A'), 20],
  [pair('LINDLEYA_4', 'ZWIRKI_63A'), 15],
  [pair('NOWOGRODZKA_59', 'PAWINSKIEGO_3A'), 20],
  [pair('NOWOGRODZKA_59', 'PAWINSKIEGO_3C'), 20],
  [pair('NOWOGRODZKA_59', 'TROJDENA_2A'), 20],
  [pair('NOWOGRODZKA_59', 'ZWIRKI_63A'), 15],
  [pair('PAWINSKIEGO_3A', 'PAWINSKIEGO_3C'), 5],
  [pair('PAWINSKIEGO_3A', 'TROJDENA_2A'), 10],
  [pair('PAWINSKIEGO_3C', 'TROJDENA_2A'), 10],
  [pair('PAWINSKIEGO_3A', 'ZWIRKI_63A'), 10],
  [pair('PAWINSKIEGO_3C', 'ZWIRKI_63A'), 10],
  [pair('TROJDENA_2A', 'ZWIRKI_63A'), 15],
]);

export function approximateTransitMinutesBetweenAddresses(a: string, b: string): number | undefined {
  const from = knownPlace(a);
  const to = knownPlace(b);
  if (!from || !to) return undefined;
  if (from === to) return 0;
  return APPROXIMATE_TRANSIT_MINUTES.get(pair(from, to));
}

export function approximateTravelSignalForGap(gapMinutes: number, transitMinutes: number): ApproximateTravelSignal | undefined {
  const gap = Math.max(0, gapMinutes);
  const deficit = transitMinutes - gap;
  if (deficit <= 0) return undefined;
  return deficit > APPROXIMATE_TRAVEL_WARNING_MARGIN_MINUTES ? 'CLEARLY_TOO_SHORT' : 'TIGHT';
}

export function isClearlyTooShortForApproximateTransit(gapMinutes: number, transitMinutes: number): boolean {
  return approximateTravelSignalForGap(gapMinutes, transitMinutes) === 'CLEARLY_TOO_SHORT';
}
