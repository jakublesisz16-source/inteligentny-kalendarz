import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const study = read('src/study/StudyView.tsx');
const work = read('src/work/WorkView.tsx');
const settings = read('src/settings/SettingsView.tsx');
const styles = read('src/styles/interface-consistency.css');
const responsive = read('src/styles/responsive.css');
const version = read('src/core/version.ts');

const checks = [
  ['Study has one calm page title', study.includes('<h1>Studia</h1>') && !study.includes('Plan, grupy i aktualizacje.')],
  ['Study active-plan status is a single compact line', study.includes('study-current-plan-line') && !study.includes('className="study-plan-freshness"')],
  ['Study group choice stays visible while secondary history remains collapsed', study.includes('className="study-groups-primary"') && study.includes('StudyProfileSettings')],
  ['Study history is collapsed by default', study.includes('<details className="imports-section study-history-details study-compact-details">')],
  ['Work overview is reduced to one summary line', work.includes('className="work-summary-line"') && !work.includes('className="work-quick-summary"')],
  ['Work empty availability comparison is not shown on schedule surface', work.includes('hasSentAvailability ? <AvailabilityWorkComparisonPanel')],
  ['Work nearest team stays visible while roster details remain on demand', work.includes('work-next-team-static') && work.includes('work-shift-team-details') && work.includes('<CoworkerOverlapList people={coworkers} compact />')],
  ['Work roster rows show own shift first', work.includes('work-shift-row-minimal') && work.includes('work-shift-main-line')],
  ['Settings essentials are the only expanded default block', settings.includes('className="settings-core"') && settings.includes('<h2>Podstawy</h2>')],
  ['Settings backup and history are one-click sections', (settings.match(/<details className="settings-collapsible-section">/g) ?? []).length === 2 && settings.includes('Kopia i przenoszenie') && settings.includes('Historia i odzyskiwanie')],
  ['Mobile removes helper copy and keeps Work tabs all visible', responsive.includes('.study-view .study-upload-dashboard > .study-upload-copy > p { display: none; }') && responsive.includes('grid-template-columns: repeat(3, minmax(0, 1fr));')],
  ['Mobile touch targets remain readable', responsive.includes('.work-shift-team-details > summary { min-height: 40px; }') && responsive.includes('.settings-collapsible-section > summary { min-height: 50px;')],
  ['Build174 CSS contract is present', styles.includes('1.2.0.174 - default surfaces show only the next decision') && responsive.includes('1.2.0.174 - mobile keeps only essential information')],
  ['No database migration is introduced', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`UI simplification proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`UI simplification proof PASS (${checks.length}/${checks.length})`);
