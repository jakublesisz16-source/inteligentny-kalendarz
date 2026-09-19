import { readFileSync } from 'node:fs';

function source(path) { return readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(`TRAVEL_RELEASE_GATE: ${message}`); }

const version = source('src/core/version.ts');
const finance = source('src/finance/FinanceDashboardView.tsx');
const quickExpense = source('src/finance/FinanceQuickExpenseModal.tsx');
const rates = source('src/finance/exchange-rates.ts');
const calendar = source('src/calendar/CalendarView.tsx');
const settings = source('src/settings/SettingsView.tsx');
const safety = source('src/safety/SafetyCenter.tsx');
const transfer = source('src/data-transfer/DataTransferPanel.tsx');
const db = source('src/storage/database.ts');
const work = source('src/work/WorkView.tsx');
const study = source('src/study/StudyView.tsx');
const sw = source('public/service-worker.js');
const responsive = source('src/styles/responsive.css');
const modal = source('src/ui/Modal.tsx');
const indexHtml = source('index.html');

assert(version.includes("APP_VERSION = '1.2.0.145'"), 'wrong app version');
assert(rates.includes('LOCAL_CURRENT_PLN_RATES'), 'local FX table missing');
assert(!rates.includes('fetch(') && !rates.includes('XMLHttpRequest') && !/https?:\/\//u.test(rates), 'Finance FX must not use network');
assert(quickExpense.includes('inputMode="decimal"'), 'amount field must request numeric keyboard');
assert(quickExpense.includes('<span>Waluta</span>'), 'currency selector must remain directly available');
assert(quickExpense.includes("'Zapisz'"), 'quick expense save action missing');
assert(quickExpense.includes('form="finance-quick-expense-form"') && quickExpense.includes('modal-mobile-header-save'), 'quick expense primary action is not pinned to the mobile modal header');
assert(modal.includes("body.classList.add('modal-open')") && modal.includes('modalOpenCount'), 'modal-open lifecycle guard missing');
assert(responsive.includes('body.modal-open .bottom-nav') && responsive.includes('max-height: calc(100dvh - max(8px, env(safe-area-inset-top)))'), 'mobile modal/navigation overlap hardening missing');
assert(indexHtml.includes('interactive-widget=resizes-content'), 'mobile keyboard viewport resize hint missing');
assert(finance.includes('finance-overview-summary-card') && finance.includes('finance-expense-row finance-month-transaction-row') && finance.includes('finance-expense-row finance-trip-expense-row'), 'Month/Trip Finance structure drifted');
assert(calendar.includes('setSelectedDate(day)') && calendar.includes('setMobileDayPanelOpen(false)'), 'mobile Month day selection invariant missing');
assert(settings.includes('Backup i przenoszenie') && settings.includes('Dane i historia'), 'Settings core sections missing');
assert(!settings.includes('<details') && !settings.includes('settings-advanced-collapsible'), 'Settings must not hide primary options in accordions');
assert(!safety.includes("tab === 'backup'") && !safety.includes('Utwórz kopię zapasową'), 'duplicate backup UI returned to Safety Center');
assert(transfer.includes('createDataTransferFile') && transfer.includes('importDataTransfer') && transfer.includes('MAX_TRANSFER_FILE_BYTES'), 'portable backup/restore path missing');
assert(db.includes('export async function createBackupFile') && db.includes('export async function restoreBackup') && db.includes('replaceSnapshotVerified'), 'verified backup/restore core missing');
assert(work.includes("activeWorkEvents.length ? 'Aktualizuj PDF' : 'Importuj PDF'"), 'Work should keep import secondary after schedule exists');
assert(responsive.includes('.work-header-actions .work-import-button'), 'mobile Work import placement hardening missing');
assert(study.includes('Wczytaj Excel. Przed zapisem zobaczysz zmiany i wybierzesz tylko potrzebne grupy.') && study.includes('Grupy i podgląd'), 'Study simplicity pass missing');
assert(sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.2.0.145`"), 'offline shell revision missing');
assert(sw.includes('MANDATORY_SHELL_ASSET_PATHS') && sw.includes("request.mode === 'navigate'") && sw.includes('cache.match(self.registration.scope)'), 'offline shell/navigation handling missing');

console.log('TRAVEL_RELEASE_GATE PASS');
