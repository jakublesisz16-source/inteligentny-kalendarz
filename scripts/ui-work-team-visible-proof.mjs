import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const work = read('src/work/WorkView.tsx');
const consistency = read('src/styles/interface-consistency.css');
const responsive = read('src/styles/responsive.css');
const version = read('src/core/version.ts');

const checks = [
  ['Nearest/current Work shift keeps the complete coworker map', work.includes('nearestCoworkers.map((person)') && !work.includes('nearestCoworkers.slice(')],
  ['Nearest/current team is not hidden behind details/summary', work.includes('className="work-next-team-static"') && !work.includes('<details className="work-next-team-details"')],
  ['Team count remains visible above the names', work.includes('className="work-next-team-count"') && work.includes('formatPersonCount(nearestCoworkers.length)')],
  ['Persistent team occupies its own compact row', consistency.includes('.work-next-team-static {') && consistency.includes('grid-column: 1 / -1;') && consistency.includes('gap: 6px;')],
  ['Coworker chips remain left-aligned and wrap naturally', consistency.includes('.work-next-team-static > .coworker-inline {') && consistency.includes('justify-content: flex-start;')],
  ['Phone keeps the complete nearest/current team visible', responsive.includes('.work-next-team-static { justify-self: stretch; width: 100%; }') && responsive.includes('.work-next-team-static > .coworker-inline { justify-content: flex-start; }')],
  ['Phone preserves a compact team count target', responsive.includes('.work-next-team-count { min-height: 34px; }')],
  ['Individual schedule rows can still keep their own details control', work.includes('className="work-shift-team-details"')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build179 Work-team proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build179 Work-team proof PASS (${checks.length}/${checks.length})`);
