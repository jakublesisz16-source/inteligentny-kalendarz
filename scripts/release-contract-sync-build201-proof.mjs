import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const settings = read('src/settings/SettingsView.tsx');
const today = read('src/calendar/TodayView.tsx');
const work = read('src/work/WorkView.tsx');
const availability = read('src/availability/AvailabilityView.tsx');
const finance = read('src/finance/FinanceDashboardView.tsx');
const calendar = read('src/calendar/CalendarView.tsx');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, condition) => { if (!condition) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('concise Settings labels are canonical', settings.includes('Kopia i przenoszenie') && settings.includes('Historia i odzyskiwanie'));
check('old Settings copy is not restored', !settings.includes('Backup i przenoszenie') && !settings.includes('Historia i bezpieczeństwo'));
check('Today keeps the concise add action', today.includes('>+ Dodaj</button>') && !today.includes('+ Dodaj wydarzenie'));
check('Availability keeps concise automation headings', availability.includes('<h3>Automat</h3>') && availability.includes('<strong>Wyjątki</strong>'));
check('old Availability helper copy stays removed', !availability.includes('Ręczny wpis lub wyjątek ma zawsze pierwszeństwo') && !availability.includes('Wyjątki dla poszczególnych dni'));
check('trip summary leads with the trip itself', finance.includes('finance-trip-hero-total') && finance.includes('<strong>{activeTripName}</strong>') && !finance.includes('Wydatki na wyjeździe'));
check('Calendar does not repeat passive Study profile context', !calendar.includes('calendar-selected-day-study-context'));
check('Work settings expose one save surface', work.includes('work-settings-header-save') && !work.includes('work-settings-save-footer'));
check('Build201 metadata is synchronized', version.includes("APP_VERSION = '1.2.0.201'") && build.includes("APP_BUILD = '201'") && sw.includes('v1.2.0.201'));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build201 release contract sync proof PASS ${checks.length}/${checks.length}`);
