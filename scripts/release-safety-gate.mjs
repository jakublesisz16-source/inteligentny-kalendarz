import { existsSync, readFileSync, readdirSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function sourceIfExists(path) {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

function assert(condition, message) {
  if (!condition) throw new Error(`RELEASE_SAFETY_GATE_FAIL: ${message}`);
}

function between(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  assert(start >= 0, `missing start marker: ${startNeedle}`);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  assert(end >= 0, `missing end marker: ${endNeedle}`);
  return text.slice(start, end);
}

const db = source('src/storage/database.ts');
const app = source('src/app/App.tsx');
const safety = source('src/safety/SafetyCenter.tsx');
const transfer = source('src/data-transfer/DataTransferPanel.tsx');
const audit = source('scripts/production-audit.mjs');
const sw = source('public/service-worker.js');
const version = source('src/core/version.ts');
const buildInfoText = sourceIfExists('BUILD_INFO.json');
const buildInfo = buildInfoText ? JSON.parse(buildInfoText) : null;
const packageJson = JSON.parse(source('package.json'));
const studyCompleteness = source('src/study/study-completeness.ts');
const studyMatrixAdapter = source('src/imports/xlsx/adapters/nursing-week-matrix-v2.adapter.ts');
const studyRegistry = source('src/imports/xlsx/adapter-registry.ts');
const workPdfFile = source('src/imports/pdf/work-pdf-file.ts');
const workView = source('src/work/WorkView.tsx');
const viteConfig = source('vite.config.ts');
const calendarView = source('src/calendar/CalendarView.tsx');
const eventForm = source('src/events/EventForm.tsx');
const eventConflicts = source('src/events/event-conflicts.ts');
const eventCard = source('src/events/EventCard.tsx');
const quickEventEditor = source('src/events/QuickEventEditor.tsx');
const eventTypes = source('src/events/event.types.ts');
const calendarCss = source('src/styles/components.css');
const weekLayout = source('src/calendar/week-layout.ts');
const swipeNavigation = source('src/calendar/swipe-navigation.ts');
const weekDrag = source('src/calendar/week-drag.ts');
const weekTouchDrag = source('src/calendar/week-touch-drag.ts');
const navigation = source('src/ui/Navigation.tsx');
const todayView = source('src/calendar/TodayView.tsx');
const sha256 = source('src/core/sha256.ts');
const studyService = source('src/study/study.service.ts');
const availabilityService = source('src/availability/availability.service.ts');
const modal = source('src/ui/Modal.tsx');
const settingsView = source('src/settings/SettingsView.tsx');
const financeDashboard = source('src/finance/FinanceDashboardView.tsx');
const financeQuickExpense = source('src/finance/FinanceQuickExpenseModal.tsx');
const financeExchangeRates = source('src/finance/exchange-rates.ts');
const foreignReceipt = source('src/finance/foreign-receipt.ts');
const receiptScanFlow = source('src/shopping/receipt-ocr/ReceiptScanFlow.tsx');
const receiptScanReview = source('src/shopping/receipt-ocr/ReceiptScanReview.tsx');
const receiptDuplicate = source('src/shopping/receipt-ocr/receipt-duplicate.ts');
const interfaceConsistency = source('src/styles/interface-consistency.css');
const tokensCss = source('src/styles/tokens.css');
const studyViewSource = source('src/study/StudyView.tsx');
const styleIndex = source('src/styles/index.css');
const expenseTypes = source('src/shopping/expenses.types.ts');
const expenseUtils = source('src/shopping/expenses.utils.ts');
const mainEntry = source('src/main.tsx');
const indexHtml = source('index.html');
const swRegistration = source('src/app/registerServiceWorker.ts');
const devSwRecovery = source('src/app/devServiceWorkerRecovery.ts');
const publicRepoDoc = sourceIfExists('docs/PUBLIC_REPOSITORY.md');
const privacyDoc = source('docs/PRIVACY.md');
const calendarOverlays = source('src/calendar/calendar-overlays.ts');
const availabilityView = source('src/availability/AvailabilityView.tsx');
const workSummaryView = source('src/work/WorkSummaryView.tsx');
const releasePreflight = source('scripts/release-preflight.mjs');
const publicPackageGate = source('scripts/public-package-gate.mjs');
const releaseChecklist = sourceIfExists('RELEASE_CHECKLIST.md');
const githubCi = source('.github/workflows/ci.yml');
const gitignore = source('.gitignore');

const projectRootEntries = readdirSync(new URL('../', import.meta.url));
const rootHandoffs = projectRootEntries.filter((name) => /^HANDOFF_NEW_CHAT_.*\.md$/u.test(name));
const rootPrivateNotes = projectRootEntries.filter((name) => /^PRIVATE_1\.2\.0\.\d+\.md$/u.test(name));


// RC package identity must be visible in-app and synchronized with build metadata.
assert(version.includes("APP_VERSION = '1.2.0.112'"), 'APP_VERSION drifted');
assert(!version.includes('APP_BUILD') && !version.includes('APP_STAGE'), 'technical build/stage metadata leaked back into app version module');
assert(version.includes('DATABASE_SCHEMA_VERSION = 14'), 'database schema changed unexpectedly');
if (buildInfo) assert(buildInfo.appVersion === '1.2.0.112' && buildInfo.channel === 'private' && buildInfo.packageVersion === '1.2.0-private.112' && buildInfo.date === '2026-09-13', 'BUILD_INFO.json is not synchronized with PRIVATE 1.2.0.112 metadata');
assert(packageJson.version === '1.2.0-private.112', 'package.json version drifted');
if (buildInfo?.channel === 'private') {
  assert(rootHandoffs.length === 1 && rootHandoffs[0] === 'HANDOFF_NEW_CHAT_1.2.0.112.md', 'root must contain exactly one current handoff');
  assert(rootPrivateNotes.length === 1 && rootPrivateNotes[0] === 'PRIVATE_1.2.0.112.md', 'root must contain exactly one current PRIVATE note');
}
for (const obsolete of [
  'public/icon-192.png', 'public/icon-512.png', 'public/apple-touch-icon.png',
  'public/icon-192-v111.png', 'public/icon-512-v111.png', 'public/apple-touch-icon-v111.png',
  'public/icon-192-v1202.png', 'public/icon-512-v1202.png', 'public/apple-touch-icon-v1202.png',
  'public/icon-192-v120d1.png', 'public/icon-512-v120d1.png', 'public/apple-touch-icon-v120d1.png',
  'docs/DEPLOYMENT_1.0.0.md', 'docs/LOCAL_FINAL_GATE.md', 'docs/PROJECT_HANDOFF.md',
  'FINAL_RELEASE_VALIDATION.ps1',
]) assert(!existsSync(new URL(`../${obsolete}`, import.meta.url)), `obsolete checkpoint file returned: ${obsolete}`);
for (const currentAsset of ['public/icon-192-v1203.png', 'public/icon-512-v1203.png', 'public/apple-touch-icon-v1203.png']) assert(existsSync(new URL(`../${currentAsset}`, import.meta.url)), `current PWA icon missing: ${currentAsset}`);
if (publicRepoDoc) assert(!publicRepoDoc.includes('Finalna architektura `1.0.0`'), 'public repository guide still presents obsolete 1.0.0 wording as current');
assert(packageJson.scripts?.build?.includes('service-worker-gate.mjs') && packageJson.scripts?.build?.includes('release-safety-gate.mjs') && packageJson.scripts?.build?.includes('travel-release-gate.mjs'), 'future production build does not execute release gates');
assert(packageJson.scripts?.build?.includes('security-release-gate.mjs'), 'future production build does not execute security release gate');
assert(packageJson.scripts?.['security:public']?.includes('public-package-gate.mjs'), 'public package security gate script is missing');
assert(packageJson.scripts?.['security:dependencies']?.includes('npm audit --omit=dev --audit-level=high'), 'production dependency audit script is missing');
assert(viteConfig.includes('sourcemap: false'), 'production source maps are not disabled');
assert(workPdfFile.includes('MAX_WORK_PDF_FILE_BYTES = 32 * 1024 * 1024'), 'work PDF pre-read size limit missing or changed unexpectedly');
assert(workPdfFile.includes("bytes[0] === 0x25") && workPdfFile.includes("bytes[4] === 0x2d"), 'work PDF signature validation missing');
assert(workView.includes('await validateWorkPdfFile(file)'), 'Work PDF security validation is not wired into import flow');
assert(workView.indexOf('await validateWorkPdfFile(file)') < workView.indexOf('file.arrayBuffer()'), 'Work PDF full read happens before security validation');

// 1.2.0.53 keeps the calendar model stable while tightening mobile UI and restoring hashing on insecure LAN development origins.
assert(calendarView.includes('calendar-week-now-line'), 'weekly current-time marker missing');
assert(calendarCss.includes('/* 1.2.0.40 - clearer week planner and minimal event form */'), '1.2.0.40 calendar/form polish marker missing');
assert(calendarCss.includes('/* 1.2.0.41 - today outline correction'), '1.2.0.41 today outline correction marker missing');
assert(calendarCss.includes('/* 1.2.0.42 - quick add directly from the weekly timeline */'), '1.2.0.42 quick-add style marker missing');
assert(calendarView.includes('calendar-week-quick-add') && calendarView.includes('Co planujesz?'), 'compact week quick-add composer missing');
assert(calendarView.includes("category: 'PERSONAL'") && calendarView.includes("availabilityImpact: 'BLOCKING'"), 'quick-add defaults drifted');
assert(app.includes('onQuickAdd={async (draft) => { await saveEvent(draft); }}'), 'quick-add is not wired to normal event persistence');
assert(eventForm.includes("initialTitle = ''") && eventForm.includes('title: initialTitle'), 'quick-add title is not preserved when opening more options');
assert(calendarView.includes('calendar-week-quick-add-times') && calendarView.includes('aria-label="Godzina rozpoczęcia"') && calendarView.includes('aria-label="Godzina zakończenia"'), 'quick-add editable time range missing');
assert(calendarView.includes("const startTime = quickAdd.startTime") && calendarView.includes("const endTime = quickAdd.endTime"), 'quick-add does not persist edited start/end times');
assert(calendarView.includes('Godzina zakończenia musi być późniejsza od rozpoczęcia.'), 'quick-add invalid time-range validation missing');
assert(app.includes('initialEndDate') && eventForm.includes('initialEndDate ?? new Date'), 'edited quick-add end time is not preserved in More options');
assert(calendarCss.includes('/* 1.2.0.48 - editable times in compact week quick add */'), '1.2.0.48 quick-add time styles missing');
assert(!calendarCss.includes('.calendar-week-column.today:not(.selected) {\n  background-color:'), 'today week column is still tinted');
assert(eventForm.includes('event-form-minimal') && eventForm.includes('Więcej opcji'), 'minimal event form progressive disclosure missing');
assert(eventForm.includes('<datalist id="event-location-suggestions">'), 'saved-place suggestions for free-text location missing');
assert(eventTypes.includes('locationText?: string;'), 'free-text event location field missing');
assert(db.includes('draft.locationText?.trim()'), 'free-text event location is not persisted');
assert(eventCard.includes('event.locationText?.trim()'), 'free-text event location is not rendered');
assert(app.includes("...(draft.availabilityImpact ? { availabilityImpact: draft.availabilityImpact } : {})"), 'manual multi-date series still writes optional availabilityImpact as explicit undefined');
assert(calendarView.includes("return event.source === 'MANUAL' && !event.allDay && event.spanType === 'SINGLE_DAY'"), 'selected-day quick edit is not limited to safe manual timed events');
assert(calendarView.includes('<QuickEventEditor') && calendarView.includes('onQuickEdit(event, draft)'), 'selected-day quick editor is not wired into CalendarView');
assert(quickEventEditor.includes('Szybka edycja') && quickEventEditor.includes('Wpisz dowolne miejsce'), 'minimal selected-day quick editor is incomplete');
assert(quickEventEditor.includes('<datalist id="quick-event-location-suggestions">'), 'quick editor saved-place suggestions missing');
assert(app.includes('async function quickEditEvent(event: CalendarEvent, draft: EventDraft)') && app.includes('await updateEvent(event.id, draft)'), 'quick edit is not wired through the normal update path');
assert(eventCard.includes('onDelete?: ((event: CalendarEvent) => void)') && eventCard.includes('>Usuń</button>'), 'manual event quick-delete action missing from event card');
assert(calendarView.includes("event.source === 'MANUAL' && !event.seriesId") && calendarView.includes('onQuickDelete(event)'), 'calendar quick delete is not limited to safe non-series manual events');
assert(app.includes('async function quickDeleteEvent(event: CalendarEvent)') && app.includes('await deleteEvent(event.id)') && app.includes("Przeniesiono wydarzenie do Kosza."), 'quick delete is not wired through normal soft-delete + undo flow');
assert(calendarCss.includes('/* 1.2.0.43 - quick editing from the selected-day panel */'), '1.2.0.43 quick-edit style marker missing');
assert(calendarView.includes('calendar-week-all-day-strip') && calendarView.includes('Cały dzień'), 'dedicated all-day week lane missing');
assert(calendarView.includes('buildWeekTimedEventLayout'), 'overlap-aware week layout is not wired into CalendarView');
assert(weekLayout.includes('commitOverlapGroup') && weekLayout.includes('widthPercent = 100 / columnCount'), 'overlap-aware side-by-side layout algorithm missing');
assert(calendarCss.includes('/* 1.2.0.44 - clearer all-day lane and overlapping week events */'), '1.2.0.44 week readability styles missing');
const mobileResponsiveCss = source('src/styles/responsive.css');
const visualQaScript = source('scripts/visual-qa-capture.mjs');
const projectRules = sourceIfExists('CURRENT_PROJECT_RULES.md');
assert(mobileResponsiveCss.includes('/* 1.2.0.45 - mobile-first weekly planner'), '1.2.0.45 mobile planner responsive marker missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.48 - touch-friendly editable quick-add time range */'), '1.2.0.48 mobile quick-add time controls missing');
assert(mobileResponsiveCss.includes('.calendar-week-column { display: none; }') && mobileResponsiveCss.includes('.calendar-week-column.selected'), 'mobile week timeline is not reduced to the selected day');
assert(mobileResponsiveCss.includes('grid-template-columns: repeat(7, minmax(0, 1fr));'), 'mobile seven-day selector is missing');
assert(packageJson.scripts?.['visual:qa']?.includes('visual-qa-capture.mjs'), 'visual QA capture script is not exposed through package.json');
assert(visualQaScript.includes('calendar-week-desktop-1440x1000.png') && visualQaScript.includes('calendar-week-mobile-390x844.png'), 'visual QA desktop/mobile capture presets missing');
assert(visualQaScript.includes('calendar-month-day-sheet-mobile-390x844.png'), 'mobile month day-sheet visual QA capture missing');
assert(visualQaScript.includes('today-desktop-1440x1000.png') && visualQaScript.includes('today-mobile-390x844.png'), 'Today desktop/mobile visual QA capture presets missing');
if (projectRules) assert(projectRules.includes('Visual QA i mobile są częścią Definition of Done'), 'visual/mobile Definition of Done rule missing');
assert(!navigation.includes('bottom-nav-search') && !navigation.includes('onSearch'), 'visible global search leaked back into navigation');
assert(!calendarView.includes('HeaderSearch') && !calendarView.includes('onSearch'), 'CalendarView still exposes a visible global search dependency');
assert(app.includes("event.key.toLowerCase() !== 'k'") && app.includes('<GlobalSearch'), 'underlying global search is not preserved behind the non-visual desktop shortcut');
assert(mobileResponsiveCss.includes('/* 1.2.0.53 - mobile density, integrated search and viewport-first core screens */'), '1.2.0.53 mobile density styles missing');
assert(mobileResponsiveCss.includes('grid-template-columns: repeat(6, minmax(0, 1fr));'), 'six-item mobile bottom navigation drifted');
assert(mobileResponsiveCss.includes('/* 1.2.0.60 - mobile headers without a dedicated search control */'), '1.2.0.60 mobile header cleanup marker missing');
assert(modal.includes('headerActions?: ReactNode') && modal.includes('modal-header-actions'), 'Modal header actions support missing');
assert(workView.includes('work-settings-header-save') && workView.includes('saveWorkSettings(true)'), 'mobile work settings header save action missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.53 - keep the primary work-settings action visible without scrolling */') && mobileResponsiveCss.includes('.work-settings-header-save { display: inline-flex;'), 'mobile work settings save action is not visible in modal header');
assert(mobileResponsiveCss.includes('.work-settings-modal .work-settings-save-footer { display: none; }'), 'redundant mobile work settings footer is still visible');
assert(!app.includes('className="global-search-utility"') && !navigation.includes('nav-search-item'), 'obsolete visible search utility leaked back into the primary interface');
assert(todayView.includes('today-add-button') && todayView.includes('showAllWorkCoworkers') && todayView.includes('compactTimeRange'), 'Today full coworker context or compact hierarchy drifted');
assert(!eventCard.includes('event-coworker-mobile-more'), 'Calendar/Today must not claim a hidden coworker list when full-list mode is active');
assert(workView.includes('nearestCoworkers.map((person)') && !workView.includes('nearestCoworkers.slice('), 'Work nearest-shift teammate list must remain complete');
assert(!mobileResponsiveCss.includes('.selected-day-panel .event-coworker-line:nth-child(n+5)'), 'mobile selected-day panel must not hide coworkers after the fourth row');
assert(financeDashboard.includes('>+ Wydatek</button>') && financeDashboard.includes('Brak wydatków w'), 'Finance primary expense action or empty state is not concise');
// 1.2.0.100 removes duplicate empty-state expense actions at render time on every viewport, not only via mobile CSS.
assert(financeDashboard.includes("const isEmptyMonth = financeScope === 'MONTH' && monthSummary.receiptCount === 0;"), 'Finance empty-month render guard missing');
assert(financeDashboard.includes("const isEmptyActiveTrip = financeScope === 'TRIPS' && Boolean(activeTripName) && activeTripReceipts.length === 0;"), 'Finance empty-trip render guard missing');
assert(financeDashboard.includes('!isEmptyMonth ? <button type="button" className="button button-primary finance-manual-expense"'), 'empty Month can render the duplicated header + Wydatek action');
assert(financeDashboard.includes('activeTripName && !isEmptyActiveTrip ? ('), 'empty active Trip can render a duplicated header action group');
assert(!financeDashboard.includes(`{financeScope === 'MONTH' || activeTripName ? <div className="finance-dashboard-actions finance-core-actions">`), 'obsolete unconditional Finance header action group returned');
assert(financeDashboard.includes('<div><button type="button" className="button button-primary" onClick={openQuickExpense}>+ Wydatek</button></div>'), 'empty Month lost its single primary + Wydatek CTA');
assert(financeDashboard.includes('className="button button-secondary finance-scan-receipt" onClick={openReceiptScan}>Skanuj paragon</button>'), 'Finance receipt scanner action missing');
assert(financeDashboard.includes("type FinanceScope = 'MONTH' | 'TRIPS'") && financeDashboard.includes('finance-trip-summary') && financeDashboard.includes('finance-trip-expense-list'), 'Finance trip summaries are missing');
assert(financeDashboard.includes("financeScope === 'TRIPS' ? normalizeTripName(activeTripName) : ''") && db.includes("const tripName = normalizeExpenseText(draft.tripName ?? '')"), 'Trip expense assignment or receipt persistence is missing');
assert(db.includes("FINANCE_TRIPS_META_KEY = 'financeTrips.v1'") && db.includes('export async function listFinanceTrips') && db.includes('export async function createFinanceTrip') && financeDashboard.includes('tripDefinitions'), 'Persistent empty Finance trips are missing');
assert(expenseTypes.includes("FinanceCurrencyCode = 'PLN' | 'EUR' | 'HUF'") && expenseTypes.includes('originalCurrency?: FinanceCurrencyCode;') && expenseTypes.includes("FinanceConversionSource = 'rate' | 'actual'"), 'Finance foreign-currency persistence fields are missing');
assert(expenseUtils.includes('convertForeignMinorToPlnMinor') && expenseUtils.includes('formatCurrencyAmountMinor') && expenseUtils.includes('parseExchangeRateToPln'), 'Finance currency conversion helpers are missing');
assert(db.includes('export async function updateFinanceTripCurrency') && db.includes('normalizeReceiptCurrencyMetadata'), 'Finance trip currency persistence or receipt currency normalization is missing');
assert(foreignReceipt.includes('convertForeignReceiptDraftToPln') && financeDashboard.includes('convertForeignReceiptDraftToPln(receiptDraft, currency, rate)'), 'foreign-trip OCR conversion safety guard is missing');
assert(financeDashboard.includes('fetchCurrentPlnRate') && financeExchangeRates.includes('LOCAL_CURRENT_PLN_RATES') && !financeExchangeRates.includes('api.frankfurter.dev') && !financeExchangeRates.includes('fetch('), 'local current PLN rate service is missing');
assert(!financeExchangeRates.includes('LOOKBACK_DAYS') && !financeExchangeRates.includes('requestedDate') && !financeExchangeRates.includes("providers: PROVIDER"), 'historical/provider-specific FX complexity returned');
assert(!financeQuickExpense.includes('<summary>Więcej opcji</summary>') && financeQuickExpense.includes('Miejsce / odbiorca <small>opcjonalnie</small>') && financeQuickExpense.includes('<span>Waluta</span>') && financeQuickExpense.includes('≈ ${formatMoneyMinor(converted)} według lokalnego kursu orientacyjnego'), 'simple foreign expense flow regressed');
assert(!financeQuickExpense.includes('Ręczny kurs do PLN') && !financeQuickExpense.includes('Faktycznie pobrano z karty') && !financeQuickExpense.includes('rateText') && !financeQuickExpense.includes('actualPlnText'), 'manual exchange-rate bookkeeping leaked back into the quick expense form');
assert(financeQuickExpense.includes('form="finance-quick-expense-form"') && financeQuickExpense.includes('modal-mobile-header-save'), 'mobile quick-expense save is not reachable from sticky modal header');
assert(modal.includes("body.classList.add('modal-open')") && modal.includes('modalOpenCount'), 'mobile modal open-state lifecycle guard missing');
assert(mobileResponsiveCss.includes('body.modal-open .bottom-nav') && mobileResponsiveCss.includes('max-height: calc(100dvh - max(8px, env(safe-area-inset-top)))'), 'mobile modal viewport/bottom-nav overlap hardening missing');
assert(indexHtml.includes('interactive-widget=resizes-content'), 'viewport meta does not request keyboard-driven content resize');
assert(financeDashboard.includes('activeTripFixedRate') && financeDashboard.includes('!activeTripDefinition.exchangeRatePlnPerUnit'), 'trip-level approximate fixed rate is not persisted after first foreign expense');
assert(financeDashboard.includes('merchant: quickExpense.merchant.trim() || expenseName'), 'optional merchant fallback is missing');
assert(!expenseUtils.includes('exchangeRateToInput'), 'dead exchangeRateToInput helper returned');
assert(interfaceConsistency.includes('--ui-page-title-size: 1.82rem') && interfaceConsistency.includes('.today-header h1') && interfaceConsistency.includes('.calendar-view-header h1') && interfaceConsistency.includes('.finance-view-header h1'), 'shared primary typography scale is missing');
assert(tokensCss.includes('--category-study: #b95d84') && tokensCss.includes('--category-work: #2f7382') && tokensCss.includes('--category-personal: #695591'), 'semantic Study/Work/Personal colors are not sufficiently distinct');
assert(interfaceConsistency.includes('/* 1.2.0.85 - one hierarchy and stronger semantic event categories. */') && interfaceConsistency.includes('.study-view > .view-header h1') && interfaceConsistency.includes('.work-view > .view-header h1') && interfaceConsistency.includes('.settings-minimal-view > .view-header h1'), '1.2.0.85 cross-module hierarchy is missing');
assert(interfaceConsistency.includes('.calendar-week-event.category-study') && interfaceConsistency.includes('.calendar-week-event.category-work') && interfaceConsistency.includes('.calendar-week-event.category-personal') && interfaceConsistency.includes('.selected-day-panel .event-card.category-work'), 'semantic event contrast does not cover calendar and selected-day surfaces');
assert(calendarView.includes('filter-${item.id.toLowerCase()}') && calendarView.includes('category-${event.category.toLowerCase()}'), 'calendar filters or mobile day preview lost semantic category classes');
assert(studyViewSource.includes('Wczytaj Excel. Aplikacja pokaże zmiany przed zapisem'), 'Study intro was not simplified');
assert(styleIndex.trimEnd().endsWith("@import './interface-consistency.css';"), 'shared interface consistency stylesheet must load last');
assert(privacyDoc.includes('## Lokalne kursy walut 1.2.0.85') && privacyDoc.includes('wbudowanych lokalnie') && privacyDoc.includes('nie wysyła kwoty wydatku'), 'simplified FX privacy boundary is not documented');
assert(financeDashboard.includes('activeTripOriginalTotals') && financeDashboard.includes('finance-trip-currency-button'), 'Trip original-currency summary or currency settings entry is missing');
assert(calendarCss.includes('/* 1.2.0.58 - lightweight trip expense summaries */') && mobileResponsiveCss.includes('/* 1.2.0.58 - trip finances on mobile */'), 'Finance trip summary styling missing');
assert(financeDashboard.includes("type FinanceExpenseListMode = 'TRANSACTIONS' | 'ITEMS'") && financeDashboard.includes("useState<FinanceExpenseListMode>('TRANSACTIONS')") && financeDashboard.includes('finance-month-transaction-list'), 'Finance monthly view is no longer transaction-first');
assert(financeDashboard.includes('>Transakcje</button>') && financeDashboard.includes('>Pozycje</button>') && financeDashboard.includes("setExpenseListMode('ITEMS')"), 'Finance transaction/item drill-down switch is missing');
assert(calendarCss.includes('/* 1.2.0.78 - Finance month defaults to a lightweight transaction list */') && mobileResponsiveCss.includes('/* 1.2.0.78 - transaction-first Finance remains readable on mobile */'), '1.2.0.78 Finance transaction-list styling missing');
assert(financeDashboard.includes('finance-trip-summary-simple') && financeDashboard.includes('finance-trips-heading') && financeDashboard.includes('receiptExpenseTitle(receipt)') && !financeDashboard.includes('Twoje wyjazdy'), '1.2.0.79 Finance trip hierarchy polish is missing');
assert(financeDashboard.includes('button button-primary finance-manual-expense') && financeDashboard.includes('button button-secondary finance-scan-receipt'), 'manual expense is not the primary Finance action');
assert(financeDashboard.includes('Szukaj nazwy, miejsca lub kategorii') && financeDashboard.includes('finance-month-summary-compact') && financeDashboard.includes('finance-month-category-chips') && financeDashboard.includes('formatShortDate(receipt.date)'), 'monthly Finance copy or compact category/transaction layout regressed');
assert(calendarCss.includes('/* 1.2.0.79 - Finance hierarchy polish: expense-first actions and lighter trips */') && mobileResponsiveCss.includes('/* 1.2.0.79 - simple Finance hierarchy on phones */'), '1.2.0.79 Finance polish styling missing');
assert(calendarCss.includes('/* 1.2.0.86 - compact trip-ready Finance without adding new concepts */') && mobileResponsiveCss.includes('/* 1.2.0.86 - compact Finance stays thumb-friendly on phones */'), '1.2.0.86 compact Finance styling missing');
assert(financeDashboard.includes('finance-month-summary-compact') && financeDashboard.includes('finance-month-summary-meta') && financeDashboard.includes('finance-month-category-chips'), '1.2.0.87 compact month summary is missing');
assert(calendarCss.includes('/* 1.2.0.87 - month Finance mirrors the compact trip summary */') && mobileResponsiveCss.includes('/* 1.2.0.87 - compact month summary remains readable on phones */'), '1.2.0.87 compact month styling missing');
assert(financeDashboard.includes('finance-trips-heading-actions') && financeDashboard.includes('finance-new-trip-header-button') && !financeDashboard.includes("financeScope === 'TRIPS' && !activeTripName ? <button type=\"button\" className=\"button button-secondary\""), '1.2.0.88 trip create action is not anchored to the trip-list heading');
assert(calendarCss.includes('/* 1.2.0.88 - trip creation belongs to the trip-list heading') && mobileResponsiveCss.includes('/* 1.2.0.88 - trip-list header action stays compact on phones */'), '1.2.0.88 trip header styling missing');
assert(financeDashboard.includes('activeTripCategoryTotals') && financeDashboard.includes('finance-trip-category-strip') && financeDashboard.includes('finance-trip-expense-icon'), '1.2.0.89 trip category cues are missing');
assert(calendarCss.includes('/* 1.2.0.89 - travel-ready category cues') && mobileResponsiveCss.includes('/* 1.2.0.89 - fast trip spending on phones */'), '1.2.0.89 travel-ready Finance styling missing');
assert(financeDashboard.includes('finance-overview-summary-card') && financeDashboard.includes('finance-overview-category-strip') && financeDashboard.includes('finance-expense-row finance-month-transaction-row') && financeDashboard.includes('finance-expense-row finance-trip-expense-row'), '1.2.0.90 Month/Trip shared Finance structure is missing');
assert(financeDashboard.includes('finance-month-transaction-icon') && financeDashboard.includes('finance-trip-expense-icon') && financeDashboard.includes("const secondary = [receipt.tripName, formatExpenseMerchantDisplayName(receipt.merchant), categoryLabel]"), '1.2.0.90 transaction category cues are not shared between Month and Trip');
assert(calendarCss.includes('/* 1.2.0.90 - Month and Trip Finance share one compact visual grammar. */') && mobileResponsiveCss.includes('/* 1.2.0.90 - Month and Trip keep the same Finance hierarchy on phones. */'), '1.2.0.90 shared Finance styling missing');
assert(settingsView.includes('settings-essential-grid') && settingsView.includes('settings-build-line') && settingsView.includes('Backup i przenoszenie') && settingsView.includes('Dane i historia') && !settingsView.includes('settings-advanced-collapsible'), 'Settings is no longer essentials-first');
assert(!safety.includes("tab === 'backup'") && !safety.includes('Utwórz kopię zapasową'), 'duplicate backup controls returned to Safety Center');
assert(workView.includes("activeWorkEvents.length ? 'Aktualizuj PDF' : 'Importuj PDF'") && mobileResponsiveCss.includes('.work-header-actions .work-import-button'), 'travel-ready Work header hardening missing');
assert(calendarCss.includes('/* 1.2.0.54 - global clarity pass') && mobileResponsiveCss.includes('/* 1.2.0.54 - real-device mobile clarity pass */'), '1.2.0.54 clarity styles missing');
assert(calendarView.includes('mobileDayPanelOpen') && calendarView.includes('calendar-mobile-day-backdrop') && calendarView.includes("selected-day-panel${mobileDayPanelOpen ? ' mobile-open' : ''}"), '1.2.0.56 mobile month day-sheet wiring missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.56 - viewport-first mobile Calendar and lighter Today agenda */') && mobileResponsiveCss.includes('.selected-day-panel.mobile-open'), '1.2.0.56 mobile day-sheet styles missing');
assert(calendarCss.includes('/* 1.2.0.60 - visible global search removed, headers reclaim the space */'), '1.2.0.60 header cleanup styles missing');
assert(calendarCss.includes('/* 1.2.0.61 - one lightweight event composer across mobile entry points */'), '1.2.0.61 shared event composer marker missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.61 - shared mobile event bottom sheet */'), '1.2.0.61 mobile event sheet styles missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.62 - horizontal period swipe while preserving vertical scroll */'), '1.2.0.62 mobile swipe styles missing');
assert(calendarCss.includes('/* 1.2.0.62 - mobile swipe navigation between calendar periods */'), '1.2.0.62 calendar swipe marker missing');
assert(calendarView.includes('handlePeriodSwipeStart') && calendarView.includes('handlePeriodSwipeEnd') && calendarView.includes('calendar-period-swipe-surface'), 'mobile period swipe is not wired into month/week surfaces');
assert(calendarView.includes('suppressSwipeClickUntilRef') && calendarView.includes('handlePeriodSwipeClickCapture'), 'swipe click suppression missing');
assert(swipeNavigation.includes('detectPeriodSwipe') && swipeNavigation.includes('axisRatio') && swipeNavigation.includes('maxDurationMs'), 'swipe gesture discrimination helper missing');
assert(weekDrag.includes('canDragWeekEvent') && weekDrag.includes("event.source === 'MANUAL'") && weekDrag.includes('!event.seriesId'), 'safe manual-only week drag guard missing');
assert(weekDrag.includes('computeWeekDropStartMinutes') && weekDrag.includes('snapMinutes ?? 15'), '15-minute week drag snapping helper missing');
assert(weekDrag.includes('buildMovedWeekEventDraft') && calendarView.includes('onDragStart={(dragEvent) => startWeekEventDrag(dragEvent, event)}') && calendarView.includes('onDrop={(event) => { void dropWeekEvent(event, key); }}'), 'week drag and drop is not wired into the timeline');
assert(app.includes('async function quickMoveEvent') && app.includes("event.source !== 'MANUAL' || event.allDay || event.spanType !== 'SINGLE_DAY' || event.seriesId"), 'App drag persistence guard missing');
assert(calendarCss.includes('/* 1.2.0.63 - safe desktop drag and drop for manual week events */'), 'desktop week drag styles missing');
assert(weekDrag.includes('canResizeWeekEvent') && weekDrag.includes('computeWeekResizeEndMinutes') && weekDrag.includes('buildResizedWeekEventDraft'), 'safe desktop week resize helpers missing');
assert(calendarView.includes('startWeekResize') && calendarView.includes('calendar-week-resize-handle') && calendarView.includes('previewEndMinutes'), 'week duration resize is not wired into CalendarView');
assert(calendarCss.includes('/* 1.2.0.68 - desktop duration resize for safe manual week events */'), 'desktop week resize styles missing');
assert(calendarView.includes("const touchResizable = !desktopWeekDragEnabled && canResizeWeekEvent(event);") && calendarView.includes("weekResize?.inputMode === 'touch'") && calendarView.includes('onTouchStart={(touchEvent) => touchEvent.stopPropagation()}'), 'explicit mobile week resize is not isolated from long-press drag');
assert(mobileResponsiveCss.includes('/* 1.2.0.74 - explicit mobile duration resize without stealing long-press drag */') && mobileResponsiveCss.includes('.calendar-week-resize-handle.touch-resize-handle') && mobileResponsiveCss.includes('touch-action: none;'), 'mobile week resize handle styles missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.76 - keep the mobile resize hit area inside its own event */') && mobileResponsiveCss.includes('bottom: 0;') && mobileResponsiveCss.includes('height: min(18px, 100%);') && mobileResponsiveCss.includes('width: min(64px, calc(100% - 16px));') && calendarView.includes('onLostPointerCapture={handleWeekResizeLostPointerCapture}'), 'mobile resize overlap/capture hardening missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.64 - long-press drag and drop for safe manual week events on mobile */'), 'mobile long-press drag styles missing');
assert(weekTouchDrag.includes('shouldCancelWeekLongPress') && weekTouchDrag.includes('computeMobileWeekTargetDayIndex'), 'mobile week touch drag discrimination helper missing');
assert(calendarView.includes('MOBILE_WEEK_LONG_PRESS_MS = 450') && calendarView.includes('startMobileWeekLongPress') && calendarView.includes('commitMobileWeekTouchDrag'), 'mobile week long-press drag is not wired');
assert(calendarView.includes('ref={weekScrollRef} className="calendar-week-scroll"') && calendarView.includes('onScroll={handleMobileWeekScroll}') && calendarView.includes('startScrollTop: weekScrollRef.current?.scrollTop ?? 0'), 'mobile week scroll ref / long-press scroll cancellation missing');
assert(calendarView.includes("inputMode: 'touch'") && calendarView.includes("window.addEventListener('touchmove', handleTouchMove, { passive: false })"), 'mobile drag does not actively protect the gesture from page scrolling after long-press');
assert(calendarView.includes('if (session.activated) {\n      event.preventDefault();\n      updateMobileWeekTouchPosition(touch);'), 'active mobile drag can miss local touchmove during listener handoff');
assert(calendarView.includes('event?.preventDefault();\n      void commitMobileWeekTouchDrag();') && calendarView.includes('event?.preventDefault();\n      cancelMobileWeekTouchSession(true);'), 'mobile drag local touchend/touchcancel handoff hardening missing');
assert(calendarView.includes("window.matchMedia('(max-width: 820px)').matches") && calendarView.includes('onAdd(initial, undefined, new Date(initial.getTime() + 60 * 60 * 1000))'), 'weekly compact add does not route through the shared event sheet');
const monthQuickAddBlock = between(calendarView, 'function openMonthQuickAdd(day: Date)', 'function quickAddInitialDate()');
assert(monthQuickAddBlock.includes('setMobileDayPanelOpen(false)') && !monthQuickAddBlock.includes('onAdd('), 'mobile month quick-add fallback can still open event creation directly');
assert(calendarView.includes('!selectionMode && selected && desktopWeekDragEnabled') && mobileResponsiveCss.includes(`@media (max-width: 820px) {
  .calendar-day-quick-add-trigger { display: none; }`), 'month cell plus is not fail-closed to desktop only');
const monthSelectDayBlock = between(calendarView, 'function selectDay(day: Date)', 'function addAtHour(day: Date, hour: number)');
assert(monthSelectDayBlock.includes("if (displayMode === 'MONTH') setMobileDayPanelOpen(false)") && !monthSelectDayBlock.includes('setMobileDayPanelOpen(true)') && !monthSelectDayBlock.includes('hasVisibleEvent'), 'mobile month day tap can still auto-open details');
assert(calendarView.includes('calendar-mobile-day-preview') && calendarView.includes('calendar-mobile-day-preview-event') && calendarView.includes('selectedEvents.slice(0, 3)') && calendarView.includes('calendar-mobile-explicit-add'), 'mobile month inline day preview or explicit add action is missing');
assert(calendarCss.includes('/* 1.2.0.80 - mobile month date selection stays separate from event details */') && mobileResponsiveCss.includes('/* 1.2.0.80 - tapping a month date only selects it; event rows are the explicit detail action. */') && mobileResponsiveCss.includes('.selected-day-panel.mobile-open .selected-day-quick-actions { display: none; }'), '1.2.0.80 mobile month selection/detail separation styling missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.73 - compact explicit add action in the mobile Calendar header */') && mobileResponsiveCss.includes('width: auto !important;') && mobileResponsiveCss.includes('flex: 0 0 auto;'), 'mobile Calendar explicit add action can stretch to full width again');
assert(eventForm.includes('id="event-editor-form"') && app.includes('form="event-editor-form"') && app.includes('event-mobile-header-save'), 'shared mobile event sheet save action is missing');
assert(mainEntry.includes('registerServiceWorker();') && !mainEntry.includes('if (import.meta.env.PROD) registerServiceWorker();'), 'environment-aware service worker helper is not executed in Vite development');
assert(indexHtml.indexOf('/src/app/devServiceWorkerRecovery.ts') >= 0 && indexHtml.indexOf('/src/app/devServiceWorkerRecovery.ts') < indexHtml.indexOf('/src/main.tsx'), 'dev stale-worker recovery is not loaded before main');
assert(devSwRecovery.includes('import.meta.env.DEV') && devSwRecovery.includes('cleanupDevelopmentServiceWorker'), 'LAN dev stale-worker recovery entry is missing');
assert(swRegistration.includes('export async function cleanupDevelopmentServiceWorker') && swRegistration.includes('registration.unregister()') && swRegistration.includes('window.location.reload()'), 'development service worker cleanup cannot recover a stale LAN-controlled tab');
assert(calendarCss.includes('width: 32px;') && calendarCss.includes('width: 40px;') && calendarCss.includes('.calendar-week-resize-handle'), 'desktop resize affordance is too ambiguous or missing');
assert(calendarCss.includes('/* 1.2.0.70 - resize handle no longer reserves content space in short events */') && !calendarCss.includes('.calendar-week-event.resizable { padding-bottom:'), 'desktop resize is stealing vertical space from short event labels');
assert(calendarCss.includes('.calendar-week-shell.compact-density .calendar-week-event span { font-size: .55rem;') && calendarCss.includes('font-size: .64rem;') && calendarCss.includes('text-overflow: ellipsis;'), 'compact week event text readability regression');
assert(mobileResponsiveCss.includes('.event-form-create:not(.event-form-multi-create) .modal-actions { display: none; }'), 'mobile event create sheet still duplicates the save action in the footer');
assert(todayView.includes("today-view${hasPlan ? ' has-plan' : ' is-empty'}") && todayView.includes('actionLabel="+ Dodaj"'), 'Today empty state is still unnecessarily large or verbose');
assert(todayView.includes('today-plan-panel today-single-surface') && calendarCss.includes('/* 1.2.0.58 - Today uses one visual surface instead of cards inside a card */') && mobileResponsiveCss.includes('/* 1.2.0.58 - keep the single-surface Today hierarchy on phones too */'), 'Today reverted to nested visual cards');
assert(mobileResponsiveCss.includes('/* 1.2.0.71 - mobile Today work-card readability */') && mobileResponsiveCss.includes('grid-template-columns: 72px minmax(0, 1fr);') && mobileResponsiveCss.includes('column-gap: 12px;') && mobileResponsiveCss.includes('border-top-color: rgba(63,130,146,.07);'), 'mobile Today event hierarchy became cramped or coworker separators became too heavy');
assert(sha256.includes('globalThis.crypto?.subtle') && sha256.includes('fallbackSha256'), 'SHA-256 fallback for insecure LAN origins is missing');
assert(workView.includes('work-analysis-primary-action') && workView.includes('Dodaj do kalendarza'), 'Work import commit action is not immediately visible above preview details');
assert(workView.indexOf('Dodaj do kalendarza') < workView.indexOf('Sprawdź szczegóły importu'), 'Work import commit action was moved below long preview details');
assert(workView.includes('sha256Hex(buffer)'), 'Work PDF hashing does not use the secure-context fallback helper');
assert(!workView.includes('crypto.subtle.digest'), 'Work PDF import still calls crypto.subtle directly');
assert(studyService.includes('sha256Hex(data)'), 'Study file hashing does not use the SHA-256 fallback helper');
assert(availabilityService.includes('return sha256Hex(value);'), 'availability fingerprint hashing does not use the SHA-256 fallback helper');
assert(db.includes('return sha256Hex(value);'), 'database backup/checksum hashing does not use the SHA-256 fallback helper');
assert(calendarView.includes('function calculateWeekHourHeight(): number'), 'adaptive desktop week density calculation missing');
assert(calendarView.includes('window.innerHeight - WEEK_DESKTOP_VERTICAL_CHROME'), 'week density does not react to available viewport height');
assert(calendarView.includes("window.innerWidth <= 820) return WEEK_HOUR_HEIGHT"), 'mobile week spacing is no longer protected from desktop compaction');
assert(calendarView.includes("weekHourHeight < 40 ? ' compact-density' : ''"), 'compact week density visual mode missing');
assert(calendarCss.includes('/* 1.2.0.48 - adaptive desktop week density, without changing the selected-day panel */'), 'adaptive week density styles missing');

// Location deletion must be one transaction spanning every persistent reference.
const deletion = between(db, 'export async function deleteLocation(id: string): Promise<void> {', '\nexport async function getSettings');
for (const store of ['STORE_LOCATIONS', 'STORE_EVENTS', 'STORE_SETTINGS', 'STORE_WORK_PROFILES', 'STORE_CHANGE_JOURNAL']) {
  assert(deletion.includes(store), `deleteLocation transaction does not include ${store}`);
}
assert(deletion.includes("event.source === 'UNIVERSITY_XLSX' || event.source === 'WORK_PDF'"), 'imported event protection missing on location deletion');
assert(deletion.includes("'locationId'"), 'locationId user-modified protection missing');
assert(deletion.includes('delete updatedSettings.homeLocationId'), 'homeLocationId is not cleared');
assert(deletion.includes('delete updatedSettings.workLocationId'), 'workLocationId is not cleared');
assert(deletion.includes('delete updated.locationId'), 'event/work profile location reference is not cleared');
assert(deletion.indexOf('locationStore.delete(id)') > deletion.indexOf('for (const profile of updatedWorkProfiles)'), 'location is deleted before dependent records are updated');
assert(deletion.includes('tx.abort()'), 'explicit abort safeguard missing from location deletion');
assert(deletion.includes("operationType: 'DELETE_LOCATION'"), 'location deletion is not journaled');

const removeLocation = between(app, 'async function removeLocation()', '\n  async function changeSettings');
assert(!removeLocation.includes('updateEvent('), 'App still detaches location event-by-event');
assert(removeLocation.includes('await deleteLocation(removedId)'), 'App does not use transactional deleteLocation');

// A manually removed imported location must not be silently recreated during plan updates.
assert(db.includes("const locationId = preserved.has('locationId')\n        ? oldEvent.locationId\n        : ensureCandidateLocation"), 'SKIP update may recreate a manually removed study location');
assert(db.includes("const locationId = effectivePreserveFields.includes('locationId')\n      ? oldEvent.locationId\n      : ensureCandidateLocation"), 'normal update may recreate a manually removed study location');

// Transfer/backup import files must be bounded before materializing their text in memory.
const inspectTransfer = between(transfer, 'async function inspectFile(file: File)', '\n\n  async function confirmImport');
assert(inspectTransfer.indexOf('file.size > MAX_TRANSFER_FILE_BYTES') >= 0, 'transfer pre-read size limit missing');
assert(inspectTransfer.indexOf('file.size > MAX_TRANSFER_FILE_BYTES') < inspectTransfer.indexOf('await file.text()'), 'transfer size check happens after file.text()');
const inspectFile = between(transfer, 'async function inspectFile(file: File)', '\n\n  async function confirmImport');
assert(inspectFile.indexOf('file.size > MAX_TRANSFER_FILE_BYTES') >= 0, 'transfer pre-read size limit missing');
assert(inspectFile.indexOf('file.size > MAX_TRANSFER_FILE_BYTES') < inspectFile.indexOf('await file.text()'), 'transfer size check happens after file.text()');

// Database connection cache must recover from version changes and blocked upgrades.
const openDb = between(db, 'function openDatabase(): Promise<IDBDatabase> {', '\nasync function ensureInitialSettings');
assert(openDb.includes('db.onversionchange = () =>'), 'versionchange handler missing');
assert(openDb.includes('if (databasePromise === activePromise) databasePromise = null'), 'closed database remains cached after versionchange');
assert(openDb.includes('request.onblocked = () =>'), 'blocked database upgrade handler missing');
assert(openDb.includes('inna karta lub okno'), 'blocked upgrade lacks actionable user message');

// Snapshot restore must verify after commit and restore the previous snapshot on failed verification.
const verifiedRestore = between(db, 'async function replaceSnapshotVerified', '\nasync function pruneChangeJournal');
assert(verifiedRestore.includes('await verifySnapshotReplacement(snapshot, includeJournal)'), 'post-write snapshot verification missing');
assert(verifiedRestore.includes('await replaceSnapshot(rollbackSnapshot, true)'), 'snapshot rollback missing');
assert(verifiedRestore.includes('await verifySnapshotReplacement(rollbackSnapshot, true)'), 'rollback verification missing');
for (const call of [
  'await replaceSnapshotVerified(point.snapshot, false)',
  'await replaceSnapshotVerified(migrated, true)',
  'await replaceSnapshotVerified(migrateBackupSnapshotToCurrent(inspected.document.data), true)',
]) {
  assert(db.includes(call), `verified snapshot restore is not used: ${call}`);
}

// Device notification runtime/reminders and restore points are intentionally not transferred as portable data.
const restoreStores = between(db, 'function restoreSnapshotStoreNames(): string[] {', '\n}\n\nfunction backupSnapshotStoreNames');
assert(!restoreStores.includes('STORE_NOTIFICATION_RUNTIME'), 'notification runtime must not be restored from backup');
assert(!restoreStores.includes('STORE_NOTIFICATION_REMINDERS'), 'device reminder state must not be restored from backup');
assert(!restoreStores.includes('STORE_RESTORE_POINTS'), 'restore-point recursion must not be embedded in snapshots');
assert(db.includes('return [...restoreSnapshotStoreNames(), STORE_CHANGE_JOURNAL]'), 'backup store list does not extend restore list with journal');

// Production audit and service worker must agree on the current RC cache contract.
assert(sw.includes("const CACHE_PREFIX = 'inteligentny-kalendarz-shell-'"), 'current service worker cache prefix missing');
assert(sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.2.0.112`"), 'current service worker cache version missing');
assert(audit.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.2.0.112`"), 'production audit still expects an obsolete service worker revision');
assert(!/\bcaches\.match\s*\(/u.test(sw), 'service worker can read foreign origin caches');
assert(sw.includes('key.startsWith(CACHE_PREFIX)'), 'service worker can delete unrelated caches');
assert(sw.includes('await caches.delete(CACHE_NAME)'), 'partial current cache cleanup missing');
assert(sw.includes('MANDATORY_SHELL_ASSET_PATHS'), 'mandatory PWA shell asset list missing');
for (const asset of ['manifest.webmanifest', 'favicon.svg', 'icon-192-v1203.png', 'icon-512-v1203.png', 'apple-touch-icon-v1203.png']) assert(sw.includes(`'${asset}'`), `mandatory PWA asset missing: ${asset}`);
assert(sw.includes("const PRIVATE_FILE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.json'];"), 'private document cache bypass list missing');

assert(!settingsView.includes('Co nowego') && !settingsView.includes('Roadmapa'), 'changelog/roadmap controls are still visible in Settings');
assert(!settingsView.includes('APP_BUILD') && !settingsView.includes('APP_STAGE'), 'technical build/stage are still visible in Settings');
assert(!existsSync(new URL('../src/settings/releaseNotes.ts', import.meta.url)), 'dead releaseNotes.ts still present');
assert(!existsSync(new URL('../src/settings/roadmap.ts', import.meta.url)), 'dead roadmap.ts still present');

// Study parser must prove source-block completeness or fail closed without inventing missing schedule data.
assert(studyCompleteness.includes('expectedDatesForSourceBlock'), 'source-block date completeness gate missing');
assert(studyCompleteness.includes('const expectedMinutes = group.declared * 45'), 'teaching-hour normalization missing');
assert(studyCompleteness.includes("status = 'OVERFLOW'") && studyCompleteness.includes("status = 'MISMATCH'"), 'strict hour mismatch states missing');
assert(studyCompleteness.includes("status = 'SOURCE_INCOMPLETE'"), 'source-incomplete hour state missing');
assert(studyMatrixAdapter.includes('sourceBlocks.push({'), 'week-matrix adapter does not preserve source blocks');
assert(studyMatrixAdapter.includes('declaredTeachingHoursFromText'), 'declared teaching-hour extraction missing');
assert(studyMatrixAdapter.includes('unparsedAssignmentCellsForWeekRows'), 'unknown group-assignment fail-closed detector missing');
assert(studyMatrixAdapter.includes('suspiciousUnparsedWeekRows'), 'unparsed week-row fail-closed detector missing');
assert(studyMatrixAdapter.includes('mostSpecificWeekdays'), 'specific-column weekday precedence missing');
assert(studyMatrixAdapter.includes('entriesMostSpecificFirst'), 'specific header ordering missing');
assert(studyMatrixAdapter.includes('mostSpecificTime'), 'specific-column time precedence missing');
assert(studyMatrixAdapter.includes('headerLocation'), 'specific-column location precedence missing');
assert(studyMatrixAdapter.includes('entriesBroadToSpecific'), 'broad-to-specific location override ordering missing');
assert(studyRegistry.includes('analysis.completeness') && studyRegistry.includes('Kompletność planu:'), 'adapter registry does not enforce completeness audit');
assert(studyRegistry.includes('unparsedAssignmentCellCount') && studyRegistry.includes('suspiciousUnparsedWeekRows'), 'adapter registry can silently accept unresolved matrix assignments');
assert(db.includes('sourceWeekStart: identified.sourceWeekStart') && db.includes('sourceWeekEnd: identified.sourceWeekEnd'), 'source week metadata is not persisted');
assert(db.includes('declaredTeachingHours: identified.declaredTeachingHours'), 'declared teaching hours are not persisted');
assert(db.includes('sourceCandidateId: identified.id'), 'source candidate identity is not persisted for completeness rechecks');
assert(db.includes('assertStudySourceCompleteness(input.allCandidates ?? input.candidates, input.sourceBlocks, input.selectedGroups)'), 'initial import does not recheck source completeness in storage');
assert(db.includes('assertStudySourceCompleteness(input.allCandidates, input.sourceBlocks, input.selectedGroups)'), 'schedule update preparation does not recheck source completeness in storage');
assert(db.includes('assertStudySourceCompleteness(preview.allCandidates, preview.sourceBlocks, preview.selectedGroups)'), 'schedule update apply does not recheck source completeness in storage');
assert(db.includes('active.sourceBlocks?.length') && db.includes('completenessForSelectedGroups(sourceAnalysis, selectedGroups)'), 'group recalculation does not enforce persisted source completeness');
assert(source('src/study/StudyView.tsx').includes('sourceBlocks: analysis.sourceBlocks'), 'Study UI does not pass source blocks to storage gates');

// Study import warnings must stay readable without forcing redundant confirmation clicks.
const studyView = source('src/study/StudyView.tsx');
const studyProfile = source('src/study/StudyProfileSettings.tsx');
const studyDiff = source('src/study/ScheduleDiffView.tsx');
const studyImportReview = source('src/study/import-review.ts');
const componentCss = source('src/styles/components.css');
const responsiveCss = source('src/styles/responsive.css');
for (const uiSource of [studyView, studyProfile, studyDiff]) assert(!uiSource.includes('className="decision-toggle"'), 'study warnings require an extra consent checkbox');
assert(studyView.includes('Konflikty pozostają widoczne, ale nie wymagają dodatkowego potwierdzenia'), 'initial study import conflict notice is no longer low-friction');
assert(studyDiff.includes('zapisze wybrane zmiany także wtedy, gdy część zajęć się nakłada'), 'schedule update conflict notice lost explicit action semantics');
assert(studyProfile.includes('bez dodatkowego checkboxa'), 'group recalculation still implies a separate conflict-confirmation click');
assert(studyView.includes('allowScheduleConflicts: scheduleConflicts.length > 0'), 'initial study import no longer binds the primary action to the displayed conflict set');
assert(studyView.includes('allowScheduleConflicts: Boolean(updatePreview.scheduleConflicts?.length)'), 'schedule update apply action no longer binds to displayed conflicts');
assert(studyProfile.includes('Boolean(recalculation.scheduleConflicts?.length)'), 'group recalculation apply action no longer binds to displayed conflicts');
assert(db.includes('if (conflicts.length && !input.allowScheduleConflicts)'), 'storage conflict guard was removed instead of moving acknowledgement to the primary action');
assert(componentCss.includes('.candidate-card.unselected { opacity: 1;'), 'unselected study cards are globally dimmed');
assert(studyView.includes('className="study-conflict-list"'), 'study conflict list lost structured layout');
assert(responsiveCss.includes('.study-conflict-list li { grid-template-columns: 1fr;'), 'study conflict list lacks narrow-screen collapse');
assert(studyImportReview.includes('const hasSourceWeek = Boolean(candidate.sourceWeekStart && candidate.sourceWeekEnd)'), 'weekly source-only Study entries can regress to hard date blockers');
assert(studyImportReview.includes("severity: 'INCOMPLETE'"), 'source-week missing date is no longer represented as incomplete');
assert(studyCompleteness.includes("status = 'SOURCE_INCONSISTENT'"), 'advisory seminar hour inconsistencies are no longer surfaced');
assert(studyView.includes('deklaracji godzin seminariów nie zgadza się z datowanymi terminami'), 'Study UI hides advisory seminar-hour inconsistencies');
assert(app.includes('activeStudyGroups={activeStudyGroups}'), 'Calendar does not receive active Study groups');
assert(app.includes('getActiveUniversityImport()'), 'App does not load active Study import metadata for calendar context');
assert(calendarView.includes('className="calendar-study-context"'), 'calendar lacks visible active Study group context');
assert(calendarView.includes('Plan studiów aktywny'), 'calendar Study context lacks concise label');
assert(calendarView.includes('calendar-side-column') && calendarView.includes('calendar-side-study-context'), 'active Study context is not placed in the compact right-side calendar column');
assert(calendarView.indexOf('calendar-side-study-context') > calendarView.indexOf('className="panel selected-day-panel"'), 'active Study context must remain below the selected-day panel');
assert(calendarView.includes('const WEEK_DESKTOP_VERTICAL_CHROME = 225;'), 'adaptive week density did not reclaim the vertical space freed by moving Study context');
assert(calendarCss.includes('/* 1.2.0.50 - move Study context out of the main calendar vertical flow */'), '1.2.0.50 compact calendar side-context styles missing');
assert(mobileResponsiveCss.includes('/* 1.2.0.50 - compact side Study context */'), '1.2.0.50 responsive side-context styles missing');
assert(studyProfile.includes('study-profile-heading-status') && studyProfile.includes('activeGroups.length'), 'Study profile does not expose active-plan group status');
assert(studyProfile.includes('study-future-groups-note'), 'Study profile does not distinguish future-only group selection');
assert(studyProfile.includes('study-profile-settings-always-open') && studyProfile.includes('Wybór grup') && studyProfile.includes('study-group-dashboard') && studyProfile.includes('setPartitionGroup') && !studyProfile.includes('Zmień grupy') && !studyProfile.includes('setEditing'), '1.2.0.102 Study group controls are no longer permanently visible in compact dashboard form');
assert(source('src/study/StudyGroupPreviewPanel.tsx').includes('<section className="study-preview-sandbox">') && !source('src/study/StudyGroupPreviewPanel.tsx').includes('<section className="panel study-preview-sandbox">'), '1.2.0.101 Study preview returned to a nested panel');
assert(transfer.includes('data-transfer-privacy-details') && transfer.includes('Informacje o bezpieczeństwie eksportu'), '1.2.0.101 compact transfer safety disclosure missing');
assert(!safety.includes('<section className="panel safety-center">') && safety.includes('settings-section-intro'), '1.2.0.101 Settings safety hierarchy returned to a nested panel');
assert(interfaceConsistency.includes('/* 1.2.0.101 - compact Studies and Settings without hiding primary controls. */') && interfaceConsistency.includes('.study-profile-group-picker .group-chip { min-height: 42px;'), '1.2.0.101 compact UI or mobile touch-size guard missing');
assert(studyProfile.includes('PROFILE_PARTITIONS') && studyProfile.includes('study-group-dashboard-card') && studyProfile.includes('<select value={current}'), '1.2.0.102 Study group dashboard selector missing');
assert(workView.includes('className="work-overview-dashboard"'), '1.2.0.102 Work overview is no longer grouped as a dashboard');
assert(settingsView.includes('className="settings-dashboard-grid"'), '1.2.0.102 Settings top modules are no longer grouped as a dashboard');
assert(interfaceConsistency.includes('/* 1.2.0.102 - dashboard density: compact Studies, Work overview and Settings. */') && interfaceConsistency.includes('.study-group-dashboard-card select') && interfaceConsistency.includes('.work-overview-dashboard') && interfaceConsistency.includes('.settings-dashboard-grid'), '1.2.0.102 dashboard density styles missing');
assert(studyViewSource.includes('study-upload-dashboard') && interfaceConsistency.includes('.study-view .study-upload-dashboard'), '1.2.0.102 compact Study import dashboard missing');
// 1.2.0.103 continues dashboard density without hiding primary actions and adds optional calendar information layers.
assert(todayView.includes('today-add-row') && todayView.includes('+ Dodaj wydarzenie') && todayView.includes('<div className="today-header-actions" />'), '1.2.0.103 Today add action is no longer centered below the agenda');
assert(financeDashboard.includes('!newTripOpen && tripSummaries.length') && financeDashboard.includes('Utwórz pierwszy wyjazd, a jego wydatki będą zebrane w jednym miejscu.'), '1.2.0.103 empty Trips returned to duplicated header/empty-state actions');
assert(settingsView.includes('showPolishHolidays') && settingsView.includes('showWumAcademicCalendar') && db.includes('showPolishHolidays: settings?.showPolishHolidays ?? true') && db.includes('showWumAcademicCalendar: settings?.showWumAcademicCalendar ?? true'), '1.2.0.103 optional calendar layers are not persisted safely');
assert(calendarView.includes('calendarOverlayMarkersForDate') && calendarView.includes('calendar-selected-day-overlays') && calendarView.includes('calendar-overlay-dots'), '1.2.0.103 calendar overlay rendering missing');
assert(calendarOverlays.includes("'2026-10-05'") && calendarOverlays.includes("'2026-12-21'") && calendarOverlays.includes("'2027-09-30'") && calendarOverlays.includes("'Wigilia Bożego Narodzenia'"), '1.2.0.103 official holiday/WUM overlay dataset incomplete');
assert(safety.includes('journal.slice(0, showAllHistory ? journal.length : 5)') && safety.includes('Pokaż całą historię'), '1.2.0.103 Settings history is no longer compact by default');
assert(interfaceConsistency.includes('/* 1.2.0.103 - dashboard continuation: compact actions, calendar context and informational overlays. */') && interfaceConsistency.includes('.availability-week-days { grid-template-columns: repeat(2, minmax(0, 1fr)); }') && interfaceConsistency.includes('.work-summary-view { max-width: none;'), '1.2.0.103 dashboard continuation styles missing');
assert(availabilityView.includes('availability-week-days') && workSummaryView.includes('work-summary-view'), '1.2.0.103 Work dashboard sources missing');
// 1.2.0.104 finishes desktop compaction without hiding data or shrinking touch targets.
assert(availabilityView.includes('availability-dashboard-layout') && interfaceConsistency.includes('grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr)'), '1.2.0.104 Availability 2/3 + 1/3 dashboard missing');
assert(studyProfile.includes('study-profile-plan-summary') && !studyProfile.includes('Grupy aktywnego planu'), '1.2.0.104 Study profile duplicates active group chips above selectors');
assert(calendarView.includes('calendar-study-context-details') && interfaceConsistency.includes('.calendar-side-column.is-empty .selected-day-panel .empty-state'), '1.2.0.104 Calendar compact context or empty-day density guard missing');
assert(settingsView.includes('Święta PL') && settingsView.includes('WUM 26/27') && interfaceConsistency.includes('.settings-layer-switch input:checked'), '1.2.0.104 compact calendar layer switches missing');

// 1.2.0.105 mobile touch targets after dashboard compaction.
assert(interfaceConsistency.includes('/* 1.2.0.105 - mobile touch-target hardening after dashboard compaction. */'), '1.2.0.105 mobile touch-target block missing');
assert(interfaceConsistency.includes('.availability-time-chip,') && interfaceConsistency.includes('.availability-proposal-chip,') && interfaceConsistency.includes('.availability-day-rule-button') && interfaceConsistency.includes('min-height: 42px;'), '1.2.0.105 Availability touch targets missing');
assert(interfaceConsistency.includes('.today-plan-panel .today-add-row .today-add-button') && interfaceConsistency.includes('min-height: 44px !important;'), '1.2.0.105 Today primary CTA touch target missing');

// 1.2.0.106 real-device phone screenshots: restore Finance scan and compact the longest mobile flows.
assert(interfaceConsistency.includes('/* 1.2.0.106 - real-phone compaction based on 1.2.0.105 screenshots. */'), '1.2.0.106 real-phone compaction block missing');
assert(interfaceConsistency.includes('.finance-dashboard-controls-v1258 .finance-core-actions .finance-scan-receipt') && interfaceConsistency.includes('display: inline-flex !important;'), '1.2.0.106 mobile Finance scanner is hidden again');
assert(studyViewSource.includes('study-import-group-dashboard') && studyViewSource.includes('setImportPartitionGroup') && studyViewSource.includes('Wybierz grupę importu:'), '1.2.0.106 compact Study import group selectors missing');
assert(interfaceConsistency.includes('.availability-dashboard-layout .availability-week-day') && interfaceConsistency.includes('.work-summary-facts.work-summary-facts-grid'), '1.2.0.106 Work mobile compaction guards missing');

// 1.2.0.107 removes redundant month-counter dots and enables safe receipt scanning inside foreign-currency trips.
assert(!calendarView.includes('<i aria-hidden="true" />{counts[category]}'), '1.2.0.107 redundant calendar counter dot returned');
assert(!financeDashboard.includes('Skanowanie zagranicznych paragonów nie jest jeszcze obsługiwane'), '1.2.0.107 foreign-trip scanner is blocked again');
assert(financeDashboard.includes('convertForeignReceiptDraftToPln(receiptDraft, currency, rate)') && financeDashboard.includes('Paragon dodany do wyjazdu ${tripName}.'), '1.2.0.107 scanned trip receipt is not converted/assigned through the active-trip flow');
assert(foreignReceipt.includes("originalCurrency: currency") && foreignReceipt.includes("conversionSource: 'rate'") && foreignReceipt.includes('roundingDelta'), '1.2.0.107 foreign receipt conversion metadata or rounding guard missing');

// 1.2.0.108 keeps foreign-currency OCR review semantically correct and restores duplicate warnings after PLN conversion.
assert(receiptScanFlow.includes('displayCurrency?: FinanceCurrencyCode') && receiptScanFlow.includes('currency: displayCurrency') && receiptScanFlow.includes('waluta paragonu: <strong>{displayCurrency}</strong>'), '1.2.0.108 foreign-trip OCR currency context missing');
assert(receiptScanReview.includes('reviewAmountMinor(value: number, currency: FinanceCurrencyCode)') && receiptScanReview.includes("Kwota{displayCurrency === 'PLN' ? '' : ` (${displayCurrency})`}"), '1.2.0.108 OCR review can label foreign raw amounts as PLN');
assert(receiptDuplicate.includes('receipt.originalCurrency !== foreignCurrency') && receiptDuplicate.includes('receipt.originalAmountMinor !== totalMinor') && receiptDuplicate.includes("normalizeExpenseProductKey(receipt.tripName ?? '') !== tripKey"), '1.2.0.108 foreign duplicate detector does not use original trip-currency metadata');

// 1.2.0.109 returns Trips to manual expense entry and adds focused daily usability without another broad redesign.
assert((financeDashboard.match(/Skanuj paragon/g) ?? []).length === 1 && financeDashboard.includes("financeScope === 'MONTH'"), '1.2.0.109 receipt scanner is exposed outside the Month finance flow');
assert(todayView.includes('today-glance-grid') && todayView.includes('Najbliższe zajęcia') && todayView.includes('Najbliższa praca') && todayView.includes('calendarOverlayMarkersForDate'), '1.2.0.109 Today glance dashboard or day context missing');
assert(app.includes('calendarEvents={events}') && eventForm.includes('event-conflict-warning') && eventForm.includes('findEventConflicts') && eventConflicts.includes("event.availabilityImpact !== 'NON_BLOCKING'"), '1.2.0.109 non-blocking event collision warning is not wired safely');
assert(calendarView.includes('className="calendar-overlay-dots" role="img"') && calendarView.includes('aria-label={overlayMarkers.map((marker) => marker.label)'), '1.2.0.109 calendar overlay meaning is hidden from assistive technology');
assert(interfaceConsistency.includes('/* 1.2.0.109 - focused usability: Today glance dashboard, non-blocking collision warning and manual-only trip expenses. */'), '1.2.0.109 focused usability styles missing');

// 1.2.0.110 makes calendar overlay dots understandable on mobile after selecting the marked day.
assert(calendarView.includes('selectedEvents.length || selectedIncompleteStudyEntries.length || selectedDayOverlayMarkers.length') && calendarView.includes('calendar-mobile-day-preview-overlays') && calendarView.includes('Informacja o dniu'), '1.2.0.110 mobile selected-day overlay context missing');
assert(responsiveCss.includes('1.2.0.110 - mobile calendar overlay meaning is visible after selecting a marked day.'), '1.2.0.110 mobile overlay context styles missing');

// 1.2.0.111 keeps Study plan freshness factual and makes update diffs easier to scan.
assert(db.includes('getLatestAppliedScheduleUpdateSession') && db.includes("item.status === 'APPLIED'"), '1.2.0.111 latest applied Study update lookup missing');
assert(studyView.includes('study-plan-freshness') && studyView.includes('Ostatnie porównanie') && studyView.includes('latestAppliedUpdate?.newFileHash === activeImport.fileHash'), '1.2.0.111 active Study plan freshness status missing or not tied to the active file');
assert(studyDiff.includes('summarizeScheduleDiffChangeTypes') && studyDiff.includes('W zmienionych zajęciach:') && studyDiff.includes('Lokalizacje') && studyDiff.includes('Grupy'), '1.2.0.111 Study update change-type breakdown missing');
assert(interfaceConsistency.includes('/* 1.2.0.111 - compact study plan freshness and readable update breakdown. */'), '1.2.0.111 Study freshness styles missing');

// 1.2.0.112 prepares the repository for release without changing domain behavior.
assert(packageJson.scripts?.['release:preflight'] === 'node scripts/release-preflight.mjs', '1.2.0.112 release preflight script missing');
assert(githubCi.includes('npm ci') && githubCi.includes('npm run check') && githubCi.includes('npm run security:dependencies'), '1.2.0.112 GitHub CI validation path incomplete');
if (releaseChecklist) assert(releaseChecklist.includes('GitHub Desktop') && releaseChecklist.includes('Visual QA') && releaseChecklist.includes('SHA256'), '1.2.0.112 release checklist incomplete');
assert(releasePreflight.includes('RELEASE_PREFLIGHT_PREP_OK') && releasePreflight.includes('Service Worker cache revision differs from APP_VERSION'), '1.2.0.112 dependency-free release preflight incomplete');
assert(publicPackageGate.includes('forbiddenPrivateDocPatterns') && publicPackageGate.includes('HANDOFF_NEW_CHAT_') && publicPackageGate.includes('CLEAN_CHECKPOINT_CONTENTS'), '1.2.0.112 public package gate can leak PRIVATE checkpoint documents');
assert(gitignore.includes('.vite/') && gitignore.includes('test-results/') && gitignore.includes('playwright-report/'), '1.2.0.112 local release/test artifacts are not ignored');
assert(interfaceConsistency.includes('/* 1.2.0.112 - compact release-prep polish: denser desktop history, unchanged mobile touch targets. */'), '1.2.0.112 compact Settings release-prep styles missing');
assert(studyView.includes('className="import-history-group-list"'), 'Study import history still renders groups as dense text');
assert(componentCss.includes('.calendar-study-context'), 'calendar Study group context styling missing');
assert(app.includes('incompleteStudyEntries={incompleteStudyEntries}'), 'Calendar does not receive source-incomplete Study entries');
assert(calendarView.includes('study-incomplete-marker'), 'Calendar hides source-incomplete Study blocks');
assert(calendarView.includes('to nie jest potwierdzone wydarzenie'), 'Calendar does not distinguish source-incomplete blocks from confirmed events');
assert(studyView.includes('Bloki i godziny źródłowe'), 'Study preview lacks source completeness summary');
assert(componentCss.includes('.study-completeness-panel') && componentCss.includes('.study-incomplete-marker'), 'source completeness UI styles missing');

// 1.2.0.98 keeps bottom navigation, toasts and PWA content clear of device safe areas.
assert(mobileResponsiveCss.includes('/* 1.2.0.98 - shared safe-area clearance for bottom navigation and mobile PWA edges. */'), '1.2.0.98 mobile safe-area marker missing');
assert(mobileResponsiveCss.includes('--mobile-bottom-nav-clearance: calc(74px + max(8px, env(safe-area-inset-bottom)))'), 'shared mobile bottom-navigation safe-area clearance missing');
assert(mobileResponsiveCss.includes('padding-bottom: calc(var(--mobile-bottom-nav-clearance) + 8px);'), 'mobile app content can fall behind bottom navigation');
assert(mobileResponsiveCss.includes('.toast,\n  .finance-feedback-toast,') && mobileResponsiveCss.includes('bottom: var(--mobile-bottom-nav-clearance);'), 'mobile toasts can cover bottom navigation');
assert(mobileResponsiveCss.includes('padding-top: max(8px, env(safe-area-inset-top));') && mobileResponsiveCss.includes('padding-left: max(18px, env(safe-area-inset-left));') && mobileResponsiveCss.includes('padding-right: max(18px, env(safe-area-inset-right));'), 'mobile PWA view does not protect top/side safe areas');


// 1.2.0.99 keeps mobile modal forms inside the real visual viewport when the software keyboard opens.
assert(modal.includes('window.visualViewport'), 'mobile modal does not observe the real visual viewport');
assert(modal.includes("viewport?.addEventListener('resize', syncVisualViewport)"), 'mobile modal does not react to visual viewport resize');
assert(modal.includes("viewport?.addEventListener('scroll', syncVisualViewport)"), 'mobile modal does not track visual viewport offset changes');
assert(modal.includes("--modal-visual-viewport-height"), 'modal visual viewport height is not exposed to CSS');
assert(modal.includes("--modal-visual-viewport-offset-top"), 'modal visual viewport offset is not exposed to CSS');
assert(mobileResponsiveCss.includes('/* 1.2.0.99 - mobile modals follow the real visual viewport when the software keyboard opens. */'), '1.2.0.99 mobile keyboard viewport marker missing');
assert(mobileResponsiveCss.includes('height: var(--modal-visual-viewport-height, 100dvh);'), 'mobile modal backdrop does not shrink with the software keyboard');
assert(mobileResponsiveCss.includes('inset: var(--modal-visual-viewport-offset-top, 0px) 0 auto;'), 'mobile modal backdrop does not follow visual viewport offset');

// Month grid stays compact. Details remain available in the selected-day panel and a native desktop tooltip.
assert(!calendarView.includes('className="calendar-day-events"'), 'calendar month grid unexpectedly returned to dense inline event previews');
assert(calendarView.includes('className="category-count-row calendar-day-counts"'), 'calendar compact event counters missing');
assert(calendarView.includes("title={dayEvents.map((event) => `${calendarEventTimeLabel(event, key, timeFormat)} ${event.title}`).join('\\n')}"), 'calendar compact counters lost event detail tooltip');
assert(!componentCss.includes('.calendar-panel .calendar-day-counts { display: none; }'), 'desktop month counters are hidden');
assert(calendarView.includes('activeStudyGroups.map(studyGroupDisplayLabel).join'), 'calendar Study context lost full group labels in accessibility metadata');

console.log('RELEASE_SAFETY_GATE_OK');
