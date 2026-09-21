import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dashboard = read('src/finance/FinanceDashboardView.tsx');
const components = read('src/styles/components.css');
const responsive = read('src/styles/responsive.css');
const parser = read('src/shopping/receipt-ocr/receipt-parser.ts');

const checks = [
  ['transaction-first default preserved', dashboard.includes("const [activeTripCategoryId, setActiveTripCategoryId] = useState('')") && dashboard.includes("activeTripCategoryId ? 'Pozycje' : 'Wydatki'")],
  ['ranked category is an explicit control', dashboard.includes('filterActiveTripByCategory(entry.categoryId)') && dashboard.includes('aria-pressed={activeTripCategoryId === entry.categoryId}')],
  ['descendant categories included', dashboard.includes('expenseCategoryDescendantIds(categories, activeTripCategoryId)')],
  ['effective classification reused', dashboard.includes('resolveExpenseItemClassification(item, productByKey)') && dashboard.includes('activeTripItemRows')],
  ['filtered items are trip-local', dashboard.includes('activeTripReceipts.flatMap((receipt) => receipt.items.map((item) => {') && dashboard.includes('activeTripFilteredItemRows')],
  ['drill-down item opens transaction detail', dashboard.includes('onClick={() => setDetailReceipt(row.receipt)}')],
  ['existing edit path remains available', dashboard.includes('onClick={() => openReceiptEditor(detailReceipt)}>Edytuj</button>')],
  ['clear action restores transactions', dashboard.includes('finance-trip-drilldown-reset') && dashboard.includes('Wszystkie transakcje')],
  ['filter resets with trip context', (dashboard.match(/setActiveTripCategoryId\(''\)/g) ?? []).length >= 4],
  ['interactive category focus style', components.includes('.finance-trip-category-row:focus-visible')],
  ['mobile reset target', responsive.includes('.finance-trip-drilldown-reset { min-height: 40px; }')],
  ['receipt parser remains untouched by drill-down', !parser.includes('activeTripCategoryId') && !parser.includes('finance-trip-drilldown-v172')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Finance trip drill-down proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Finance trip drill-down proof PASS (${checks.length}/${checks.length})`);
