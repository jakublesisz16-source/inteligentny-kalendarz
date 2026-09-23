import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Today has one concise header add action', today.includes('today-header-actions') && today.includes('today-header-add') && today.includes('>+ Dodaj</button>') && !today.includes('today-add-row'));
check('Tomorrow suppresses the duplicate next strip', today.includes('nextEvent && !tomorrowEvents.length'));
check('Tomorrow no longer renders a redundant event count', today.includes('today-tomorrow-title') && !today.includes('today-tomorrow-heading'));
check('Tomorrow location stays with the event instead of the far right edge', today.includes('<strong>{event.title}</strong>') && today.includes('{location ? <small>{location}</small> : null}'));
check('Empty Today does not duplicate the add action', today.includes('<EmptyState icon="calendar" title="Wolny dzień" description="" />'));
check('Coworker rows are visually lighter', css.includes('/* Build203 - Today clarity pass after live Build202 review. */') && css.includes('.today-view .event-coworker-line {') && css.includes('border-bottom: 0;'));
check('Tomorrow is a plain lightweight list', css.includes('.today-tomorrow {') && css.includes('border: 0;') && css.includes('grid-template-columns: 94px minmax(0, 1fr);'));
check('Mobile header add keeps a full touch target', css.includes('.today-header-add {') && css.includes('min-height: 44px;'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build203 contract remains valid on current synchronized metadata', Boolean(versionMatch && buildMatch && versionMatch[1].startsWith('1.2.0.') && Number(versionMatch[2]) >= 203 && versionMatch[2] === buildMatch[1]));

console.log(`Build203 Today clarity proof PASS ${checks.length}/${checks.length}`);
