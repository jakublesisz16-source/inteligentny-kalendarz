import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build272 empty Finance action hierarchy on mobile', () => {
  it('marks empty month and empty active trip states explicitly', () => {
    expect(dashboard).toContain("const isEmptyMonth = financeScope === 'MONTH' && monthSummary.receiptCount === 0;");
    expect(dashboard).toContain("const isEmptyActiveTrip = financeScope === 'TRIPS' && Boolean(activeTripName) && activeTripReceipts.length === 0;");
    expect(dashboard).toContain("${isEmptyMonth ? ' finance-month-is-empty' : ''}${isEmptyActiveTrip ? ' finance-trip-is-empty' : ''}");
  });

  it('keeps the primary manual expense action visible for an empty month while empty trips keep their owned action', () => {
    expect(responsive).not.toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-manual-expense,\n  .finance-trip-is-empty');
    expect(responsive).toContain('.finance-trip-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions');
    expect(responsive).toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-manual-expense');
  });

  it('keeps a single primary expense action while the empty state stays descriptive', () => {
    expect(dashboard).toContain('<h2>Dodaj pierwszy wydatek</h2>');
    expect(dashboard).toContain('className="button button-primary finance-manual-expense"');
    expect(dashboard).toContain('Po pierwszym wydatku pojawi się podsumowanie miesiąca.');
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
