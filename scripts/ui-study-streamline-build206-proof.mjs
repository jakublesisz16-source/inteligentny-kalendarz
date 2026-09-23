import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const view = read('src/study/StudyView.tsx');
const profile = read('src/study/StudyProfileSettings.tsx');
const preview = read('src/study/StudyGroupPreviewPanel.tsx');
const css = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Study preview uses the shared hierarchical group chooser', preview.includes("import { StudyGroupChoiceFields } from './StudyGroupChoiceFields';") && preview.includes('ariaLabel="Grupy do podglądu"'));
check('Study preview no longer renders the wall of group tiles', !preview.includes("import { StudyGroupSelector } from './StudyGroupSelector';") && !preview.includes('Grupy do sprawdzenia'));
check('Opening preview starts from saved primary groups', preview.includes('if (nextOpen && !selectedGroups.length && primaryGroups.length) setSelectedGroups([...primaryGroups]);'));
check('Preview source is one compact row with an optional alternate Excel', preview.includes('study-preview-source-v206') && preview.includes('>Inny Excel</button>') && preview.includes('>Aktywny plan</button>'));
check('Saved preview choices are secondary details', preview.includes('study-preview-compact-details-v206') && preview.includes('<strong>Zapisane wybory</strong>') && preview.includes('<strong>Zapisz ten wybór</strong>'));
check('Preview result keeps only a short read-only cue', preview.includes('tylko podgląd') && !preview.includes('Nic stąd nie trafia do głównego kalendarza.'));
check('Active Study plan does not repeat the drag helper', view.includes('{!activeImport ? <span className="upload-hint">Możesz też przeciągnąć plik tutaj.</span> : null}'));
check('Main Study group heading no longer repeats the chosen groups beside the controls', profile.includes('id="study-profile-groups-title">Wybór grup</strong>') && !profile.includes("<span>{formatStudyGroupList(groupsDraft) || 'Wybierz swoje grupy'}</span>"));
check('Desktop Study import surface is flattened', css.includes('1.2.0.206 - Studies aligned with the current low-noise interface standard.') && css.includes('.study-view .study-upload-dashboard {') && css.includes('border-radius: 0;'));
check('Desktop preview uses three compact selectors instead of tiles', css.includes('.study-preview-picker-v206 .study-group-choice-grid') && css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'));
check('Mobile preview remains a readable one-column flow', css.includes('@media (max-width: 820px)') && css.includes('.study-preview-picker-actions-v206') && css.includes('grid-template-columns: minmax(0, 1fr) auto;'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build206 contract remains valid on current synchronized metadata', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 206 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build206 Study streamline proof PASS ${checks.length}/${checks.length}`);
