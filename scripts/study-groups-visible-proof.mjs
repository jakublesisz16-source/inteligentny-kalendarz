import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const view = read('src/study/StudyView.tsx');
const profile = read('src/study/StudyProfileSettings.tsx');
const styles = read('src/styles/interface-consistency.css');
const responsive = read('src/styles/responsive.css');
const version = read('src/core/version.ts');

const checks = [
  ['Group picker is directly visible', view.includes('className="study-groups-primary"') && view.includes('<StudyProfileSettings')],
  ['Old hidden group wrapper is gone', !view.includes('<details className="study-secondary-tools study-compact-details"')],
  ['History remains collapsed', view.includes('<details className="imports-section study-history-details study-compact-details">')],
  ['Group heading is compact', profile.includes('study-groups-visible-heading') && profile.includes('>Wybór grup</strong>')],
  ['Duplicate active-plan summary is gone', !profile.includes('study-profile-plan-summary')],
  ['Verbose persistent helper copy is gone', !profile.includes('Używamy tego samego, uproszczonego wyboru')],
  ['Actions only appear after a real group change', profile.includes('draftDiffersFromFuture || draftDiffersFromActive ? <div className="settings-study-actions compact-study-actions">')],
  ['Future-only choices still identify active versus next-import groups', profile.includes('Aktualny plan: {formatStudyGroupList(activeGroups)}') && profile.includes('Kolejne importy: {formatStudyGroupList(futureGroups)}')],
  ['Desktop persistent picker stays three-column', styles.includes('.study-profile-group-picker .study-group-choice-grid {') && styles.includes('grid-template-columns: repeat(3, minmax(0, 1fr));')],
  ['Persistent helper text is hidden without changing import guidance', styles.includes('.study-profile-group-picker .study-group-choice-card small { display: none; }')],
  ['Phone picker uses compact label/select rows', responsive.includes('grid-template-columns: minmax(102px, .78fr) minmax(0, 1.22fr);')],
  ['Phone selects remain thumb-friendly', responsive.includes('.study-profile-group-picker .study-group-choice-card select { min-height: 44px; }')],
  ['Schema stays 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Study groups visibility proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Study groups visibility proof PASS (${checks.length}/${checks.length})`);
