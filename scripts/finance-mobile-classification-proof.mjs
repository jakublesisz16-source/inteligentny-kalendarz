import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const components = readFileSync(new URL('../src/styles/components.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../src/styles/responsive.css', import.meta.url), 'utf8');

const checks = [
  ['assessment link', dashboard.includes('finance-expense-assessment-link')],
  ['separate filter state', dashboard.includes("function filterByNecessity(necessity: ExpenseNecessity | '') {") && dashboard.includes('setReviewOnly(false);') && dashboard.includes("setActiveCategoryId(\'\');")],
  ['category row state', dashboard.includes("row.categoryNeedsReview ? 'is-category-review-row' : ''")],
  ['necessity row state', dashboard.includes("row.necessityNeedsReview ? 'is-necessity-review-row' : ''")],
  ['assessment select state', dashboard.includes("row.necessityNeedsReview ? ' is-assessment' : ''")],
  ['assessment filter state', dashboard.includes("activeNecessity === 'unknown' ? 'is-active is-assessment' : 'is-assessment'")],
  ['distinct category row css', components.includes('.finance-purchase-table tbody tr.is-category-review-row')],
  ['distinct necessity row css', components.includes('.finance-purchase-table tbody tr.is-necessity-review-row:not(.is-category-review-row)')],
  ['assessment select css', components.includes('.finance-necessity-select.is-assessment')],
  ['mobile build marker', responsive.includes('1.2.0.166 - Finance mobile assessment workflow and touch targets.')],
  ['40px core targets', responsive.includes('.finance-necessity-select { min-height: 40px; }')],
  ['40px detail target', responsive.includes('.finance-purchase-details-column .icon-button { width: 40px; height: 40px; min-width: 40px; }')],
  ['390 heading wrap', responsive.includes('.finance-expense-heading-tools { width: 100%; margin-left: 0; justify-content: flex-start; }')],
  ['product editor mobile affordance', responsive.includes(".finance-purchase-product-button::after { content: '›';") && dashboard.includes('aria-label={`Otwórz produkt: ${formatExpenseProductDisplayName(row.canonicalName)}`')],
  ['product editor stack', responsive.includes('.finance-product-editor-fields { grid-template-columns: 1fr; }')],
  ['product stats phone stack', responsive.includes('.finance-product-stats { grid-template-columns: 1fr; }')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
