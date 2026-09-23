import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const workList = read('src/work/CoworkerOverlapList.tsx');
const finance = read('src/finance/FinanceDashboardView.tsx');
const css = read('src/styles/interface-refinement.css');
const mobileWeekTest = read('src/tests/calendar-mobile-week-1245.test.ts');
const releaseSafety = read('scripts/release-safety-gate.mjs');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Today keeps the accepted compact content model', today.includes('today-single-surface') && today.includes('today-future-preview') && today.includes('compactCoworkerLabel'));
check('Today uses quiet tiles instead of one long mobile sheet', css.includes('Today: a few quiet tiles') && css.includes('border-radius: 14px') && css.includes('.today-view .today-future-preview'));
check('Mobile week exposes all seven timeline columns', css.includes('grid-template-columns: 38px repeat(7, minmax(0, 1fr));') && css.includes('.calendar-week-column,\n  .calendar-week-column.selected'));
check('Mobile week events have concise visual labels without losing full source text', calendar.includes('data-mobile-time=') && calendar.includes('data-mobile-label={event.title.split'));
check('Historical selected-day-only test contract is replaced', mobileWeekTest.includes("keeps all seven day timelines visible on phones") && !mobileWeekTest.includes('renders only the selected timeline'));
check('Release safety protects the new full-week contract', releaseSafety.includes('Build208 full-week mobile override missing') && releaseSafety.includes('mobile week timeline does not expose all seven day columns'));
check('Finance mobile navigation is two-row and low-noise', css.includes('Finance - two navigation rows') && css.includes('.finance-dashboard-controls-v1258 .finance-scope-switch') && css.includes('grid-template-columns: minmax(0, 1fr) auto'));
check('Finance month summary keeps only the useful first metric on phone', css.includes('.finance-month-metric-grid button:nth-child(n+2)') && css.includes('display: none'));
check('Work compact teammate rows suppress duplicate full-shift time', workList.includes('const sameAsShared =') && workList.includes("shared-is-full"));
check('Work expansion keeps the team control anchored while details open below', css.includes('Work - count stays in the same place') && css.includes('position: absolute') && css.includes('.work-shift-team-details[open]'));
check('Finance core transaction/item navigation remains available', finance.includes('finance-expense-mode-switch') && finance.includes('>Transakcje</button>') && finance.includes('>Pozycje</button>'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build208 metadata is synchronized', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 208 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build208 final UI polish proof PASS ${checks.length}/${checks.length}`);
