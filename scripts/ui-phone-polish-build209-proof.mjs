import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const finance = read('src/finance/FinanceDashboardView.tsx');
const work = read('src/work/WorkView.tsx');
const coworkers = read('src/work/CoworkerOverlapList.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');

const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Mobile week density is viewport-aware', calendar.includes('WEEK_MOBILE_VERTICAL_CHROME') && calendar.includes('window.innerWidth <= 620') && calendar.includes('Math.max(26, Math.min(32'));
check('Mobile week no longer auto-scrolls when the full timeline fits', calendar.includes('if (weekHourHeight <= 32)') && calendar.includes('container.scrollTop = 0'));
check('Mobile week time axis exposes hour metadata', calendar.includes('data-hour={WEEK_START_HOUR + index}'));
check('Mobile week suppresses internal vertical scrolling', css.includes('Calendar week: the whole 06:00-23:00 range fits in one phone viewport') && css.includes('overflow-y: hidden'));
check('Finance drops non-comparable month comparison noise', finance.includes("{comparison.state === 'comparable' ? <small") && !finance.includes(': comparisonText.detail}\n                </small>'));
check('Finance trip keeps rare currency edit in a compact action', finance.includes('finance-trip-currency-compact') && css.includes('.finance-trip-currency-compact { display: none; }'));
check('Finance mobile trip metrics are removed from first surface', css.includes('.finance-trip-dashboard-v148 .finance-trip-metric-grid') && css.includes('display: none;'));
check('Work person count label is shorter', (work.includes('<summary>{formatPersonCount(coworkers.length)}</summary>') || work.includes('work-shift-team-count')) && !work.includes('{formatPersonCount(coworkers.length)} na zmianie'));
check('Work teammate compact rows use one time line', coworkers.includes('coworker-compact-time') && coworkers.includes('· razem'));
check('Work phone roster hides derived duration', css.includes('.work-roster-direct .work-shift-main-line small { display: none; }'));
check('Older cached roster heading is guarded out', css.includes('.work-roster-direct .work-roster-minimal-heading { display: none !important; }'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build209 metadata is synchronized', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 209 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build209 real-phone polish proof PASS ${checks.length}/${checks.length}`);
