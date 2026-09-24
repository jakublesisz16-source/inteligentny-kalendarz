import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const coworkers = read('src/work/CoworkerOverlapList.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const summary = read('src/work/WorkSummaryView.tsx');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');

const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Today header owns the single add action', today.includes('today-header-add') && today.includes('>+ Dodaj</button>'));
check('Today uses agenda rather than obsolete plan-only panel gating', today.includes("hasAgenda ? ' today-plan-panel today-single-surface' : ' today-empty-panel'"));
check('Today future preview contract is current', today.includes('today-next-strip today-future-preview') && today.includes('today-tomorrow'));
check('Mobile week fits the full timeline to narrow phones', calendar.includes('if (window.innerWidth <= 620) {') && calendar.includes('WEEK_MOBILE_VERTICAL_CHROME') && calendar.includes('Math.max(26, Math.min(32'));
check('Tablet/narrow mobile week remains bounded', calendar.includes('if (window.innerWidth <= 820) return 40;'));
check('Compact coworker rows avoid duplicate shared times', coworkers.includes('sameAsShared') && coworkers.includes('coworker-compact-time') && coworkers.includes('· razem'));
check('Availability uses current natural action wording', availability.includes("dayBlocks.length ? 'Dodaj' : 'Ustaw'"));
check('Work summary uses compact rhythm contract', summary.includes('work-summary-rhythm-inline') && summary.includes('dni z rzędu'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build211-or-newer metadata is synchronized', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 211 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build211 release contract sync proof PASS ${checks.length}/${checks.length}`);
