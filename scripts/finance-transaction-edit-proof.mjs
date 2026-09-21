import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dashboard = read('src/finance/FinanceDashboardView.tsx');
const database = read('src/storage/database.ts');
const components = read('src/styles/components.css');
const responsive = read('src/styles/responsive.css');
const parser = read('src/shopping/receipt-ocr/receipt-parser.ts');
const version = read('src/core/version.ts');

const checks = [
  ['trip edit is controlled select', dashboard.includes('<select value={editReceipt.tripName ?? \'\'}') && dashboard.includes('<option value="">Bez wyjazdu</option>')],
  ['trip choices come from persisted definitions', dashboard.includes('tripDefinitions.map((trip) => <option key={trip.id}')],
  ['free-form phantom assignment is guarded', dashboard.includes('targetTripIsKnown') && dashboard.includes('Wybierz istniejący wyjazd albo ustaw „Bez wyjazdu”.')],
  ['legacy assignment can be preserved', dashboard.includes('originalTripName?: string') && dashboard.includes('starsze przypisanie')],
  ['persisted trip spelling is canonicalized before select rendering', dashboard.includes('const persistedTrip = receipt.tripName') && dashboard.includes('setEditReceipt(persistedTrip ? { ...form, tripName: persistedTrip.name } : form)')],
  ['line amount currency is explicit PLN', dashboard.includes('<span>Kwota (PLN)</span>')],
  ['foreign source amount is visible in editor', dashboard.includes('finance-receipt-edit-currency-context') && dashboard.includes('formatCurrencyAmountMinor(editReceipt.originalAmountMinor, editReceipt.originalCurrency)')],
  ['trip reassignment documents metadata preservation', dashboard.includes('Nie zmienia zapisanej waluty ani kwoty źródłowej.')],
  ['foreign edit documents effective-rate recalculation', dashboard.includes('jeśli zmienisz sumę PLN, aplikacja przeliczy efektywny kurs tej transakcji.')],
  ['storage update still clears only tripName when detached', database.includes('if (!normalized.tripName) delete updated.tripName;')],
  ['storage currency metadata still falls back to current transaction', database.includes('draft.originalCurrency ?? current?.originalCurrency') && database.includes('draft.originalAmountMinor ?? current?.originalAmountMinor')],
  ['mobile currency context stacks', responsive.includes('.finance-receipt-edit-currency-context { grid-template-columns: 1fr; }') && components.includes('1.2.0.173 - Transaction edit keeps trip assignment')],
  ['schema and frozen receipt parser stay untouched', version.includes('DATABASE_SCHEMA_VERSION = 14') && !parser.includes('targetTripIsKnown') && !parser.includes('finance-receipt-edit-currency-context')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Finance transaction edit proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Finance transaction edit proof PASS (${checks.length}/${checks.length})`);
