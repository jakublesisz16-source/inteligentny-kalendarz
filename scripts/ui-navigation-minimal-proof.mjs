import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const today = read('src/calendar/TodayView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const navigation = read('src/ui/Navigation.tsx');
const styles = read('src/styles/interface-consistency.css');
const visualQa = read('scripts/visual-qa-capture.mjs');
const version = read('src/core/version.ts');

const checks = [
  ['Today uses one next-event cue', today.includes('today-next-strip') && today.includes('aria-label="Następne wydarzenie"')],
  ['Old two-card Today glance is gone', !today.includes('today-glance-grid') && !today.includes('Najbliższe zajęcia') && !today.includes('Najbliższa praca')],
  ['Today header no longer repeats the active tab label', today.includes('today-header-minimal') && !today.includes('<p className="eyebrow">Dzisiaj</p>')],
  ['Today next cue can distinguish an event already in progress', today.includes('Teraz · do ${formatTime(event.endDateTime, timeFormat)}')],
  ['Calendar keeps desktop filters but provides one compact mobile filter select', calendar.includes('calendar-filter-desktop') && calendar.includes('calendar-filter-select') && calendar.includes('value={filter}')],
  ['Calendar mobile filter writes to the same filter state', calendar.includes("onChange={(event) => setFilter(event.target.value as CalendarFilter)}")],
  ['Calendar mobile surface drops the redundant outer panel chrome', styles.includes('.calendar-view-shell .calendar-panel {') && styles.includes('background: transparent;') && styles.includes('box-shadow: none;')],
  ['Advanced multi-day action is removed from the phone primary surface', styles.includes('.calendar-view-shell .calendar-toolbar-modern .calendar-multi-day-trigger { display: none; }')],
  ['Mobile navigation keeps all six destinations but shortens only low-information labels', navigation.includes("short: 'Dziś'") && navigation.includes("short: 'Opcje'")],
  ['Navigation buttons expose stable product-level view ids', (navigation.match(/data-view=\{item\.id\}/g) ?? []).length === 2],
  ['Mobile navigation retains full accessible labels', navigation.includes('aria-label={item.label}')],
  ['Visual QA navigates by the accessible label instead of rendered short copy', visualQa.includes("item.getAttribute('aria-label') ===")],
  ['Old Today glance CSS is removed', !styles.includes('.today-glance-grid') && styles.includes('.today-next-strip')],
  ['Schema stays 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`UI/navigation minimal proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`UI/navigation minimal proof PASS (${checks.length}/${checks.length})`);
