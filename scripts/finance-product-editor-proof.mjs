import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dashboard = read('src/finance/FinanceDashboardView.tsx');
const components = read('src/styles/components.css');
const responsive = read('src/styles/responsive.css');
const parser = read('src/shopping/receipt-ocr/receipt-parser.ts');

const checks = [
  ['live classification preview', dashboard.includes('finance-product-classification-preview') && dashboard.includes('editedProductCategoryPath') && dashboard.includes('editedProductNecessity')],
  ['unknown necessity remains explicit', dashboard.includes("editProduct.necessity === 'unknown' ? ' is-assessment' : ''") && dashboard.includes('Wymaga decyzji')],
  ['canonical cross-view copy', dashboard.includes('Używane w Miesiącu, Wyjeździe i eksporcie')],
  ['canonical name gets full row', dashboard.includes('field finance-product-editor-name') && components.includes('.finance-product-editor-name { grid-column: 1 / -1; }')],
  ['price history wording', dashboard.includes('Historia ceny jednostkowej')],
  ['history defaults to six', dashboard.includes('productHistoryExpanded ? 20 : 6')],
  ['history expansion control', dashboard.includes('finance-product-history-toggle') && dashboard.includes('Pokaż całą historię') && dashboard.includes('Pokaż mniej')],
  ['history control touch target', responsive.includes('.finance-product-history-toggle { min-height: 44px; }')],
  ['editor controls touch target', responsive.includes('.finance-product-editor-fields input { min-height: 42px; }')],
  ['mobile classification stack', responsive.includes('.finance-product-classification-preview { grid-template-columns: 1fr; padding: 8px; }')],
  ['390 history heading stack', responsive.includes('.finance-product-history-heading { display: grid; grid-template-columns: 1fr; gap: 3px; }')],
  ['Receipt Scanner parser remains outside product UX', !parser.includes('finance-product-classification-preview') && !parser.includes('productHistoryExpanded')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Finance product editor source proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Finance product editor source proof PASS (${checks.length}/${checks.length})`);
