import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const work = read('src/work/WorkView.tsx');
const coworkers = read('src/work/CoworkerOverlapList.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const summary = read('src/work/WorkSummaryView.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, condition) => { if (!condition) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Today next cue is one compact natural line', today.includes('today-next-when') && today.includes('Następne'));
check('Today main plan precedes tomorrow glance', today.indexOf('today-plan-panel') < today.lastIndexOf('today-tomorrow'));
check('Today still exposes every work coworker', today.includes('showAllWorkCoworkers'));
check('Today coworker layout uses desktop width instead of seven vertical rows', css.includes('.today-view .event-coworkers > span') && css.includes('repeat(2, minmax(0, 1fr))'));
check('Work nearest-shift label is concise', work.includes('<span>Najbliższa</span>'));
check('Expanded Work coworker details remain complete and use a two-column desktop grid', coworkers.includes('aria-label={`Razem z Tobą') && css.includes('.work-shift-team-details .coworker-overlap-list.compact') && css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
check('Availability uses one short per-day action', availability.includes('availability-day-action') && availability.includes("dayBlocks.length ? '+ zakres' : 'Ustaw'"));
check('Unconfigured automation has one concise setup action', availability.includes('availability-config-note-compact') && !availability.includes('Automat nie jest jeszcze skonfigurowany') && !availability.includes('Ustawienia automatu</button>'));
check('Availability removes artificial fixed-hours suffix', !availability.includes('stałe</span>'));
check('Work summary keeps useful sections with shorter headings', summary.includes('<h3>Godziny w tygodniach</h3>') && summary.includes('<h3>Ostatnie miesiące</h3>') && summary.includes('work-summary-rhythm-inline') && summary.includes('<h3>Dyspozycyjność</h3>'));
check('Work summary removes passive source explanation', !summary.includes('Na podstawie aktualnie zapisanych potwierdzonych zmian'));
check('Work summary is physically shorter on desktop', css.includes('.work-month-bar-track { height: 58px;') && css.includes('.work-rhythm-stats {\n  grid-template-columns: repeat(3'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build202 contract remains valid on current synchronized metadata', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 202 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build202 compact Work/Today proof PASS ${checks.length}/${checks.length}`);
