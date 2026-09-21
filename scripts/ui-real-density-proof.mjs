import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const today = read('src/calendar/TodayView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const work = read('src/work/WorkView.tsx');
const styles = read('src/styles/interface-consistency.css');
const study = read('src/study/StudyView.tsx');
const settings = read('src/settings/SettingsView.tsx');
const version = read('src/core/version.ts');

const checks = [
  ['Today empty state still exposes one direct add action', today.includes('title="Wolny dzień"') && today.includes('actionLabel="+ Dodaj"')],
  ['Today empty surface drops redundant panel chrome', styles.includes('.today-view.is-empty .today-empty-panel {') && styles.includes('border: 0;') && styles.includes('background: transparent;')],
  ['Today empty state is a compact inline grid', styles.includes('grid-template-columns: 42px minmax(0, 1fr) auto;') && styles.includes('min-height: 88px;')],
  ['Today mobile empty state remains compact', styles.includes('grid-template-columns: 36px minmax(0, 1fr) auto;') && styles.includes('min-height: 76px;')],
  ['Calendar empty day removes redundant sentence', calendar.includes('<EmptyState title="Brak wydarzeń" description="" actionLabel="+ Dodaj"')],
  ['Calendar empty day hides decorative orbit and nested-card chrome', styles.includes('.calendar-side-column.is-empty .selected-day-panel .empty-orbit { display: none; }') && styles.includes('background: transparent;')],
  ['Calendar empty content is compact instead of fixed-height dashboard', styles.includes('.calendar-side-column.is-empty .selected-day-panel .empty-state {') && styles.includes('min-height: 54px;')],
  ['Calendar eventful selected-day rendering remains present', calendar.includes('selectedEvents.map((event)') && calendar.includes('compact-event-list')],
  ['Work next shift keeps one primary summary strip', work.includes('className="work-next-strip"') && work.includes('aria-label="Najbliższa zmiana"')],
  ['Work next strip drops card chrome in favor of one divider', styles.includes('.work-next-strip {') && styles.includes('border-bottom: 1px solid var(--line);') && styles.includes('border-radius: 0;')],
  ['Work team detail stays on a second row instead of stretching the summary strip', styles.includes('.work-next-team-static {') && styles.includes('grid-column: 1 / -1;') && styles.includes('justify-content: flex-start;')],
  ['Study remains on the visible-group Build175 surface', study.includes('className="study-groups-primary"')],
  ['Settings remain on the compact essentials-first surface', settings.includes('className="settings-core"') && settings.includes('settings-collapsible-section')],
  ['Schema stays 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`UI real-density proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`UI real-density proof PASS (${checks.length}/${checks.length})`);
