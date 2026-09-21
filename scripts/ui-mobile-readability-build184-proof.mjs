import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const app = read('src/app/App.tsx');
const finance = read('src/finance/FinanceDashboardView.tsx');
const styles = read('src/styles/interface-consistency.css');
const version = read('src/core/version.ts');

const checks = [
  ['Build184 Finance readability marker is present', styles.includes('/* 1.2.0.184 - Finance gets clearer phone spacing and typography. */')],
  ['Build186 rollback does not reintroduce runtime nav lift CSS', !styles.includes('--mobile-nav-viewport-lift')],
  ['Primary navigation resets the newly selected view to the top', app.includes('function changeView(nextView: AppView)') && app.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })") && app.includes('<Navigation activeView={view} onChange={changeView} />')],
  ['Finance surface changes also reset to the top', finance.includes('function scrollFinanceTop()') && finance.includes("setFinanceScope('MONTH'); setActiveTripName(''); setActiveTripCategoryId(''); scrollFinanceTop();") && finance.includes('setTripCurrencyEdit(null);\n    scrollFinanceTop();')],
  ['Scanner label uses explicit short and long spans', finance.includes('finance-scan-receipt-short') && finance.includes('finance-scan-receipt-long') && !finance.includes('Skanuj<span className="finance-scan-receipt-long"> paragon</span>')],
  ['Phone scanner shows the short label only', styles.includes('.finance-scan-receipt-short { display: inline; }') && styles.includes('.finance-scan-receipt-long { display: none; }')],
  ['Month and Trip metrics share a two-column phone grid', styles.includes('.finance-month-dashboard-v177 .finance-month-metric-grid,') && styles.includes('.finance-trip-dashboard-v148 .finance-trip-metric-grid') && styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr));')],
  ['Phone metric cells have consistent row/column separators', styles.includes('> button:nth-child(even)') && styles.includes('> :nth-child(even)') && styles.includes('> button:nth-child(n+3)') && styles.includes('> :nth-child(n+3)')],
  ['Expense descriptions can use two lines instead of hard truncation', styles.includes('-webkit-line-clamp: 2;') && styles.includes('white-space: normal;')],
  ['Narrow phone expense rows preserve content space', styles.includes('grid-template-columns: 42px 26px minmax(0, 1fr) auto 9px;')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build184 mobile readability proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build184 mobile readability proof PASS (${checks.length}/${checks.length})`);
