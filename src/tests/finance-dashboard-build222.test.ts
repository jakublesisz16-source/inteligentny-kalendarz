import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build222 Finance currency context polish', () => {
  it('makes PLN primary in Month and keeps the original foreign amount secondary', () => {
    expect(dashboard).toContain('function receiptAmountForMonth');
    expect(dashboard).toContain('primary: formatMoneyMinor(receipt.totalMinor)');
    expect(dashboard).toContain('`oryginalnie ${original}`');
    expect(dashboard).toContain('const amount = receiptAmountForMonth(receipt);');
  });

  it('makes the configured trip currency primary when the full trip has complete original amounts', () => {
    expect(dashboard).toContain('const activeTripUsesOriginalCurrency = activeTripOriginalTotalMinor !== null;');
    expect(dashboard).toContain('function receiptAmountForTrip');
    expect(dashboard).toContain('primary: formatCurrencyAmountMinor(receipt.originalAmountMinor, currency)');
    expect(dashboard).toContain('secondary: `≈ ${formatMoneyMinor(receipt.totalMinor)}`');
  });

  it('uses the same hierarchy in largest-expense rankings, transaction rows and transaction detail', () => {
    expect(dashboard).toContain('activeTripLargestAmount?.primary');
    expect(dashboard).toContain('finance-context-amount-v222');
    expect(dashboard).toContain('detailContextAmount?.primary');
    expect(dashboard).toContain('finance-transaction-detail-currency-note-v222');
  });

  it('keeps item-level foreign-trip category drilldowns explicitly in PLN', () => {
    expect(dashboard).toContain("activeTripCurrency !== 'PLN' ? ' · kwoty w PLN' : ''");
    expect(dashboard).toContain('Pozycje poniżej są pokazane po przeliczeniu w PLN.');
    expect(dashboard).toContain("activeTripCurrency !== 'PLN' ? ' · w PLN' : ''");
  });

  it('extends bottom-navigation clearance to both Month and Trip expense lists', () => {
    expect(refinement).toContain('.finance-dashboard-v2 .finance-purchases-section,');
    expect(refinement).toContain('.finance-dashboard-v2 .finance-trip-expenses');
    expect(refinement).toContain('scroll-margin-bottom: calc(var(--mobile-bottom-nav-clearance) + 28px);');
  });

  it('does not change the database schema', () => {
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
