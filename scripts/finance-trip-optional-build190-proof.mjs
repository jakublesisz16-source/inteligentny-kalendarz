import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');
const checks = [
  ['ReceiptEditForm keeps tripName optional without widening it to explicit undefined', dashboard.includes('tripName?: string;') && !dashboard.includes('tripName?: string | undefined;')],
  ['trip select remains controlled with empty value for no trip', dashboard.includes("<select value={editReceipt.tripName ?? ''}") && dashboard.includes('<option value="">Bez wyjazdu</option>')],
  ['selected trip writes a concrete string', dashboard.includes('if (nextTripName) return { ...current, tripName: nextTripName };')],
  ['detaching a trip removes the optional property instead of assigning undefined', dashboard.includes('const next = { ...current };') && dashboard.includes('delete next.tripName;')],
  ['old exactOptionalPropertyTypes regression is absent', !dashboard.includes('tripName: event.target.value || undefined')],
  ['save path still persists tripName only when non-empty', dashboard.includes('...(targetTripName ? { tripName: targetTripName } : {})')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
if (failed.length) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length}`);
