import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const summary = read('src/work/WorkSummaryView.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');

const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Mobile week still carries concise source labels', calendar.includes('data-mobile-time=') && calendar.includes('data-mobile-label={event.title.split'));
check('Mobile week hard-hides the raw full time range', css.includes('text-indent: -9999px !important') && css.includes("content: attr(data-mobile-time) !important"));
check('Mobile week hard-hides the raw long title', css.includes("content: attr(data-mobile-label) !important") && css.includes('white-space: nowrap;'));
check('Availability exposes derived duration as a hideable element', availability.includes('className="availability-day-total"'));
check('Availability work label can be removed on phone without losing interval', availability.includes('availability-fixed-work-label') && availability.includes("slice(11, 16)"));
check('Availability uses natural add wording', availability.includes("{dayBlocks.length ? 'Dodaj' : 'Ustaw'}"));
check('Mobile availability is one row per day', css.includes('grid-template-columns: minmax(92px, .9fr) minmax(0, 1.2fr) auto !important') && css.includes('.availability-week-editor-clean .availability-day-total'));
check('Mobile availability strips work-pill decoration', css.includes('.availability-fixed-work-chip,') && css.includes('border: 0 !important') && css.includes('background: transparent !important'));
check('Summary no-comparison copy is inline under the total', summary.includes('work-summary-no-comparison') && !summary.includes('<strong>Brak porównania</strong>'));
check('Summary facts lose mobile divider noise', css.includes('.work-summary-facts-grid > span:nth-child(2),') && css.includes('border: 0 !important'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build210-or-newer metadata is synchronized', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 210 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build210 mobile readability proof PASS ${checks.length}/${checks.length}`);
