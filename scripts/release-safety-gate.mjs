import { existsSync, readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
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
const buildInfo = JSON.parse(source('BUILD_INFO.json'));
const packageJson = JSON.parse(source('package.json'));
const studyCompleteness = source('src/study/study-completeness.ts');
const studyMatrixAdapter = source('src/imports/xlsx/adapters/nursing-week-matrix-v2.adapter.ts');
const studyRegistry = source('src/imports/xlsx/adapter-registry.ts');
const workPdfFile = source('src/imports/pdf/work-pdf-file.ts');
const workView = source('src/work/WorkView.tsx');
const viteConfig = source('vite.config.ts');


// RC package identity must be visible in-app and synchronized with build metadata.
assert(version.includes("APP_VERSION = '1.1.2'"), 'APP_VERSION drifted');
assert(!version.includes('APP_BUILD') && !version.includes('APP_STAGE'), 'technical build/stage metadata leaked back into app version module');
assert(version.includes('DATABASE_SCHEMA_VERSION = 13'), 'database schema changed unexpectedly');
assert(buildInfo.appVersion === '1.1.2' && buildInfo.channel === 'stable' && buildInfo.date === '2026-09-06', 'BUILD_INFO.json is not synchronized with 1.1.2 metadata');
assert(packageJson.version === '1.1.2', 'package.json version drifted');
assert(packageJson.scripts?.build?.includes('service-worker-gate.mjs') && packageJson.scripts?.build?.includes('release-safety-gate.mjs'), 'future production build does not execute release gates');
assert(packageJson.scripts?.build?.includes('security-release-gate.mjs'), 'future production build does not execute security release gate');
assert(packageJson.scripts?.['security:public']?.includes('public-package-gate.mjs'), 'public package security gate script is missing');
assert(packageJson.scripts?.['security:dependencies']?.includes('npm audit --omit=dev --audit-level=high'), 'production dependency audit script is missing');
assert(viteConfig.includes('sourcemap: false'), 'production source maps are not disabled');
assert(workPdfFile.includes('MAX_WORK_PDF_FILE_BYTES = 32 * 1024 * 1024'), 'work PDF pre-read size limit missing or changed unexpectedly');
assert(workPdfFile.includes("bytes[0] === 0x25") && workPdfFile.includes("bytes[4] === 0x2d"), 'work PDF signature validation missing');
assert(workView.includes('await validateWorkPdfFile(file)'), 'Work PDF security validation is not wired into import flow');
assert(workView.indexOf('await validateWorkPdfFile(file)') < workView.indexOf('file.arrayBuffer()'), 'Work PDF full read happens before security validation');

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

// Backup and transfer files must be bounded before materializing their text in memory.
const loadBackup = between(safety, 'async function loadBackup(file: File)', '\n\n  return (');
assert(loadBackup.indexOf('file.size > MAX_BACKUP_FILE_BYTES') >= 0, 'backup pre-read size limit missing');
assert(loadBackup.indexOf('file.size > MAX_BACKUP_FILE_BYTES') < loadBackup.indexOf('await file.text()'), 'backup size check happens after file.text()');
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
assert(sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`"), 'current service worker cache version missing');
assert(audit.includes("const CACHE_NAME = `${CACHE_PREFIX}v1.1.2`"), 'production audit still expects an obsolete service worker revision');
assert(!/\bcaches\.match\s*\(/u.test(sw), 'service worker can read foreign origin caches');
assert(sw.includes('key.startsWith(CACHE_PREFIX)'), 'service worker can delete unrelated caches');
assert(sw.includes('await caches.delete(CACHE_NAME)'), 'partial current cache cleanup missing');
assert(sw.includes('MANDATORY_SHELL_ASSET_PATHS'), 'mandatory PWA shell asset list missing');
for (const asset of ['manifest.webmanifest', 'favicon.svg', 'icon-192-v111.png', 'icon-512-v111.png', 'apple-touch-icon-v111.png']) assert(sw.includes(`'${asset}'`), `mandatory PWA asset missing: ${asset}`);
assert(sw.includes("const PRIVATE_FILE_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.json'];"), 'private document cache bypass list missing');

const settingsView = source('src/settings/SettingsView.tsx');
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
const calendarView = source('src/calendar/CalendarView.tsx');
assert(calendarView.includes('className="calendar-study-context"'), 'calendar lacks visible active Study group context');
assert(calendarView.includes('Plan dla grup'), 'calendar Study context lacks concise label');
assert(studyProfile.includes('Grupy aktywnego planu'), 'Study profile does not distinguish active-plan groups');
assert(studyProfile.includes('study-future-groups-note'), 'Study profile does not distinguish future-only group selection');
assert(studyView.includes('className="import-history-group-list"'), 'Study import history still renders groups as dense text');
assert(componentCss.includes('.calendar-study-context'), 'calendar Study group context styling missing');
assert(app.includes('incompleteStudyEntries={incompleteStudyEntries}'), 'Calendar does not receive source-incomplete Study entries');
assert(calendarView.includes('study-incomplete-marker'), 'Calendar hides source-incomplete Study blocks');
assert(calendarView.includes('to nie jest potwierdzone wydarzenie'), 'Calendar does not distinguish source-incomplete blocks from confirmed events');
assert(studyView.includes('Bloki i godziny źródłowe'), 'Study preview lacks source completeness summary');
assert(componentCss.includes('.study-completeness-panel') && componentCss.includes('.study-incomplete-marker'), 'source completeness UI styles missing');

// Month grid stays compact. Details remain available in the selected-day panel and a native desktop tooltip.
assert(!calendarView.includes('className="calendar-day-events"'), 'calendar month grid unexpectedly returned to dense inline event previews');
assert(calendarView.includes('className="category-count-row calendar-day-counts"'), 'calendar compact event counters missing');
assert(calendarView.includes("title={dayEvents.map((event) => `${calendarEventTimeLabel(event, key, timeFormat)} ${event.title}`).join('\\n')}"), 'calendar compact counters lost event detail tooltip');
assert(!componentCss.includes('.calendar-panel .calendar-day-counts { display: none; }'), 'desktop month counters are hidden');
assert(calendarView.includes('studyGroupCompactLabel(group)'), 'calendar group chips no longer disambiguate same-label group sizes');

console.log('RELEASE_SAFETY_GATE_OK');
