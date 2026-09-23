import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const today = read('src/calendar/TodayView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const work = read('src/work/WorkView.tsx');
const study = read('src/study/StudyView.tsx');
const studyPreview = read('src/study/StudyGroupPreviewPanel.tsx');
const settings = read('src/settings/SettingsView.tsx');
const transfer = read('src/data-transfer/DataTransferPanel.tsx');
const safety = read('src/safety/SafetyCenter.tsx');
const finance = read('src/finance/FinanceDashboardView.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const refinement = read('src/styles/interface-refinement.css');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');

const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

check('app metadata remains synchronized on a four-part version', /APP_VERSION = '\d+\.\d+\.\d+\.\d+'/.test(version) && /APP_BUILD = '\d+'/.test(build));
check('schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));
check('Today keeps next event and adds a compact tomorrow glance', today.includes('today-next-strip') && today.includes('today-tomorrow') && today.includes('tomorrowEvents.map'));
check('Tomorrow glance is derived from real calendar events', today.includes('events.filter((event) => eventOccursOnDate(event, tomorrowKey))') && today.includes('formatTime(event.startDateTime, timeFormat)'));
check('Calendar selected day no longer repeats passive Study-plan status', !calendar.includes('Plan studiów aktywny') && !calendar.includes('calendar-selected-day-study-context') && calendar.includes('calendar-week-study-group'));
check('Work and Study headers avoid redundant eyebrow labels', !work.includes('<p className="eyebrow">Praca</p>') && !study.includes('<p className="eyebrow">Studia</p>'));
check('coworker names are text rather than status pills', refinement.includes('Names are information, not status badges') && refinement.includes('background: transparent;') && refinement.includes('color: var(--text);'));
check('Study idle copy is concise and action-led', study.includes('<h2>Plan zajęć</h2>') && study.includes("activeImport ? 'Wczytaj nowy' : 'Wczytaj plan'") && !study.includes('Nowy plik najpierw porównamy z obecnym'));
check('Study alternate-group preview drops artificial read-only badge copy', !studyPreview.includes('TYLKO PODGLĄD') && !studyPreview.includes('Bezpieczny podgląd') && studyPreview.includes("open ? 'Zamknij' : 'Podgląd'"));
check('Settings keeps visible release version and build only', settings.includes('APP_RELEASE_VERSION') && settings.includes('Build {BUILD_NUMBER}') && !settings.includes('DATABASE_SCHEMA_VERSION') && !settings.includes('>Lokalnie</span>'));
check('Backup surface uses short natural copy and hides schema/format metadata', transfer.includes('<h3 id="data-transfer-title">Kopia danych</h3>') && transfer.includes('>Eksportuj kopię</button>') && transfer.includes('>Excel</button>') && !transfer.includes('<span>Schemat danych</span>') && !transfer.includes('<span>Format pliku</span>'));
check('Safety history hides schema implementation detail', !safety.includes('schema {point.schemaVersion}') && !safety.includes('settings-section-intro'));
check('Finance hides zero-value necessity metrics and redundant category heading', finance.includes('necessityTotals.essential > 0 ?') && finance.includes('necessityTotals.nonessential > 0 ?') && finance.includes('categoryAnalytics.length > 1 ?') && !finance.includes('<span className="section-kicker">Wydatki w miesiącu</span>'));
check('Availability week header avoids repeating the section name', !availability.includes('<span className="section-kicker">Dyspozycyjność</span><h2>{weekLabel(weekStart)}</h2>'));
check('Today next label is natural rather than decorative uppercase', refinement.includes('.today-next-label {') && refinement.includes('text-transform: none;'));

console.log(`Build200 global cleanup proof PASS ${checks.length}/${checks.length}`);
