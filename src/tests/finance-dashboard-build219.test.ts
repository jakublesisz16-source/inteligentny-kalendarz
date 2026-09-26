import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build219 Finance + Trips compact responsive dashboard polish', () => {
  it('compacts the donut to three primary categories plus a remainder', () => {
    expect(dashboard).toContain('FINANCE_DONUT_PRIMARY_CATEGORY_LIMIT = 3');
    expect(dashboard).toContain('categoryAnalytics.slice(0, FINANCE_DONUT_PRIMARY_CATEGORY_LIMIT)');
    expect(dashboard).toContain('activeTripCategoryDonutEntries');
    expect(dashboard).toContain('FinanceCategoryDonut');
    expect(dashboard).toContain('finance-month-category-barless');
    expect(dashboard).toContain('finance-trip-category-barless');
  });

  it('uses the same KPI hierarchy in Month and Trip', () => {
    expect(dashboard).toContain('finance-month-dashboard-v219');
    expect(dashboard).toContain('finance-trip-dashboard-v219');
    expect(dashboard).toContain('finance-trip-metric-grid-v219');
    expect(dashboard).toContain('Największa kategoria');
    expect(dashboard).toContain('Największy wydatek');
    expect(dashboard).toContain('activeTripTopCategory');
    expect(dashboard).toContain('activeTripLargestReceipt');
  });

  it('does not rank generic manual placeholders as shopping places', () => {
    expect(dashboard).toContain('GENERIC_FINANCE_MERCHANT_KEYS');
    expect(dashboard).toContain('isMeaningfulReceiptMerchant');
    expect(dashboard).toContain('meaningfulMonthMerchantAnalytics');
    expect(dashboard).toContain('meaningfulTripMerchantAnalytics');
  });

  it('uses one mobile ranking at a time to reduce vertical scrolling', () => {
    expect(dashboard).toContain('finance-insight-tabs');
    expect(dashboard).toContain("setMonthInsightTab('MERCHANTS')");
    expect(dashboard).toContain("setMonthInsightTab('LARGEST')");
    expect(dashboard).toContain("setTripInsightTab('MERCHANTS')");
    expect(dashboard).toContain("setTripInsightTab('LARGEST')");
    expect(refinement).toContain('One ranking at a time on phone');
    expect(refinement).toContain('.finance-insight-group-v219.is-mobile-active');
  });

  it('forces the month and trip KPI grids to use full phone width', () => {
    expect(refinement).toContain('.finance-month-dashboard-v219 .finance-month-metric-grid-v218');
    expect(refinement).toContain('.finance-trip-dashboard-v219 .finance-trip-metric-grid-v219');
    expect(refinement).toContain('width: 100% !important;');
    expect(refinement).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
  });

  it('keeps the trip merchant ranking actionable without changing receipt parsing', () => {
    expect(dashboard).toContain('filterActiveTripByMerchant');
    expect(dashboard).toContain('activeTripVisibleReceipts');
    expect(dashboard).toContain('activeTripMerchantFilterLabel');
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
