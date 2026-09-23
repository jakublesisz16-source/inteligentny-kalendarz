import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const indexCss = read('src/styles/index.css');
const css = read('src/styles/mobile-compact.css');
const today = read('src/calendar/TodayView.tsx');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

check('compact CSS loads after shared interface consistency', indexCss.indexOf("@import './mobile-compact.css';") > indexCss.indexOf("@import './interface-consistency.css';"));
check('Today single surface loses outer card chrome', css.includes('.today-view.has-plan .today-plan-panel.today-single-surface {\n    border: 0;'));
check('Today secondary category/source chips are hidden on phones', css.includes('.event-category,\n  .today-view.has-plan .today-plan-panel.today-single-surface .event-source { display: none; }'));
check('Work shift stays one scan row', css.includes('.work-shift-row-minimal {\n    grid-template-columns: minmax(0, 1fr) auto;'));
check('Work date/time/duration share one line', css.includes('.work-shift-main-line {\n    grid-template-columns: minmax(0, 1fr) auto auto;'));
check('Expanded coworker rows are flat instead of cards', css.includes('border-radius: 0;\n    background: transparent;'));
check('Settings become label/value rows', css.includes('grid-template-columns: minmax(0, 1fr) minmax(150px, 56%);'));
check('Calendar layer switches share one compact row', css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
check('Consistency related events are flat rows', css.includes('.consistency-events > div {\n    grid-template-columns: 8px minmax(0, 1fr) auto;'));
check('Today add copy is short', today.includes('>+ Dodaj</button>'));

console.log(`Build195 compact mobile surface proof PASS ${checks.length}/${checks.length}`);
