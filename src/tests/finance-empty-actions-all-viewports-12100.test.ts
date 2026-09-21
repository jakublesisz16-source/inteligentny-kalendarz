import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('1.2.0.100 Finance empty-state actions on all viewports', () => {
  it('does not render the header manual-expense action for an empty month', () => {
    expect(dashboard).toContain("const isEmptyMonth = financeScope === 'MONTH' && monthSummary.receiptCount === 0;");
    expect(dashboard).toContain('!isEmptyMonth ? <button type="button" className="button button-primary finance-manual-expense"');
    expect(dashboard).toContain('<section className="panel finance-trip-empty finance-month-empty"');
    expect(dashboard).toContain('<div><button type="button" className="button button-primary" onClick={openQuickExpense}>+ Wydatek</button></div>');
  });

  it('keeps receipt scanning reachable in the empty month on desktop and mobile', () => {
    expect(dashboard).toContain('<button type="button" className="button button-secondary finance-scan-receipt" onClick={openReceiptScan}>');
    expect(dashboard).toContain('finance-scan-receipt-short">Skanuj');
    expect(dashboard).toContain('finance-scan-receipt-long">paragon');
    expect(responsive).toContain('.finance-month-is-empty > .finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt');
    expect(responsive).toContain('display: inline-flex;');
  });

  it('does not render a second header action group for an empty active trip', () => {
    expect(dashboard).toContain("const isEmptyActiveTrip = financeScope === 'TRIPS' && Boolean(activeTripName) && activeTripReceipts.length === 0;");
    expect(dashboard).toContain('activeTripName && !isEmptyActiveTrip ? (');
    expect(dashboard).not.toContain("{financeScope === 'MONTH' || activeTripName ? <div className=\"finance-dashboard-actions finance-core-actions\">");
  });

  it('keeps schema unchanged', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
