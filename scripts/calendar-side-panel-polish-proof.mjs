import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const styles = read('src/styles/interface-consistency.css');
const responsive = read('src/styles/responsive.css');
const version = read('src/core/version.ts');

const checks = [
  ['Selected-day panel keeps the full Add event action', calendar.includes('>Dodaj wydarzenie</button>')],
  ['Selected-day Work event keeps full coworkers visible', calendar.includes('showAllWorkCoworkers compactTimeRange')],
  ['Build180 visual marker is present', styles.includes('/* 1.2.0.180 - selected-day panel: no hard accent rail, softer category glow and calmer Study spacing. */')],
  ['Selected-day event rail is disabled', styles.includes('.calendar-view-shell .selected-day-panel .event-card::before { display: none; }')],
  ['Work category uses a subtle 135deg gradient', styles.includes('.event-card.category-work { background: linear-gradient(135deg')],
  ['Selected-day event card retains only a subtle inset boundary', styles.includes('box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line) 18%, transparent);')],
  ['Study context gains breathing room above', styles.includes('margin: 3px 0 15px;')],
  ['Study context gains breathing room below', styles.includes('padding: 2px 0 12px;')],
  ['Study context internal gap is larger', styles.includes('gap: 9px;')],
  ['Study divider is lighter rather than removed', styles.includes('border-bottom: 1px solid color-mix(in srgb, var(--line) 52%, transparent);')],
  ['Mobile Study spacing is preserved', responsive.includes('margin-top: 2px; margin-bottom: 13px; padding-bottom: 11px;')],
  ['Mobile sheet Study spacing is preserved', responsive.includes('margin-top: 3px;') && responsive.includes('margin-bottom: 13px;')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Calendar side-panel polish proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Calendar side-panel polish proof PASS (${checks.length}/${checks.length})`);
