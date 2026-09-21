import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const styles = read('src/styles/interface-consistency.css');
const version = read('src/core/version.ts');

const checks = [
  ['Full selected-day coworker list remains requested', calendar.includes('showAllWorkCoworkers compactTimeRange')],
  ['Build181 coworker separation marker is present', styles.includes('/* 1.2.0.181 - selected-day coworkers stay fully visible but get only a hairline separation for scanability. */')],
  ['Coworker rows get only small internal padding', styles.includes('padding: 2px 1px 3px;')],
  ['Only consecutive rows receive a separator', styles.includes('.event-coworker-line + .event-coworker-line {')],
  ['Separator is a one-pixel hairline', styles.includes('border-top: 1px solid color-mix(in srgb, var(--line) 26%, transparent);')],
  ['No coworker chip/card background was introduced', !styles.includes('.calendar-view-shell .selected-day-panel .event-coworker-line { background:')],
  ['Build180 hard event rail stays disabled', styles.includes('.calendar-view-shell .selected-day-panel .event-card::before { display: none; }')],
  ['Build180 soft Work gradient remains', styles.includes('.calendar-view-shell .selected-day-panel .event-card.category-work { background: linear-gradient(135deg')],
  ['Full Add event action remains visible', calendar.includes('>Dodaj wydarzenie</button>')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Calendar coworker separation proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Calendar coworker separation proof PASS (${checks.length}/${checks.length})`);
