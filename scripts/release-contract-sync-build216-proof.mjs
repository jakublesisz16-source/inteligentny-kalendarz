import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const finance = read('src/finance/FinanceDashboardView.tsx');
const core = read('src/tests/finance-core-flow-1229.test.ts');
const dashboard = read('src/tests/finance-dashboard-1222.test.ts');
const hierarchy = read('src/tests/finance-hierarchy-polish-1279.test.ts');
const month = read('src/tests/finance-month-transactions-1278.test.ts');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');

const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Finance keeps compact Build214 search copy', finance.includes('placeholder="Szukaj pozycji"'));
check('legacy Finance core-flow contract follows compact search copy', core.includes('placeholder="Szukaj pozycji"'));
check('legacy Finance dashboard contract follows compact search copy', dashboard.includes('placeholder="Szukaj pozycji"'));
check('legacy Finance hierarchy contract follows compact search copy', hierarchy.includes('placeholder="Szukaj pozycji"'));
check('transaction-first contract targets current ITEMS control', month.includes("aria-pressed={expenseListMode === 'ITEMS'}") && month.includes("onClick={() => setExpenseListMode('ITEMS')}") && month.includes('finance-items-review-badge'));
check('old long mobile search copy is no longer asserted', !core.includes('Szukaj nazwy, miejsca lub kategorii') && !dashboard.includes('Szukaj nazwy, miejsca lub kategorii') && !hierarchy.includes('Szukaj nazwy, miejsca lub kategorii'));
check('old exact Pozycje closing-tag assertion is removed', !month.includes("toContain('>Pozycje</button>')"));
const vm = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const bm = build.match(/APP_BUILD = '(\d+)'/);
check('Build216 metadata synchronized', Boolean(vm && bm && vm[1] === '1.2.0.216' && bm[1] === '216' && sw.includes('v1.2.0.216')));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));
check('product Finance source is not reverted to old copy', !finance.includes('Szukaj nazwy, miejsca lub kategorii'));

console.log(`Build216 release contract sync proof PASS ${checks.length}/${checks.length}`);
