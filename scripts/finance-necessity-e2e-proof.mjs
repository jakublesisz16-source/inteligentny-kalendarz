import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const database = read('src/storage/database.ts');
const dashboard = read('src/finance/FinanceDashboardView.tsx');
const utils = read('src/shopping/expenses.utils.ts');
const excel = read('src/data-transfer/excel-export.ts');
const test = read('src/tests/finance-necessity-e2e-build167.test.ts');
const receiptParser = read('src/shopping/receipt-ocr/receipt-parser.ts');

const checks = [
  ['canonical resolver reads product necessity', utils.includes("necessity: product?.necessity ?? 'unknown'")],
  ['product update persists explicit necessity', database.includes('necessity: draft.necessity ?? current.necessity ?? inferExpenseNecessity(name)')],
  ['refresh sync preserves an existing necessity', database.includes('const necessity = product.necessity ?? inferExpenseNecessity(product.name || product.originalName);')],
  ['inline assessment writes through updateExpenseProduct', dashboard.includes('async function changeProductNecessity(product: ExpenseProduct, necessity: ExpenseNecessity)') && dashboard.includes('necessity,\n      });')],
  ['month item rows use the canonical resolver', dashboard.includes('const classification = resolveExpenseItemClassification(item, productByKey);') && dashboard.includes('necessity: classification.necessity,')],
  ['transaction detail uses the same resolver and label', dashboard.includes('expenseCategoryPath(categories, classification.categoryId)} · {expenseNecessityLabel(classification.necessity)}')],
  ['export uses the same resolver and necessity label', excel.includes('const classification = resolveExpenseItemClassification(item, productByKey);') && excel.includes('expenseNecessityLabel(classification.necessity)')],
  ['reload proof resets only the DB connection', test.includes('resetDatabaseConnectionForTests();') && test.includes('syncExpenseProductsFromReceipts();')],
  ['test covers month and trip receipts', test.includes("tripName: 'Budapeszt'") && test.includes("merchant: 'Sklep miesiąc'")],
  ['test covers both explicit decisions', test.includes("setAndReloadNecessity(created!.id, 'essential')") && test.includes("setAndReloadNecessity(created!.id, 'nonessential')")],
  ['test verifies XLSX labels', test.includes("['Niezbędne', 'Niezbędne']") && test.includes("['Zbędne', 'Zbędne']")],
  ['necessity remains outside Receipt Scanner parser', !receiptParser.includes('ExpenseNecessity') && !receiptParser.includes('inferExpenseNecessity')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Finance necessity E2E source proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Finance necessity E2E source proof PASS (${checks.length}/${checks.length})`);
