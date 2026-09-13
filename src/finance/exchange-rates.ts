import type { FinanceCurrencyCode } from '../shopping/expenses.types';

// Snapshot odświeżony z ostatniej opublikowanej tabeli roboczej przed wydaniem; runtime nie wykonuje requestów sieciowych.
const LOCAL_RATE_SNAPSHOT_DATE = '2026-09-11';

const LOCAL_CURRENT_PLN_RATES: Record<Exclude<FinanceCurrencyCode, 'PLN'>, number> = {
  EUR: 4.3228,
  HUF: 0.01188,
  CZK: 0.1784,
  GBP: 5.0332,
  USD: 3.7267,
  CHF: 4.5768,
  RON: 0.8225,
  DKK: 0.5783,
  SEK: 0.3848,
  NOK: 0.4005,
  TRY: 0.0766,
  JPY: 0.024183,
};

export interface CurrentPlnRate {
  currency: Exclude<FinanceCurrencyCode, 'PLN'>;
  effectiveDate: string;
  ratePlnPerUnit: number;
  origin: 'builtin';
}

export function buildCurrentPlnRateUrl(currency: Exclude<FinanceCurrencyCode, 'PLN'>): string {
  return `local://exchange-rates/${currency.toLowerCase()}-pln`;
}

export function resolveCurrentPlnRateRows(
  rows: Array<{ currency?: unknown; effectiveDate?: unknown; ratePlnPerUnit?: unknown }>,
  currency: Exclude<FinanceCurrencyCode, 'PLN'>,
): Omit<CurrentPlnRate, 'origin'> | null {
  const selected = rows
    .map((row) => ({
      currency: typeof row.currency === 'string' ? row.currency.toUpperCase() : '',
      effectiveDate: typeof row.effectiveDate === 'string' ? row.effectiveDate : '',
      ratePlnPerUnit: typeof row.ratePlnPerUnit === 'number' ? row.ratePlnPerUnit : Number(row.ratePlnPerUnit),
    }))
    .filter((row) => row.currency === currency && row.effectiveDate && Number.isFinite(row.ratePlnPerUnit) && row.ratePlnPerUnit > 0)
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];

  if (!selected) return null;
  return {
    currency,
    effectiveDate: selected.effectiveDate,
    ratePlnPerUnit: Math.round(selected.ratePlnPerUnit * 100000000) / 100000000,
  };
}

export async function fetchCurrentPlnRate(
  currency: Exclude<FinanceCurrencyCode, 'PLN'>,
  _signal?: AbortSignal,
): Promise<CurrentPlnRate> {
  const rate = LOCAL_CURRENT_PLN_RATES[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Brak lokalnego kursu dla wybranej waluty.');
  return {
    currency,
    effectiveDate: LOCAL_RATE_SNAPSHOT_DATE,
    ratePlnPerUnit: rate,
    origin: 'builtin',
  };
}
