import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildCurrentPlnRateUrl, resolveCurrentPlnRateRows } from '../finance/exchange-rates';

describe('1.2.0.85 local current Finance exchange rate', () => {
  it('keeps the exchange-rate source local instead of using an external API', () => {
    expect(buildCurrentPlnRateUrl('HUF')).toBe('local://exchange-rates/huf-pln');
  });

  it('uses the newest valid local quote row when resolving helper data', () => {
    const result = resolveCurrentPlnRateRows([
      { currency: 'HUF', effectiveDate: '2026-09-11', ratePlnPerUnit: 0.01188 },
      { currency: 'HUF', effectiveDate: '2026-09-10', ratePlnPerUnit: 0.01191 },
    ], 'HUF');
    expect(result?.effectiveDate).toBe('2026-09-11');
    expect(result?.ratePlnPerUnit).toBe(0.01188);
  });

  it('keeps the quick expense form simple without nested more-options disclosure', () => {
    const modal = readFileSync(new URL('../finance/FinanceQuickExpenseModal.tsx', import.meta.url), 'utf8');
    const dashboard = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
    const rates = readFileSync(new URL('../finance/exchange-rates.ts', import.meta.url), 'utf8');
    expect(modal).toContain('≈ ${formatMoneyMinor(converted)} według lokalnego kursu orientacyjnego');
    expect(modal).toContain('Miejsce / odbiorca <small>opcjonalnie</small>');
    expect(modal).toContain('<span>Waluta</span>');
    expect(modal).not.toContain('<summary>Więcej opcji</summary>');
    expect(modal).not.toContain('Ręczny kurs do PLN');
    expect(modal).not.toContain('Faktycznie pobrano z karty');
    expect(modal).not.toContain('rateText');
    expect(modal).not.toContain('actualPlnText');
    expect(dashboard).toContain('activeTripFixedRate');
    expect(dashboard).toContain('fetchCurrentPlnRate');
    expect(rates).toContain('LOCAL_CURRENT_PLN_RATES');
    expect(rates).not.toContain('api.frankfurter.dev');
    expect(rates).not.toContain('fetch(');
  });

  it('centralizes the main page typography instead of adding more per-screen sizes', () => {
    const styleIndex = readFileSync(new URL('../styles/index.css', import.meta.url), 'utf8');
    const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
    expect(styleIndex).toContain("@import './interface-consistency.css';");
    expect(consistency).toContain('--ui-page-title-size:');
    expect(consistency).toContain('.today-header h1');
    expect(consistency).toContain('.calendar-view-header h1');
    expect(consistency).toContain('.finance-view-header h1');
  });
});
