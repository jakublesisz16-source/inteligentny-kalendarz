import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const finance = read('src/finance/FinanceDashboardView.tsx');
const responsive = read('src/styles/responsive.css');
const consistency = read('src/styles/interface-consistency.css');
const version = read('src/core/version.ts');

const categoryHeadingStart = finance.indexOf('className="finance-month-category-heading"');
const categoryGridStart = finance.indexOf('className="finance-month-category-grid"', categoryHeadingStart);
const categoryHeading = finance.slice(categoryHeadingStart, categoryGridStart);

const checks = [
  ['Month keeps manual expense as a primary action', finance.includes('finance-manual-expense') && finance.includes('+ Wydatek')],
  ['Receipt scan remains a primary action', finance.includes('finance-scan-receipt') && finance.includes('finance-scan-receipt-long')],
  ['Phone override restores receipt scan instead of hiding it', responsive.includes('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt {') && responsive.includes('display: inline-flex;')],
  ['Phone actions are two equal columns when both are present', responsive.includes('grid-template-columns: repeat(2, minmax(0, 1fr));')],
  ['Receipt scan copy shortens on narrow phones without changing accessible function', responsive.includes('.finance-scan-receipt-long { display: none; }')],
  ['Build177 month summary marker exists', finance.includes('finance-month-dashboard-v177')],
  ['Mobile month summary reduces metric height without shrinking below touchable compact controls', responsive.includes('.finance-month-dashboard-v177 .finance-month-metric-grid button') && responsive.includes('min-height: 46px;')],
  ['Mobile category preview is capped at two rows', responsive.includes('.finance-month-dashboard-v177 .finance-month-category-grid > .finance-month-category-row:nth-child(n+3)') && responsive.includes('display: none;')],
  ['Full category overview remains reachable', finance.includes('>Wszystkie</button>') && finance.includes('onClick={openCategoryOverview}')],
  ['Category subsection no longer repeats current month', categoryHeading.includes('>Kategorie</strong>') && !categoryHeading.includes('formatMonthLabel(monthKey)')],
  ['Default transaction heading does not surface item-review controls', finance.includes("expenseListMode === 'ITEMS' && categoryReviewRows.length") && finance.includes("expenseListMode === 'ITEMS' && necessityReviewRows.length")],
  ['Transaction/item switch remains available', finance.includes('aria-label="Sposób wyświetlania wydatków"') && finance.includes('Transakcje') && finance.includes('Pozycje')],
  ['Build177 CSS contract is present', consistency.includes('1.2.0.177 - Finance keeps the default surface transaction-first and decision-light.') && responsive.includes('1.2.0.177 - Finance mobile')],
  ['Database schema stays 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Finance UI minimal proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Finance UI minimal proof PASS (${checks.length}/${checks.length})`);
