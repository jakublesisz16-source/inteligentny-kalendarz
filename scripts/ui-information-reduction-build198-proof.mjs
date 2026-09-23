import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const work = read('src/work/WorkView.tsx');
const study = read('src/study/StudyView.tsx');
const settings = read('src/settings/SettingsView.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const components = read('src/styles/components.css');
const consistency = read('src/styles/interface-consistency.css');
const refinement = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');

const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('app metadata remains synchronized after Build198', Boolean(versionMatch && buildMatch && versionMatch[2] === buildMatch[1]));
check('schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));
check('Today next strip no longer repeats category', !today.includes('nextCategoryLabels') && today.includes('<section className="today-next-strip"'));
check('Today hides redundant category and source badges', refinement.includes('.today-view .event-category') && refinement.includes('.today-view .event-source { display: none; }'));
check('Work page no longer carries generic subtitles', !work.includes('workHeaderSubtitle') && !work.includes('Zmiany, godziny i zespół w jednym miejscu.'));
check('Study and Settings generic helper copy removed', !study.includes('Plan, grupy i aktualizacje.') && !settings.includes('Najczęściej używane ustawienia'));
check('Availability copy is reduced to natural labels', availability.includes('<h3>Plan tygodnia</h3>') && availability.includes('<h3>Automat</h3>') && availability.includes('>Wolne</span>') && availability.includes('<strong>Wyjątki</strong>'));
check('Work person-count summary stays right anchored when open', refinement.includes('.work-shift-team-details[open] > summary') && refinement.includes('grid-column: 2;') && refinement.includes('justify-self: end;'));
check('Event-card decorative rails are removed globally', !components.includes('.event-card::before') && !components.includes('.event-card.category-work::before'));
check('Week calendar decorative rails are removed', !components.includes('calendar-week-event.category-work { border-left-color') && !consistency.includes('calendar-week-event.category-work { border-left-color'));
check('All-day and mobile preview decorative rails are removed', !components.includes('calendar-week-all-day-event.category-work { border-left-color') && !consistency.includes('calendar-mobile-day-preview-event.category-work { border-left-color'));
check('Semantic category fills remain without rails', components.includes('.calendar-week-event.category-work { background:') && components.includes('.event-card.category-work { background:'));

console.log(`Build198 information reduction proof PASS ${checks.length}/${checks.length}`);
