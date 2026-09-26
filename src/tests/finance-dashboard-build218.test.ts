import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('Build 218 Finance dashboard visual polish', () => {
  it('adds a compact six-month trend without a second analytics screen', () => {
    expect(dashboard).toContain('getSixMonthTrend');
    expect(dashboard).toContain('FinanceMiniTrend');
    expect(dashboard).toContain('Trend 6 miesięcy');
    expect(dashboard).toContain('finance-month-mini-trend');
  });

  it('replaces the category-first impression with a donut plus clickable category legend', () => {
    expect(dashboard).toContain('FinanceCategoryDonut');
    expect(dashboard).toContain('finance-month-donut');
    expect(dashboard).toContain('categoryAnalytics.slice(0, 4)');
    expect(dashboard).toContain('categoryRemainder');
    expect(dashboard).toContain('onClick={() => filterByCategory(entry.categoryId)}');
  });

  it('adds useful decision-light month insights and merchant filtering', () => {
    expect(dashboard).toContain('aggregateMeaningfulReceiptMerchants');
    expect(dashboard).toContain('meaningfulMonthMerchantAnalytics');
    expect(dashboard).toContain('Miejsca zakupów');
    expect(dashboard).toContain('Największe wydatki');
    expect(dashboard).toContain('filterByMerchant(entry.key)');
    expect(dashboard).toContain('filteredMonthReceipts.map');
    expect(dashboard).toContain('finance-expense-merchant-filter');
  });

  it('keeps necessity available but secondary to spend structure', () => {
    expect(dashboard).toContain('finance-month-necessity-inline');
    expect(dashboard).toContain("filterByNecessity('essential')");
    expect(dashboard).toContain("filterByNecessity('nonessential')");
  });

  it('has explicit desktop and phone layouts for the new dashboard', () => {
    expect(refinement).toContain('Build218 - Finance dashboard visual polish');
    expect(refinement).toContain('.finance-month-dashboard-v218 .finance-month-dashboard-hero-v218');
    expect(refinement).toContain('.finance-month-category-composition');
    expect(refinement).toContain('.finance-month-insights-v218');
    expect(refinement).toContain('@media (max-width: 620px)');
    expect(refinement).toContain('.finance-month-dashboard-v218 .finance-month-metric-grid-v218 > button:nth-child(n+2)');
  });

  it('keeps the durable data schema unchanged', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
