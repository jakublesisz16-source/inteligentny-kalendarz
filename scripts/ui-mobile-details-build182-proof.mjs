import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const calendar = read('src/calendar/CalendarView.tsx');
const styles = read('src/styles/interface-consistency.css');
const work = read('src/work/WorkView.tsx');
const version = read('src/core/version.ts');

const titleStart = calendar.indexOf('<div className="calendar-header-title-row"><h1>Kalendarz</h1></div>');
const controlsStart = calendar.indexOf('<div className="calendar-primary-controls calendar-primary-controls-minimal">');
const mobileActionsStart = calendar.indexOf('<div className="calendar-mobile-filter-actions">');
const addStart = calendar.indexOf('className="button button-primary button-small calendar-mobile-explicit-add"');

const checks = [
  ['Calendar title no longer owns mobile Add', titleStart >= 0],
  ['Mobile filter/action group exists inside primary controls', controlsStart >= 0 && mobileActionsStart > controlsStart],
  ['Explicit Add follows the mobile filter select', addStart > mobileActionsStart && calendar.slice(mobileActionsStart, addStart).includes('calendar-filter-select')],
  ['Explicit Add remains a real button for the selected date', calendar.includes('calendar-mobile-explicit-add" onClick={() => onAdd(selectedDate)}>+ Dodaj</button>')],
  ['Build182 mobile detail marker is present', styles.includes('/* 1.2.0.182 - mobile Calendar keeps filter and explicit Add on one row; compact Work duration never wraps. */')],
  ['Mobile filter/action group uses two compact columns', styles.includes('grid-template-columns: minmax(100px, 1fr) auto;')],
  ['Filter select reserves less arrow space so full labels remain visible', styles.includes('padding-right: 24px;') && styles.includes('white-space: nowrap;')],
  ['Mobile Add remains compact rather than full-width', styles.includes('min-width: 72px;') && styles.includes('padding-inline: 10px;')],
  ['360px fallback remains explicit', styles.includes('@media (max-width: 360px)') && styles.includes('grid-template-columns: minmax(94px, 1fr) auto;')],
  ['Work schedule still renders formatted duration', work.includes('<small>{formatWorkMinutes(ownMinutes)}</small>')],
  ['Work duration is forced to one line on mobile', styles.includes('.work-shift-main-line small {') && styles.includes('min-width: 2.35rem;') && styles.includes('white-space: nowrap;')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build182 mobile detail proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build182 mobile detail proof PASS (${checks.length}/${checks.length})`);
