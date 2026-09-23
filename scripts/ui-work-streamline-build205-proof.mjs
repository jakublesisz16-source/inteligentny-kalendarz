import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const work = read('src/work/WorkView.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const summary = read('src/work/WorkSummaryView.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Work removes the repeated roster heading', work.includes('work-roster-direct') && !work.includes('work-roster-minimal-heading"><h2>Grafik</h2>'));
check('Work keeps every expanded coworker detail', work.includes('<CoworkerOverlapList people={coworkers} compact />') && css.includes("grid-template-areas: 'name full shared';"));
check('Expanded coworker rows are lighter instead of card-like', css.includes('.work-shift-team-details .coworker-overlap-list.compact .coworker-overlap-row') && css.includes('border-radius: 0;') && css.includes("content: 'razem';"));
check('Nearest-shift coworkers read as text rather than badges', css.includes('.work-next-team-static > .coworker-inline') && css.includes("content: '·';") && css.includes('background: transparent;'));
check('Availability removes the redundant Plan tygodnia heading', availability.includes('availability-week-editor-clean') && !availability.includes('<h3>Plan tygodnia</h3>'));
check('Availability scans in one natural desktop column', css.includes('.availability-week-editor-clean .availability-week-days') && css.includes('grid-template-columns: 1fr !important;'));
check('Availability keeps work blocks lightweight', css.includes('.availability-week-editor-clean .availability-fixed-work-chip') && css.includes('border-radius: 0;'));
check('Summary keeps rhythm metrics without a separate rhythm panel', summary.includes('work-summary-rhythm-inline') && !summary.includes('<h3>Rytm pracy</h3>'));
check('Summary shortens recent-month history', summary.includes('work-summary-recent-only') && css.includes('grid-template-rows: auto 42px auto;'));
check('Summary facts are information, not four decorative cards', css.includes('.work-summary-facts-grid > span') && css.includes('background: transparent;'));
check('Today remains outside the Build205 product slice', !work.includes('Build205 Today'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build205 contract remains valid on current synchronized metadata', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 205 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build205 Work streamline proof PASS ${checks.length}/${checks.length}`);
