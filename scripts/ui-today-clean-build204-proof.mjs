import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const eventCard = read('src/events/EventCard.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Today desktop canvas is narrower', css.includes('/* Build204 - Today is one compact agenda surface, not a wide table. */') && css.includes('max-width: 980px;'));
check('Add action is visually quieter', today.includes('button button-secondary button-small today-header-add') && css.includes('background: rgba(255,255,255,.72);'));
check('Tomorrow remains deduplicated from Next', today.includes('nextEvent && !tomorrowEvents.length'));
check('Future context is integrated into the agenda surface', today.includes('const hasAgenda = hasPlan || hasFutureContext;') && today.indexOf('today-plan-panel') < today.indexOf('today-future-preview') && today.includes('today-tomorrow today-future-preview'));
check('Today uses a shorter coworker label without changing the shared default', today.includes('compactCoworkerLabel') && eventCard.includes("compactCoworkerLabel ? `Z Tobą · ${workCoworkerCountLabel}` : `Z Tobą na zmianie · ${workCoworkerCountLabel}`"));
check('Coworker rows preserve names and overlap hours', eventCard.includes('{person.displayName}') && eventCard.includes('{person.overlapStartTime}-{person.overlapEndTime}'));
check('Coworker information no longer dominates desktop width', css.includes('width: min(100%, 650px);') && css.includes('min-height: 21px;'));
check('Tomorrow preview uses one subtle divider inside the surface', css.includes('.today-future-preview {') && css.includes('border-top: 1px solid color-mix') && css.includes('background: color-mix'));
check('Mobile keeps one-column coworkers and a 44px add target', css.includes('grid-template-columns: 1fr;') && css.includes('min-height: 44px;'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build204 contract remains valid on current synchronized metadata', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 204 && versionMatch[2] === buildMatch[1]));

console.log(`Build204 Today clean agenda proof PASS ${checks.length}/${checks.length}`);
