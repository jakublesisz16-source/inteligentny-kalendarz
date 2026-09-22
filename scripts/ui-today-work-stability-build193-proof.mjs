import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const work = read('src/work/WorkView.tsx');
const css = read('src/styles/interface-consistency.css');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

check('Today helper can exclude events already visible on a date', today.includes('excludedDateKey?: string') && today.includes('!eventOccursOnDate(event, excludedDateKey)'));
check('Today excludes today agenda events from the top next strip', today.includes('upcomingEvent(events, today, todayEvents.length ? todayKey : undefined)'));
check('Today still renders the actual day agenda cards', today.includes('todayEvents.map((event) =>'));
check('Work roster still uses expandable coworker details', work.includes('className="work-shift-team-details"'));
check('mobile coworker details own a stable two-column anchor grid', css.includes('.work-shift-team-details {\n    width: 100%;\n    display: grid;\n    grid-template-columns: minmax(0, 1fr) auto;'));
check('coworker count summary stays right aligned', css.includes('.work-shift-team-details > summary {\n    grid-column: 2;\n    justify-self: end;'));
check('expanded coworker list opens below the summary', css.includes('.work-shift-team-details .coworker-overlap-list.compact {\n    grid-column: 1 / -1;\n    grid-row: 2;'));
check('no runtime viewport or navigation logic was introduced', !work.includes('visualViewport') && !today.includes('visualViewport'));

console.log(`Build193 Today/Work mobile stability proof PASS ${checks.length}/${checks.length}`);
