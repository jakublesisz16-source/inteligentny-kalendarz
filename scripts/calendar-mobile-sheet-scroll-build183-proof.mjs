import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const responsive = read('src/styles/responsive.css');
const version = read('src/core/version.ts');

const checks = [
  ['Mobile day sheet still uses explicit open state', calendar.includes("const [mobileDayPanelOpen, setMobileDayPanelOpen] = useState(false)")],
  ['Opening sheet installs a dedicated body lock', calendar.includes("body.classList.add('calendar-day-sheet-open')")],
  ['Body lock freezes the current document position', calendar.includes("body.style.position = 'fixed'") && calendar.includes("body.style.top = `-${scrollY}px`")],
  ['Body lock also disables overflow', calendar.includes("body.style.overflow = 'hidden'")],
  ['Closing sheet restores the body class and styles', calendar.includes("body.classList.remove('calendar-day-sheet-open')") && calendar.includes('body.style.position = previous.position')],
  ['Closing sheet restores the original scroll position', calendar.includes('window.scrollTo(0, scrollY)')],
  ['Build183 responsive marker is present', responsive.includes('/* 1.2.0.183 - mobile selected-day sheet owns scrolling; background and nested coworker scroll stay locked. */')],
  ['Backdrop cannot scroll the background', responsive.includes('.calendar-mobile-day-backdrop {\n    touch-action: none;\n    overscroll-behavior: none;')],
  ['Sheet gets more usable height before scrolling', responsive.includes('max-height: min(72dvh, 640px);')],
  ['Sheet remains the single overflow container when needed', responsive.includes('overflow-y: auto;') && responsive.includes('overscroll-behavior-y: contain;')],
  ['Coworker list loses nested max-height on the mobile sheet', responsive.includes('.selected-day-panel.mobile-open .event-coworkers > span {\n    max-height: none;')],
  ['Coworker list loses nested overflow on the mobile sheet', responsive.includes('max-height: none;\n    overflow: visible;')],
  ['Full coworker rendering remains enabled', calendar.includes('showAllWorkCoworkers compactTimeRange')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build183 mobile sheet scroll proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build183 mobile sheet scroll proof PASS (${checks.length}/${checks.length})`);
