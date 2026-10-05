import { describe, expect, it } from 'vitest';
import { sourceText } from './helpers/source-text';

const dashboard = () => sourceText('src/finance/FinanceDashboardView.tsx');
const refinement = () => sourceText('src/styles/interface-refinement.css');

describe('current Finance dashboard contract', () => {
  it('keeps the six-month trend, donut composition and compact monthly insights', () => {
    const source = dashboard();
    expect(source).toContain('getSixMonthTrend');
    expect(source).toContain('FinanceMiniTrend');
    expect(source).toContain('Trend 6 miesięcy');
    expect(source).toContain('FinanceCategoryDonut');
    expect(source).toContain('finance-month-donut');
    expect(source).toContain('Miejsca zakupów');
    expect(source).toContain('Największe wydatki');
    expect(source).toContain('finance-month-necessity-inline');
  });

  it('uses the shared three-primary-categories-plus-remainder composition for Month and Trip', () => {
    const source = dashboard();
    expect(source).toContain('FINANCE_DONUT_PRIMARY_CATEGORY_LIMIT = 3');
    expect(source).toContain('categoryAnalytics.slice(0, FINANCE_DONUT_PRIMARY_CATEGORY_LIMIT)');
    expect(source).toContain('activeTripCategoryDonutEntries');
    expect(source).toContain('finance-month-category-tone-4" onClick={openCategoryOverview}');
    expect(source).toContain('finance-trip-category-tone-4');
    expect(source).not.toContain('finance-month-category-tone-5" onClick={openCategoryOverview}');
  });

  it('keeps Month and Trip KPI hierarchy aligned and merchant rankings actionable', () => {
    const source = dashboard();
    expect(source).toContain('finance-month-dashboard-v219');
    expect(source).toContain('finance-trip-dashboard-v219');
    expect(source).toContain('Największa kategoria');
    expect(source).toContain('Największy wydatek');
    expect(source).toContain('filterByMerchant(entry.key)');
    expect(source).toContain('filterActiveTripByMerchant');
    expect(source).toContain('activeTripMerchantFilterLabel');
    expect(source).toContain('GENERIC_FINANCE_MERCHANT_KEYS');
    expect(source).toContain('isMeaningfulReceiptMerchant');
  });

  it('shows one ranking at a time on phones without narrowing the dashboard', () => {
    const source = dashboard();
    const css = refinement();
    expect(source).toContain('finance-insight-tabs');
    expect(source).toContain("setMonthInsightTab('MERCHANTS')");
    expect(source).toContain("setMonthInsightTab('LARGEST')");
    expect(source).toContain("setTripInsightTab('MERCHANTS')");
    expect(source).toContain("setTripInsightTab('LARGEST')");
    expect(css).toContain('.finance-insight-group-v219.is-mobile-active');
    expect(css).toContain('.finance-month-dashboard-v219 .finance-month-metric-grid-v218');
    expect(css).toContain('.finance-trip-dashboard-v219 .finance-trip-metric-grid-v219');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;');
  });

  it('keeps donut slice and legend tones mapped consistently', () => {
    const css = refinement();
    expect(css).toContain('--finance-chart-tone-1');
    expect(css).toContain('.finance-dashboard-v2 .finance-month-donut-slice-1');
    expect(css).toContain('.finance-month-category-tone-1');
    expect(css).toContain('.finance-trip-category-tone-1');
    expect(css).toContain('background: var(--finance-category-tone');
  });

  it('keeps compact desktop and mobile legend geometry readable', () => {
    const css = refinement();
    expect(css).toContain('grid-template-columns: 9px 23px minmax(0, 1fr) minmax(96px, auto);');
    expect(css).toContain('grid-template-columns: 7px 18px minmax(0, 1fr) auto;');
    expect(css).toContain('width: 8px;\n  height: 8px;\n  border-radius: 50%;');
    expect(css).toContain('@media (max-width: 620px)');
  });

  it('keeps currency context truthful in Month, Trip and drilldowns', () => {
    const source = dashboard();
    expect(source).toContain('function receiptAmountForMonth');
    expect(source).toContain('primary: formatMoneyMinor(receipt.totalMinor)');
    expect(source).toContain('`oryginalnie ${original}`');
    expect(source).toContain('const activeTripUsesOriginalCurrency = activeTripOriginalTotalMinor !== null;');
    expect(source).toContain('function receiptAmountForTrip');
    expect(source).toContain('primary: formatCurrencyAmountMinor(receipt.originalAmountMinor, currency)');
    expect(source).toContain('secondary: `≈ ${formatMoneyMinor(receipt.totalMinor)}`');
    expect(source).toContain('Udział kategorii · kwoty w PLN');
    expect(source).toContain('Pozycje poniżej są pokazane po przeliczeniu w PLN.');
  });

  it('keeps amount hierarchy consistent in rankings, rows and transaction detail', () => {
    const source = dashboard();
    expect(source).toContain('activeTripLargestAmount?.primary');
    expect(source).toContain('finance-context-amount-v222');
    expect(source).toContain('detailContextAmount?.primary');
    expect(source).toContain('finance-transaction-detail-currency-note-v222');
  });

  it('keeps the Finance entry surface concise and category filters directly actionable', () => {
    const view = sourceText('src/finance/FinanceView.tsx');
    const source = dashboard();
    expect(view).toContain('<h1>Finanse</h1>');
    expect(view).not.toContain('Skanuj paragony i od razu widz');
    expect(source).toContain('onClick={() => filterByCategory(entry.categoryId)}');
    expect(source).toContain('aria-pressed={activeCategoryId === entry.categoryId}');
  });

  it('keeps monthly necessity filtering and review work close to the expense list', () => {
    const source = dashboard();
    expect(source).toContain("filterByNecessity('essential')");
    expect(source).toContain("filterByNecessity('nonessential')");
    expect(source).toContain('finance-expense-review-link');
    expect(source).toContain('Do poprawy <strong>{categoryReviewRows.length}</strong>');
  });

  it('keeps trip category cues and fast mobile expense entry', () => {
    const source = dashboard();
    const modal = sourceText('src/finance/FinanceQuickExpenseModal.tsx');
    const responsive = sourceText('src/styles/responsive.css');
    expect(source).toContain('finance-trip-expense-icon');
    expect(source).toContain('<ExpenseCategoryIcon category={category ?? { id: categoryId }} />');
    expect(modal).toContain('data-modal-autofocus="true"');
    expect(modal).toContain('inputMode="decimal"');
    expect(responsive).toContain('min-height: 46px');
  });

  it('keeps the trip dashboard hierarchy and scannable trip cards', () => {
    const source = dashboard();
    const responsive = sourceText('src/styles/responsive.css');
    expect(source).toContain('finance-trip-hero-total');
    expect(source).toContain('<strong>{activeTripName}</strong>');
    expect(source).toContain('finance-trip-metric-grid');
    expect(source).toContain('activeTripAverageMinor');
    expect(source).toContain('activeTripCategoryCount');
    expect(source).toContain('finance-trip-card-facts');
    expect(source).toContain('finance-trip-card-total');
    expect(responsive).toContain('.finance-trip-category-grid { grid-template-columns: 1fr; }');
  });

  it('keeps mobile expense lists clear of bottom navigation', () => {
    const css = refinement();
    expect(css).toContain('.finance-dashboard-v2 .finance-purchases-section,');
    expect(css).toContain('.finance-dashboard-v2 .finance-trip-expenses');
    expect(css).toContain('scroll-margin-bottom: calc(var(--mobile-bottom-nav-clearance) + 28px);');
  });
});
