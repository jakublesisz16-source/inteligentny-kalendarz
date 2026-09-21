import fs from 'node:fs';

const service = fs.readFileSync('src/work/work.service.ts', 'utf8');
const work = fs.readFileSync('src/work/WorkView.tsx', 'utf8');
const checks = [
  ['formatter exported', service.includes('export function formatPersonCount(count: number): string')],
  ['special 12-14 guard', service.includes('lastTwo >= 12 && lastTwo <= 14')],
  ['nearest team uses formatter', work.includes('formatPersonCount(nearestCoworkers.length)')],
  ['roster uses formatter', work.includes('formatPersonCount(coworkers.length)')],
  ['analysis uses formatter', work.includes('formatPersonCount(new Set(analysis.coworkers.map((item) => item.normalizedName)).size)')],
  ['old nearest ternary removed', !work.includes("nearestCoworkers.length === 1 ? 'osoba razem'")],
  ['old roster ternary removed', !work.includes("coworkers.length === 1 ? 'osoba na zmianie'")],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
if (failed.length) process.exit(1);
console.log(`PASS ${checks.length}/${checks.length}`);
