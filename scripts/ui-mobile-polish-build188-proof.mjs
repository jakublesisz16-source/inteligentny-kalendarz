import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const styles = read('src/styles/interface-consistency.css');
const consistency = read('src/planning/ConsistencyCenter.tsx');
const study = read('src/study/StudyProfileSettings.tsx');
const settings = read('src/settings/SettingsView.tsx');
const work = read('src/work/WorkView.tsx');
const version = read('src/core/version.ts');
const checks = [
  ['Build188 polish marker exists', styles.includes('/* 1.2.0.188 - real-phone polish for Settings, Studies, consistency and Work. */')],
  ['Settings phone grid is forced to one column after desktop rules', styles.includes('.settings-minimal-view .settings-core .settings-essential-grid,') && styles.includes('grid-template-columns: minmax(0, 1fr);')],
  ['Settings controls keep readable phone height', styles.includes('.settings-minimal-view .settings-essential-grid select') && styles.includes('min-height: 46px;')],
  ['Settings calendar layers become a compact mobile grid', styles.includes('.settings-calendar-layers {') && styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr));')],
  ['Study groups remain visible in profile settings', study.includes('StudyGroupChoiceFields') && study.includes('study-profile-group-picker')],
  ['Study phone group grid is forced to one column', styles.includes('.study-profile-group-picker .study-group-choice-grid') && styles.includes('grid-template-columns: minmax(0, 1fr);')],
  ['Study group choice uses label plus full select row', styles.includes('grid-template-columns: minmax(122px, .82fr) minmax(0, 1.18fr);') && styles.includes('min-height: 44px;')],
  ['Study preview actions stay in one readable row', styles.includes('.study-groups-primary > .study-preview-sandbox .preview-sandbox-actions') && styles.includes('grid-template-columns: auto minmax(0, 1fr);')],
  ['Consistency adds mobile select without removing desktop filters', consistency.includes('consistency-filters-desktop') && consistency.includes('consistency-filter-select') && consistency.includes('value={filter}')],
  ['Consistency event actions are grouped', consistency.includes('consistency-event-actions') && styles.includes('.consistency-event-actions {')],
  ['Consistency cards are compact on phones', styles.includes('.consistency-card { padding: 13px; border-radius: 13px; }') && styles.includes('.consistency-actions .button { width: 100%; min-height: 40px; }')],
  ['Work keeps nearest coworkers visible', work.includes('work-next-team-static') && work.includes('coworker-inline')],
  ['Work phone shift controls are visually lighter', styles.includes('.work-shift-team-details > summary') && styles.includes('border-radius: 10px;')],
  ['Settings screen remains the existing minimal structure', settings.includes('settings-core') && settings.includes('settings-collapsible-section')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build188 mobile polish proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build188 mobile polish proof PASS (${checks.length}/${checks.length})`);
