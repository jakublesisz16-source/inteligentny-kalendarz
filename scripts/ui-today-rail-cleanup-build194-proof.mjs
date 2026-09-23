import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const components = read('src/styles/components.css');
const responsive = read('src/styles/responsive.css');
const consistency = read('src/styles/interface-consistency.css');
const today = read('src/calendar/TodayView.tsx');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

check('Today next strip remains present', consistency.includes('.today-next-strip {'));
check('Today next strip no longer renders a left pseudo-element rail', !consistency.includes('.today-next-strip::before'));
check('Today category-specific next-strip rail rules are gone', !consistency.includes('.today-next-strip.category-work::before'));
check('event-card category rails are now absent globally', !components.includes('.event-card::before') && !components.includes('.event-card.category-work::before'));
check('category meaning remains available without rails', components.includes('.event-card.category-work { background:')); 
check('desktop Today card reclaims asymmetric rail gutter', components.includes('padding: 16px 18px 17px;'));
check('mobile Today card reclaims asymmetric rail gutter', responsive.includes('padding: 12px 11px 13px;'));
check('Build193 next-event de-duplication remains intact', today.includes('upcomingEvent(events, today, todayEvents.length ? todayKey : undefined)'));

console.log(`Build194 Today rail cleanup proof PASS ${checks.length}/${checks.length}`);
