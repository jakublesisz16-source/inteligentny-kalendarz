import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.94 single empty-state expense CTA on mobile', () => {
  it('marks empty month and empty active trip states explicitly', () => {
    expect(dashboard).toContain("const isEmptyMonth = financeScope === 'MONTH' && monthSummary.receiptCount === 0;");
    expect(dashboard).toContain("const isEmptyActiveTrip = financeScope === 'TRIPS' && Boolean(activeTripName) && activeTripReceipts.length === 0;");
    expect(dashboard).toContain("${isEmptyMonth ? ' finance-month-is-empty' : ''}${isEmptyActiveTrip ? ' finance-trip-is-empty' : ''}");
  });

  it('hides the duplicated header action only on mobile empty states', () => {
    expect(responsive).toContain('1.2.0.93 - one expense CTA in empty Finance states on phones.');
    expect(responsive).toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-manual-expense');
    expect(responsive).toContain('.finance-trip-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions');
    expect(responsive).toContain('display: none;');
  });

  it('keeps the empty-state primary action available', () => {
    expect(dashboard).toContain('<h2>Dodaj pierwszy wydatek</h2>');
    expect(dashboard).toContain('<button type="button" className="button button-primary" onClick={openQuickExpense}>+ Wydatek</button>');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
