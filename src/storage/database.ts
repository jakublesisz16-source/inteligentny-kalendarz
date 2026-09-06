import { APP_VERSION, DATABASE_SCHEMA_VERSION } from '../core/version';
import type { CalendarEvent, EventDraft, ManualMultiDateDraft, UserModifiedEventField } from '../events/event.types';
import { validateEventDraft, validateManualMultiDateDraft } from '../events/event.validation';
import { eventOccursOnDate, inferSpanType, splitLocalDateTime, toLocalDateKey, uniqueSortedDateKeys } from '../calendar/date.utils';
import type { Location, LocationDraft } from '../locations/location.types';
import type { AppSettings, AppSettingsPatch } from '../settings/settings.types';
import { DEFAULT_DECORATIVE_BACKGROUND_MODE, normalizeDecorativeBackgroundMode } from '../settings/appearance';
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from '../notifications/notification-preferences';
import type { NotificationReminder, NotificationRuntime } from '../notifications/notification.types';
import type { BackupDocument, BackupInspection, BackupSummary, ChangeJournalEntry, ChangeOperationType, ChangeEntityType, DatabaseSnapshot, DayConstraint, RestorePoint, RestorePointReason, TrashItem } from '../safety/safety.types';
import { nextJournalTimestampIso } from '../safety/change-journal-order';
import { reviewCandidate } from '../study/import-review';
import { applyCorrectionRules } from '../study/study-corrections';
import { buildScheduleDiff, recalculateDiffSummary } from '../study/study-diff';
import { identifyCandidate, identifyEntry } from '../study/study-identity';
import { candidatesForSelectedGroups, findStudyScheduleConflicts, findStudyUpdateDecisionConflicts, validateStudyGroupSelection } from '../study/study.service';
import { completenessForSelectedGroups } from '../study/study-completeness';
import { formatStudyGroupList, groupSetsIntersect } from '../imports/xlsx/group-normalizer';
import { validateCandidateForImport } from '../imports/xlsx/import-validation';
import type {
  ConfirmedWorkBlock,
  CoworkerOverlap,
  WorkCoworkerShift,
  WorkImportCommitInput,
  WorkImportCommitResult,
  WorkProfile,
  WorkScheduleEntry,
  WorkScheduleImport,
} from '../work/work.types';
import { coworkerOverlaps, workDateTimes, workMinutes } from '../work/work.service';
import { analyzeCalendarConsistency, openPlanningBlockingIssues } from '../planning/consistency';
import type { CalendarConsistencyIssue, ConsistencyAcknowledgement, DailyRoutineRule, DayAttribute, DayPlanningContext, DayPlanningProfile, WeekPlanningContext } from '../planning/planning.types';
import type { AvailabilityPlan } from '../availability/availability.types';
import type { ShoppingItem, ShoppingItemDraft } from '../shopping/shopping.types';
import type { ExpenseCategory, Receipt, ReceiptDraft, ReceiptItem } from '../shopping/expenses.types';
import { CYCLE_BLEEDING_LEVELS, CYCLE_PAIN_LEVELS, CYCLE_WELLBEING_LEVELS } from '../cycle/cycle.types';
import type { CycleGapDecision, CycleJournalEntry, CycleJournalEntryDraft, CyclePeriod, CyclePeriodDraft } from '../cycle/cycle.types';
import { cycleDaysBetween, isValidCycleDateKey } from '../cycle/cycle-prediction';
import { normalizeShoppingName, normalizeShoppingQuantity, sortShoppingItems } from '../shopping/shopping.utils';
import { DEFAULT_EXPENSE_CATEGORY_DEFINITIONS, expenseCategoryNameKey, isDepositExpenseCategoryName, normalizeExpenseText } from '../shopping/expenses.utils';
import type {
  ApplyScheduleUpdateResult,
  CommitUniversityImportInput,
  CommitUniversityImportResult,
  GroupRecalculationPreview,
  PendingStudyCorrectionRule,
  ScheduleDiffItem,
  ScheduleUpdatePreview,
  ScheduleUpdateSession,
  StudyCorrectionField,
  StudyCorrectionRule,
  StudyProfile,
  StudyScheduleCandidate,
  StudySourceBlock,
  UniversityImportEntry,
  UniversityScheduleImport,
  StudyPreviewProfile,
  StudyGroupPreview,
} from '../study/study.types';

const DB_NAME = 'inteligentny-kalendarz';
const STORE_EVENTS = 'events';
const STORE_LOCATIONS = 'locations';
const STORE_SETTINGS = 'settings';
const STORE_META = 'meta';
const STORE_UNIVERSITY_IMPORTS = 'universityImports';
const STORE_UNIVERSITY_IMPORT_ENTRIES = 'universityImportEntries';
const STORE_STUDY_PROFILE = 'studyProfile';
const STORE_SCHEDULE_UPDATE_SESSIONS = 'scheduleUpdateSessions';
const STORE_STUDY_CORRECTION_RULES = 'studyCorrectionRules';
const STORE_CHANGE_JOURNAL = 'changeJournal';
const STORE_TRASH_ITEMS = 'trashItems';
const STORE_RESTORE_POINTS = 'restorePoints';
const STORE_DAY_CONSTRAINTS = 'dayConstraints';
const STORE_STUDY_PREVIEW_PROFILES = 'studyPreviewProfiles';
const STORE_WORK_PROFILES = 'workProfiles';
const STORE_WORK_SCHEDULE_IMPORTS = 'workScheduleImports';
const STORE_WORK_SCHEDULE_ENTRIES = 'workScheduleEntries';
const STORE_WORK_COWORKER_SHIFTS = 'workCoworkerShifts';
const STORE_DAY_PLANNING_PROFILES = 'dayPlanningProfiles';
const STORE_DAILY_ROUTINE_RULES = 'dailyRoutineRules';
const STORE_DAY_ATTRIBUTES = 'dayAttributes';
const STORE_CONSISTENCY_ACKNOWLEDGEMENTS = 'consistencyAcknowledgements';
const STORE_AVAILABILITY_PLANS = 'availabilityPlans';
const STORE_SHOPPING_ITEMS = 'shoppingItems';
const STORE_EXPENSE_CATEGORIES = 'expenseCategories';
const STORE_RECEIPTS = 'receipts';
const STORE_CYCLE_PERIODS = 'cyclePeriods';
const STORE_CYCLE_JOURNAL_ENTRIES = 'cycleJournalEntries';
const STORE_NOTIFICATION_RUNTIME = 'notificationRuntime';
const STORE_NOTIFICATION_REMINDERS = 'notificationReminders';
const CHANGE_JOURNAL_LIMIT = 100;
const AUTOMATIC_RESTORE_POINT_LIMIT = 10;

interface MetaRecord {
  key: string;
  value: string | number | boolean;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let fallbackIdCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function journalNowIso(): string {
  return new Date(Date.now()).toISOString();
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now()}-${fallbackIdCounter}`;
}


function buildJournalEntry(input: {
  operationType: ChangeOperationType;
  entityType: ChangeEntityType;
  entityIds: string[];
  description: string;
  beforeState?: unknown;
  afterState?: unknown;
  reversible?: boolean;
  groupId?: string;
  restorePointId?: string;
  metadata?: Record<string, unknown>;
}): ChangeJournalEntry {
  return {
    id: createId('change'),
    timestamp: journalNowIso(),
    operationType: input.operationType,
    entityType: input.entityType,
    entityIds: [...input.entityIds],
    description: input.description,
    ...(input.beforeState !== undefined ? { beforeState: input.beforeState } : {}),
    ...(input.afterState !== undefined ? { afterState: input.afterState } : {}),
    reversible: input.reversible ?? true,
    ...(input.groupId ? { groupId: input.groupId } : {}),
    ...(input.restorePointId ? { restorePointId: input.restorePointId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

function putJournalEntry(transaction: IDBTransaction, entry: ChangeJournalEntry): void {
  const store = transaction.objectStore(STORE_CHANGE_JOURNAL);
  const request = store.getAll() as IDBRequest<ChangeJournalEntry[]>;
  request.onsuccess = () => {
    const timestamp = nextJournalTimestampIso(entry.timestamp, request.result.map((item) => item.timestamp));
    store.put({ ...entry, timestamp } satisfies ChangeJournalEntry);
  };
}

async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function restoreSnapshotStoreNames(): string[] {
  return [
    STORE_EVENTS,
    STORE_LOCATIONS,
    STORE_SETTINGS,
    STORE_META,
    STORE_UNIVERSITY_IMPORTS,
    STORE_UNIVERSITY_IMPORT_ENTRIES,
    STORE_STUDY_PROFILE,
    STORE_SCHEDULE_UPDATE_SESSIONS,
    STORE_STUDY_CORRECTION_RULES,
    STORE_TRASH_ITEMS,
    STORE_DAY_CONSTRAINTS,
    STORE_STUDY_PREVIEW_PROFILES,
    STORE_WORK_PROFILES,
    STORE_WORK_SCHEDULE_IMPORTS,
    STORE_WORK_SCHEDULE_ENTRIES,
    STORE_WORK_COWORKER_SHIFTS,
    STORE_DAY_PLANNING_PROFILES,
    STORE_DAILY_ROUTINE_RULES,
    STORE_DAY_ATTRIBUTES,
    STORE_CONSISTENCY_ACKNOWLEDGEMENTS,
    STORE_AVAILABILITY_PLANS,
    STORE_SHOPPING_ITEMS,
    STORE_EXPENSE_CATEGORIES,
    STORE_RECEIPTS,
    STORE_CYCLE_PERIODS,
    STORE_CYCLE_JOURNAL_ENTRIES,
  ];
}

function backupSnapshotStoreNames(): string[] {
  return [...restoreSnapshotStoreNames(), STORE_CHANGE_JOURNAL];
}

function createMigrationSafetySnapshot(transaction: IDBTransaction, oldVersion: number): void {
  if (![4, 5, 6, 7, 8, 9, 10, 11, 12].includes(oldVersion)) return;
  if (!transaction.objectStoreNames.contains(STORE_RESTORE_POINTS)) return;
  const storeNames = [
    STORE_EVENTS,
    STORE_LOCATIONS,
    STORE_SETTINGS,
    STORE_META,
    STORE_UNIVERSITY_IMPORTS,
    STORE_UNIVERSITY_IMPORT_ENTRIES,
    STORE_STUDY_PROFILE,
    STORE_SCHEDULE_UPDATE_SESSIONS,
    STORE_STUDY_CORRECTION_RULES,
    STORE_CHANGE_JOURNAL,
    STORE_TRASH_ITEMS,
    STORE_DAY_CONSTRAINTS,
    STORE_STUDY_PREVIEW_PROFILES,
    STORE_WORK_PROFILES,
    STORE_WORK_SCHEDULE_IMPORTS,
    STORE_WORK_SCHEDULE_ENTRIES,
    STORE_WORK_COWORKER_SHIFTS,
    STORE_DAY_PLANNING_PROFILES,
    STORE_DAILY_ROUTINE_RULES,
    STORE_DAY_ATTRIBUTES,
    STORE_CONSISTENCY_ACKNOWLEDGEMENTS,
    STORE_AVAILABILITY_PLANS,
    STORE_SHOPPING_ITEMS,
    STORE_EXPENSE_CATEGORIES,
    STORE_RECEIPTS,
    STORE_CYCLE_PERIODS,
    STORE_CYCLE_JOURNAL_ENTRIES,
  ].filter((name) => transaction.objectStoreNames.contains(name));
  const stores: Record<string, unknown[]> = {};
  let remaining = storeNames.length;
  if (!remaining) return;
  for (const name of storeNames) {
    const request = transaction.objectStore(name).getAll();
    request.onsuccess = () => {
      stores[name] = request.result as unknown[];
      remaining -= 1;
      if (remaining !== 0) return;
      const capturedAt = nowIso();
      const fromAppVersion = oldVersion === 4 ? '0.2.3' : oldVersion === 5 ? '0.2.4' : oldVersion === 6 ? '0.3.0' : oldVersion === 7 ? '0.3.1' : oldVersion === 8 ? '0.3.4' : oldVersion === 9 ? '0.3.7' : oldVersion === 10 ? '0.4.1' : oldVersion === 11 ? '0.5.4' : '1.0.1';
      const snapshot: DatabaseSnapshot = {
        format: 'inteligentny-kalendarz-snapshot',
        snapshotVersion: 1,
        appVersion: fromAppVersion,
        databaseSchemaVersion: oldVersion,
        capturedAt,
        stores,
      };
      const point: RestorePoint = {
        id: createId('restore'),
        createdAt: capturedAt,
        label: `Przed migracją bazy ${oldVersion} -> ${DATABASE_SCHEMA_VERSION}`,
        reason: 'MIGRATION',
        schemaVersion: oldVersion,
        appVersion: fromAppVersion,
        snapshot,
        integrityMarker: 'upgrade-transaction-snapshot-v1',
        automatic: true,
        pinned: true,
      };
      transaction.objectStore(STORE_RESTORE_POINTS).put(point);
    };
  }
}

function normalizeLocationKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bul\.\s*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[,.;]+$/g, '')
    .trim();
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Błąd IndexedDB.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Błąd transakcji IndexedDB.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transakcja IndexedDB została przerwana.'));
  });
}

function ensureEventIndexes(store: IDBObjectStore): void {
  if (!store.indexNames.contains('startDateTime')) store.createIndex('startDateTime', 'startDateTime');
  if (!store.indexNames.contains('sourceImportId')) store.createIndex('sourceImportId', 'sourceImportId');
  if (!store.indexNames.contains('seriesKey')) store.createIndex('seriesKey', 'seriesKey');
  if (!store.indexNames.contains('occurrenceKey')) store.createIndex('occurrenceKey', 'occurrenceKey');
  if (!store.indexNames.contains('seriesId')) store.createIndex('seriesId', 'seriesId');
  if (!store.indexNames.contains('sourceWorkImportId')) store.createIndex('sourceWorkImportId', 'sourceWorkImportId');
  if (!store.indexNames.contains('sourceWorkEntryId')) store.createIndex('sourceWorkEntryId', 'sourceWorkEntryId');
}

function ensureEntryIndexes(store: IDBObjectStore): void {
  if (!store.indexNames.contains('importId')) store.createIndex('importId', 'importId');
  if (!store.indexNames.contains('eventId')) store.createIndex('eventId', 'eventId');
  if (!store.indexNames.contains('seriesKey')) store.createIndex('seriesKey', 'seriesKey');
  if (!store.indexNames.contains('occurrenceKey')) store.createIndex('occurrenceKey', 'occurrenceKey');
}

function candidateFromEntry(entry: UniversityImportEntry): StudyScheduleCandidate {
  return {
    id: entry.sourceCandidateId ?? entry.id,
    adapterId: entry.adapterId ?? 'nursing-plan-v1',
    sourceSheet: entry.sourceSheet,
    sourceRange: entry.sourceRange,
    sourceKey: entry.sourceKey,
    originalText: entry.originalText,
    subject: entry.subject,
    ...(entry.activityType ? { activityType: entry.activityType } : {}),
    ...(entry.date ? { date: entry.date } : {}),
    ...(entry.startTime ? { startTime: entry.startTime } : {}),
    ...(entry.endTime ? { endTime: entry.endTime } : {}),
    groupScope: entry.groupScope ?? (entry.groupTags.length ? 'SPECIFIC' : 'UNKNOWN'),
    groupTags: [...entry.groupTags],
    ...(entry.clinic ? { clinic: entry.clinic } : {}),
    ...(entry.room ? { room: entry.room } : {}),
    ...(entry.address ? { address: entry.address } : {}),
    ...(entry.locationLabel ? { locationLabel: entry.locationLabel } : {}),
    status: entry.warnings.length ? 'REVIEW_REQUIRED' : 'READY',
    warnings: [...entry.warnings],
    ...(entry.seriesKey ? { seriesKey: entry.seriesKey } : {}),
    ...(entry.occurrenceKey ? { occurrenceKey: entry.occurrenceKey } : {}),
    ...(entry.sourceWeekStart ? { sourceWeekStart: entry.sourceWeekStart } : {}),
    ...(entry.sourceWeekEnd ? { sourceWeekEnd: entry.sourceWeekEnd } : {}),
    ...(entry.sourceSectionKey ? { sourceSectionKey: entry.sourceSectionKey } : {}),
    ...(entry.declaredTeachingHours ? { declaredTeachingHours: entry.declaredTeachingHours } : {}),
  };
}

function issueCodesForCandidate(candidate: StudyScheduleCandidate): string[] {
  return reviewCandidate(candidate).issues.map((issue) => issue.code);
}

function backfillSchema3(transaction: IDBTransaction): void {
  const importsStore = transaction.objectStore(STORE_UNIVERSITY_IMPORTS);
  const entriesStore = transaction.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  const eventsStore = transaction.objectStore(STORE_EVENTS);
  const profileStore = transaction.objectStore(STORE_STUDY_PROFILE);

  const importsRequest = importsStore.getAll() as IDBRequest<UniversityScheduleImport[]>;
  importsRequest.onsuccess = () => {
    const imports = importsRequest.result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    const active = imports[0];
    for (const item of imports) {
      importsStore.put({
        ...item,
        lifecycleStatus: item.id === active?.id ? 'ACTIVE' : 'HISTORICAL',
        availableGroups: item.availableGroups ?? [...item.selectedGroups],
        sourceDataComplete: item.sourceDataComplete ?? false,
      } satisfies UniversityScheduleImport);
    }
    const profileRequest = profileStore.get('university') as IDBRequest<StudyProfile | undefined>;
    profileRequest.onsuccess = () => {
      const current = profileRequest.result;
      const timestamp = nowIso();
      const academicYear = current?.detectedAcademicYear ?? active?.detectedAcademicYear;
      const term = current?.detectedTerm ?? active?.detectedTerm;
      const profile: StudyProfile = {
        id: 'university',
        selectedGroups: current?.selectedGroups ?? active?.selectedGroups ?? [],
        availableGroups: current?.availableGroups ?? active?.availableGroups ?? active?.selectedGroups ?? [],
        ...(academicYear ? { detectedAcademicYear: academicYear } : {}),
        ...(term ? { detectedTerm: term } : {}),
        ...(current?.studyName ? { studyName: current.studyName } : {}),
        ...(active ? { activeImportId: active.id, lastPlanUpdatedAt: active.importedAt } : {}),
        sourceDataComplete: current?.sourceDataComplete ?? false,
        updatedAt: current?.updatedAt ?? timestamp,
      };
      profileStore.put(profile);
    };
  };

  const cursorRequest = entriesStore.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    const entry = identifyEntry(cursor.value as UniversityImportEntry);
    const migrated: UniversityImportEntry = { ...entry, sourceOnly: entry.sourceOnly ?? false };
    cursor.update(migrated);
    if (migrated.eventId) {
      const eventRequest = eventsStore.get(migrated.eventId) as IDBRequest<CalendarEvent | undefined>;
      eventRequest.onsuccess = () => {
        const event = eventRequest.result;
        if (!event) return;
        const candidate = candidateFromEntry(migrated);
        eventsStore.put({
          ...event,
          ...(migrated.seriesKey ? { seriesKey: migrated.seriesKey } : {}),
          ...(migrated.occurrenceKey ? { occurrenceKey: migrated.occurrenceKey } : {}),
          studyIssueCodes: issueCodesForCandidate(candidate),
          allDay: event.allDay ?? false,
          spanType: event.spanType ?? inferSpanType(event.startDateTime, event.endDateTime),
        } satisfies CalendarEvent);
      };
    }
    cursor.continue();
  };
}

function backfillSchema4(transaction: IDBTransaction): void {
  const eventsStore = transaction.objectStore(STORE_EVENTS);
  const cursorRequest = eventsStore.openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    const event = cursor.value as Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'startDateTime' | 'endDateTime'>;
    cursor.update({
      ...event,
      allDay: event.allDay ?? false,
      spanType: event.spanType ?? inferSpanType(event.startDateTime, event.endDateTime),
    });
    cursor.continue();
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DATABASE_SCHEMA_VERSION);
    let settled = false;

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const transaction = request.transaction;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const events = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        ensureEventIndexes(events);
      } else if (transaction) {
        ensureEventIndexes(transaction.objectStore(STORE_EVENTS));
      }
      if (!db.objectStoreNames.contains(STORE_LOCATIONS)) db.createObjectStore(STORE_LOCATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });

      if (!db.objectStoreNames.contains(STORE_UNIVERSITY_IMPORTS)) {
        const imports = db.createObjectStore(STORE_UNIVERSITY_IMPORTS, { keyPath: 'id' });
        imports.createIndex('fileHash', 'fileHash', { unique: true });
        imports.createIndex('importedAt', 'importedAt');
      }
      if (!db.objectStoreNames.contains(STORE_UNIVERSITY_IMPORT_ENTRIES)) {
        const entries = db.createObjectStore(STORE_UNIVERSITY_IMPORT_ENTRIES, { keyPath: 'id' });
        ensureEntryIndexes(entries);
      } else if (transaction) {
        ensureEntryIndexes(transaction.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES));
      }
      if (!db.objectStoreNames.contains(STORE_STUDY_PROFILE)) {
        db.createObjectStore(STORE_STUDY_PROFILE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SCHEDULE_UPDATE_SESSIONS)) {
        const sessions = db.createObjectStore(STORE_SCHEDULE_UPDATE_SESSIONS, { keyPath: 'id' });
        sessions.createIndex('status', 'status');
        sessions.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_STUDY_CORRECTION_RULES)) {
        const corrections = db.createObjectStore(STORE_STUDY_CORRECTION_RULES, { keyPath: 'id' });
        corrections.createIndex('seriesKey', 'seriesKey');
      }
      if (!db.objectStoreNames.contains(STORE_CHANGE_JOURNAL)) {
        const journal = db.createObjectStore(STORE_CHANGE_JOURNAL, { keyPath: 'id' });
        journal.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains(STORE_TRASH_ITEMS)) {
        const trash = db.createObjectStore(STORE_TRASH_ITEMS, { keyPath: 'id' });
        trash.createIndex('deletedAt', 'deletedAt');
      }
      if (!db.objectStoreNames.contains(STORE_RESTORE_POINTS)) {
        const restore = db.createObjectStore(STORE_RESTORE_POINTS, { keyPath: 'id' });
        restore.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORE_DAY_CONSTRAINTS)) {
        const constraints = db.createObjectStore(STORE_DAY_CONSTRAINTS, { keyPath: 'id' });
        constraints.createIndex('date', 'date');
        constraints.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains(STORE_STUDY_PREVIEW_PROFILES)) {
        const previews = db.createObjectStore(STORE_STUDY_PREVIEW_PROFILES, { keyPath: 'id' });
        previews.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORE_WORK_PROFILES)) {
        db.createObjectStore(STORE_WORK_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_WORK_SCHEDULE_IMPORTS)) {
        const workImports = db.createObjectStore(STORE_WORK_SCHEDULE_IMPORTS, { keyPath: 'id' });
        workImports.createIndex('fileHash', 'fileHash', { unique: true });
        workImports.createIndex('profileId', 'profileId');
        workImports.createIndex('periodStart', 'periodStart');
        workImports.createIndex('lifecycleStatus', 'lifecycleStatus');
      }
      if (!db.objectStoreNames.contains(STORE_WORK_SCHEDULE_ENTRIES)) {
        const workEntries = db.createObjectStore(STORE_WORK_SCHEDULE_ENTRIES, { keyPath: 'id' });
        workEntries.createIndex('importId', 'importId');
        workEntries.createIndex('eventId', 'eventId');
        workEntries.createIndex('date', 'date');
        workEntries.createIndex('workOccurrenceKey', 'workOccurrenceKey');
      }
      if (!db.objectStoreNames.contains(STORE_WORK_COWORKER_SHIFTS)) {
        const coworkerShifts = db.createObjectStore(STORE_WORK_COWORKER_SHIFTS, { keyPath: 'id' });
        coworkerShifts.createIndex('importId', 'importId');
        coworkerShifts.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains(STORE_DAY_PLANNING_PROFILES)) {
        db.createObjectStore(STORE_DAY_PLANNING_PROFILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DAILY_ROUTINE_RULES)) {
        const routines = db.createObjectStore(STORE_DAILY_ROUTINE_RULES, { keyPath: 'id' });
        routines.createIndex('active', 'active');
      }
      if (!db.objectStoreNames.contains(STORE_DAY_ATTRIBUTES)) {
        const attributes = db.createObjectStore(STORE_DAY_ATTRIBUTES, { keyPath: 'id' });
        attributes.createIndex('date', 'date');
        attributes.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains(STORE_CONSISTENCY_ACKNOWLEDGEMENTS)) {
        const acknowledgements = db.createObjectStore(STORE_CONSISTENCY_ACKNOWLEDGEMENTS, { keyPath: 'id' });
        acknowledgements.createIndex('fingerprint', 'fingerprint', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_AVAILABILITY_PLANS)) {
        const availabilityPlans = db.createObjectStore(STORE_AVAILABILITY_PLANS, { keyPath: 'id' });
        availabilityPlans.createIndex('weekStart', 'weekStart', { unique: true });
        availabilityPlans.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(STORE_SHOPPING_ITEMS)) {
        db.createObjectStore(STORE_SHOPPING_ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_EXPENSE_CATEGORIES)) {
        const categories = db.createObjectStore(STORE_EXPENSE_CATEGORIES, { keyPath: 'id' });
        const timestamp = nowIso();
        DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.forEach((definition, sortOrder) => {
          categories.put({ ...definition, sortOrder, createdAt: timestamp, updatedAt: timestamp } satisfies ExpenseCategory);
        });
      }
      if (!db.objectStoreNames.contains(STORE_RECEIPTS)) {
        const receipts = db.createObjectStore(STORE_RECEIPTS, { keyPath: 'id' });
        receipts.createIndex('date', 'date');
      } else if (transaction) {
        const receipts = transaction.objectStore(STORE_RECEIPTS);
        if (!receipts.indexNames.contains('date')) receipts.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains(STORE_CYCLE_PERIODS)) {
        const cyclePeriods = db.createObjectStore(STORE_CYCLE_PERIODS, { keyPath: 'id' });
        cyclePeriods.createIndex('startDate', 'startDate', { unique: true });
      } else if (transaction) {
        const cyclePeriods = transaction.objectStore(STORE_CYCLE_PERIODS);
        if (!cyclePeriods.indexNames.contains('startDate')) cyclePeriods.createIndex('startDate', 'startDate', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_CYCLE_JOURNAL_ENTRIES)) {
        const cycleJournalEntries = db.createObjectStore(STORE_CYCLE_JOURNAL_ENTRIES, { keyPath: 'id' });
        cycleJournalEntries.createIndex('date', 'date', { unique: true });
      } else if (transaction) {
        const cycleJournalEntries = transaction.objectStore(STORE_CYCLE_JOURNAL_ENTRIES);
        if (!cycleJournalEntries.indexNames.contains('date')) cycleJournalEntries.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_NOTIFICATION_RUNTIME)) {
        db.createObjectStore(STORE_NOTIFICATION_RUNTIME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_NOTIFICATION_REMINDERS)) {
        const reminders = db.createObjectStore(STORE_NOTIFICATION_REMINDERS, { keyPath: 'id' });
        reminders.createIndex('triggerAt', 'triggerAt');
        reminders.createIndex('scheduleId', 'scheduleId', { unique: true });
      } else if (transaction) {
        const reminders = transaction.objectStore(STORE_NOTIFICATION_REMINDERS);
        if (!reminders.indexNames.contains('triggerAt')) reminders.createIndex('triggerAt', 'triggerAt');
        if (!reminders.indexNames.contains('scheduleId')) reminders.createIndex('scheduleId', 'scheduleId', { unique: true });
      }

      if ([4, 5, 6, 7, 8, 9, 10, 11, 12].includes(oldVersion) && transaction) createMigrationSafetySnapshot(transaction, oldVersion);
      if (oldVersion >= 2 && oldVersion < 3 && transaction) backfillSchema3(transaction);
      if (oldVersion < 4 && transaction) backfillSchema4(transaction);
    };

    request.onsuccess = () => {
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      const activePromise = databasePromise;
      db.onversionchange = () => {
        db.close();
        if (databasePromise === activePromise) databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      databasePromise = null;
      reject(request.error ?? new Error('Nie udało się otworzyć lokalnej bazy.'));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      databasePromise = null;
      reject(new Error('Nie można zaktualizować lokalnej bazy, ponieważ inna karta lub okno Inteligentnego Kalendarza nadal jej używa. Zamknij pozostałe karty aplikacji i spróbuj ponownie.'));
    };
  });

  return databasePromise;
}

async function ensureInitialSettings(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_SETTINGS, 'readwrite');
  const settingsStore = tx.objectStore(STORE_SETTINGS);
  const existingSettings = await requestToPromise(settingsStore.get('app') as IDBRequest<AppSettings | undefined>);
  if (!existingSettings) {
    const timestamp = nowIso();
    settingsStore.put({
      id: 'app',
      preferredStartView: 'today',
      timeFormat: '24h',
      notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
      decorativeBackgroundMode: DEFAULT_DECORATIVE_BACKGROUND_MODE,
      updatedAt: timestamp,
    } satisfies AppSettings);
  }
  await transactionDone(tx);
}

export async function initializeDatabase(): Promise<void> {
  const db = await openDatabase();
  await ensureInitialSettings(db);
}

export async function listEvents(): Promise<CalendarEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_EVENTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_EVENTS).getAll() as IDBRequest<CalendarEvent[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export async function getEvent(id: string): Promise<CalendarEvent | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_EVENTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_EVENTS).get(id) as IDBRequest<CalendarEvent | undefined>);
  await transactionDone(tx);
  return result;
}

export async function createEvent(draft: EventDraft): Promise<CalendarEvent> {
  const db = await openDatabase();
  const timestamp = nowIso();
  const event: CalendarEvent = {
    id: createId('event'),
    title: draft.title.trim(),
    startDateTime: draft.startDateTime,
    endDateTime: draft.endDateTime,
    allDay: draft.allDay ?? false,
    spanType: draft.spanType ?? inferSpanType(draft.startDateTime, draft.endDateTime),
    category: draft.category,
    source: 'MANUAL',
    availabilityImpact: draft.availabilityImpact ?? (draft.allDay ? 'NON_BLOCKING' : 'BLOCKING'),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.locationId ? { locationId: draft.locationId } : {}),
  };
  const tx = db.transaction([STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_EVENTS).add(event);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'CREATE_EVENT',
    entityType: 'CALENDAR_EVENT',
    entityIds: [event.id],
    description: `Dodano wydarzenie: ${event.title}`,
    afterState: event,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return event;
}

function changedEventFields(current: CalendarEvent, draft: EventDraft): UserModifiedEventField[] {
  const fields: UserModifiedEventField[] = [];
  if (current.title !== draft.title.trim()) fields.push('title');
  if (current.startDateTime !== draft.startDateTime) fields.push('startDateTime');
  if (current.endDateTime !== draft.endDateTime) fields.push('endDateTime');
  if ((current.locationId ?? '') !== (draft.locationId ?? '')) fields.push('locationId');
  if ((current.description ?? '') !== (draft.description?.trim() ?? '')) fields.push('description');
  if (current.category !== draft.category) fields.push('category');
  if (current.allDay !== (draft.allDay ?? false)) fields.push('allDay');
  const nextImpact = draft.availabilityImpact ?? current.availabilityImpact ?? (draft.allDay ? 'NON_BLOCKING' : 'BLOCKING');
  if ((current.availabilityImpact ?? (current.allDay ? 'NON_BLOCKING' : 'BLOCKING')) !== nextImpact) fields.push('availabilityImpact');
  return fields;
}

export async function updateEvent(id: string, draft: EventDraft): Promise<CalendarEvent> {
  const current = await getEvent(id);
  if (!current) throw new Error('Nie znaleziono wydarzenia.');
  const changedFields = changedEventFields(current, draft);
  const userModifiedFields = [...new Set([...(current.userModifiedFields ?? []), ...changedFields])];
  const updated: CalendarEvent = {
    ...current,
    title: draft.title.trim(),
    startDateTime: draft.startDateTime,
    endDateTime: draft.endDateTime,
    allDay: draft.allDay ?? false,
    spanType: draft.spanType ?? inferSpanType(draft.startDateTime, draft.endDateTime),
    category: draft.category,
    availabilityImpact: draft.availabilityImpact ?? current.availabilityImpact ?? (draft.allDay ? 'NON_BLOCKING' : 'BLOCKING'),
    updatedAt: nowIso(),
    ...((current.source === 'UNIVERSITY_XLSX' || current.source === 'WORK_PDF') && changedFields.length ? { userModified: true, userModifiedFields } : {}),
  };
  if (draft.description?.trim()) updated.description = draft.description.trim();
  else delete updated.description;
  if (draft.locationId) updated.locationId = draft.locationId;
  else delete updated.locationId;

  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_EVENTS).put(updated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'UPDATE_EVENT',
    entityType: 'CALENDAR_EVENT',
    entityIds: [updated.id],
    description: `Edytowano wydarzenie: ${updated.title}`,
    beforeState: current,
    afterState: updated,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function createManualEventSeries(draft: ManualMultiDateDraft): Promise<CalendarEvent[]> {
  const dates = uniqueSortedDateKeys(draft.dates);
  const normalizedDraft: ManualMultiDateDraft = { ...draft, dates };
  const validation = validateManualMultiDateDraft(normalizedDraft);
  if (!validation.valid) throw new Error(Object.values(validation.errors)[0] ?? 'Nieprawidłowe dane serii.');
  const db = await openDatabase();
  const timestamp = nowIso();
  const seriesId = createId('manual-series');
  const events = dates.map((date) => ({
    id: createId('event'),
    title: draft.title.trim(),
    startDateTime: draft.allDay ? `${date}T00:00` : `${date}T${draft.startTime}`,
    endDateTime: draft.allDay ? `${date}T23:59` : `${date}T${draft.endTime}`,
    allDay: draft.allDay,
    spanType: 'SINGLE_DAY' as const,
    category: draft.category,
    source: 'MANUAL' as const,
    availabilityImpact: draft.availabilityImpact ?? (draft.allDay ? 'NON_BLOCKING' : 'BLOCKING'),
    seriesId,
    seriesType: 'MANUAL_MULTI_DATE' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.locationId ? { locationId: draft.locationId } : {}),
  } satisfies CalendarEvent));
  const tx = db.transaction([STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_EVENTS);
  for (const event of events) store.add(event);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'CREATE_MANUAL_SERIES',
    entityType: 'MANUAL_SERIES',
    entityIds: events.map((event) => event.id),
    description: `Dodano serię „${draft.title.trim()}” (${events.length} dni)`,
    afterState: events,
    groupId: seriesId,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return events;
}

export async function listManualSeriesEvents(seriesId: string): Promise<CalendarEvent[]> {
  const events = await listEvents();
  return events.filter((event) => event.source === 'MANUAL' && event.seriesId === seriesId && event.seriesType === 'MANUAL_MULTI_DATE');
}

export async function updateManualEventSeries(eventId: string, draft: EventDraft): Promise<CalendarEvent[]> {
  const validation = validateEventDraft(draft);
  if (!validation.valid) throw new Error(Object.values(validation.errors)[0] ?? 'Nieprawidłowe dane wydarzenia.');
  const current = await getEvent(eventId);
  if (!current?.seriesId || current.seriesType !== 'MANUAL_MULTI_DATE') throw new Error('To wydarzenie nie należy do ręcznej serii.');
  const members = await listManualSeriesEvents(current.seriesId);
  const timestamp = nowIso();
  const startParts = splitLocalDateTime(draft.startDateTime);
  const endParts = splitLocalDateTime(draft.endDateTime);
  const updated = members.map((member) => {
    const date = splitLocalDateTime(member.startDateTime).date;
    const next: CalendarEvent = {
      ...member,
      title: draft.title.trim(),
      startDateTime: draft.allDay ? `${date}T00:00` : `${date}T${startParts.time}`,
      endDateTime: draft.allDay ? `${date}T23:59` : `${date}T${endParts.time}`,
      allDay: draft.allDay ?? false,
      spanType: 'SINGLE_DAY',
      category: draft.category,
      availabilityImpact: draft.availabilityImpact ?? (draft.allDay ? 'NON_BLOCKING' : 'BLOCKING'),
      updatedAt: timestamp,
    };
    if (draft.description?.trim()) next.description = draft.description.trim();
    else delete next.description;
    if (draft.locationId) next.locationId = draft.locationId;
    else delete next.locationId;
    return next;
  });
  if (members.length >= 5) await createRestorePoint(`Przed edycją serii: ${current.title}`, 'BEFORE_SERIES_BULK_CHANGE', true);
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_EVENTS);
  for (const event of updated) store.put(event);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'UPDATE_MANUAL_SERIES',
    entityType: 'MANUAL_SERIES',
    entityIds: updated.map((event) => event.id),
    description: `Zmieniono ${updated.length} wydarzeń serii: ${draft.title.trim()}`,
    beforeState: members,
    afterState: updated,
    groupId: current.seriesId,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function deleteManualEventSeries(seriesId: string): Promise<number> {
  const members = await listManualSeriesEvents(seriesId);
  if (!members.length) return 0;
  if (members.length >= 5) await createRestorePoint(`Przed usunięciem serii: ${members[0]?.title ?? 'seria'}`, 'BEFORE_SERIES_BULK_CHANGE', true);
  const trashItem: TrashItem = {
    id: createId('trash'),
    entityType: 'MANUAL_SERIES',
    entityId: seriesId,
    entityIds: members.map((event) => event.id),
    displayName: `${members[0]?.title ?? 'Seria'} (${members.length} wydarzeń)`,
    deletedAt: nowIso(),
    source: 'MANUAL',
    payload: members,
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_TRASH_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_EVENTS);
  for (const event of members) store.delete(event.id);
  tx.objectStore(STORE_TRASH_ITEMS).put(trashItem);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_MANUAL_SERIES',
    entityType: 'MANUAL_SERIES',
    entityIds: members.map((event) => event.id),
    description: `Przeniesiono do Kosza serię: ${members[0]?.title ?? 'Seria'}`,
    beforeState: members,
    groupId: seriesId,
    metadata: { trashItemId: trashItem.id },
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return members.length;
}

export async function deleteEvent(id: string): Promise<void> {
  const event = await getEvent(id);
  if (!event) return;
  const trashItem: TrashItem = {
    id: createId('trash'),
    entityType: 'CALENDAR_EVENT',
    entityId: event.id,
    entityIds: [event.id],
    displayName: event.title,
    deletedAt: nowIso(),
    source: event.source,
    payload: event,
    ...((event.sourceEntryId || event.sourceWorkEntryId) ? { metadata: { ...(event.sourceEntryId ? { sourceEntryId: event.sourceEntryId } : {}), ...(event.sourceWorkEntryId ? { sourceWorkEntryId: event.sourceWorkEntryId } : {}) } } : {}),
  };
  const storeNames = [STORE_EVENTS, STORE_TRASH_ITEMS, STORE_CHANGE_JOURNAL];
  if (event.sourceEntryId) storeNames.push(STORE_UNIVERSITY_IMPORT_ENTRIES);
  if (event.sourceWorkEntryId) storeNames.push(STORE_WORK_SCHEDULE_ENTRIES);
  const db = await openDatabase();
  const tx = db.transaction(storeNames, 'readwrite');
  tx.objectStore(STORE_EVENTS).delete(id);
  tx.objectStore(STORE_TRASH_ITEMS).put(trashItem);
  if (event.sourceEntryId) {
    const entryStore = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
    const request = entryStore.get(event.sourceEntryId) as IDBRequest<UniversityImportEntry | undefined>;
    request.onsuccess = () => {
      if (request.result) entryStore.put({ ...request.result, userDeleted: true });
    };
  }
  if (event.sourceWorkEntryId) {
    const workEntryStore = tx.objectStore(STORE_WORK_SCHEDULE_ENTRIES);
    const request = workEntryStore.get(event.sourceWorkEntryId) as IDBRequest<WorkScheduleEntry | undefined>;
    request.onsuccess = () => {
      if (request.result) workEntryStore.put({ ...request.result, userDeleted: true });
    };
  }
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_EVENT',
    entityType: 'CALENDAR_EVENT',
    entityIds: [event.id],
    description: `Przeniesiono do Kosza: ${event.title}`,
    beforeState: event,
    metadata: { trashItemId: trashItem.id, ...(event.sourceEntryId ? { sourceEntryId: event.sourceEntryId } : {}), ...(event.sourceWorkEntryId ? { sourceWorkEntryId: event.sourceWorkEntryId } : {}) },
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}


export async function listShoppingItems(): Promise<ShoppingItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readonly');
  const items = await requestToPromise(tx.objectStore(STORE_SHOPPING_ITEMS).getAll() as IDBRequest<ShoppingItem[]>);
  await transactionDone(tx);
  const groups = sortShoppingItems(items);
  return [...groups.active, ...groups.purchased];
}

export async function getShoppingItem(id: string): Promise<ShoppingItem | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readonly');
  const item = await requestToPromise(tx.objectStore(STORE_SHOPPING_ITEMS).get(id) as IDBRequest<ShoppingItem | undefined>);
  await transactionDone(tx);
  return item;
}

export async function createShoppingItem(draft: ShoppingItemDraft): Promise<ShoppingItem> {
  const name = normalizeShoppingName(draft.name);
  if (!name) throw new Error('Wpisz nazwę produktu.');
  const quantity = normalizeShoppingQuantity(draft.quantity);
  const timestamp = nowIso();
  const item: ShoppingItem = {
    id: createId('shopping'),
    name,
    isPurchased: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(quantity ? { quantity } : {}),
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_SHOPPING_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_SHOPPING_ITEMS).add(item);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'ADD_SHOPPING_ITEM',
    entityType: 'SHOPPING_ITEM',
    entityIds: [item.id],
    description: `Dodano do zakupów: ${item.name}`,
    afterState: item,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return item;
}

export async function updateShoppingItem(id: string, draft: ShoppingItemDraft): Promise<ShoppingItem> {
  const current = await getShoppingItem(id);
  if (!current) throw new Error('Nie znaleziono produktu.');
  const name = normalizeShoppingName(draft.name);
  if (!name) throw new Error('Wpisz nazwę produktu.');
  const quantity = normalizeShoppingQuantity(draft.quantity);
  const updated: ShoppingItem = { ...current, name, updatedAt: nowIso() };
  if (quantity) updated.quantity = quantity;
  else delete updated.quantity;
  const db = await openDatabase();
  const tx = db.transaction([STORE_SHOPPING_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_SHOPPING_ITEMS).put(updated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'EDIT_SHOPPING_ITEM',
    entityType: 'SHOPPING_ITEM',
    entityIds: [updated.id],
    description: `Edytowano produkt: ${updated.name}`,
    beforeState: current,
    afterState: updated,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function setShoppingItemPurchased(id: string, purchased: boolean): Promise<ShoppingItem> {
  const current = await getShoppingItem(id);
  if (!current) throw new Error('Nie znaleziono produktu.');
  const timestamp = nowIso();
  const updated: ShoppingItem = { ...current, isPurchased: purchased, updatedAt: timestamp };
  if (purchased) updated.purchasedAt = timestamp;
  else delete updated.purchasedAt;
  const db = await openDatabase();
  const tx = db.transaction([STORE_SHOPPING_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_SHOPPING_ITEMS).put(updated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: purchased ? 'PURCHASE_SHOPPING_ITEM' : 'UNPURCHASE_SHOPPING_ITEM',
    entityType: 'SHOPPING_ITEM',
    entityIds: [updated.id],
    description: purchased ? `Kupione: ${updated.name}` : `Przywrócono do kupienia: ${updated.name}`,
    beforeState: current,
    afterState: updated,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const current = await getShoppingItem(id);
  if (!current) return;
  const db = await openDatabase();
  const tx = db.transaction([STORE_SHOPPING_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_SHOPPING_ITEMS).delete(id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_SHOPPING_ITEM',
    entityType: 'SHOPPING_ITEM',
    entityIds: [current.id],
    description: `Usunięto z zakupów: ${current.name}`,
    beforeState: current,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function deletePurchasedShoppingItems(): Promise<number> {
  const items = (await listShoppingItems()).filter((item) => item.isPurchased);
  if (!items.length) return 0;
  const db = await openDatabase();
  const tx = db.transaction([STORE_SHOPPING_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_SHOPPING_ITEMS);
  for (const item of items) store.delete(item.id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_PURCHASED_SHOPPING_ITEMS',
    entityType: 'SHOPPING_ITEM',
    entityIds: items.map((item) => item.id),
    description: `Usunięto kupione produkty (${items.length})`,
    beforeState: items,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return items.length;
}


function defaultExpenseCategories(timestamp = nowIso()): ExpenseCategory[] {
  return DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.map((definition, sortOrder) => ({
    ...definition,
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

async function ensureDefaultExpenseCategories(): Promise<void> {
  const db = await openDatabase();
  const readTx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readonly');
  const existing = await requestToPromise(readTx.objectStore(STORE_EXPENSE_CATEGORIES).getAll() as IDBRequest<ExpenseCategory[]>);
  await transactionDone(readTx);

  if (!existing.length) {
    const writeTx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readwrite');
    const store = writeTx.objectStore(STORE_EXPENSE_CATEGORIES);
    for (const category of defaultExpenseCategories()) store.put(category);
    await transactionDone(writeTx);
    return;
  }

  const depositDefinition = DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.find((definition) => definition.id === 'expense-category-deposit');
  if (!depositDefinition) return;
  if (existing.some((category) => category.id === depositDefinition.id || isDepositExpenseCategoryName(category.name))) return;

  const timestamp = nowIso();
  const writeTx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readwrite');
  writeTx.objectStore(STORE_EXPENSE_CATEGORIES).put({
    ...depositDefinition,
    sortOrder: existing.reduce((max, category) => Math.max(max, category.sortOrder), -1) + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies ExpenseCategory);
  await transactionDone(writeTx);
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  await ensureDefaultExpenseCategories();
  const db = await openDatabase();
  const tx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readonly');
  const categories = await requestToPromise(tx.objectStore(STORE_EXPENSE_CATEGORIES).getAll() as IDBRequest<ExpenseCategory[]>);
  await transactionDone(tx);
  return categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl-PL'));
}

export async function createExpenseCategory(nameInput: string): Promise<ExpenseCategory> {
  const name = normalizeExpenseText(nameInput);
  if (!name) throw new Error('Wpisz nazwę kategorii.');
  const categories = await listExpenseCategories();
  const key = expenseCategoryNameKey(name);
  if (categories.some((category) => expenseCategoryNameKey(category.name) === key)) throw new Error('Taka kategoria już istnieje.');
  const timestamp = nowIso();
  const category: ExpenseCategory = {
    id: createId('expense-category'),
    name,
    sortOrder: categories.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readwrite');
  tx.objectStore(STORE_EXPENSE_CATEGORIES).add(category);
  await transactionDone(tx);
  return category;
}

export async function updateExpenseCategory(id: string, nameInput: string): Promise<ExpenseCategory> {
  const name = normalizeExpenseText(nameInput);
  if (!name) throw new Error('Wpisz nazwę kategorii.');
  const categories = await listExpenseCategories();
  const current = categories.find((category) => category.id === id);
  if (!current) throw new Error('Nie znaleziono kategorii.');
  const key = expenseCategoryNameKey(name);
  if (categories.some((category) => category.id !== id && expenseCategoryNameKey(category.name) === key)) throw new Error('Taka kategoria już istnieje.');
  const updated: ExpenseCategory = { ...current, name, updatedAt: nowIso() };
  const db = await openDatabase();
  const tx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readwrite');
  tx.objectStore(STORE_EXPENSE_CATEGORIES).put(updated);
  await transactionDone(tx);
  return updated;
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const categories = await listExpenseCategories();
  if (!categories.some((category) => category.id === id)) return;
  const receipts = await listReceipts();
  if (receipts.some((receipt) => receipt.items.some((item) => item.categoryId === id))) {
    throw new Error('Ta kategoria jest używana przez zapisane paragony. Najpierw zmień kategorię tych pozycji.');
  }
  const db = await openDatabase();
  const tx = db.transaction(STORE_EXPENSE_CATEGORIES, 'readwrite');
  tx.objectStore(STORE_EXPENSE_CATEGORIES).delete(id);
  await transactionDone(tx);
}

function isValidReceiptDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

async function normalizeReceiptDraft(draft: ReceiptDraft, current?: Receipt): Promise<{ date: string; merchant: string; items: ReceiptItem[]; totalMinor: number }> {
  const date = draft.date.trim();
  if (!isValidReceiptDateKey(date)) throw new Error('Wybierz prawidłową datę paragonu.');
  const merchant = normalizeExpenseText(draft.merchant);
  if (!merchant) throw new Error('Wpisz nazwę sklepu.');
  if (!draft.items.length) throw new Error('Dodaj co najmniej jedną pozycję paragonu.');
  const categories = await listExpenseCategories();
  const categoryIds = new Set(categories.map((category) => category.id));
  const currentIds = new Set(current?.items.map((item) => item.id) ?? []);
  const items: ReceiptItem[] = draft.items.map((item) => {
    const name = normalizeExpenseText(item.name);
    if (!name) throw new Error('Każda pozycja paragonu musi mieć nazwę.');
    if (!categoryIds.has(item.categoryId)) throw new Error(`Wybierz istniejącą kategorię dla pozycji: ${name}.`);
    if (!Number.isSafeInteger(item.amountMinor) || item.amountMinor <= 0) throw new Error(`Wpisz prawidłową kwotę dla pozycji: ${name}.`);
    const id = item.id && currentIds.has(item.id) ? item.id : createId('receipt-item');
    return { id, name, categoryId: item.categoryId, amountMinor: item.amountMinor };
  });
  const totalMinor = items.reduce((sum, item) => sum + item.amountMinor, 0);
  if (!Number.isSafeInteger(totalMinor)) throw new Error('Suma paragonu jest zbyt duża.');
  return { date, merchant, items, totalMinor };
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readonly');
  const receipts = await requestToPromise(tx.objectStore(STORE_RECEIPTS).getAll() as IDBRequest<Receipt[]>);
  await transactionDone(tx);
  return receipts.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readonly');
  const receipt = await requestToPromise(tx.objectStore(STORE_RECEIPTS).get(id) as IDBRequest<Receipt | undefined>);
  await transactionDone(tx);
  return receipt;
}

export async function createReceipt(draft: ReceiptDraft): Promise<Receipt> {
  const normalized = await normalizeReceiptDraft(draft);
  const timestamp = nowIso();
  const receipt: Receipt = {
    id: createId('receipt'),
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
  tx.objectStore(STORE_RECEIPTS).add(receipt);
  await transactionDone(tx);
  return receipt;
}

export async function updateReceipt(id: string, draft: ReceiptDraft): Promise<Receipt> {
  const current = await getReceipt(id);
  if (!current) throw new Error('Nie znaleziono paragonu.');
  const normalized = await normalizeReceiptDraft(draft, current);
  const updated: Receipt = { ...current, ...normalized, updatedAt: nowIso() };
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
  tx.objectStore(STORE_RECEIPTS).put(updated);
  await transactionDone(tx);
  return updated;
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
  tx.objectStore(STORE_RECEIPTS).delete(id);
  await transactionDone(tx);
}

export async function restoreDeletedReceipt(receipt: Receipt): Promise<void> {
  const existing = await getReceipt(receipt.id);
  if (existing) throw new Error('Nie można cofnąć usunięcia, ponieważ paragon o tym ID już istnieje.');
  const db = await openDatabase();
  const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
  tx.objectStore(STORE_RECEIPTS).add(structuredClone(receipt));
  await transactionDone(tx);
}


function validateCyclePeriodDraft(draft: CyclePeriodDraft, periods: CyclePeriod[], editingId?: string): { startDate: string; endDate?: string; isUserMarkedAtypical?: boolean } {
  const startDate = draft.startDate.trim();
  const endDate = draft.endDate?.trim() || undefined;
  if (!isValidCycleDateKey(startDate)) throw new Error('Wybierz prawidłową datę początku miesiączki.');
  if (startDate > toLocalDateKey(new Date())) throw new Error('Rzeczywistą miesiączkę możesz zapisać po jej rozpoczęciu.');
  if (endDate && !isValidCycleDateKey(endDate)) throw new Error('Wybierz prawidłową datę końca miesiączki.');
  if (endDate && endDate > toLocalDateKey(new Date())) throw new Error('Rzeczywisty koniec miesiączki nie może być zapisany w przyszłości.');
  if (endDate && endDate < startDate) throw new Error('Koniec miesiączki nie może być przed jej początkiem.');
  const duplicate = periods.find((period) => period.id !== editingId && period.startDate === startDate);
  if (duplicate) throw new Error('Ta data jest już zapisana jako początek miesiączki.');

  const others = periods.filter((period) => period.id !== editingId).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const previous = [...others].reverse().find((period) => period.startDate < startDate);
  const next = others.find((period) => period.startDate > startDate);
  if (previous?.endDate && previous.endDate >= startDate) throw new Error('Ta data nachodzi na wcześniej zapisaną miesiączkę. Popraw daty przed zapisaniem.');
  if (endDate && next && endDate >= next.startDate) throw new Error('Zakres miesiączki nachodzi na kolejny zapisany początek. Popraw daty przed zapisaniem.');

  return { startDate, ...(endDate ? { endDate } : {}), ...(draft.isUserMarkedAtypical ? { isUserMarkedAtypical: true } : {}) };
}

function cycleNextPeriod(periods: CyclePeriod[], id: string): CyclePeriod | undefined {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const index = sorted.findIndex((period) => period.id === id);
  return index >= 0 ? sorted[index + 1] : undefined;
}

function cyclePreviousPeriod(periods: CyclePeriod[], id: string): CyclePeriod | undefined {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const index = sorted.findIndex((period) => period.id === id);
  return index > 0 ? sorted[index - 1] : undefined;
}

export async function listCyclePeriods(): Promise<CyclePeriod[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CYCLE_PERIODS, 'readonly');
  const periods = await requestToPromise(tx.objectStore(STORE_CYCLE_PERIODS).getAll() as IDBRequest<CyclePeriod[]>);
  await transactionDone(tx);
  return periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function getCyclePeriod(id: string): Promise<CyclePeriod | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CYCLE_PERIODS, 'readonly');
  const period = await requestToPromise(tx.objectStore(STORE_CYCLE_PERIODS).get(id) as IDBRequest<CyclePeriod | undefined>);
  await transactionDone(tx);
  return period;
}

export async function createCyclePeriod(draft: CyclePeriodDraft): Promise<CyclePeriod> {
  const periods = await listCyclePeriods();
  const normalized = validateCyclePeriodDraft(draft, periods);
  const timestamp = nowIso();
  const period: CyclePeriod = {
    id: createId('cycle-period'),
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const projected = [...periods, period].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = cycleNextPeriod(projected, period.id);
  const nextUpdated = next?.previousGapDecision ? { ...next, previousGapDecision: undefined, updatedAt: timestamp } : next;
  if (nextUpdated && nextUpdated.previousGapDecision === undefined) delete nextUpdated.previousGapDecision;

  const db = await openDatabase();
  const tx = db.transaction([STORE_CYCLE_PERIODS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_CYCLE_PERIODS);
  store.add(period);
  if (next && nextUpdated && nextUpdated !== next) store.put(nextUpdated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'ADD_CYCLE_PERIOD',
    entityType: 'CYCLE_PERIOD',
    entityIds: [period.id],
    description: `Dodano początek miesiączki: ${period.startDate}`,
    beforeState: { nextPeriod: next ?? null },
    afterState: { created: period, nextPeriod: nextUpdated ?? null },
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return period;
}

export async function updateCyclePeriod(id: string, draft: CyclePeriodDraft): Promise<CyclePeriod> {
  const periods = await listCyclePeriods();
  const current = periods.find((period) => period.id === id);
  if (!current) throw new Error('Nie znaleziono wpisu cyklu.');
  const normalized = validateCyclePeriodDraft(draft, periods, id);
  const startChanged = normalized.startDate !== current.startDate;
  const timestamp = nowIso();
  const updated: CyclePeriod = {
    ...current,
    startDate: normalized.startDate,
    updatedAt: timestamp,
  };
  if (normalized.endDate) updated.endDate = normalized.endDate;
  else delete updated.endDate;
  if (normalized.isUserMarkedAtypical) updated.isUserMarkedAtypical = true;
  else delete updated.isUserMarkedAtypical;
  if (startChanged) delete updated.previousGapDecision;

  const oldNext = cycleNextPeriod(periods, id);
  const projected = periods.map((period) => period.id === id ? updated : period).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const newNext = cycleNextPeriod(projected, id);
  const impactedIds = new Set<string>([id]);
  if (startChanged && oldNext) impactedIds.add(oldNext.id);
  if (startChanged && newNext) impactedIds.add(newNext.id);
  const beforeAffected = periods.filter((period) => impactedIds.has(period.id));
  const afterMap = new Map(projected.map((period) => [period.id, period]));
  if (startChanged) {
    for (const next of [oldNext, newNext]) {
      if (!next) continue;
      const value = afterMap.get(next.id);
      if (!value?.previousGapDecision) continue;
      const cleared = { ...value, updatedAt: timestamp };
      delete cleared.previousGapDecision;
      afterMap.set(next.id, cleared);
    }
  }
  const finalUpdated = afterMap.get(id)!;
  const afterAffected = [...impactedIds].map((affectedId) => afterMap.get(affectedId)).filter((value): value is CyclePeriod => Boolean(value));

  const db = await openDatabase();
  const tx = db.transaction([STORE_CYCLE_PERIODS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_CYCLE_PERIODS);
  for (const value of afterAffected) store.put(value);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'EDIT_CYCLE_PERIOD',
    entityType: 'CYCLE_PERIOD',
    entityIds: [...impactedIds],
    description: `Zmieniono wpis cyklu: ${finalUpdated.startDate}`,
    beforeState: beforeAffected,
    afterState: afterAffected,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return finalUpdated;
}

export async function setCycleGapDecision(laterPeriodId: string, decision: CycleGapDecision): Promise<CyclePeriod> {
  const periods = await listCyclePeriods();
  const current = periods.find((period) => period.id === laterPeriodId);
  if (!current) throw new Error('Nie znaleziono wpisu cyklu.');
  const previous = cyclePreviousPeriod(periods, laterPeriodId);
  if (!previous) throw new Error('Ten wpis nie ma wcześniejszej miesiączki do porównania.');
  const updated: CyclePeriod = { ...current, previousGapDecision: decision, updatedAt: nowIso() };
  const db = await openDatabase();
  const tx = db.transaction([STORE_CYCLE_PERIODS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_CYCLE_PERIODS).put(updated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SET_CYCLE_GAP_DECISION',
    entityType: 'CYCLE_PERIOD',
    entityIds: [current.id],
    description: decision === 'OBSERVATION_BREAK' ? 'Pominięto długi odstęp w nauce modelu cyklu' : 'Potwierdzono rzeczywisty długi cykl',
    beforeState: current,
    afterState: updated,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function deleteCyclePeriod(id: string): Promise<void> {
  const periods = await listCyclePeriods();
  const current = periods.find((period) => period.id === id);
  if (!current) return;
  const next = cycleNextPeriod(periods, id);
  const timestamp = nowIso();
  let nextUpdated = next;
  if (next?.previousGapDecision) {
    nextUpdated = { ...next, updatedAt: timestamp };
    delete nextUpdated.previousGapDecision;
  }
  const db = await openDatabase();
  const tx = db.transaction([STORE_CYCLE_PERIODS, STORE_CHANGE_JOURNAL], 'readwrite');
  const store = tx.objectStore(STORE_CYCLE_PERIODS);
  store.delete(id);
  if (nextUpdated && nextUpdated !== next) store.put(nextUpdated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_CYCLE_PERIOD',
    entityType: 'CYCLE_PERIOD',
    entityIds: [current.id, ...(next ? [next.id] : [])],
    description: `Usunięto wpis cyklu: ${current.startDate}`,
    beforeState: { deleted: current, nextPeriod: next ?? null },
    afterState: { nextPeriod: nextUpdated ?? null },
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}


function normalizeCycleJournalDraft(draft: CycleJournalEntryDraft): CycleJournalEntryDraft {
  const date = draft.date.trim();
  if (!isValidCycleDateKey(date)) throw new Error('Wybierz prawidłową datę wpisu dziennika.');
  if (date > toLocalDateKey(new Date())) throw new Error('Obserwacji z Dziennika Cyklu nie można zapisywać w przyszłości.');
  if (draft.bleeding !== undefined && !CYCLE_BLEEDING_LEVELS.includes(draft.bleeding)) throw new Error('Nieprawidłowa wartość krwawienia.');
  if (draft.pain !== undefined && !CYCLE_PAIN_LEVELS.includes(draft.pain)) throw new Error('Nieprawidłowa wartość bólu.');
  if (draft.wellbeing !== undefined && !CYCLE_WELLBEING_LEVELS.includes(draft.wellbeing)) throw new Error('Nieprawidłowa wartość samopoczucia.');
  if (draft.painMedicationTaken !== undefined && typeof draft.painMedicationTaken !== 'boolean') throw new Error('Nieprawidłowa wartość pola leku przeciwbólowego.');
  const note = draft.note?.trim() || undefined;
  if (note && note.length > 500) throw new Error('Notatka może mieć maksymalnie 500 znaków.');
  if (draft.bleeding === undefined && draft.pain === undefined && draft.wellbeing === undefined && draft.painMedicationTaken === undefined && !note) {
    throw new Error('Zaznacz przynajmniej jedną obserwację albo wpisz notatkę.');
  }
  return {
    date,
    ...(draft.bleeding !== undefined ? { bleeding: draft.bleeding } : {}),
    ...(draft.pain !== undefined ? { pain: draft.pain } : {}),
    ...(draft.wellbeing !== undefined ? { wellbeing: draft.wellbeing } : {}),
    ...(draft.painMedicationTaken !== undefined ? { painMedicationTaken: draft.painMedicationTaken } : {}),
    ...(note ? { note } : {}),
  };
}

export async function listCycleJournalEntries(): Promise<CycleJournalEntry[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readonly');
  const entries = await requestToPromise(tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).getAll() as IDBRequest<CycleJournalEntry[]>);
  await transactionDone(tx);
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCycleJournalEntryByDate(date: string): Promise<CycleJournalEntry | undefined> {
  if (!isValidCycleDateKey(date)) return undefined;
  const db = await openDatabase();
  const tx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readonly');
  const entry = await requestToPromise(tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).index('date').get(date) as IDBRequest<CycleJournalEntry | undefined>);
  await transactionDone(tx);
  return entry;
}

export async function createCycleJournalEntry(draft: CycleJournalEntryDraft): Promise<CycleJournalEntry> {
  const normalized = normalizeCycleJournalDraft(draft);
  if (await getCycleJournalEntryByDate(normalized.date)) throw new Error('Ten dzień ma już wpis dziennika.');
  const timestamp = nowIso();
  const entry: CycleJournalEntry = {
    id: createId('cycle-journal'),
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_CYCLE_JOURNAL_ENTRIES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).add(entry);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'ADD_CYCLE_JOURNAL_ENTRY',
    entityType: 'CYCLE_JOURNAL_ENTRY',
    entityIds: [entry.id],
    description: `Dodano wpis Dziennika Cyklu: ${entry.date}`,
    afterState: entry,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return entry;
}

export async function updateCycleJournalEntry(id: string, draft: CycleJournalEntryDraft): Promise<CycleJournalEntry> {
  const normalized = normalizeCycleJournalDraft(draft);
  const db = await openDatabase();
  const readTx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readonly');
  const current = await requestToPromise(readTx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).get(id) as IDBRequest<CycleJournalEntry | undefined>);
  await transactionDone(readTx);
  if (!current) throw new Error('Nie znaleziono wpisu dziennika.');
  const duplicate = await getCycleJournalEntryByDate(normalized.date);
  if (duplicate && duplicate.id !== id) throw new Error('Ten dzień ma już wpis dziennika.');
  const updated: CycleJournalEntry = {
    id: current.id,
    ...normalized,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  };
  const tx = db.transaction([STORE_CYCLE_JOURNAL_ENTRIES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).put(updated);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'EDIT_CYCLE_JOURNAL_ENTRY',
    entityType: 'CYCLE_JOURNAL_ENTRY',
    entityIds: [id],
    description: `Zmieniono wpis Dziennika Cyklu: ${updated.date}`,
    beforeState: current,
    afterState: updated,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function deleteCycleJournalEntry(id: string): Promise<void> {
  const db = await openDatabase();
  const readTx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readonly');
  const current = await requestToPromise(readTx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).get(id) as IDBRequest<CycleJournalEntry | undefined>);
  await transactionDone(readTx);
  if (!current) return;
  const tx = db.transaction([STORE_CYCLE_JOURNAL_ENTRIES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).delete(id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_CYCLE_JOURNAL_ENTRY',
    entityType: 'CYCLE_JOURNAL_ENTRY',
    entityIds: [id],
    description: `Usunięto wpis Dziennika Cyklu: ${current.date}`,
    beforeState: current,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function listLocations(): Promise<Location[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_LOCATIONS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_LOCATIONS).getAll() as IDBRequest<Location[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export async function createLocation(draft: LocationDraft): Promise<Location> {
  const db = await openDatabase();
  const timestamp = nowIso();
  const location: Location = {
    id: createId('location'),
    name: draft.name.trim(),
    type: draft.type,
    address: draft.address.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
  };
  const tx = db.transaction(STORE_LOCATIONS, 'readwrite');
  tx.objectStore(STORE_LOCATIONS).add(location);
  await transactionDone(tx);
  return location;
}

export async function updateLocation(id: string, draft: LocationDraft): Promise<Location> {
  const db = await openDatabase();
  const txRead = db.transaction(STORE_LOCATIONS, 'readonly');
  const current = await requestToPromise(txRead.objectStore(STORE_LOCATIONS).get(id) as IDBRequest<Location | undefined>);
  await transactionDone(txRead);
  if (!current) throw new Error('Nie znaleziono miejsca.');
  const updated: Location = {
    ...current,
    name: draft.name.trim(),
    type: draft.type,
    address: draft.address.trim(),
    updatedAt: nowIso(),
  };
  if (draft.note?.trim()) updated.note = draft.note.trim();
  else delete updated.note;
  const tx = db.transaction(STORE_LOCATIONS, 'readwrite');
  tx.objectStore(STORE_LOCATIONS).put(updated);
  await transactionDone(tx);
  return updated;
}

export async function deleteLocation(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([
    STORE_LOCATIONS,
    STORE_EVENTS,
    STORE_SETTINGS,
    STORE_WORK_PROFILES,
    STORE_CHANGE_JOURNAL,
  ], 'readwrite');

  try {
    const locationStore = tx.objectStore(STORE_LOCATIONS);
    const eventStore = tx.objectStore(STORE_EVENTS);
    const settingsStore = tx.objectStore(STORE_SETTINGS);
    const workProfileStore = tx.objectStore(STORE_WORK_PROFILES);

    const locationRequest = requestToPromise(locationStore.get(id) as IDBRequest<Location | undefined>);
    const eventsRequest = requestToPromise(eventStore.getAll() as IDBRequest<CalendarEvent[]>);
    const settingsRequest = requestToPromise(settingsStore.get('app') as IDBRequest<AppSettings | undefined>);
    const workProfilesRequest = requestToPromise(workProfileStore.getAll() as IDBRequest<WorkProfile[]>);
    const [location, allEvents, settings, workProfiles] = await Promise.all([
      locationRequest,
      eventsRequest,
      settingsRequest,
      workProfilesRequest,
    ]);

    if (!location) throw new Error('Nie znaleziono miejsca.');

    const timestamp = nowIso();
    const affectedEvents = allEvents.filter((event) => event.locationId === id);
    const updatedEvents = affectedEvents.map((event) => {
      const updated: CalendarEvent = { ...event, updatedAt: timestamp };
      delete updated.locationId;
      if (event.source === 'UNIVERSITY_XLSX' || event.source === 'WORK_PDF') {
        const existingModifiedFields: UserModifiedEventField[] = event.userModifiedFields?.length
          ? [...event.userModifiedFields]
          : event.userModified
            ? ['title', 'startDateTime', 'endDateTime', 'locationId', 'description', 'category']
            : [];
        updated.userModified = true;
        updated.userModifiedFields = [...new Set<UserModifiedEventField>([...existingModifiedFields, 'locationId'])];
      }
      return updated;
    });

    const settingsAffected = Boolean(settings && (settings.homeLocationId === id || settings.workLocationId === id));
    const updatedSettings = settingsAffected && settings ? { ...settings, updatedAt: timestamp } : undefined;
    if (updatedSettings) {
      if (updatedSettings.homeLocationId === id) delete updatedSettings.homeLocationId;
      if (updatedSettings.workLocationId === id) delete updatedSettings.workLocationId;
    }

    const affectedWorkProfiles = workProfiles.filter((profile) => profile.locationId === id);
    const updatedWorkProfiles = affectedWorkProfiles.map((profile) => {
      const updated: WorkProfile = { ...profile, updatedAt: timestamp };
      delete updated.locationId;
      return updated;
    });

    for (const event of updatedEvents) eventStore.put(event);
    if (updatedSettings) settingsStore.put(updatedSettings);
    for (const profile of updatedWorkProfiles) workProfileStore.put(profile);
    locationStore.delete(id);

    putJournalEntry(tx, buildJournalEntry({
      operationType: 'DELETE_LOCATION',
      entityType: 'LOCATION',
      entityIds: [
        id,
        ...affectedEvents.map((event) => event.id),
        ...(settingsAffected ? ['app'] : []),
        ...affectedWorkProfiles.map((profile) => profile.id),
      ],
      description: `Usunięto miejsce: ${location.name}`,
      beforeState: {
        location,
        affectedEvents,
        ...(settingsAffected && settings ? { settings } : {}),
        affectedWorkProfiles,
      },
      afterState: {
        location: null,
        affectedEvents: updatedEvents,
        ...(updatedSettings ? { settings: updatedSettings } : {}),
        affectedWorkProfiles: updatedWorkProfiles,
      },
      reversible: false,
      metadata: {
        affectedEventCount: affectedEvents.length,
        affectedWorkProfileCount: affectedWorkProfiles.length,
        settingsAffected,
      },
    }));

    await transactionDone(tx);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Transaction may already be completed or aborted by IndexedDB.
    }
    throw error;
  }
  await pruneChangeJournal();
}

export async function getSettings(): Promise<AppSettings> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_SETTINGS, 'readonly');
  const settings = await requestToPromise(tx.objectStore(STORE_SETTINGS).get('app') as IDBRequest<(Partial<AppSettings> & { id: 'app' }) | undefined>);
  await transactionDone(tx);
  return {
    id: 'app',
    preferredStartView: settings?.preferredStartView ?? 'today',
    timeFormat: settings?.timeFormat ?? '24h',
    ...(settings?.homeLocationId ? { homeLocationId: settings.homeLocationId } : {}),
    ...(settings?.workLocationId ? { workLocationId: settings.workLocationId } : {}),
    notificationPreferences: normalizeNotificationPreferences(settings?.notificationPreferences),
    decorativeBackgroundMode: normalizeDecorativeBackgroundMode(settings?.decorativeBackgroundMode),
    updatedAt: settings?.updatedAt ?? nowIso(),
  };
}

export async function updateSettings(patch: AppSettingsPatch): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = { ...current, id: 'app', updatedAt: nowIso() };
  if (patch.preferredStartView) updated.preferredStartView = patch.preferredStartView;
  if (patch.timeFormat) updated.timeFormat = patch.timeFormat;
  if (patch.homeLocationId === null) delete updated.homeLocationId;
  else if (patch.homeLocationId !== undefined) updated.homeLocationId = patch.homeLocationId;
  if (patch.workLocationId === null) delete updated.workLocationId;
  else if (patch.workLocationId !== undefined) updated.workLocationId = patch.workLocationId;
  if (patch.notificationPreferences) updated.notificationPreferences = normalizeNotificationPreferences(patch.notificationPreferences);
  if (patch.decorativeBackgroundMode) updated.decorativeBackgroundMode = normalizeDecorativeBackgroundMode(patch.decorativeBackgroundMode);
  const db = await openDatabase();
  const tx = db.transaction(STORE_SETTINGS, 'readwrite');
  tx.objectStore(STORE_SETTINGS).put(updated);
  await transactionDone(tx);
  return updated;
}

export async function listUniversityImports(): Promise<UniversityScheduleImport[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_UNIVERSITY_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_UNIVERSITY_IMPORTS).getAll() as IDBRequest<UniversityScheduleImport[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getUniversityImport(id: string): Promise<UniversityScheduleImport | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_UNIVERSITY_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_UNIVERSITY_IMPORTS).get(id) as IDBRequest<UniversityScheduleImport | undefined>);
  await transactionDone(tx);
  return result;
}

export async function getActiveUniversityImport(): Promise<UniversityScheduleImport | undefined> {
  const profile = await getStudyProfile();
  if (profile?.activeImportId) {
    const active = await getUniversityImport(profile.activeImportId);
    if (active && active.lifecycleStatus !== 'HISTORICAL') return active;
  }
  const imports = await listUniversityImports();
  const explicitActive = imports.find((item) => item.lifecycleStatus === 'ACTIVE');
  if (explicitActive) return explicitActive;
  // Starsze dane sprzed lifecycleStatus mogły mieć jeden aktywny import bez flagi.
  // Nigdy jednak nie reaktywujemy automatycznie wpisu oznaczonego HISTORYCZNYM.
  return imports.find((item) => item.lifecycleStatus === undefined);
}

export async function findUniversityImportByHash(fileHash: string): Promise<UniversityScheduleImport | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_UNIVERSITY_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_UNIVERSITY_IMPORTS).index('fileHash').get(fileHash) as IDBRequest<UniversityScheduleImport | undefined>);
  await transactionDone(tx);
  return result;
}

export async function listUniversityImportEntries(importId?: string): Promise<UniversityImportEntry[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_UNIVERSITY_IMPORT_ENTRIES, 'readonly');
  const store = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  const result = importId
    ? await requestToPromise(store.index('importId').getAll(importId) as IDBRequest<UniversityImportEntry[]>)
    : await requestToPromise(store.getAll() as IDBRequest<UniversityImportEntry[]>);
  await transactionDone(tx);
  return result;
}

export async function getStudyProfile(): Promise<StudyProfile | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_STUDY_PROFILE, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_STUDY_PROFILE).get('university') as IDBRequest<StudyProfile | undefined>);
  await transactionDone(tx);
  return result;
}

export async function updateStudyProfileGroups(selectedGroups: string[]): Promise<StudyProfile> {
  const current = await getStudyProfile();
  const availableGroups = current?.availableGroups ?? current?.selectedGroups ?? [];
  const groupValidation = validateStudyGroupSelection(availableGroups, selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));
  const profile: StudyProfile = {
    id: 'university',
    selectedGroups: [...new Set(selectedGroups)].sort((a, b) => a.localeCompare(b, 'pl')),
    ...(current?.availableGroups ? { availableGroups: [...current.availableGroups] } : {}),
    ...(current?.detectedAcademicYear ? { detectedAcademicYear: current.detectedAcademicYear } : {}),
    ...(current?.detectedTerm ? { detectedTerm: current.detectedTerm } : {}),
    ...(current?.studyName ? { studyName: current.studyName } : {}),
    ...(current?.activeImportId ? { activeImportId: current.activeImportId } : {}),
    ...(current?.sourceDataComplete !== undefined ? { sourceDataComplete: current.sourceDataComplete } : {}),
    ...(current?.lastPlanUpdatedAt ? { lastPlanUpdatedAt: current.lastPlanUpdatedAt } : {}),
    updatedAt: nowIso(),
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_STUDY_PROFILE, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_STUDY_PROFILE).put(profile);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'UPDATE_STUDY_GROUPS',
    entityType: 'STUDY_GROUPS',
    entityIds: ['study-profile-university'],
    description: `Zmieniono grupy dla kolejnych importów: ${formatStudyGroupList(profile.selectedGroups)}`,
    beforeState: current,
    afterState: profile,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return profile;
}

type CompleteImportCandidate = StudyScheduleCandidate & Required<Pick<StudyScheduleCandidate, 'date' | 'startTime' | 'endTime'>>;

function requireCompleteImportCandidate(candidate: StudyScheduleCandidate): CompleteImportCandidate {
  const validation = validateCandidateForImport(candidate);
  if (!validation.valid || !candidate.date || !candidate.startTime || !candidate.endTime) {
    throw new Error(`Co najmniej jeden wybrany wpis nie ma poprawnej daty, godzin lub przedmiotu. ${validation.errors.join(' ')}`.trim());
  }
  return candidate as CompleteImportCandidate;
}

function candidateMatchesSelectedGroups(candidate: StudyScheduleCandidate, selectedGroups: string[]): boolean {
  if (candidate.groupScope === 'ALL' || candidate.groupScope === 'UNKNOWN') return true;
  return groupSetsIntersect(candidate.groupTags, selectedGroups);
}

function assertCandidatesBelongToSelection(
  candidates: StudyScheduleCandidate[],
  allCandidates: StudyScheduleCandidate[] | undefined,
  selectedGroups: string[],
): void {
  if (!allCandidates?.length) return;
  const sourceById = new Map(allCandidates.map((candidate) => [candidate.id, candidate]));
  const invalid = candidates.filter((candidate) => {
    const source = sourceById.get(candidate.id);
    return !source || !candidateMatchesSelectedGroups(source, selectedGroups);
  });
  if (invalid.length) {
    throw new Error(`Wykryto ${invalid.length} wpisów spoza wybranych grup. Odśwież podgląd planu przed zapisem.`);
  }
}

function importedEventDescription(candidate: Pick<StudyScheduleCandidate, 'activityType' | 'groupTags' | 'clinic' | 'room'>): string | undefined {
  const groupLabel = candidate.groupTags.length
    ? `${candidate.groupTags.length === 1 ? 'Grupa' : 'Grupy'} ${formatStudyGroupList(candidate.groupTags)}`
    : undefined;
  const parts = [
    candidate.activityType,
    groupLabel,
    candidate.clinic,
    candidate.room,
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' - ') : undefined;
}

function entryFromCandidate(candidate: StudyScheduleCandidate, importId: string, eventId?: string, sourceOnly = false): UniversityImportEntry {
  const identified = identifyCandidate(candidate);
  return {
    id: createId(sourceOnly ? 'university-source' : 'university-entry'),
    importId,
    adapterId: identified.adapterId,
    sourceKey: identified.sourceKey,
    ...(eventId ? { eventId } : {}),
    ...(sourceOnly ? { sourceOnly: true } : {}),
    sourceCandidateId: identified.id,
    sourceSheet: identified.sourceSheet,
    sourceRange: identified.sourceRange,
    originalText: identified.originalText,
    subject: identified.subject,
    ...(identified.activityType ? { activityType: identified.activityType } : {}),
    ...(identified.date ? { date: identified.date } : {}),
    ...(identified.startTime ? { startTime: identified.startTime } : {}),
    ...(identified.endTime ? { endTime: identified.endTime } : {}),
    groupScope: identified.groupScope,
    groupTags: [...identified.groupTags],
    ...(identified.clinic ? { clinic: identified.clinic } : {}),
    ...(identified.room ? { room: identified.room } : {}),
    ...(identified.address ? { address: identified.address } : {}),
    ...(identified.locationLabel ? { locationLabel: identified.locationLabel } : {}),
    warnings: [...identified.warnings],
    ...(identified.occurrenceKey ? { occurrenceKey: identified.occurrenceKey } : {}),
    ...(identified.seriesKey ? { seriesKey: identified.seriesKey } : {}),
    ...(identified.sourceWeekStart ? { sourceWeekStart: identified.sourceWeekStart } : {}),
    ...(identified.sourceWeekEnd ? { sourceWeekEnd: identified.sourceWeekEnd } : {}),
    ...(identified.sourceSectionKey ? { sourceSectionKey: identified.sourceSectionKey } : {}),
    ...(identified.declaredTeachingHours ? { declaredTeachingHours: identified.declaredTeachingHours } : {}),
  };
}

function cloneStudySourceBlocks(blocks: StudySourceBlock[] | undefined): StudySourceBlock[] | undefined {
  if (!blocks?.length) return undefined;
  return blocks.map((block) => ({
    ...block,
    groupTags: [...block.groupTags],
    weekdays: [...block.weekdays],
    excludedDates: [...block.excludedDates],
    candidateIds: [...block.candidateIds],
  }));
}

function assertStudySourceCompleteness(candidates: StudyScheduleCandidate[], sourceBlocks: StudySourceBlock[] | undefined, selectedGroups: string[]): void {
  if (!sourceBlocks?.length) return;
  const audit = completenessForSelectedGroups({
    adapterId: 'stored-completeness-gate',
    sheetNames: [],
    groups: [],
    candidates,
    sourceBlocks,
    information: [],
    warnings: [],
  }, selectedGroups);
  if (!audit.safe) throw new Error(`Plan nie przeszedł bramki kompletności: ${audit.reasons.join(' ')}`);
}

function locationMap(locations: Location[]): Map<string, Location> {
  return new Map(locations.map((location) => [normalizeLocationKey(location.address || location.name), location]));
}

function ensureCandidateLocation(
  candidate: StudyScheduleCandidate,
  locationsByKey: Map<string, Location>,
  newLocations: Location[],
  timestamp: string,
): string | undefined {
  const identity = candidate.address ?? candidate.locationLabel;
  if (!identity) return undefined;
  const key = normalizeLocationKey(identity);
  let location = locationsByKey.get(key);
  if (!location) {
    location = {
      id: createId('location-university'),
      name: candidate.clinic ?? candidate.address ?? candidate.locationLabel ?? candidate.subject,
      type: candidate.clinic ? 'CLINIC' : 'UNIVERSITY',
      address: candidate.address ?? candidate.locationLabel ?? candidate.subject,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(candidate.room ? { note: candidate.room } : {}),
    };
    locationsByKey.set(key, location);
    newLocations.push(location);
  }
  return location.id;
}

function candidateManualEventFields(candidate: StudyScheduleCandidate): UserModifiedEventField[] {
  const fields = new Set<UserModifiedEventField>();
  for (const field of candidate.manuallyModifiedFields ?? []) {
    if (field === 'subject') fields.add('title');
    if (field === 'date' || field === 'startTime') fields.add('startDateTime');
    if (field === 'date' || field === 'endTime') fields.add('endDateTime');
    if (field === 'address' || field === 'locationLabel') fields.add('locationId');
    if (field === 'room' || field === 'clinic') fields.add('description');
  }
  return [...fields];
}

function eventFromCandidate(candidate: CompleteImportCandidate, importId: string, entryId: string, locationId: string | undefined, timestamp: string): CalendarEvent {
  const identified = identifyCandidate(candidate);
  const description = importedEventDescription(identified);
  const manualFields = candidateManualEventFields(identified);
  return {
    id: createId('event'),
    title: identified.subject.trim(),
    startDateTime: `${identified.date}T${identified.startTime}`,
    endDateTime: `${identified.date}T${identified.endTime}`,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    sourceImportId: importId,
    sourceEntryId: entryId,
    ...(identified.occurrenceKey ? { occurrenceKey: identified.occurrenceKey } : {}),
    ...(identified.seriesKey ? { seriesKey: identified.seriesKey } : {}),
    studyIssueCodes: issueCodesForCandidate(identified),
    studyGroupTags: [...identified.groupTags],
    studyGroupScope: identified.groupScope,
    userModified: manualFields.length > 0,
    ...(manualFields.length ? { userModifiedFields: manualFields } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(locationId ? { locationId } : {}),
    ...(description ? { description } : {}),
  };
}

function buildCorrectionRule(rule: PendingStudyCorrectionRule, existing?: StudyCorrectionRule): StudyCorrectionRule {
  const timestamp = nowIso();
  return {
    id: existing?.id ?? createId('study-correction'),
    seriesKey: rule.seriesKey,
    field: rule.field,
    value: rule.value,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    source: 'USER_SERIES_CORRECTION',
    active: true,
  };
}

export async function listStudyCorrectionRules(): Promise<StudyCorrectionRule[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_STUDY_CORRECTION_RULES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_STUDY_CORRECTION_RULES).getAll() as IDBRequest<StudyCorrectionRule[]>);
  await transactionDone(tx);
  return result;
}

export async function commitUniversityImport(input: CommitUniversityImportInput): Promise<CommitUniversityImportResult> {
  const duplicate = await findUniversityImportByHash(input.fileHash);
  if (duplicate) throw new Error('Ten plik planu został już wcześniej zaimportowany.');
  const activeImport = await getActiveUniversityImport();
  if (activeImport) throw new Error('Istnieje już aktywny plan. Nowy plik musi zostać porównany z aktywnym planem i zastosowany jako aktualizacja.');
  const groupValidation = validateStudyGroupSelection(input.availableGroups ?? input.selectedGroups, input.selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));
  assertCandidatesBelongToSelection(input.candidates, input.allCandidates, input.selectedGroups);
  assertStudySourceCompleteness(input.allCandidates ?? input.candidates, input.sourceBlocks, input.selectedGroups);

  const importable = input.candidates.filter((candidate) => candidate.include !== false).map((candidate) => identifyCandidate(requireCompleteImportCandidate(candidate)));
  const conflicts = findStudyScheduleConflicts(importable);
  if (conflicts.length && !input.allowScheduleConflicts) throw new Error(`Wykryto ${conflicts.length} konfliktów godzin. Wróć do podglądu i rozwiąż je albo świadomie zaakceptuj przed zapisem.`);
  const safetyPoint = await createRestorePoint('Przed importem planu studiów', 'BEFORE_STUDY_IMPORT', true);
  const sourceCandidates = (input.allCandidates ?? input.candidates).map(identifyCandidate);
  const existingLocations = await listLocations();
  const existingImports = await listUniversityImports();
  const existingRules = await listStudyCorrectionRules();
  const locationsByKey = locationMap(existingLocations);
  const timestamp = nowIso();
  const importId = createId('university-import');
  const newLocations: Location[] = [];
  const events: CalendarEvent[] = [];
  const entries: UniversityImportEntry[] = [];

  for (const candidate of importable) {
    const locationId = ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
    const entryId = createId('university-entry');
    const event = eventFromCandidate(requireCompleteImportCandidate(candidate), importId, entryId, locationId, timestamp);
    const entry = { ...entryFromCandidate(candidate, importId, event.id, false), id: entryId };
    events.push(event);
    entries.push(entry);
  }

  const sourceEntries = sourceCandidates.map((candidate) => entryFromCandidate(candidate, importId, undefined, true));
  const importRecord: UniversityScheduleImport = {
    id: importId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    importedAt: timestamp,
    adapterId: input.adapterId,
    sheetNames: [...input.sheetNames],
    ...(input.detectedAcademicYear ? { detectedAcademicYear: input.detectedAcademicYear } : {}),
    ...(input.detectedTerm ? { detectedTerm: input.detectedTerm } : {}),
    selectedGroups: [...input.selectedGroups],
    availableGroups: [...(input.availableGroups ?? input.selectedGroups)],
    importedEventCount: events.length,
    warningCount: importable.reduce((sum, candidate) => sum + candidate.warnings.length, 0),
    status: 'COMPLETED',
    lifecycleStatus: 'ACTIVE',
    sourceDataComplete: Boolean(input.allCandidates),
    ...(input.sourceBlocks?.length ? { sourceBlocks: cloneStudySourceBlocks(input.sourceBlocks)! } : {}),
  };
  const profile: StudyProfile = {
    id: 'university',
    selectedGroups: [...input.selectedGroups],
    availableGroups: [...(input.availableGroups ?? input.selectedGroups)],
    ...(input.detectedAcademicYear ? { detectedAcademicYear: input.detectedAcademicYear } : {}),
    ...(input.detectedTerm ? { detectedTerm: input.detectedTerm } : {}),
    activeImportId: importId,
    sourceDataComplete: Boolean(input.allCandidates),
    lastPlanUpdatedAt: timestamp,
    updatedAt: timestamp,
  };

  const db = await openDatabase();
  const tx = db.transaction(
    [STORE_EVENTS, STORE_LOCATIONS, STORE_UNIVERSITY_IMPORTS, STORE_UNIVERSITY_IMPORT_ENTRIES, STORE_STUDY_PROFILE, STORE_STUDY_CORRECTION_RULES, STORE_CHANGE_JOURNAL],
    'readwrite',
  );
  const eventStore = tx.objectStore(STORE_EVENTS);
  const locationStore = tx.objectStore(STORE_LOCATIONS);
  const importStore = tx.objectStore(STORE_UNIVERSITY_IMPORTS);
  const entryStore = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  const correctionStore = tx.objectStore(STORE_STUDY_CORRECTION_RULES);
  for (const oldImport of existingImports) {
    if (oldImport.lifecycleStatus === 'ACTIVE' || oldImport.lifecycleStatus === undefined) {
      importStore.put({ ...oldImport, lifecycleStatus: 'HISTORICAL' } satisfies UniversityScheduleImport);
    }
  }
  for (const location of newLocations) locationStore.add(location);
  for (const event of events) eventStore.add(event);
  for (const entry of [...entries, ...sourceEntries]) entryStore.add(entry);
  importStore.add(importRecord);
  tx.objectStore(STORE_STUDY_PROFILE).put(profile);

  for (const pending of input.pendingCorrectionRules ?? []) {
    const existing = existingRules.find((rule) => rule.seriesKey === pending.seriesKey && rule.field === pending.field);
    correctionStore.put(buildCorrectionRule(pending, existing));
  }
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'IMPORT_STUDY_PLAN',
    entityType: 'STUDY_PLAN',
    entityIds: [importRecord.id],
    description: `Zaimportowano plan studiów: ${importRecord.fileName}`,
    restorePointId: safetyPoint.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return { importRecord, eventCount: events.length, newLocationCount: newLocations.length };
}

export async function deleteUniversityImport(importId: string): Promise<void> {
  const safetyPoint = await createRestorePoint('Przed usunięciem importu planu', 'BEFORE_IMPORT_DELETE', true);
  const [entries, events, profile] = await Promise.all([listUniversityImportEntries(importId), listEvents(), getStudyProfile()]);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_UNIVERSITY_IMPORTS, STORE_UNIVERSITY_IMPORT_ENTRIES, STORE_STUDY_PROFILE, STORE_CHANGE_JOURNAL], 'readwrite');
  const eventStore = tx.objectStore(STORE_EVENTS);
  const entryStore = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  for (const entry of entries) {
    if (entry.eventId) {
      const event = eventById.get(entry.eventId);
      if (event?.sourceImportId === importId) eventStore.delete(entry.eventId);
    }
    entryStore.delete(entry.id);
  }
  tx.objectStore(STORE_UNIVERSITY_IMPORTS).delete(importId);
  if (profile?.activeImportId === importId) {
    const next = { ...profile, updatedAt: nowIso() };
    delete next.activeImportId;
    next.sourceDataComplete = false;
    tx.objectStore(STORE_STUDY_PROFILE).put(next);
  }
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_STUDY_IMPORT',
    entityType: 'STUDY_PLAN',
    entityIds: [importId],
    description: 'Usunięto zapis planu studiów',
    restorePointId: safetyPoint.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export interface PrepareScheduleUpdateInput {
  fileName: string;
  fileSize: number;
  fileHash: string;
  adapterId: string;
  sheetNames: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  selectedGroups: string[];
  availableGroups: string[];
  allowScheduleConflicts?: boolean;
  candidates: StudyScheduleCandidate[];
  allCandidates: StudyScheduleCandidate[];
  sourceBlocks?: StudySourceBlock[];
}

export async function prepareUniversityScheduleUpdate(input: PrepareScheduleUpdateInput): Promise<ScheduleUpdatePreview> {
  const duplicate = await findUniversityImportByHash(input.fileHash);
  if (duplicate) throw new Error('Ten plik planu został już wcześniej zaimportowany.');
  const groupValidation = validateStudyGroupSelection(input.availableGroups, input.selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));
  assertCandidatesBelongToSelection(input.candidates, input.allCandidates, input.selectedGroups);
  assertStudySourceCompleteness(input.allCandidates, input.sourceBlocks, input.selectedGroups);
  const selectedCandidates = input.candidates.filter((candidate) => candidate.include !== false || !reviewCandidate(candidate).canImport);
  const importConflicts = findStudyScheduleConflicts(selectedCandidates);
  if (importConflicts.length && !input.allowScheduleConflicts) throw new Error(`Wykryto ${importConflicts.length} konfliktów godzin. Wróć do podglądu i rozwiąż je albo świadomie zaakceptuj przed porównaniem planów.`);
  const baseImport = await getActiveUniversityImport();
  if (!baseImport) throw new Error('Brak aktywnego planu do porównania.');
  const [entries, events, rules] = await Promise.all([
    listUniversityImportEntries(baseImport.id),
    listEvents(),
    listStudyCorrectionRules(),
  ]);
  const oldEntries = entries.filter((entry) => (Boolean(entry.eventId) || entry.userDeleted) && !entry.sourceOnly);
  const candidateCorrections = applyCorrectionRules(selectedCandidates, rules);
  const candidates = candidateCorrections.candidates.map(identifyCandidate);
  const diff = buildScheduleDiff({ oldEntries, oldEvents: events, newCandidates: candidates, adapterId: input.adapterId });
  const correctionConflictByCandidate = new Map<string, typeof candidateCorrections.conflicts>();
  for (const conflict of candidateCorrections.conflicts) {
    const list = correctionConflictByCandidate.get(conflict.candidateId) ?? [];
    list.push(conflict);
    correctionConflictByCandidate.set(conflict.candidateId, list);
  }
  const items = diff.items.map((item) => {
    if (item.oldEntry?.userDeleted && item.newCandidate && reviewCandidate(item.newCandidate).canImport) {
      return {
        ...item,
        kind: 'CONFLICT_USER_MODIFIED' as const,
        resolution: 'KEEP_USER' as const,
        note: 'To zajęcie zostało wcześniej świadomie usunięte z kalendarza. Domyślnie pozostaje ukryte. Wybierz dane z nowego planu tylko jeśli chcesz je przywrócić.',
      };
    }
    const conflicts = item.newCandidate ? correctionConflictByCandidate.get(item.newCandidate.id) : undefined;
    if (!conflicts?.length) return item;
    const details = conflicts.map((conflict) => `${conflict.field}: zapisano „${conflict.savedValue}”, plan podaje „${conflict.planValue}”`).join('; ');
    return {
      ...item,
      kind: 'CONFLICT_USER_MODIFIED' as const,
      correctionConflictFields: [...new Set(conflicts.map((conflict) => conflict.field))],
      resolution: 'SKIP' as const,
      note: `Zapisana poprawka serii różni się od jawnych danych nowego planu (${details}). Wybierz, którą wartość zachować.`,
    };
  });
  const decisionConflicts = findStudyUpdateDecisionConflicts(items);
  const preview: ScheduleUpdatePreview = {
    id: createId('schedule-update'),
    baseImport,
    fileName: input.fileName,
    fileSize: input.fileSize,
    fileHash: input.fileHash,
    adapterId: input.adapterId,
    sheetNames: [...input.sheetNames],
    ...(input.detectedAcademicYear ? { detectedAcademicYear: input.detectedAcademicYear } : {}),
    ...(input.detectedTerm ? { detectedTerm: input.detectedTerm } : {}),
    selectedGroups: [...input.selectedGroups],
    availableGroups: [...input.availableGroups],
    allowScheduleConflicts: false,
    ...(decisionConflicts.length ? { scheduleConflicts: decisionConflicts } : {}),
    candidates,
    allCandidates: input.allCandidates.map(identifyCandidate),
    ...(input.sourceBlocks?.length ? { sourceBlocks: cloneStudySourceBlocks(input.sourceBlocks)! } : {}),
    items,
    summary: recalculateDiffSummary(items),
    correctionConflicts: candidateCorrections.conflicts,
    createdAt: nowIso(),
  };
  const session: ScheduleUpdateSession = {
    id: preview.id,
    baseImportId: baseImport.id,
    newFileHash: input.fileHash,
    newFileName: input.fileName,
    createdAt: preview.createdAt,
    status: 'PREVIEW',
    summary: preview.summary,
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_SCHEDULE_UPDATE_SESSIONS, 'readwrite');
  tx.objectStore(STORE_SCHEDULE_UPDATE_SESSIONS).put(session);
  await transactionDone(tx);
  return preview;
}

function applyCandidateToExistingEvent(
  event: CalendarEvent,
  candidate: CompleteImportCandidate,
  importId: string,
  entryId: string,
  locationId: string | undefined,
  preserveUserFields: UserModifiedEventField[],
  timestamp: string,
): CalendarEvent {
  const identified = identifyCandidate(candidate);
  const description = importedEventDescription(identified);
  const next: CalendarEvent = {
    ...event,
    title: identified.subject,
    startDateTime: `${identified.date}T${identified.startTime}`,
    endDateTime: `${identified.date}T${identified.endTime}`,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    sourceImportId: importId,
    sourceEntryId: entryId,
    ...(identified.occurrenceKey ? { occurrenceKey: identified.occurrenceKey } : {}),
    ...(identified.seriesKey ? { seriesKey: identified.seriesKey } : {}),
    studyIssueCodes: issueCodesForCandidate(identified),
    studyGroupTags: [...identified.groupTags],
    studyGroupScope: identified.groupScope,
    userModified: preserveUserFields.length > 0,
    userModifiedFields: [...preserveUserFields],
    updatedAt: timestamp,
  };
  if (locationId) next.locationId = locationId;
  else delete next.locationId;
  if (description) next.description = description;
  else delete next.description;

  // Merge user-owned fields back on top of the fresh plan values. This lets a new
  // plan update unrelated source fields without silently destroying manual edits.
  for (const field of preserveUserFields) {
    if (field === 'title') next.title = event.title;
    if (field === 'startDateTime') next.startDateTime = event.startDateTime;
    if (field === 'endDateTime') next.endDateTime = event.endDateTime;
    if (field === 'category') next.category = event.category;
    if (field === 'description') {
      if (event.description) next.description = event.description;
      else delete next.description;
    }
    if (field === 'locationId') {
      if (event.locationId) next.locationId = event.locationId;
      else delete next.locationId;
    }
  }
  return next;
}

function preservedFieldsForUpdate(event: CalendarEvent, item: ScheduleDiffItem): UserModifiedEventField[] {
  if (!event.userModified) return [];
  const explicit = event.userModifiedFields ?? [];
  if (explicit.length > 0) {
    if (item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution === 'USE_NEW') return [];
    const preserved = new Set<UserModifiedEventField>(explicit);
    if (item.changes.some((change) => change.field === 'date')
      && (preserved.has('startDateTime') || preserved.has('endDateTime'))) {
      preserved.add('startDateTime');
      preserved.add('endDateTime');
    }
    return [...preserved];
  }
  if (item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution === 'USE_NEW') return [];
  // Legacy userModified=true did not record which field changed. Preserve every
  // editable user field rather than pretend we know which one is safe to replace.
  return ['title', 'startDateTime', 'endDateTime', 'locationId', 'description', 'category'];
}

function detachStudyEventAsManual(event: CalendarEvent, timestamp: string): CalendarEvent {
  const manual: CalendarEvent = {
    ...event,
    source: 'MANUAL',
    userModified: false,
    userModifiedFields: [],
    updatedAt: timestamp,
  };
  delete manual.sourceImportId;
  delete manual.sourceEntryId;
  delete manual.occurrenceKey;
  delete manual.seriesKey;
  delete manual.studyIssueCodes;
  return manual;
}

function eventPreviewFingerprint(event: CalendarEvent): string {
  return JSON.stringify({
    id: event.id,
    title: event.title,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    category: event.category,
    source: event.source,
    sourceImportId: event.sourceImportId ?? null,
    sourceEntryId: event.sourceEntryId ?? null,
    locationId: event.locationId ?? null,
    description: event.description ?? null,
    userModified: Boolean(event.userModified),
    userModifiedFields: [...(event.userModifiedFields ?? [])].sort(),
    occurrenceKey: event.occurrenceKey ?? null,
    seriesKey: event.seriesKey ?? null,
  });
}

function sortedConflictIds(conflicts: ReturnType<typeof findStudyUpdateDecisionConflicts> | undefined): string {
  return [...(conflicts ?? [])].map((conflict) => conflict.id).sort().join('\n');
}

function retainedAmbiguousEvent(
  oldEvent: CalendarEvent,
  candidate: StudyScheduleCandidate,
  importId: string,
  entryId: string,
  timestamp: string,
): CalendarEvent {
  const identified = identifyCandidate(candidate);
  const preservedFields = new Set<UserModifiedEventField>(oldEvent.userModifiedFields ?? []);
  preservedFields.add('title');
  preservedFields.add('startDateTime');
  preservedFields.add('endDateTime');
  preservedFields.add('locationId');
  preservedFields.add('description');
  const retained: CalendarEvent = {
    ...oldEvent,
    source: 'UNIVERSITY_XLSX',
    sourceImportId: importId,
    sourceEntryId: entryId,
    ...(identified.occurrenceKey ? { occurrenceKey: identified.occurrenceKey } : {}),
    ...(identified.seriesKey ? { seriesKey: identified.seriesKey } : {}),
    studyIssueCodes: issueCodesForCandidate(identified),
    studyGroupTags: [...identified.groupTags],
    studyGroupScope: identified.groupScope,
    userModified: true,
    userModifiedFields: [...preservedFields],
    updatedAt: timestamp,
  };
  if (!identified.occurrenceKey) delete retained.occurrenceKey;
  if (!identified.seriesKey) delete retained.seriesKey;
  return retained;
}

export async function applyUniversityScheduleUpdate(preview: ScheduleUpdatePreview): Promise<ApplyScheduleUpdateResult> {
  const duplicate = await findUniversityImportByHash(preview.fileHash);
  if (duplicate) throw new Error('Ta aktualizacja została już wcześniej zastosowana.');
  const currentActiveImport = await getActiveUniversityImport();
  if (!currentActiveImport || currentActiveImport.id !== preview.baseImport.id) {
    throw new Error('Aktywny plan zmienił się od czasu przygotowania podglądu. Przygotuj porównanie ponownie, aby nie zastosować zmian do nieaktualnej wersji planu.');
  }
  const groupValidation = validateStudyGroupSelection(preview.availableGroups, preview.selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));
  assertCandidatesBelongToSelection(preview.candidates, preview.allCandidates, preview.selectedGroups);
  assertStudySourceCompleteness(preview.allCandidates, preview.sourceBlocks, preview.selectedGroups);

  const [events, existingLocations, existingRules, currentEntries] = await Promise.all([
    listEvents(),
    listLocations(),
    listStudyCorrectionRules(),
    listUniversityImportEntries(preview.baseImport.id),
  ]);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const currentEntryById = new Map(currentEntries.map((entry) => [entry.id, entry]));
  for (const item of preview.items) {
    if (item.oldEntry) {
      const currentEntry = currentEntryById.get(item.oldEntry.id);
      if (!currentEntry || currentEntry.eventId !== item.oldEntry.eventId || Boolean(currentEntry.userDeleted) !== Boolean(item.oldEntry.userDeleted)) {
        throw new Error('Plan lub stan usuniętych zajęć zmienił się od czasu przygotowania podglądu. Przygotuj porównanie ponownie.');
      }
    }
    if (item.oldEventSnapshot) {
      const currentEvent = eventById.get(item.oldEventSnapshot.id);
      if (!currentEvent || eventPreviewFingerprint(currentEvent) !== eventPreviewFingerprint(item.oldEventSnapshot)) {
        throw new Error('Kalendarz zmienił się od czasu przygotowania podglądu aktualizacji. Przygotuj porównanie ponownie, aby zobaczyć aktualny wynik.');
      }
    }
  }

  const decisionConflicts = findStudyUpdateDecisionConflicts(preview.items);
  if (sortedConflictIds(decisionConflicts) !== sortedConflictIds(preview.scheduleConflicts)) {
    throw new Error('Decyzje w podglądzie zmieniły wynik konfliktów. Odśwież podgląd przed zastosowaniem aktualizacji.');
  }
  if (decisionConflicts.length && !preview.allowScheduleConflicts) {
    throw new Error(`Wykryto ${decisionConflicts.length} konfliktów godzin w końcowym wyniku aktualizacji. Sprawdź je i świadomie zaakceptuj przed zapisem.`);
  }

  const safetyPoint = await createRestorePoint('Przed aktualizacją planu studiów', 'BEFORE_STUDY_UPDATE', true);
  const locationsByKey = locationMap(existingLocations);
  const timestamp = nowIso();
  const importId = createId('university-import');
  const newLocations: Location[] = [];
  const eventsToPut: CalendarEvent[] = [];
  const eventIdsToDelete = new Set<string>();
  const linkedEntries: UniversityImportEntry[] = [];
  const correctionRuleKeysToDeactivate = new Set<string>();
  let added = 0;
  let changed = 0;
  let removed = 0;
  let keptUserModified = 0;
  let resolvedConflicts = 0;

  for (const item of preview.items) {
    const oldEvent = item.oldEventId ? eventById.get(item.oldEventId) : undefined;
    const candidate = item.newCandidate;

    if (item.kind === 'AMBIGUOUS') {
      if (!candidate) continue;
      if (item.oldEntry?.userDeleted && !oldEvent) {
        linkedEntries.push({ ...entryFromCandidate(candidate, importId, undefined, false), userDeleted: true });
        keptUserModified += 1;
        continue;
      }
      if (!oldEvent) continue;
      const entryId = createId('university-entry');
      eventsToPut.push(retainedAmbiguousEvent(oldEvent, candidate, importId, entryId, timestamp));
      linkedEntries.push({ ...entryFromCandidate(candidate, importId, oldEvent.id, false), id: entryId });
      keptUserModified += 1;
      continue;
    }

    if (item.kind === 'REMOVED') {
      if (!oldEvent) continue;
      if (item.resolution === 'APPLY') {
        eventIdsToDelete.add(oldEvent.id);
        removed += 1;
      } else if (item.resolution === 'SKIP' || item.resolution === 'KEEP_USER') {
        // Keeping an event that no longer exists in the source plan turns it into
        // a normal personal event so a later plan update cannot delete it silently.
        eventsToPut.push(detachStudyEventAsManual(oldEvent, timestamp));
        if (oldEvent.userModified) keptUserModified += 1;
      }
      continue;
    }

    if (item.kind === 'CONFLICT_USER_MODIFIED' && !candidate) {
      if (!oldEvent) continue;
      if (item.resolution === 'USE_NEW' || item.resolution === 'APPLY') {
        eventIdsToDelete.add(oldEvent.id);
        removed += 1;
        resolvedConflicts += 1;
      } else {
        eventsToPut.push(detachStudyEventAsManual(oldEvent, timestamp));
        keptUserModified += 1;
        resolvedConflicts += 1;
      }
      continue;
    }

    if (!candidate) continue;
    const complete = requireCompleteImportCandidate(candidate);
    if (!reviewCandidate(candidate).canImport) continue;

    if (item.oldEntry?.userDeleted && !oldEvent) {
      if (item.resolution === 'KEEP_USER' || item.resolution === 'SKIP') {
        linkedEntries.push({ ...entryFromCandidate(candidate, importId, undefined, false), userDeleted: true });
        keptUserModified += 1;
        continue;
      }
      const entryId = createId('university-entry');
      const locationId = ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
      const event = eventFromCandidate(complete, importId, entryId, locationId, timestamp);
      const entry = { ...entryFromCandidate(candidate, importId, event.id, false), id: entryId, userDeleted: false };
      eventsToPut.push(event);
      linkedEntries.push(entry);
      added += 1;
      resolvedConflicts += 1;
      continue;
    }

    if (item.kind === 'ADDED' || !oldEvent) {
      if (item.resolution === 'SKIP') continue;
      const entryId = createId('university-entry');
      const locationId = ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
      const event = eventFromCandidate(complete, importId, entryId, locationId, timestamp);
      const entry = { ...entryFromCandidate(candidate, importId, event.id, false), id: entryId };
      eventsToPut.push(event);
      linkedEntries.push(entry);
      added += 1;
      continue;
    }

    // Skipping a changed source value means "keep my current value". Keep the
    // event attached to the new active plan as an explicit user override instead
    // of leaving a stale reference to the historical import.
    if (item.kind === 'CHANGED' && item.resolution === 'SKIP') {
      const entryId = createId('university-entry');
      const preserved = new Set<UserModifiedEventField>(preservedFieldsForUpdate(oldEvent, item));
      for (const change of item.changes) {
        if (change.field === 'subject') preserved.add('title');
        if (change.field === 'date' || change.field === 'startTime') preserved.add('startDateTime');
        if (change.field === 'date' || change.field === 'endTime') preserved.add('endDateTime');
        if (change.field === 'address' || change.field === 'locationLabel') preserved.add('locationId');
        if (change.field === 'room' || change.field === 'clinic' || change.field === 'activityType' || change.field === 'groupTags') preserved.add('description');
      }
      const locationId = preserved.has('locationId')
        ? oldEvent.locationId
        : ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
      const updated = applyCandidateToExistingEvent(oldEvent, complete, importId, entryId, locationId, [...preserved], timestamp);
      eventsToPut.push(updated);
      linkedEntries.push({ ...entryFromCandidate(candidate, importId, oldEvent.id, false), id: entryId });
      keptUserModified += 1;
      continue;
    }

    const preserveFields = preservedFieldsForUpdate(oldEvent, item);
    if (item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution !== 'KEEP_USER' && item.resolution !== 'USE_NEW' && item.resolution !== 'APPLY') continue;
    if (item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution === 'USE_NEW' && candidate.seriesKey) {
      for (const field of item.correctionConflictFields ?? []) correctionRuleKeysToDeactivate.add(`${candidate.seriesKey}|${field}`);
    }
    const effectivePreserveFields = item.kind === 'CONFLICT_USER_MODIFIED' && item.resolution === 'USE_NEW' ? [] : preserveFields;
    const entryId = createId('university-entry');
    const locationId = effectivePreserveFields.includes('locationId')
      ? oldEvent.locationId
      : ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
    const updated = applyCandidateToExistingEvent(oldEvent, complete, importId, entryId, locationId, effectivePreserveFields, timestamp);
    eventsToPut.push(updated);
    linkedEntries.push({ ...entryFromCandidate(candidate, importId, oldEvent.id, false), id: entryId });
    if (item.kind === 'CHANGED') changed += 1;
    if (item.kind === 'UNCHANGED' && oldEvent.userModified) keptUserModified += 1;
    if (item.kind === 'CONFLICT_USER_MODIFIED') {
      resolvedConflicts += 1;
      if (item.resolution === 'KEEP_USER') keptUserModified += 1;
      else changed += 1;
    }
  }

  const sourceEntries = preview.allCandidates.map((candidate) => entryFromCandidate(candidate, importId, undefined, true));
  const importedEventCount = linkedEntries.filter((entry) => Boolean(entry.eventId)).length;
  const importRecord: UniversityScheduleImport = {
    id: importId,
    fileName: preview.fileName,
    fileSize: preview.fileSize,
    fileHash: preview.fileHash,
    importedAt: timestamp,
    adapterId: preview.adapterId,
    sheetNames: [...preview.sheetNames],
    ...(preview.detectedAcademicYear ? { detectedAcademicYear: preview.detectedAcademicYear } : {}),
    ...(preview.detectedTerm ? { detectedTerm: preview.detectedTerm } : {}),
    selectedGroups: [...preview.selectedGroups],
    availableGroups: [...preview.availableGroups],
    importedEventCount,
    warningCount: preview.candidates.reduce((sum, candidate) => sum + candidate.warnings.length, 0),
    status: 'COMPLETED',
    lifecycleStatus: 'ACTIVE',
    sourceDataComplete: true,
    ...(preview.sourceBlocks?.length ? { sourceBlocks: cloneStudySourceBlocks(preview.sourceBlocks)! } : {}),
    replacedImportId: preview.baseImport.id,
  };
  const profile: StudyProfile = {
    id: 'university',
    selectedGroups: [...preview.selectedGroups],
    availableGroups: [...preview.availableGroups],
    ...(preview.detectedAcademicYear ? { detectedAcademicYear: preview.detectedAcademicYear } : {}),
    ...(preview.detectedTerm ? { detectedTerm: preview.detectedTerm } : {}),
    activeImportId: importId,
    sourceDataComplete: true,
    lastPlanUpdatedAt: timestamp,
    updatedAt: timestamp,
  };

  const db = await openDatabase();
  const tx = db.transaction(
    [STORE_EVENTS, STORE_LOCATIONS, STORE_UNIVERSITY_IMPORTS, STORE_UNIVERSITY_IMPORT_ENTRIES, STORE_STUDY_PROFILE, STORE_SCHEDULE_UPDATE_SESSIONS, STORE_STUDY_CORRECTION_RULES, STORE_CHANGE_JOURNAL],
    'readwrite',
  );
  const eventStore = tx.objectStore(STORE_EVENTS);
  const locationStore = tx.objectStore(STORE_LOCATIONS);
  const importStore = tx.objectStore(STORE_UNIVERSITY_IMPORTS);
  const entryStore = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  for (const location of newLocations) locationStore.put(location);
  for (const eventId of eventIdsToDelete) eventStore.delete(eventId);
  for (const event of eventsToPut) eventStore.put(event);
  for (const entry of [...linkedEntries, ...sourceEntries]) entryStore.add(entry);
  importStore.put({ ...preview.baseImport, lifecycleStatus: 'HISTORICAL' } satisfies UniversityScheduleImport);
  importStore.add(importRecord);
  tx.objectStore(STORE_STUDY_PROFILE).put(profile);
  tx.objectStore(STORE_SCHEDULE_UPDATE_SESSIONS).put({
    id: preview.id,
    baseImportId: preview.baseImport.id,
    newFileHash: preview.fileHash,
    newFileName: preview.fileName,
    createdAt: preview.createdAt,
    appliedAt: timestamp,
    status: 'APPLIED',
    summary: preview.summary,
  } satisfies ScheduleUpdateSession);
  const correctionStore = tx.objectStore(STORE_STUDY_CORRECTION_RULES);
  for (const rule of existingRules) {
    if (!correctionRuleKeysToDeactivate.has(`${rule.seriesKey}|${rule.field}`)) continue;
    correctionStore.put({ ...rule, active: false, updatedAt: timestamp } satisfies StudyCorrectionRule);
  }
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'UPDATE_STUDY_PLAN',
    entityType: 'STUDY_PLAN',
    entityIds: [importRecord.id, preview.baseImport.id],
    description: `Zaktualizowano plan studiów: +${added}, ~${changed}, -${removed}`,
    restorePointId: safetyPoint.id,
  }));

  await transactionDone(tx);
  await pruneChangeJournal();
  return { importRecord, added, changed, removed, keptUserModified, resolvedConflicts };
}

export async function cancelScheduleUpdate(preview: ScheduleUpdatePreview): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_SCHEDULE_UPDATE_SESSIONS, 'readwrite');
  tx.objectStore(STORE_SCHEDULE_UPDATE_SESSIONS).put({
    id: preview.id,
    baseImportId: preview.baseImport.id,
    newFileHash: preview.fileHash,
    newFileName: preview.fileName,
    createdAt: preview.createdAt,
    cancelledAt: nowIso(),
    status: 'CANCELLED',
    summary: preview.summary,
  } satisfies ScheduleUpdateSession);
  await transactionDone(tx);
}

export async function prepareGroupRecalculation(selectedGroups: string[]): Promise<GroupRecalculationPreview> {
  const active = await getActiveUniversityImport();
  const profile = await getStudyProfile();
  if (!active) {
    return { selectedGroups, currentGroups: profile?.selectedGroups ?? [], canRecalculate: false, requiresReupload: true, reason: 'Brak aktywnego planu.', addedEntryIds: [], removedEntryIds: [], unchangedEventCount: 0 };
  }
  const availableGroups = active.availableGroups ?? active.selectedGroups;
  const groupValidation = validateStudyGroupSelection(availableGroups, selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));

  const entries = await listUniversityImportEntries(active.id);
  const sourceEntries = entries.filter((entry) => entry.sourceOnly);
  if (!active.sourceDataComplete || !sourceEntries.length) {
    return {
      selectedGroups,
      currentGroups: active.selectedGroups,
      canRecalculate: false,
      requiresReupload: true,
      reason: 'Ten plan został zapisany w starszej wersji aplikacji bez pełnego zestawu grup. Wskaż ponownie plik Excel, aby bezpiecznie przeliczyć aktualny kalendarz.',
      addedEntryIds: [],
      removedEntryIds: [],
      unchangedEventCount: entries.filter((entry) => Boolean(entry.eventId)).length,
    };
  }

  const sourceAnalysis = {
    adapterId: active.adapterId,
    sheetNames: [...active.sheetNames],
    groups: [...(active.availableGroups ?? [])],
    candidates: sourceEntries.map((entry) => candidateFromEntry(entry)),
    ...(active.sourceBlocks?.length ? { sourceBlocks: cloneStudySourceBlocks(active.sourceBlocks)! } : {}),
    information: [],
    warnings: [],
  };
  if (active.sourceBlocks?.length) {
    const completeness = completenessForSelectedGroups(sourceAnalysis, selectedGroups);
    if (!completeness.safe) {
      return {
        selectedGroups,
        currentGroups: active.selectedGroups,
        canRecalculate: false,
        requiresReupload: true,
        reason: `Zapisany plan nie przechodzi bramki kompletności dla wybranych grup. Wskaż ponownie plik Excel. ${completeness.reasons.join(' ')}`,
        addedEntryIds: [],
        removedEntryIds: [],
        unchangedEventCount: entries.filter((entry) => Boolean(entry.eventId)).length,
      };
    }
  }
  const correctionRules = await listStudyCorrectionRules();
  const correctedTargetCandidates = applyCorrectionRules(
    candidatesForSelectedGroups(sourceAnalysis, selectedGroups).map(identifyCandidate),
    correctionRules,
  ).candidates;
  const targetCandidates = correctedTargetCandidates.filter((candidate) => reviewCandidate(candidate).canImport && candidate.date && candidate.startTime && candidate.endTime);
  const incompleteCandidates = correctedTargetCandidates.filter((candidate) => !reviewCandidate(candidate).canImport);
  const linkedEntries = entries.filter((entry) => (Boolean(entry.eventId) || entry.userDeleted) && !entry.sourceOnly).map((entry) => identifyEntry(entry, active.adapterId));
  const currentKeys = new Set(linkedEntries.map((entry) => entry.occurrenceKey ?? entry.sourceKey));
  const targetKeys = new Set(targetCandidates.map((candidate) => candidate.occurrenceKey ?? candidate.sourceKey));
  const addedCandidates = targetCandidates.filter((candidate) => !currentKeys.has(candidate.occurrenceKey ?? candidate.sourceKey));
  const removedEntries = linkedEntries.filter((entry) => !targetKeys.has(entry.occurrenceKey ?? entry.sourceKey));
  const allEvents = await listEvents();
  const eventById = new Map(allEvents.map((event) => [event.id, event]));
  const removedEventIds = removedEntries.flatMap((entry) => entry.eventId ? [entry.eventId] : []);
  const protectedRemovedEventIds = removedEventIds.filter((eventId) => Boolean(eventById.get(eventId)?.userModified));
  const scheduleConflicts = findStudyScheduleConflicts(targetCandidates);
  return {
    selectedGroups: [...selectedGroups],
    currentGroups: [...active.selectedGroups],
    canRecalculate: true,
    requiresReupload: false,
    addedEntryIds: addedCandidates.map((candidate) => candidate.sourceKey),
    removedEntryIds: removedEntries.map((entry) => entry.id),
    addedCandidates,
    removedEventIds,
    protectedRemovedEventIds,
    ...(incompleteCandidates.length ? { incompleteCandidates } : {}),
    ...(scheduleConflicts.length ? { scheduleConflicts } : {}),
    unchangedEventCount: Math.max(0, linkedEntries.length - removedEntries.length),
  };
}

export async function applyGroupRecalculation(preview: GroupRecalculationPreview, allowScheduleConflicts = false, allowIncompleteCandidates = false): Promise<void> {
  if (!preview.canRecalculate || preview.requiresReupload) throw new Error(preview.reason ?? 'Nie można przeliczyć aktywnego planu.');
  // Nie ufamy wyłącznie wcześniej wyświetlonemu podglądowi. Między przygotowaniem a zapisem
  // dane mogły zmienić się w innej karcie, dlatego przeliczamy docelowy zestaw ponownie.
  const freshPreview = await prepareGroupRecalculation(preview.selectedGroups);
  if (!freshPreview.canRecalculate || freshPreview.requiresReupload) throw new Error(freshPreview.reason ?? 'Nie można przeliczyć aktywnego planu.');
  const sortedKey = (values: string[] | undefined) => [...(values ?? [])].sort().join('\n');
  const previewChanged = sortedKey(preview.addedEntryIds) !== sortedKey(freshPreview.addedEntryIds)
    || sortedKey(preview.removedEntryIds) !== sortedKey(freshPreview.removedEntryIds)
    || sortedKey(preview.protectedRemovedEventIds) !== sortedKey(freshPreview.protectedRemovedEventIds)
    || sortedKey(preview.incompleteCandidates?.map((candidate) => candidate.id)) !== sortedKey(freshPreview.incompleteCandidates?.map((candidate) => candidate.id))
    || sortedKey(preview.scheduleConflicts?.map((conflict) => conflict.id)) !== sortedKey(freshPreview.scheduleConflicts?.map((conflict) => conflict.id));
  if (previewChanged) {
    throw new Error('Plan lub dane kalendarza zmieniły się od czasu przygotowania podglądu zmiany grup. Przygotuj podgląd ponownie, aby świadomie ocenić aktualny wynik.');
  }
  if (freshPreview.scheduleConflicts?.length && !allowScheduleConflicts) throw new Error(`Wykryto ${freshPreview.scheduleConflicts.length} konfliktów godzin po zmianie grup. Sprawdź je i świadomie zaakceptuj albo zmień wybór grup.`);
  if (freshPreview.incompleteCandidates?.length && !allowIncompleteCandidates) throw new Error(`Po zmianie grup ${freshPreview.incompleteCandidates.length} wpisów nadal nie ma pełnej daty lub godzin i pozostanie poza kalendarzem. Potwierdź to świadomie przed zapisem.`);
  const safetyPoint = await createRestorePoint('Przed przeliczeniem planu po zmianie grup', 'BEFORE_GROUP_RECALCULATION', true);
  const active = await getActiveUniversityImport();
  if (!active) throw new Error('Brak aktywnego planu.');
  const [locations, entries, events] = await Promise.all([listLocations(), listUniversityImportEntries(active.id), listEvents()]);
  const locationsByKey = locationMap(locations);
  const timestamp = nowIso();
  const newLocations: Location[] = [];
  const newEvents: CalendarEvent[] = [];
  const newEntries: UniversityImportEntry[] = [];
  const protectedRemovedEventIds = new Set(freshPreview.protectedRemovedEventIds ?? []);
  const eventIdsToDelete = new Set((freshPreview.removedEventIds ?? []).filter((id) => !protectedRemovedEventIds.has(id)));
  const allRemovedEventIds = new Set(freshPreview.removedEventIds ?? []);
  const entryIdsToDelete = new Set(entries.filter((entry) => entry.eventId && allRemovedEventIds.has(entry.eventId)).map((entry) => entry.id));
  const protectedEventsToDetach = events.filter((event) => protectedRemovedEventIds.has(event.id)).map((event) => detachStudyEventAsManual(event, timestamp));

  for (const candidate of freshPreview.addedCandidates ?? []) {
    const complete = requireCompleteImportCandidate(candidate);
    const locationId = ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
    const entryId = createId('university-entry');
    const event = eventFromCandidate(complete, active.id, entryId, locationId, timestamp);
    newEvents.push(event);
    newEntries.push({ ...entryFromCandidate(candidate, active.id, event.id, false), id: entryId });
  }
  const remainingCount = events.filter((event) => event.sourceImportId === active.id && !allRemovedEventIds.has(event.id)).length + newEvents.length;
  const profile = await getStudyProfile();
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_LOCATIONS, STORE_UNIVERSITY_IMPORT_ENTRIES, STORE_UNIVERSITY_IMPORTS, STORE_STUDY_PROFILE, STORE_CHANGE_JOURNAL], 'readwrite');
  for (const location of newLocations) tx.objectStore(STORE_LOCATIONS).put(location);
  for (const id of eventIdsToDelete) tx.objectStore(STORE_EVENTS).delete(id);
  for (const event of protectedEventsToDetach) tx.objectStore(STORE_EVENTS).put(event);
  for (const id of entryIdsToDelete) tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES).delete(id);
  for (const event of newEvents) tx.objectStore(STORE_EVENTS).add(event);
  for (const entry of newEntries) tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES).add(entry);
  tx.objectStore(STORE_UNIVERSITY_IMPORTS).put({ ...active, selectedGroups: [...freshPreview.selectedGroups], importedEventCount: remainingCount } satisfies UniversityScheduleImport);
  tx.objectStore(STORE_STUDY_PROFILE).put({
    id: 'university',
    selectedGroups: [...freshPreview.selectedGroups],
    ...(profile?.availableGroups ? { availableGroups: [...profile.availableGroups] } : {}),
    ...(profile?.detectedAcademicYear ? { detectedAcademicYear: profile.detectedAcademicYear } : {}),
    ...(profile?.detectedTerm ? { detectedTerm: profile.detectedTerm } : {}),
    ...(profile?.studyName ? { studyName: profile.studyName } : {}),
    activeImportId: active.id,
    sourceDataComplete: true,
    lastPlanUpdatedAt: timestamp,
    updatedAt: timestamp,
  } satisfies StudyProfile);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'RECALCULATE_STUDY_GROUPS',
    entityType: 'STUDY_GROUPS',
    entityIds: ['study-profile-university', active.id],
    description: `Przeliczono aktualny plan dla grup: ${formatStudyGroupList(freshPreview.selectedGroups)}`,
    restorePointId: safetyPoint.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export interface StudyCorrectionContext {
  event: CalendarEvent;
  entry: UniversityImportEntry;
  peerCount: number;
  affectedCounts: Partial<Record<StudyCorrectionField, number>>;
  missingFields: StudyCorrectionField[];
}

function missingCorrectionFields(entry: UniversityImportEntry): StudyCorrectionField[] {
  const fields: StudyCorrectionField[] = [];
  if (!entry.address && !entry.locationLabel) fields.push('address');
  if (!entry.room) fields.push('room');
  if (!entry.clinic && entry.warnings.some((warning) => /klinik/i.test(warning))) fields.push('clinic');
  return fields;
}

export async function getStudyCorrectionContext(eventId: string): Promise<StudyCorrectionContext | undefined> {
  const event = await getEvent(eventId);
  if (!event || event.source !== 'UNIVERSITY_XLSX' || !event.sourceEntryId) return undefined;
  const db = await openDatabase();
  const tx = db.transaction(STORE_UNIVERSITY_IMPORT_ENTRIES, 'readonly');
  const store = tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES);
  const entry = await requestToPromise(store.get(event.sourceEntryId) as IDBRequest<UniversityImportEntry | undefined>);
  if (!entry) {
    await transactionDone(tx);
    return undefined;
  }
  const identified = identifyEntry(entry);
  const peers = identified.seriesKey
    ? await requestToPromise(store.index('seriesKey').getAll(identified.seriesKey) as IDBRequest<UniversityImportEntry[]>)
    : [identified];
  await transactionDone(tx);
  const linkedPeers = peers.filter((peer) => Boolean(peer.eventId) && !peer.sourceOnly);
  const affectedCounts: Partial<Record<StudyCorrectionField, number>> = {};
  for (const field of ['address', 'room', 'clinic', 'locationLabel'] as StudyCorrectionField[]) {
    affectedCounts[field] = linkedPeers.filter((peer) => !peer[field]).length;
  }
  return {
    event,
    entry: identified,
    peerCount: linkedPeers.length,
    affectedCounts,
    missingFields: missingCorrectionFields(identified),
  };
}

export interface ApplyStudyCorrectionInput {
  eventId: string;
  field: StudyCorrectionField;
  value: string;
  scope: 'SINGLE' | 'SERIES';
}

export async function applyStudyCorrection(input: ApplyStudyCorrectionInput): Promise<number> {
  const context = await getStudyCorrectionContext(input.eventId);
  if (!context) throw new Error('Nie znaleziono danych źródłowych zajęcia.');
  const safetyPoint = await createRestorePoint('Przed zastosowaniem poprawki danych zajęć', 'BEFORE_STUDY_CORRECTION', true);
  const value = input.value.trim();
  if (!value) throw new Error('Uzupełnij wartość przed zapisem.');
  const allEntries = await listUniversityImportEntries(context.entry.importId);
  const targets = input.scope === 'SERIES'
    ? allEntries.filter((entry) => !entry.sourceOnly && entry.eventId && entry.seriesKey === context.entry.seriesKey && !entry[input.field])
    : [context.entry];
  const events = await listEvents();
  const eventById = new Map(events.map((event) => [event.id, event]));
  const locations = await listLocations();
  const locationsByKey = locationMap(locations);
  const newLocations: Location[] = [];
  const timestamp = nowIso();
  const updatedEntries: UniversityImportEntry[] = [];
  const updatedEvents: CalendarEvent[] = [];

  for (const target of targets) {
    if (!target.eventId) continue;
    const event = eventById.get(target.eventId);
    if (!event) continue;
    const updatedEntry = identifyEntry({ ...target, [input.field]: value });
    updatedEntry.warnings = updatedEntry.warnings.filter((warning) => {
      if (input.field === 'address' || input.field === 'locationLabel') return !/adres|lokalizac/i.test(warning);
      if (input.field === 'room') return !/sal/i.test(warning);
      if (input.field === 'clinic') return !/klinik/i.test(warning);
      return true;
    });
    const candidate = candidateFromEntry(updatedEntry);
    let locationId = event.locationId;
    if (input.field === 'address' || input.field === 'locationLabel') {
      locationId = ensureCandidateLocation(candidate, locationsByKey, newLocations, timestamp);
    }
    const description = importedEventDescription(candidate);
    const fields = new Set<UserModifiedEventField>(event.userModifiedFields ?? []);
    if (input.field === 'address' || input.field === 'locationLabel') fields.add('locationId');
    else fields.add('description');
    const updatedEvent: CalendarEvent = {
      ...event,
      ...(locationId ? { locationId } : {}),
      ...(description ? { description } : {}),
      studyIssueCodes: issueCodesForCandidate(candidate),
      userModified: true,
      userModifiedFields: [...fields],
      updatedAt: timestamp,
    };
    updatedEntries.push(updatedEntry);
    updatedEvents.push(updatedEvent);
  }

  const existingRules = await listStudyCorrectionRules();
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_LOCATIONS, STORE_UNIVERSITY_IMPORT_ENTRIES, STORE_STUDY_CORRECTION_RULES, STORE_CHANGE_JOURNAL], 'readwrite');
  for (const location of newLocations) tx.objectStore(STORE_LOCATIONS).put(location);
  for (const entry of updatedEntries) tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES).put(entry);
  for (const event of updatedEvents) tx.objectStore(STORE_EVENTS).put(event);
  if (input.scope === 'SERIES' && context.entry.seriesKey) {
    const pending = { seriesKey: context.entry.seriesKey, field: input.field, value } satisfies PendingStudyCorrectionRule;
    const existing = existingRules.find((rule) => rule.seriesKey === pending.seriesKey && rule.field === pending.field);
    tx.objectStore(STORE_STUDY_CORRECTION_RULES).put(buildCorrectionRule(pending, existing));
  }
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'APPLY_STUDY_CORRECTION',
    entityType: 'STUDY_CORRECTION',
    entityIds: updatedEvents.map((event) => event.id),
    description: input.scope === 'SERIES' ? `Uzupełniono ${input.field} w ${updatedEvents.length} powiązanych zajęciach` : `Uzupełniono ${input.field} w zajęciu`,
    restorePointId: safetyPoint.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updatedEvents.length;
}


async function captureSnapshot(storeNames: string[]): Promise<DatabaseSnapshot> {
  const db = await openDatabase();
  const available = storeNames.filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(available, 'readonly');
  const stores: Record<string, unknown[]> = {};
  await Promise.all(available.map(async (name) => {
    stores[name] = await requestToPromise(tx.objectStore(name).getAll() as IDBRequest<unknown[]>);
  }));
  await transactionDone(tx);
  return {
    format: 'inteligentny-kalendarz-snapshot',
    snapshotVersion: 1,
    appVersion: APP_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    capturedAt: nowIso(),
    stores,
  };
}

async function replaceSnapshot(snapshot: DatabaseSnapshot, includeJournal = false): Promise<void> {
  if (snapshot.format !== 'inteligentny-kalendarz-snapshot' || snapshot.snapshotVersion !== 1) {
    throw new Error('Nieprawidłowy format punktu przywracania.');
  }
  const db = await openDatabase();
  const requested = includeJournal ? backupSnapshotStoreNames() : restoreSnapshotStoreNames();
  const names = requested.filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const store = tx.objectStore(name);
    store.clear();
    for (const item of snapshot.stores[name] ?? []) store.put(item);
  }
  await transactionDone(tx);
}

async function verifySnapshotReplacement(snapshot: DatabaseSnapshot, includeJournal = false): Promise<void> {
  const storeNames = includeJournal ? backupSnapshotStoreNames() : restoreSnapshotStoreNames();
  const verification = await captureSnapshot(storeNames);
  const expectedStores = Object.fromEntries(storeNames.map((name) => [name, snapshot.stores[name] ?? []]));
  const actualStores = Object.fromEntries(storeNames.map((name) => [name, verification.stores[name] ?? []]));
  if (await sha256Text(JSON.stringify(expectedStores)) !== await sha256Text(JSON.stringify(actualStores))) {
    throw new Error('Nie udało się zweryfikować przywróconych danych.');
  }
}

async function replaceSnapshotVerified(snapshot: DatabaseSnapshot, includeJournal = false): Promise<void> {
  const rollbackSnapshot = await captureSnapshot(backupSnapshotStoreNames());
  let replacementCommitted = false;
  try {
    await replaceSnapshot(snapshot, includeJournal);
    replacementCommitted = true;
    await verifySnapshotReplacement(snapshot, includeJournal);
  } catch (cause) {
    if (replacementCommitted) {
      try {
        await replaceSnapshot(rollbackSnapshot, true);
        await verifySnapshotReplacement(rollbackSnapshot, true);
      } catch {
        throw new Error('Przywracanie danych nie powiodło się, a automatyczny rollback także nie został zweryfikowany. Nie wykonuj dalszych zmian przed ręcznym sprawdzeniem backupu.');
      }
    }
    throw cause;
  }
}

async function pruneChangeJournal(): Promise<void> {
  const db = await openDatabase();
  const txRead = db.transaction(STORE_CHANGE_JOURNAL, 'readonly');
  const entries = await requestToPromise(txRead.objectStore(STORE_CHANGE_JOURNAL).getAll() as IDBRequest<ChangeJournalEntry[]>);
  await transactionDone(txRead);
  if (entries.length <= CHANGE_JOURNAL_LIMIT) return;
  const toDelete = entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(CHANGE_JOURNAL_LIMIT);
  const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readwrite');
  for (const entry of toDelete) tx.objectStore(STORE_CHANGE_JOURNAL).delete(entry.id);
  await transactionDone(tx);
}

async function pruneAutomaticRestorePoints(): Promise<void> {
  const db = await openDatabase();
  const txRead = db.transaction(STORE_RESTORE_POINTS, 'readonly');
  const points = await requestToPromise(txRead.objectStore(STORE_RESTORE_POINTS).getAll() as IDBRequest<RestorePoint[]>);
  await transactionDone(txRead);
  const automatic = points.filter((point) => point.automatic && !point.pinned).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (automatic.length <= AUTOMATIC_RESTORE_POINT_LIMIT) return;
  const tx = db.transaction(STORE_RESTORE_POINTS, 'readwrite');
  for (const point of automatic.slice(AUTOMATIC_RESTORE_POINT_LIMIT)) tx.objectStore(STORE_RESTORE_POINTS).delete(point.id);
  await transactionDone(tx);
}

export async function listChangeJournal(): Promise<ChangeJournalEntry[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_CHANGE_JOURNAL).getAll() as IDBRequest<ChangeJournalEntry[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getLatestReversibleChange(): Promise<ChangeJournalEntry | undefined> {
  return (await listChangeJournal()).find((entry) => entry.reversible && !entry.undoneAt);
}

function hasDependentNewerChange(target: ChangeJournalEntry, entries: ChangeJournalEntry[]): boolean {
  const targetIds = new Set(target.entityIds);
  return entries.some((entry) => {
    if (entry.id === target.id || entry.undoneAt || entry.timestamp <= target.timestamp) return false;
    if (target.restorePointId) return entry.reversible;
    return entry.entityIds.some((id) => targetIds.has(id));
  });
}

async function markJournalUndone(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readwrite');
  const store = tx.objectStore(STORE_CHANGE_JOURNAL);
  const current = await requestToPromise(store.get(id) as IDBRequest<ChangeJournalEntry | undefined>);
  if (current) store.put({ ...current, undoneAt: nowIso() } satisfies ChangeJournalEntry);
  await transactionDone(tx);
}

export async function undoChange(id: string): Promise<void> {
  const entries = await listChangeJournal();
  const entry = entries.find((item) => item.id === id);
  if (!entry || !entry.reversible || entry.undoneAt) throw new Error('Tej zmiany nie można już cofnąć.');
  if (hasDependentNewerChange(entry, entries)) {
    throw new Error('Nowsze zmiany zależą od tego stanu. Użyj punktu przywracania, aby bezpiecznie cofnąć większy zakres.');
  }
  if (entry.restorePointId) {
    await restoreRestorePointInternal(entry.restorePointId, false);
    await markJournalUndone(id);
    return;
  }

  const db = await openDatabase();
  if (entry.operationType === 'CREATE_EVENT') {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    for (const entityId of entry.entityIds) tx.objectStore(STORE_EVENTS).delete(entityId);
    await transactionDone(tx);
  } else if (entry.operationType === 'UPDATE_EVENT') {
    const previous = entry.beforeState as CalendarEvent | undefined;
    if (!previous) throw new Error('Brak wcześniejszego stanu wydarzenia.');
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    tx.objectStore(STORE_EVENTS).put(previous);
    await transactionDone(tx);
  } else if (entry.operationType === 'CREATE_MANUAL_SERIES') {
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    for (const entityId of entry.entityIds) tx.objectStore(STORE_EVENTS).delete(entityId);
    await transactionDone(tx);
  } else if (entry.operationType === 'UPDATE_MANUAL_SERIES') {
    const previous = entry.beforeState as CalendarEvent[] | undefined;
    if (!previous) throw new Error('Brak wcześniejszego stanu serii.');
    const tx = db.transaction(STORE_EVENTS, 'readwrite');
    for (const event of previous) tx.objectStore(STORE_EVENTS).put(event);
    await transactionDone(tx);
  } else if (entry.operationType === 'DELETE_EVENT' || entry.operationType === 'DELETE_MANUAL_SERIES') {
    const trashItemId = typeof entry.metadata?.trashItemId === 'string' ? entry.metadata.trashItemId : undefined;
    if (!trashItemId) throw new Error('Brak danych Kosza potrzebnych do cofnięcia.');
    await restoreTrashItemInternal(trashItemId, false);
  } else if (entry.operationType === 'RESTORE_TRASH') {
    const item = entry.metadata?.trashItem as TrashItem | undefined;
    if (!item) throw new Error('Brak danych potrzebnych do ponownego przeniesienia do Kosza.');
    const studyEntryBefore = entry.metadata?.studyEntryBefore as UniversityImportEntry | undefined;
    const workEntryBefore = entry.metadata?.workEntryBefore as WorkScheduleEntry | undefined;
    const stores = [STORE_TRASH_ITEMS];
    if (item.entityType === 'CALENDAR_EVENT' || item.entityType === 'MANUAL_SERIES') stores.push(STORE_EVENTS);
    if (item.entityType === 'DAY_CONSTRAINT') stores.push(STORE_DAY_CONSTRAINTS);
    if (studyEntryBefore) stores.push(STORE_UNIVERSITY_IMPORT_ENTRIES);
    if (workEntryBefore) stores.push(STORE_WORK_SCHEDULE_ENTRIES);
    const tx = db.transaction([...new Set(stores)], 'readwrite');
    if (item.entityType === 'CALENDAR_EVENT' || item.entityType === 'MANUAL_SERIES') {
      for (const entityId of item.entityIds) tx.objectStore(STORE_EVENTS).delete(entityId);
    } else if (item.entityType === 'DAY_CONSTRAINT') {
      for (const entityId of item.entityIds) tx.objectStore(STORE_DAY_CONSTRAINTS).delete(entityId);
    }
    if (studyEntryBefore) tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES).put(studyEntryBefore);
    if (workEntryBefore) tx.objectStore(STORE_WORK_SCHEDULE_ENTRIES).put(workEntryBefore);
    tx.objectStore(STORE_TRASH_ITEMS).put(item);
    await transactionDone(tx);
  } else if (entry.operationType === 'ADD_SHOPPING_ITEM') {
    const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readwrite');
    for (const entityId of entry.entityIds) tx.objectStore(STORE_SHOPPING_ITEMS).delete(entityId);
    await transactionDone(tx);
  } else if (['EDIT_SHOPPING_ITEM', 'PURCHASE_SHOPPING_ITEM', 'UNPURCHASE_SHOPPING_ITEM'].includes(entry.operationType)) {
    const before = entry.beforeState as ShoppingItem | undefined;
    if (!before) throw new Error('Brak wcześniejszego stanu produktu.');
    const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readwrite');
    tx.objectStore(STORE_SHOPPING_ITEMS).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'DELETE_SHOPPING_ITEM') {
    const before = entry.beforeState as ShoppingItem | undefined;
    if (!before) throw new Error('Brak danych usuniętego produktu.');
    const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readwrite');
    tx.objectStore(STORE_SHOPPING_ITEMS).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'DELETE_PURCHASED_SHOPPING_ITEMS') {
    const before = entry.beforeState as ShoppingItem[] | undefined;
    if (!before) throw new Error('Brak danych usuniętych produktów.');
    const tx = db.transaction(STORE_SHOPPING_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_SHOPPING_ITEMS);
    for (const item of before) store.put(item);
    await transactionDone(tx);
  } else if (entry.operationType === 'ADD_CYCLE_JOURNAL_ENTRY') {
    const tx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readwrite');
    for (const entityId of entry.entityIds) tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).delete(entityId);
    await transactionDone(tx);
  } else if (entry.operationType === 'EDIT_CYCLE_JOURNAL_ENTRY') {
    const before = entry.beforeState as CycleJournalEntry | undefined;
    if (!before) throw new Error('Brak wcześniejszego stanu wpisu Dziennika Cyklu.');
    const tx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readwrite');
    tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'DELETE_CYCLE_JOURNAL_ENTRY') {
    const before = entry.beforeState as CycleJournalEntry | undefined;
    if (!before) throw new Error('Brak danych usuniętego wpisu Dziennika Cyklu.');
    const tx = db.transaction(STORE_CYCLE_JOURNAL_ENTRIES, 'readwrite');
    tx.objectStore(STORE_CYCLE_JOURNAL_ENTRIES).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'ADD_CYCLE_PERIOD') {
    const before = entry.beforeState as { nextPeriod?: CyclePeriod | null } | undefined;
    const tx = db.transaction(STORE_CYCLE_PERIODS, 'readwrite');
    const store = tx.objectStore(STORE_CYCLE_PERIODS);
    for (const entityId of entry.entityIds.slice(0, 1)) store.delete(entityId);
    if (before?.nextPeriod) store.put(before.nextPeriod);
    await transactionDone(tx);
  } else if (entry.operationType === 'EDIT_CYCLE_PERIOD') {
    const before = entry.beforeState as CyclePeriod[] | undefined;
    if (!before) throw new Error('Brak wcześniejszego stanu historii cyklu.');
    const tx = db.transaction(STORE_CYCLE_PERIODS, 'readwrite');
    const store = tx.objectStore(STORE_CYCLE_PERIODS);
    for (const period of before) store.put(period);
    await transactionDone(tx);
  } else if (entry.operationType === 'SET_CYCLE_GAP_DECISION') {
    const before = entry.beforeState as CyclePeriod | undefined;
    if (!before) throw new Error('Brak wcześniejszej decyzji dla odstępu cyklu.');
    const tx = db.transaction(STORE_CYCLE_PERIODS, 'readwrite');
    tx.objectStore(STORE_CYCLE_PERIODS).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'DELETE_CYCLE_PERIOD') {
    const before = entry.beforeState as { deleted?: CyclePeriod; nextPeriod?: CyclePeriod | null } | undefined;
    if (!before?.deleted) throw new Error('Brak danych usuniętego wpisu cyklu.');
    const tx = db.transaction(STORE_CYCLE_PERIODS, 'readwrite');
    const store = tx.objectStore(STORE_CYCLE_PERIODS);
    store.put(before.deleted);
    if (before.nextPeriod) store.put(before.nextPeriod);
    await transactionDone(tx);
  } else if (entry.operationType === 'SET_DAY_CONSTRAINT') {
    const before = entry.beforeState as DayConstraint | null | undefined;
    const after = entry.afterState as DayConstraint | null | undefined;
    const tx = db.transaction(STORE_DAY_CONSTRAINTS, 'readwrite');
    const store = tx.objectStore(STORE_DAY_CONSTRAINTS);
    if (before) store.put(before);
    else if (after) store.delete(after.id);
    await transactionDone(tx);
  } else if (entry.operationType === 'UPDATE_STUDY_GROUPS') {
    const before = entry.beforeState as StudyProfile | undefined;
    if (!before) throw new Error('Brak wcześniejszego profilu grup.');
    const tx = db.transaction(STORE_STUDY_PROFILE, 'readwrite');
    tx.objectStore(STORE_STUDY_PROFILE).put(before);
    await transactionDone(tx);
  } else if (entry.operationType === 'SAVE_WORK_PROFILE') {
    const before = entry.beforeState as WorkProfile | null | undefined;
    const after = entry.afterState as WorkProfile | undefined;
    const tx = db.transaction(STORE_WORK_PROFILES, 'readwrite');
    if (before) tx.objectStore(STORE_WORK_PROFILES).put(before);
    else if (after) tx.objectStore(STORE_WORK_PROFILES).delete(after.id);
    await transactionDone(tx);
  } else if (entry.operationType === 'SAVE_DAY_PLANNING_PROFILE') {
    const before = entry.beforeState as DayPlanningProfile | null | undefined;
    const after = entry.afterState as DayPlanningProfile | undefined;
    const tx = db.transaction(STORE_DAY_PLANNING_PROFILES, 'readwrite');
    if (before) tx.objectStore(STORE_DAY_PLANNING_PROFILES).put(before);
    else if (after) tx.objectStore(STORE_DAY_PLANNING_PROFILES).delete(after.id);
    await transactionDone(tx);
  } else if (entry.operationType === 'SAVE_ROUTINE_RULE' || entry.operationType === 'DELETE_ROUTINE_RULE') {
    const before = entry.beforeState as DailyRoutineRule | null | undefined;
    const after = entry.afterState as DailyRoutineRule | undefined;
    const tx = db.transaction(STORE_DAILY_ROUTINE_RULES, 'readwrite');
    if (before) tx.objectStore(STORE_DAILY_ROUTINE_RULES).put(before);
    else if (after) tx.objectStore(STORE_DAILY_ROUTINE_RULES).delete(after.id);
    await transactionDone(tx);
  } else if (entry.operationType === 'SET_DAY_ATTRIBUTE') {
    const before = entry.beforeState as DayAttribute | null | undefined;
    const after = entry.afterState as DayAttribute | undefined;
    const tx = db.transaction(STORE_DAY_ATTRIBUTES, 'readwrite');
    if (before) tx.objectStore(STORE_DAY_ATTRIBUTES).put(before);
    else if (after) tx.objectStore(STORE_DAY_ATTRIBUTES).delete(after.id);
    await transactionDone(tx);
  } else if (entry.operationType === 'ACKNOWLEDGE_CONSISTENCY_ISSUE') {
    const after = entry.afterState as ConsistencyAcknowledgement | undefined;
    if (!after) throw new Error('Brak danych acknowledgement.');
    const tx = db.transaction(STORE_CONSISTENCY_ACKNOWLEDGEMENTS, 'readwrite');
    tx.objectStore(STORE_CONSISTENCY_ACKNOWLEDGEMENTS).delete(after.id);
    await transactionDone(tx);
  } else if (['GENERATE_AVAILABILITY_PLAN', 'ACCEPT_AVAILABILITY_BLOCK', 'EDIT_AVAILABILITY_BLOCK', 'REJECT_AVAILABILITY_BLOCK', 'ACCEPT_AVAILABILITY_PLAN', 'MARK_AVAILABILITY_SENT', 'SET_AVAILABILITY_DAY_RULE', 'ADD_MANUAL_AVAILABILITY_BLOCK', 'REMOVE_AVAILABILITY_BLOCK', 'MERGE_AVAILABILITY_BLOCKS'].includes(entry.operationType)) {
    const before = entry.beforeState as AvailabilityPlan | null | undefined;
    const after = entry.afterState as AvailabilityPlan | undefined;
    const tx = db.transaction(STORE_AVAILABILITY_PLANS, 'readwrite');
    const store = tx.objectStore(STORE_AVAILABILITY_PLANS);
    if (before) store.put(before);
    else if (after) store.delete(after.id);
    await transactionDone(tx);
  } else {
    throw new Error('Ta operacja wymaga punktu przywracania.');
  }
  await markJournalUndone(id);
}

interface StudyTrashRestoreResolution {
  event: CalendarEvent;
  entryBefore?: UniversityImportEntry;
  entryAfter?: UniversityImportEntry;
}

function preservedFieldsForTrashRestore(event: CalendarEvent): UserModifiedEventField[] {
  if (!event.userModified) return [];
  return event.userModifiedFields?.length
    ? [...event.userModifiedFields]
    : ['title', 'startDateTime', 'endDateTime', 'locationId', 'description', 'category'];
}

async function resolveStudyTrashRestore(event: CalendarEvent): Promise<StudyTrashRestoreResolution> {
  if (event.source !== 'UNIVERSITY_XLSX' || !event.sourceEntryId) return { event };
  const active = await getActiveUniversityImport();
  if (!active) return { event: detachStudyEventAsManual(event, nowIso()) };

  const [activeEntries, allEntries, locations, liveEvents] = await Promise.all([
    listUniversityImportEntries(active.id),
    listUniversityImportEntries(),
    listLocations(),
    listEvents(),
  ]);
  const linkedActiveEntries = activeEntries.filter((entry) => !entry.sourceOnly);
  const historicalEntry = allEntries.find((entry) => entry.id === event.sourceEntryId);
  const eventIds = new Set(liveEvents.map((item) => item.id));

  const uniqueMatch = (matches: UniversityImportEntry[]): UniversityImportEntry | undefined => matches.length === 1 ? matches[0] : undefined;
  let match = uniqueMatch(linkedActiveEntries.filter((entry) => entry.id === event.sourceEntryId));
  if (!match && historicalEntry?.sourceKey) match = uniqueMatch(linkedActiveEntries.filter((entry) => entry.sourceKey === historicalEntry.sourceKey));
  if (!match && event.occurrenceKey) match = uniqueMatch(linkedActiveEntries.filter((entry) => entry.occurrenceKey === event.occurrenceKey));
  if (!match && historicalEntry?.occurrenceKey) match = uniqueMatch(linkedActiveEntries.filter((entry) => entry.occurrenceKey === historicalEntry.occurrenceKey));

  // Jeżeli aktywny wpis ma już inne żywe wydarzenie, nie wolno przejąć jego powiązania.
  if (!match || (match.eventId && match.eventId !== event.id && eventIds.has(match.eventId))) {
    return { event: detachStudyEventAsManual(event, nowIso()) };
  }

  const timestamp = nowIso();
  const candidate = identifyCandidate(candidateFromEntry(match));
  let restored: CalendarEvent;
  if (reviewCandidate(candidate).canImport && candidate.date && candidate.startTime && candidate.endTime) {
    const identity = candidate.address ?? candidate.locationLabel;
    const existingLocationId = identity ? locationMap(locations).get(normalizeLocationKey(identity))?.id : undefined;
    restored = applyCandidateToExistingEvent(
      event,
      requireCompleteImportCandidate(candidate),
      active.id,
      match.id,
      existingLocationId,
      preservedFieldsForTrashRestore(event),
      timestamp,
    );
  } else {
    restored = retainedAmbiguousEvent(event, candidate, active.id, match.id, timestamp);
  }

  const entryAfter: UniversityImportEntry = { ...match, eventId: restored.id, userDeleted: false };
  return { event: restored, entryBefore: { ...match }, entryAfter };
}

export async function listTrashItems(): Promise<TrashItem[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_TRASH_ITEMS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_TRASH_ITEMS).getAll() as IDBRequest<TrashItem[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

async function restoreTrashItemInternal(id: string, writeJournal: boolean): Promise<void> {
  const db = await openDatabase();
  const readTx = db.transaction(STORE_TRASH_ITEMS, 'readonly');
  const item = await requestToPromise(readTx.objectStore(STORE_TRASH_ITEMS).get(id) as IDBRequest<TrashItem | undefined>);
  await transactionDone(readTx);
  if (!item) throw new Error('Nie znaleziono elementu w Koszu.');

  const payload = item.payload as CalendarEvent | CalendarEvent[] | DayConstraint;
  let restoredEvent: CalendarEvent | undefined;
  let studyEntryBefore: UniversityImportEntry | undefined;
  let studyEntryAfter: UniversityImportEntry | undefined;
  let workEntryBefore: WorkScheduleEntry | undefined;
  let workEntryAfter: WorkScheduleEntry | undefined;

  if (item.entityType === 'CALENDAR_EVENT') {
    const originalEvent = payload as CalendarEvent;
    const studyResolution = await resolveStudyTrashRestore(originalEvent);
    restoredEvent = studyResolution.event;
    studyEntryBefore = studyResolution.entryBefore;
    studyEntryAfter = studyResolution.entryAfter;

    if (restoredEvent.source === 'WORK_PDF' && restoredEvent.sourceWorkEntryId) {
      const workEntry = (await listWorkScheduleEntries()).find((entry) => entry.id === restoredEvent!.sourceWorkEntryId);
      if (workEntry) {
        workEntryBefore = { ...workEntry };
        workEntryAfter = { ...workEntry, eventId: restoredEvent.id, userDeleted: false };
      }
    }
  }

  const storeNames = [STORE_EVENTS, STORE_TRASH_ITEMS];
  if (studyEntryAfter) storeNames.push(STORE_UNIVERSITY_IMPORT_ENTRIES);
  if (workEntryAfter) storeNames.push(STORE_WORK_SCHEDULE_ENTRIES);
  if (item.entityType === 'DAY_CONSTRAINT') storeNames.push(STORE_DAY_CONSTRAINTS);
  if (writeJournal) storeNames.push(STORE_CHANGE_JOURNAL);
  const tx = db.transaction([...new Set(storeNames)], 'readwrite');
  const eventStore = tx.objectStore(STORE_EVENTS);

  if (item.entityType === 'CALENDAR_EVENT') {
    if (!restoredEvent) throw new Error('Nie udało się odtworzyć wydarzenia z Kosza.');
    eventStore.put(restoredEvent);
    if (studyEntryAfter) tx.objectStore(STORE_UNIVERSITY_IMPORT_ENTRIES).put(studyEntryAfter);
    if (workEntryAfter) tx.objectStore(STORE_WORK_SCHEDULE_ENTRIES).put(workEntryAfter);
  } else if (item.entityType === 'MANUAL_SERIES') {
    for (const event of payload as CalendarEvent[]) eventStore.put(event);
  } else if (item.entityType === 'DAY_CONSTRAINT') {
    tx.objectStore(STORE_DAY_CONSTRAINTS).put(payload as DayConstraint);
  }

  tx.objectStore(STORE_TRASH_ITEMS).delete(item.id);
  if (writeJournal) {
    putJournalEntry(tx, buildJournalEntry({
      operationType: 'RESTORE_TRASH',
      entityType: item.entityType === 'DAY_CONSTRAINT' ? 'DAY_CONSTRAINT' : item.entityType,
      entityIds: item.entityIds,
      description: `Przywrócono z Kosza: ${item.displayName}`,
      reversible: true,
      metadata: {
        trashItem: item,
        ...(restoredEvent ? { restoredEvent } : {}),
        ...(studyEntryBefore ? { studyEntryBefore } : {}),
        ...(workEntryBefore ? { workEntryBefore } : {}),
      },
    }));
  }
  await transactionDone(tx);
  if (writeJournal) await pruneChangeJournal();
}

export async function restoreTrashItem(id: string): Promise<void> {
  await restoreTrashItemInternal(id, true);
}

export async function permanentlyDeleteTrashItem(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_TRASH_ITEMS, 'readwrite');
  tx.objectStore(STORE_TRASH_ITEMS).delete(id);
  await transactionDone(tx);
}

export async function emptyTrash(): Promise<void> {
  const items = await listTrashItems();
  if (!items.length) return;
  const safety = await createRestorePoint('Przed opróżnieniem Kosza', 'BEFORE_EMPTY_TRASH', true);
  const db = await openDatabase();
  const tx = db.transaction([STORE_TRASH_ITEMS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_TRASH_ITEMS).clear();
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'EMPTY_TRASH',
    entityType: 'APPLICATION_DATA',
    entityIds: ['trash'],
    description: `Opróżniono Kosz (${items.length} elementów)`,
    restorePointId: safety.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function listRestorePoints(): Promise<RestorePoint[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_RESTORE_POINTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_RESTORE_POINTS).getAll() as IDBRequest<RestorePoint[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createRestorePoint(label: string, reason: RestorePointReason = 'MANUAL', automatic = false, pinned = false): Promise<RestorePoint> {
  const snapshot = await captureSnapshot(restoreSnapshotStoreNames());
  const serialized = JSON.stringify(snapshot);
  const point: RestorePoint = {
    id: createId('restore'),
    createdAt: nowIso(),
    label: label.trim() || (automatic ? 'Automatyczny punkt przywracania' : 'Ręczny punkt przywracania'),
    reason,
    schemaVersion: DATABASE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    snapshot,
    checksum: await sha256Text(serialized),
    sizeBytes: new TextEncoder().encode(serialized).byteLength,
    automatic,
    ...(pinned ? { pinned: true } : {}),
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_RESTORE_POINTS, 'readwrite');
  tx.objectStore(STORE_RESTORE_POINTS).put(point);
  await transactionDone(tx);
  if (automatic) await pruneAutomaticRestorePoints();
  return point;
}

async function validateRestorePoint(point: RestorePoint): Promise<void> {
  if (point.checksum) {
    const actual = await sha256Text(JSON.stringify(point.snapshot));
    if (actual !== point.checksum) throw new Error('Punkt przywracania jest uszkodzony.');
  } else if (!point.integrityMarker) {
    throw new Error('Punkt przywracania nie ma danych integralności.');
  }
}

async function restoreRestorePointInternal(id: string, createSafetyPoint: boolean): Promise<void> {
  const points = await listRestorePoints();
  const point = points.find((item) => item.id === id);
  if (!point) throw new Error('Nie znaleziono punktu przywracania.');
  await validateRestorePoint(point);
  if (point.snapshot.databaseSchemaVersion > DATABASE_SCHEMA_VERSION) throw new Error('Ten punkt pochodzi z nowszej, nieobsługiwanej wersji bazy.');
  if (createSafetyPoint) await createRestorePoint(`Przed przywróceniem: ${point.label}`, 'BEFORE_RESTORE_POINT', true);
  await replaceSnapshotVerified(point.snapshot, false);
}

export async function restoreRestorePoint(id: string): Promise<void> {
  const before = await createRestorePoint('Przed ręcznym przywróceniem punktu', 'BEFORE_RESTORE_POINT', true);
  const notificationsSuspended = await suspendNotificationsForDataReplace();
  try {
    await restoreRestorePointInternal(id, false);
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readwrite');
      putJournalEntry(tx, buildJournalEntry({
        operationType: 'RESTORE_POINT',
        entityType: 'APPLICATION_DATA',
        entityIds: ['application-data'],
        description: 'Przywrócono punkt przywracania',
        restorePointId: before.id,
      }));
      await transactionDone(tx);
      await pruneChangeJournal();
    } catch {
      // Historia jest pomocnicza; zweryfikowanego przywrócenia nie cofamy z powodu wpisu dziennika.
    }
  } finally {
    await resumeNotificationsAfterDataReplace(notificationsSuspended);
  }
}

export async function deleteRestorePoint(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_RESTORE_POINTS, 'readwrite');
  tx.objectStore(STORE_RESTORE_POINTS).delete(id);
  await transactionDone(tx);
}

function backupSummary(document: BackupDocument): BackupSummary {
  const stores = document.data.stores;
  return {
    createdAt: document.createdAt,
    appVersion: document.appVersion,
    databaseSchemaVersion: document.databaseSchemaVersion,
    events: stores[STORE_EVENTS]?.length ?? 0,
    locations: stores[STORE_LOCATIONS]?.length ?? 0,
    universityImports: stores[STORE_UNIVERSITY_IMPORTS]?.length ?? 0,
    trashItems: stores[STORE_TRASH_ITEMS]?.length ?? 0,
    dayConstraints: stores[STORE_DAY_CONSTRAINTS]?.length ?? 0,
    studyPreviewProfiles: stores[STORE_STUDY_PREVIEW_PROFILES]?.length ?? 0,
    workProfiles: stores[STORE_WORK_PROFILES]?.length ?? 0,
    workScheduleImports: stores[STORE_WORK_SCHEDULE_IMPORTS]?.length ?? 0,
    workScheduleEntries: stores[STORE_WORK_SCHEDULE_ENTRIES]?.length ?? 0,
    workCoworkerShifts: stores[STORE_WORK_COWORKER_SHIFTS]?.length ?? 0,
    dayPlanningProfiles: stores[STORE_DAY_PLANNING_PROFILES]?.length ?? 0,
    dailyRoutineRules: stores[STORE_DAILY_ROUTINE_RULES]?.length ?? 0,
    dayAttributes: stores[STORE_DAY_ATTRIBUTES]?.length ?? 0,
    consistencyAcknowledgements: stores[STORE_CONSISTENCY_ACKNOWLEDGEMENTS]?.length ?? 0,
    availabilityPlans: stores[STORE_AVAILABILITY_PLANS]?.length ?? 0,
    shoppingItems: stores[STORE_SHOPPING_ITEMS]?.length ?? 0,
    expenseCategories: stores[STORE_EXPENSE_CATEGORIES]?.length ?? 0,
    receipts: stores[STORE_RECEIPTS]?.length ?? 0,
    cyclePeriods: stores[STORE_CYCLE_PERIODS]?.length ?? 0,
    cycleJournalEntries: stores[STORE_CYCLE_JOURNAL_ENTRIES]?.length ?? 0,
  };
}

export async function createCanonicalDataTransferDocument(): Promise<BackupDocument> {
  const data = await captureSnapshot(backupSnapshotStoreNames());
  const unsigned = {
    format: 'inteligentny-kalendarz-backup' as const,
    backupVersion: 1 as const,
    appVersion: APP_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    createdAt: nowIso(),
    data,
  };
  const checksum = await sha256Text(JSON.stringify(unsigned));
  return { ...unsigned, checksum };
}

export async function createBackupFile(): Promise<{ fileName: string; text: string; summary: BackupSummary }> {
  const document = await createCanonicalDataTransferDocument();
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const fileName = `inteligentny-kalendarz-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
  await recordBackupExportNow();
  return { fileName, text: JSON.stringify(document, null, 2), summary: backupSummary(document) };
}


export async function createDataTransferFile(): Promise<{ fileName: string; text: string; summary: BackupSummary }> {
  const backup = await createBackupFile();
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const fileName = `inteligentny-kalendarz-dane-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
  return { ...backup, fileName };
}

export async function inspectDataTransferText(text: string): Promise<BackupInspection> {
  let header: Partial<BackupDocument> | null = null;
  try {
    header = JSON.parse(text) as Partial<BackupDocument>;
  } catch {
    throw new Error('Nie można odczytać pliku. Plik może być uszkodzony.');
  }
  if (header?.format !== 'inteligentny-kalendarz-backup' || header.backupVersion !== 1) {
    throw new Error('To nie jest plik danych Inteligentnego Kalendarza.');
  }
  if (typeof header.databaseSchemaVersion === 'number' && header.databaseSchemaVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error('Ten plik został utworzony w nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.');
  }
  try {
    return await inspectBackupText(text);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '';
    if (message.includes('uszkodzony') || message.includes('zmieniony')) {
      throw new Error('Plik jest uszkodzony albo został zmieniony.');
    }
    throw cause;
  }
}

function formatTransferRestorePointLabel(date = new Date()): string {
  const label = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(date);
  return `Przed importem danych - ${label}`;
}

export async function importDataTransfer(document: BackupDocument): Promise<{ restorePoint: RestorePoint; summary: BackupSummary }> {
  const inspected = await inspectDataTransferText(JSON.stringify(document));
  const migrated = migrateBackupSnapshotToCurrent(inspected.document.data);
  const restorePoint = await createRestorePoint(formatTransferRestorePointLabel(), 'BEFORE_DATA_TRANSFER_IMPORT', true);
  const notificationsSuspended = await suspendNotificationsForDataReplace();
  try {
    await replaceSnapshotVerified(migrated, true);
  } finally {
    await resumeNotificationsAfterDataReplace(notificationsSuspended);
  }
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readwrite');
    putJournalEntry(tx, buildJournalEntry({
      operationType: 'IMPORT_DATA_TRANSFER',
      entityType: 'APPLICATION_DATA',
      entityIds: ['application-data'],
      description: `Zaimportowano dane z pliku z ${inspected.document.createdAt}`,
      reversible: false,
      metadata: {
        sourceAppVersion: inspected.document.appVersion,
        sourceSchemaVersion: inspected.document.databaseSchemaVersion,
        restorePointId: restorePoint.id,
      },
    }));
    await transactionDone(tx);
    await pruneChangeJournal();
  } catch {
    // Journal jest pomocniczy. Udany, zweryfikowany import nie może zostać uznany
    // za nieudany wyłącznie z powodu problemu z zapisaniem wpisu historii.
  }
  return { restorePoint, summary: inspected.summary };
}

export async function inspectBackupText(text: string): Promise<BackupInspection> {
  let document: BackupDocument;
  try {
    document = JSON.parse(text) as BackupDocument;
  } catch {
    throw new Error('Nie można odczytać pliku backupu.');
  }
  if (document.format !== 'inteligentny-kalendarz-backup' || document.backupVersion !== 1) {
    throw new Error('Nieobsługiwana wersja lub format backupu.');
  }
  if (!document.data || document.data.format !== 'inteligentny-kalendarz-snapshot') throw new Error('Backup nie zawiera prawidłowego snapshotu danych.');
  const unsigned = {
    format: document.format,
    backupVersion: document.backupVersion,
    appVersion: document.appVersion,
    databaseSchemaVersion: document.databaseSchemaVersion,
    createdAt: document.createdAt,
    data: document.data,
  };
  const actual = await sha256Text(JSON.stringify(unsigned));
  if (actual !== document.checksum) throw new Error('Nie można przywrócić kopii. Plik jest uszkodzony lub został zmieniony.');
  if (![DATABASE_SCHEMA_VERSION, 12, 11, 10, 9, 8, 7].includes(document.databaseSchemaVersion)) {
    throw new Error(`Backup używa schematu ${document.databaseSchemaVersion}. Ta wersja obsługuje przywracanie schematu ${DATABASE_SCHEMA_VERSION}, 12, 11, 10, 9, 8 oraz 7.`);
  }
  return { document, summary: backupSummary(document) };
}

function migrateBackupSnapshotToCurrent(snapshot: DatabaseSnapshot): DatabaseSnapshot {
  if (snapshot.databaseSchemaVersion === DATABASE_SCHEMA_VERSION) return snapshot;
  if (![7, 8, 9, 10, 11, 12].includes(snapshot.databaseSchemaVersion)) throw new Error('Ten backup wymaga nieobsługiwanej migracji danych.');
  return {
    ...snapshot,
    appVersion: APP_VERSION,
    databaseSchemaVersion: DATABASE_SCHEMA_VERSION,
    stores: {
      ...snapshot.stores,
      ...(snapshot.databaseSchemaVersion === 7 ? { [STORE_AVAILABILITY_PLANS]: [] } : {}),
      [STORE_SHOPPING_ITEMS]: snapshot.stores[STORE_SHOPPING_ITEMS] ?? [],
      [STORE_EXPENSE_CATEGORIES]: snapshot.stores[STORE_EXPENSE_CATEGORIES] ?? [],
      [STORE_RECEIPTS]: snapshot.stores[STORE_RECEIPTS] ?? [],
      [STORE_CYCLE_PERIODS]: snapshot.stores[STORE_CYCLE_PERIODS] ?? [],
      [STORE_CYCLE_JOURNAL_ENTRIES]: snapshot.stores[STORE_CYCLE_JOURNAL_ENTRIES] ?? [],
    },
  };
}

export async function restoreBackup(document: BackupDocument): Promise<void> {
  const inspected = await inspectBackupText(JSON.stringify(document));
  const safety = await createRestorePoint('Przed przywróceniem pełnego backupu', 'BEFORE_BACKUP_RESTORE', true);
  const notificationsSuspended = await suspendNotificationsForDataReplace();
  try {
    await replaceSnapshotVerified(migrateBackupSnapshotToCurrent(inspected.document.data), true);
    try {
      const db = await openDatabase();
      const tx = db.transaction(STORE_CHANGE_JOURNAL, 'readwrite');
      putJournalEntry(tx, buildJournalEntry({
        operationType: 'RESTORE_BACKUP',
        entityType: 'APPLICATION_DATA',
        entityIds: ['application-data'],
        description: `Przywrócono backup z ${inspected.document.createdAt}`,
        restorePointId: safety.id,
      }));
      await transactionDone(tx);
      await pruneChangeJournal();
    } catch {
      // Historia jest pomocnicza; zweryfikowanego przywrócenia nie cofamy z powodu wpisu dziennika.
    }
  } finally {
    await resumeNotificationsAfterDataReplace(notificationsSuspended);
  }
}


export async function listAvailabilityPlans(): Promise<AvailabilityPlan[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_AVAILABILITY_PLANS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_AVAILABILITY_PLANS).getAll() as IDBRequest<AvailabilityPlan[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export async function getAvailabilityPlan(weekStart: string): Promise<AvailabilityPlan | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_AVAILABILITY_PLANS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_AVAILABILITY_PLANS).index('weekStart').get(weekStart) as IDBRequest<AvailabilityPlan | undefined>);
  await transactionDone(tx);
  return result;
}

export async function saveAvailabilityPlan(
  plan: AvailabilityPlan,
  operationType: Extract<ChangeOperationType, 'GENERATE_AVAILABILITY_PLAN' | 'ACCEPT_AVAILABILITY_BLOCK' | 'EDIT_AVAILABILITY_BLOCK' | 'REJECT_AVAILABILITY_BLOCK' | 'ACCEPT_AVAILABILITY_PLAN' | 'MARK_AVAILABILITY_SENT' | 'SET_AVAILABILITY_DAY_RULE' | 'ADD_MANUAL_AVAILABILITY_BLOCK' | 'REMOVE_AVAILABILITY_BLOCK' | 'MERGE_AVAILABILITY_BLOCKS'> = 'GENERATE_AVAILABILITY_PLAN',
  description = 'Zapisano plan dyspozycyjności',
): Promise<AvailabilityPlan> {
  const current = await getAvailabilityPlan(plan.weekStart);
  const db = await openDatabase();
  const tx = db.transaction([STORE_AVAILABILITY_PLANS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_AVAILABILITY_PLANS).put(plan);
  putJournalEntry(tx, buildJournalEntry({
    operationType,
    entityType: 'AVAILABILITY_PLAN',
    entityIds: [plan.id],
    description,
    beforeState: current ?? null,
    afterState: plan,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return plan;
}

export async function listDayConstraints(): Promise<DayConstraint[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_DAY_CONSTRAINTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_DAY_CONSTRAINTS).getAll() as IDBRequest<DayConstraint[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function listActiveDayConstraints(startDate?: string, endDate?: string): Promise<DayConstraint[]> {
  return (await listDayConstraints()).filter((constraint) => constraint.active && (!startDate || constraint.date >= startDate) && (!endDate || constraint.date <= endDate));
}

export async function setWorkAvailabilityExcluded(date: string, excluded: boolean, note?: string): Promise<DayConstraint | undefined> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Nieprawidłowa data ograniczenia.');
  const current = (await listDayConstraints()).find((constraint) => constraint.date === date && constraint.type === 'EXCLUDE_FROM_WORK_AVAILABILITY');
  const timestamp = nowIso();
  const next: DayConstraint | undefined = excluded ? {
    id: current?.id ?? createId('day-constraint'),
    date,
    type: 'EXCLUDE_FROM_WORK_AVAILABILITY',
    ...(note?.trim() ? { note: note.trim() } : current?.note ? { note: current.note } : {}),
    source: 'MANUAL',
    active: true,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  } : current ? { ...current, active: false, updatedAt: timestamp } : undefined;
  if (!current && !next) return undefined;
  const db = await openDatabase();
  const tx = db.transaction([STORE_DAY_CONSTRAINTS, STORE_CHANGE_JOURNAL], 'readwrite');
  if (next) tx.objectStore(STORE_DAY_CONSTRAINTS).put(next);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SET_DAY_CONSTRAINT',
    entityType: 'DAY_CONSTRAINT',
    entityIds: [next?.id ?? current!.id],
    description: excluded ? `Wykluczono ${date} z automatycznej dyspozycyjności` : `Ponownie dopuszczono ${date} do automatycznej dyspozycyjności`,
    beforeState: current ?? null,
    afterState: next ?? null,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return next;
}


export async function getDayPlanningProfile(): Promise<DayPlanningProfile | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_DAY_PLANNING_PROFILES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_DAY_PLANNING_PROFILES).get('default') as IDBRequest<DayPlanningProfile | undefined>);
  await transactionDone(tx);
  return result;
}

export async function saveDayPlanningProfile(input: Omit<DayPlanningProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<DayPlanningProfile> {
  const current = await getDayPlanningProfile();
  const timestamp = nowIso();
  const profile: DayPlanningProfile = {
    id: 'default',
    ...input,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_DAY_PLANNING_PROFILES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_DAY_PLANNING_PROFILES).put(profile);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SAVE_DAY_PLANNING_PROFILE',
    entityType: 'DAY_PLANNING_PROFILE',
    entityIds: [profile.id],
    description: 'Zapisano ustawienia planowania dnia',
    beforeState: current ?? null,
    afterState: profile,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return profile;
}

export async function listDailyRoutineRules(): Promise<DailyRoutineRule[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_DAILY_ROUTINE_RULES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_DAILY_ROUTINE_RULES).getAll() as IDBRequest<DailyRoutineRule[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export async function saveDailyRoutineRule(input: Omit<DailyRoutineRule, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<DailyRoutineRule> {
  if (!input.name.trim()) throw new Error('Podaj nazwę codziennej czynności.');
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) throw new Error('Czas czynności musi być dodatnią liczbą minut.');
  if (input.type === 'FIXED' && (!input.fixedStart || !input.fixedEnd)) throw new Error('Stała czynność wymaga godzin od i do.');
  const current = id ? (await listDailyRoutineRules()).find((rule) => rule.id === id) : undefined;
  const timestamp = nowIso();
  const rule: DailyRoutineRule = {
    id: current?.id ?? createId('routine-rule'),
    ...input,
    name: input.name.trim(),
    daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_DAILY_ROUTINE_RULES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_DAILY_ROUTINE_RULES).put(rule);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SAVE_ROUTINE_RULE',
    entityType: 'DAILY_ROUTINE_RULE',
    entityIds: [rule.id],
    description: `${current ? 'Zmieniono' : 'Dodano'} czynność: ${rule.name}`,
    beforeState: current ?? null,
    afterState: rule,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return rule;
}

export async function deleteDailyRoutineRule(id: string): Promise<void> {
  const current = (await listDailyRoutineRules()).find((rule) => rule.id === id);
  if (!current) return;
  const db = await openDatabase();
  const tx = db.transaction([STORE_DAILY_ROUTINE_RULES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_DAILY_ROUTINE_RULES).delete(id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_ROUTINE_RULE',
    entityType: 'DAILY_ROUTINE_RULE',
    entityIds: [id],
    description: `Usunięto czynność: ${current.name}`,
    beforeState: current,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function listDayAttributes(): Promise<DayAttribute[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_DAY_ATTRIBUTES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_DAY_ATTRIBUTES).getAll() as IDBRequest<DayAttribute[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function setTradingSunday(date: string, active: boolean): Promise<DayAttribute | undefined> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Nieprawidłowa data.');
  const day = new Date(`${date}T12:00:00`);
  if (day.getDay() !== 0) throw new Error('Niedzielę handlową można oznaczyć tylko dla niedzieli.');
  const current = (await listDayAttributes()).find((item) => item.date === date && item.type === 'TRADING_SUNDAY');
  const timestamp = nowIso();
  const next: DayAttribute | undefined = active ? {
    id: current?.id ?? createId('day-attribute'),
    date,
    type: 'TRADING_SUNDAY',
    active: true,
    source: 'MANUAL',
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  } : current ? { ...current, active: false, updatedAt: timestamp } : undefined;
  if (!current && !next) return undefined;
  const db = await openDatabase();
  const tx = db.transaction([STORE_DAY_ATTRIBUTES, STORE_CHANGE_JOURNAL], 'readwrite');
  if (next) tx.objectStore(STORE_DAY_ATTRIBUTES).put(next);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SET_DAY_ATTRIBUTE',
    entityType: 'DAY_ATTRIBUTE',
    entityIds: [next?.id ?? current!.id],
    description: active ? `Oznaczono ${date} jako niedzielę handlową` : `Usunięto oznaczenie niedzieli handlowej: ${date}`,
    beforeState: current ?? null,
    afterState: next ?? null,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return next;
}

export async function listConsistencyAcknowledgements(): Promise<ConsistencyAcknowledgement[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CONSISTENCY_ACKNOWLEDGEMENTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_CONSISTENCY_ACKNOWLEDGEMENTS).getAll() as IDBRequest<ConsistencyAcknowledgement[]>);
  await transactionDone(tx);
  return result;
}

export async function acknowledgeConsistencyIssue(issue: CalendarConsistencyIssue): Promise<void> {
  const existing = (await listConsistencyAcknowledgements()).find((item) => item.fingerprint === issue.fingerprint);
  if (existing) return;
  const acknowledgement: ConsistencyAcknowledgement = {
    id: createId('consistency-ack'),
    fingerprint: issue.fingerprint,
    acknowledgedAt: nowIso(),
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_CONSISTENCY_ACKNOWLEDGEMENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_CONSISTENCY_ACKNOWLEDGEMENTS).put(acknowledgement);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'ACKNOWLEDGE_CONSISTENCY_ISSUE',
    entityType: 'CONSISTENCY_ISSUE',
    entityIds: issue.eventIds,
    description: `Zaakceptowano niespójność: ${issue.title}`,
    afterState: acknowledgement,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function listCalendarConsistencyIssues(): Promise<CalendarConsistencyIssue[]> {
  const [events, routines, acknowledgements] = await Promise.all([listEvents(), listDailyRoutineRules(), listConsistencyAcknowledgements()]);
  return analyzeCalendarConsistency(events, routines, acknowledgements);
}

export async function getPlanningBlockingIssues(startDate: string, endDate: string): Promise<CalendarConsistencyIssue[]> {
  const issues = await listCalendarConsistencyIssues();
  return openPlanningBlockingIssues(issues).filter((issue) => issue.endDateTime.slice(0, 10) >= startDate && issue.startDateTime.slice(0, 10) <= endDate);
}

function freeIntervalsForDate(date: string, events: CalendarEvent[], routines: DailyRoutineRule[] = []): Array<{ startDateTime: string; endDateTime: string; minutes: number }> {
  const startOfDay = `${date}T00:00`;
  const endOfDay = `${date}T23:59`;
  const localMs = (value: string) => {
    const [d, t = '00:00'] = value.split('T');
    const [y, m, dd] = (d ?? '').split('-').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return new Date(y ?? 1970, (m || 1) - 1, dd || 1, hh || 0, mm || 0).getTime();
  };
  const eventBlocks = events
    .filter((event) => eventOccursOnDate(event, date) && (event.allDay ? event.availabilityImpact === 'BLOCKING' : event.availabilityImpact !== 'NON_BLOCKING'))
    .map((event) => ({ start: localMs(event.startDateTime) < localMs(startOfDay) ? startOfDay : event.startDateTime, end: localMs(event.endDateTime) > localMs(endOfDay) ? endOfDay : event.endDateTime }));
  const routineBlocks = routines.filter((rule) => rule.active && rule.type === 'FIXED' && rule.priority === 'REQUIRED' && rule.fixedStart && rule.fixedEnd).flatMap((rule) => {
    const currentDate = new Date(`${date}T12:00:00`);
    const previousDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
    const applies = (value: Date) => !rule.daysOfWeek.length || rule.daysOfWeek.includes(value.getDay());
    if (rule.fixedEnd! > rule.fixedStart!) return applies(currentDate) ? [{ start: `${date}T${rule.fixedStart}`, end: `${date}T${rule.fixedEnd}` }] : [];
    const result: Array<{ start: string; end: string }> = [];
    if (applies(previousDate)) result.push({ start: startOfDay, end: `${date}T${rule.fixedEnd}` });
    if (applies(currentDate)) result.push({ start: `${date}T${rule.fixedStart}`, end: `${toLocalDateKey(nextDate)}T${rule.fixedEnd}` });
    return result;
  });
  const blocks = [...eventBlocks, ...routineBlocks].sort((a, b) => localMs(a.start) - localMs(b.start));
  if (blocks.some((block) => block.start.slice(11, 16) === '00:00' && block.end.slice(11, 16) >= '23:59')) return [];
  const merged: typeof blocks = [];
  for (const block of blocks) {
    const last = merged.at(-1);
    if (!last || localMs(block.start) > localMs(last.end)) merged.push({ ...block });
    else if (localMs(block.end) > localMs(last.end)) last.end = block.end;
  }
  const result: Array<{ startDateTime: string; endDateTime: string; minutes: number }> = [];
  let cursor = startOfDay;
  for (const block of merged) {
    if (localMs(block.start) > localMs(cursor)) result.push({ startDateTime: cursor, endDateTime: block.start, minutes: Math.round((localMs(block.start) - localMs(cursor)) / 60000) });
    if (localMs(block.end) > localMs(cursor)) cursor = block.end;
  }
  if (localMs(cursor) < localMs(endOfDay)) result.push({ startDateTime: cursor, endDateTime: endOfDay, minutes: Math.round((localMs(endOfDay) - localMs(cursor)) / 60000) });
  return result;
}

export async function buildDayPlanningContext(date: string): Promise<DayPlanningContext> {
  const [events, constraints, attributes, routines, issues] = await Promise.all([
    listEvents(), listActiveDayConstraints(date, date), listDayAttributes(), listDailyRoutineRules(), listCalendarConsistencyIssues(),
  ]);
  const dayEvents = events.filter((event) => eventOccursOnDate(event, date));
  const dateObj = new Date(`${date}T12:00:00`);
  const dayRoutines = routines.filter((rule) => rule.active && (!rule.daysOfWeek.length || rule.daysOfWeek.includes(dateObj.getDay())));
  const dayAttributes = attributes.filter((attribute) => attribute.active && attribute.date === date);
  return {
    date,
    events: dayEvents,
    constraints,
    attributes: dayAttributes,
    routines: dayRoutines,
    freeIntervals: freeIntervalsForDate(date, dayEvents, dayRoutines),
    consistencyIssues: issues.filter((issue) => issue.endDateTime.slice(0, 10) >= date && issue.startDateTime.slice(0, 10) <= date),
    tradingSunday: dayAttributes.some((item) => item.type === 'TRADING_SUNDAY'),
    excludedFromWorkAvailability: constraints.some((item) => item.type === 'EXCLUDE_FROM_WORK_AVAILABILITY' && item.active),
  };
}

export async function buildWeekPlanningContext(weekStart: string): Promise<WeekPlanningContext> {
  const start = new Date(`${weekStart}T12:00:00`);
  const dates = Array.from({ length: 7 }, (_, offset) => {
    const value = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return toLocalDateKey(value);
  });
  const [profile, days, work] = await Promise.all([
    getDayPlanningProfile(),
    Promise.all(dates.map((date) => buildDayPlanningContext(date))),
    getConfirmedWorkMinutes(dates[0]!, dates[6]!),
  ]);
  const target = profile?.targetWeeklyWorkMinutes ?? 0;
  return {
    weekStart: dates[0]!,
    days,
    targetWeeklyWorkMinutes: target,
    confirmedWorkMinutes: work.totalConfirmedWorkMinutes,
    remainingWorkMinutes: Math.max(0, target - work.totalConfirmedWorkMinutes),
    overTargetMinutes: Math.max(0, work.totalConfirmedWorkMinutes - target),
    blockingIssueCount: days.reduce((sum, day) => sum + day.consistencyIssues.filter((issue) => issue.planningImpact === 'BLOCKING' && !issue.acknowledged).length, 0),
  };
}

export type StudySeriesTimingMode = 'SET_SAME_TIME' | 'SHIFT_MINUTES';

export async function updateStudySeriesTiming(eventId: string, input: { mode: StudySeriesTimingMode; startTime?: string; endTime?: string; shiftMinutes?: number }): Promise<CalendarEvent[]> {
  const event = await getEvent(eventId);
  if (!event || event.source !== 'UNIVERSITY_XLSX' || !event.seriesKey) throw new Error('To wydarzenie nie ma bezpiecznego klucza serii studiów.');
  const members = (await listEvents()).filter((item) => item.source === 'UNIVERSITY_XLSX' && item.seriesKey === event.seriesKey);
  if (!members.length) throw new Error('Nie znaleziono powiązanych terminów.');
  if (input.mode === 'SET_SAME_TIME' && (!input.startTime || !input.endTime || input.endTime <= input.startTime)) throw new Error('Podaj poprawny zakres godzin.');
  if (input.mode === 'SHIFT_MINUTES' && !Number.isInteger(input.shiftMinutes)) throw new Error('Podaj przesunięcie w pełnych minutach.');
  const safety = await createRestorePoint(`Przed korektą godzin serii: ${event.title}`, 'BEFORE_SERIES_BULK_CHANGE', true);
  const timestamp = nowIso();
  const shiftLocal = (value: string, minutes: number): string => {
    const [date, time] = value.split('T');
    const [y, m, d] = (date ?? '').split('-').map(Number);
    const [hh, mm] = (time ?? '00:00').split(':').map(Number);
    const result = new Date(y ?? 1970, (m || 1) - 1, d || 1, hh || 0, (mm || 0) + minutes);
    return `${toLocalDateKey(result)}T${String(result.getHours()).padStart(2, '0')}:${String(result.getMinutes()).padStart(2, '0')}`;
  };
  const updated = members.map((member) => {
    const date = member.startDateTime.slice(0, 10);
    const startDateTime = input.mode === 'SET_SAME_TIME' ? `${date}T${input.startTime}` : shiftLocal(member.startDateTime, input.shiftMinutes ?? 0);
    const endDateTime = input.mode === 'SET_SAME_TIME' ? `${date}T${input.endTime}` : shiftLocal(member.endDateTime, input.shiftMinutes ?? 0);
    const fields = [...new Set([...(member.userModifiedFields ?? []), 'startDateTime', 'endDateTime'] as UserModifiedEventField[])];
    return { ...member, startDateTime, endDateTime, spanType: inferSpanType(startDateTime, endDateTime), userModified: true, userModifiedFields: fields, updatedAt: timestamp } satisfies CalendarEvent;
  });
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  for (const item of updated) tx.objectStore(STORE_EVENTS).put(item);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'UPDATE_STUDY_SERIES_TIMING',
    entityType: 'STUDY_PLAN',
    entityIds: updated.map((item) => item.id),
    description: `Skorygowano godziny ${updated.length} powiązanych zajęć: ${event.title}`,
    beforeState: members,
    afterState: updated,
    groupId: event.seriesKey,
    restorePointId: safety.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return updated;
}

export async function listStudyPreviewProfiles(): Promise<StudyPreviewProfile[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_STUDY_PREVIEW_PROFILES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_STUDY_PREVIEW_PROFILES).getAll() as IDBRequest<StudyPreviewProfile[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveStudyPreviewProfile(name: string, selectedGroups: string[], id?: string): Promise<StudyPreviewProfile> {
  if (!selectedGroups.length) throw new Error('Wybierz co najmniej jedną grupę do profilu podglądowego.');
  const existing = id ? (await listStudyPreviewProfiles()).find((profile) => profile.id === id) : undefined;
  const timestamp = nowIso();
  const profile: StudyPreviewProfile = {
    id: existing?.id ?? createId('study-preview-profile'),
    name: name.trim() || `Podgląd ${formatStudyGroupList(selectedGroups)}`,
    selectedGroups: [...new Set(selectedGroups)].sort((a, b) => a.localeCompare(b, 'pl')),
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const db = await openDatabase();
  const tx = db.transaction(STORE_STUDY_PREVIEW_PROFILES, 'readwrite');
  tx.objectStore(STORE_STUDY_PREVIEW_PROFILES).put(profile);
  await transactionDone(tx);
  return profile;
}

export async function deleteStudyPreviewProfile(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_STUDY_PREVIEW_PROFILES, 'readwrite');
  tx.objectStore(STORE_STUDY_PREVIEW_PROFILES).delete(id);
  await transactionDone(tx);
}

export async function buildStudyGroupPreview(selectedGroups: string[]): Promise<StudyGroupPreview> {
  const active = await getActiveUniversityImport();
  if (!active) throw new Error('Brak aktywnego planu studiów.');
  const availableGroups = active.availableGroups ?? active.selectedGroups;
  const groupValidation = validateStudyGroupSelection(availableGroups, selectedGroups);
  if (!groupValidation.valid) throw new Error(groupValidation.errors.join(' '));
  const entries = await listUniversityImportEntries(active.id);
  const sourceDataComplete = Boolean(active.sourceDataComplete);
  const sourceEntries = entries.filter((entry) => entry.sourceOnly);
  if (!sourceDataComplete || !sourceEntries.length) {
    return {
      activeImportId: active.id,
      sourceFileName: active.fileName,
      selectedGroups: [...selectedGroups],
      availableGroups: [...availableGroups],
      candidates: [],
      sourceDataComplete,
      requiresReupload: true,
      reason: 'Ten starszy import nie zawiera pełnych danych wszystkich grup. Wskaż ponownie plik Excel, aby bezpiecznie podejrzeć inny plan.',
    };
  }
  const analysis = {
    adapterId: active.adapterId,
    sheetNames: active.sheetNames,
    ...(active.detectedAcademicYear ? { detectedAcademicYear: active.detectedAcademicYear } : {}),
    ...(active.detectedTerm ? { detectedTerm: active.detectedTerm } : {}),
    groups: [...availableGroups],
    candidates: sourceEntries.map(candidateFromEntry),
    ...(active.sourceBlocks?.length ? { sourceBlocks: cloneStudySourceBlocks(active.sourceBlocks)! } : {}),
    information: [],
    warnings: [],
  } satisfies import('../study/study.types').ScheduleAnalysis;
  const candidates = candidatesForSelectedGroups(analysis, selectedGroups).map(identifyCandidate);
  return {
    activeImportId: active.id,
    sourceFileName: active.fileName,
    selectedGroups: [...selectedGroups],
    availableGroups: [...availableGroups],
    candidates,
    sourceDataComplete,
    requiresReupload: false,
  };
}


export async function getWorkProfile(): Promise<WorkProfile | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_PROFILES, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_WORK_PROFILES).get('primary-work') as IDBRequest<WorkProfile | undefined>);
  await transactionDone(tx);
  return result;
}

export async function saveWorkProfile(input: {
  employeeMatchName: string;
  employerName: string;
  workplaceName: string;
  locationId?: string;
  storeCoworkerSchedule?: boolean;
  notes?: string;
}): Promise<WorkProfile> {
  const current = await getWorkProfile();
  const timestamp = nowIso();
  const profile: WorkProfile = {
    id: 'primary-work',
    employeeMatchName: input.employeeMatchName.trim(),
    employerName: input.employerName.trim(),
    workplaceName: input.workplaceName.trim(),
    storeCoworkerSchedule: input.storeCoworkerSchedule ?? current?.storeCoworkerSchedule ?? true,
    active: true,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
    ...(input.locationId ? { locationId: input.locationId } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  };
  const db = await openDatabase();
  const tx = db.transaction([STORE_WORK_PROFILES, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_WORK_PROFILES).put(profile);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'SAVE_WORK_PROFILE',
    entityType: 'WORK_PROFILE',
    entityIds: [profile.id],
    description: current ? 'Zaktualizowano profil pracy' : 'Utworzono profil pracy',
    beforeState: current ?? null,
    afterState: profile,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return profile;
}

export async function listWorkScheduleImports(): Promise<WorkScheduleImport[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_SCHEDULE_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).getAll() as IDBRequest<WorkScheduleImport[]>);
  await transactionDone(tx);
  return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getWorkScheduleImport(id: string): Promise<WorkScheduleImport | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_SCHEDULE_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).get(id) as IDBRequest<WorkScheduleImport | undefined>);
  await transactionDone(tx);
  return result;
}

export async function findWorkScheduleImportByHash(fileHash: string): Promise<WorkScheduleImport | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_SCHEDULE_IMPORTS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).index('fileHash').get(fileHash) as IDBRequest<WorkScheduleImport | undefined>);
  await transactionDone(tx);
  return result;
}

export async function getActiveWorkScheduleImport(periodStart?: string, profileId = 'primary-work'): Promise<WorkScheduleImport | undefined> {
  const imports = await listWorkScheduleImports();
  return imports.find((item) => item.profileId === profileId && item.lifecycleStatus === 'ACTIVE' && (!periodStart || item.periodStart === periodStart));
}

export async function listWorkScheduleEntries(importId?: string): Promise<WorkScheduleEntry[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_SCHEDULE_ENTRIES, 'readonly');
  const store = tx.objectStore(STORE_WORK_SCHEDULE_ENTRIES);
  const result = importId
    ? await requestToPromise(store.index('importId').getAll(importId) as IDBRequest<WorkScheduleEntry[]>)
    : await requestToPromise(store.getAll() as IDBRequest<WorkScheduleEntry[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}

export async function listWorkCoworkerShifts(importId?: string): Promise<WorkCoworkerShift[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_WORK_COWORKER_SHIFTS, 'readonly');
  const store = tx.objectStore(STORE_WORK_COWORKER_SHIFTS);
  const result = importId
    ? await requestToPromise(store.index('importId').getAll(importId) as IDBRequest<WorkCoworkerShift[]>)
    : await requestToPromise(store.getAll() as IDBRequest<WorkCoworkerShift[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.displayName.localeCompare(b.displayName, 'pl'));
}

function workEventTitle(profile: WorkProfile): string {
  return profile.employerName ? `Praca - ${profile.employerName}` : 'Praca';
}

function workEventFromEntry(profile: WorkProfile, entry: WorkScheduleEntry, timestamp: string): CalendarEvent {
  if (!entry.startTime || !entry.endTime) throw new Error('Brak godzin zmiany pracy.');
  const dateTimes = workDateTimes(entry.date, entry.startTime, entry.endTime);
  return {
    id: createId('event-work'),
    title: workEventTitle(profile),
    startDateTime: dateTimes.startDateTime,
    endDateTime: dateTimes.endDateTime,
    allDay: false,
    spanType: dateTimes.crossesMidnight ? 'MULTI_DAY' : 'SINGLE_DAY',
    category: 'WORK',
    source: 'WORK_PDF',
    sourceWorkImportId: entry.importId,
    sourceWorkEntryId: entry.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(profile.locationId ? { locationId: profile.locationId } : {}),
  };
}

export async function commitWorkScheduleImport(input: WorkImportCommitInput): Promise<WorkImportCommitResult> {
  const duplicate = await findWorkScheduleImportByHash(input.fileHash);
  if (duplicate) throw new Error('Ten grafik został już zaimportowany.');
  const profile = await getWorkProfile();
  if (!profile || profile.id !== input.profileId) throw new Error('Najpierw zapisz profil pracy.');
  if (!profile.employeeMatchName.trim()) throw new Error('Ustaw nazwę pracownika używaną w grafiku.');

  const active = await getActiveWorkScheduleImport(input.periodStart, input.profileId);
  const oldEntries = active ? await listWorkScheduleEntries(active.id) : [];
  const oldEvents = active ? (await listEvents()).filter((event) => event.sourceWorkImportId === active.id) : [];
  const oldEventById = new Map(oldEvents.map((event) => [event.id, event]));
  const safety = await createRestorePoint(active ? `Przed aktualizacją grafiku ${input.periodStart.slice(0, 7)}` : `Przed importem grafiku ${input.periodStart.slice(0, 7)}`, active ? 'BEFORE_WORK_UPDATE' : 'BEFORE_WORK_IMPORT', true);
  const timestamp = nowIso();
  const importId = createId('work-import');
  const workImport: WorkScheduleImport = {
    id: importId,
    profileId: input.profileId,
    fileName: input.fileName,
    fileHash: input.fileHash,
    importedAt: timestamp,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    adapterId: input.adapterId,
    lifecycleStatus: 'ACTIVE',
    shiftCount: input.shifts.length,
    totalMinutes: input.shifts.reduce((sum, shift) => sum + shift.minutes, 0),
    warningCount: input.shifts.filter((shift) => shift.status === 'REVIEW_REQUIRED').length,
    blockingCount: input.shifts.filter((shift) => shift.status === 'BLOCKING').length,
    coworkerShiftCount: profile.storeCoworkerSchedule ? input.coworkerShifts.length : 0,
    ...(input.sourceReportedMinutes !== undefined ? { sourceReportedMinutes: input.sourceReportedMinutes } : {}),
  };

  const newEntries: WorkScheduleEntry[] = [];
  const coworkerRecords: WorkCoworkerShift[] = profile.storeCoworkerSchedule ? input.coworkerShifts.map((shift) => ({ ...shift, id: createId('coworker-shift'), importId })) : [];
  const matchedOld = new Set<string>();
  const eventsToPut: CalendarEvent[] = [];
  const eventIdsToDelete = new Set<string>();
  let createdEvents = 0;
  let updatedEvents = 0;
  let removedEvents = 0;
  let preservedUserChanges = 0;

  for (const shift of input.shifts) {
    const exact = oldEntries.find((entry) => !matchedOld.has(entry.id) && entry.workOccurrenceKey === shift.workOccurrenceKey);
    const sameDate = exact ? undefined : oldEntries.filter((entry) => !matchedOld.has(entry.id) && entry.type === 'SHIFT' && entry.date === shift.date);
    const old = exact ?? (sameDate?.length === 1 ? sameDate[0] : undefined);
    if (old) matchedOld.add(old.id);
    const entry: WorkScheduleEntry = {
      id: createId('work-entry'),
      importId,
      profileId: input.profileId,
      date: shift.date,
      type: 'SHIFT',
      startTime: shift.startTime,
      endTime: shift.endTime,
      minutes: shift.minutes,
      status: shift.status,
      issues: [...shift.issues],
      sourcePage: shift.sourcePage,
      workOccurrenceKey: shift.workOccurrenceKey,
      ...(shift.sourceContext ? { sourceContext: shift.sourceContext } : {}),
      ...(old?.userDeleted ? { userDeleted: true } : {}),
    };

    const oldEvent = old?.eventId ? oldEventById.get(old.eventId) : undefined;
    if (old?.userDeleted) {
      newEntries.push(entry);
      continue;
    }
    if (oldEvent) {
      const shiftDateTimes = workDateTimes(shift.date, shift.startTime, shift.endTime);
      const exactTime = oldEvent.startDateTime === shiftDateTimes.startDateTime && oldEvent.endDateTime === shiftDateTimes.endDateTime;
      if (oldEvent.userModified && !exactTime && input.conflictDecision !== 'USE_NEW') {
        const preserved: CalendarEvent = { ...oldEvent, sourceWorkImportId: importId, sourceWorkEntryId: entry.id, updatedAt: timestamp };
        entry.eventId = preserved.id;
        eventsToPut.push(preserved);
        preservedUserChanges += 1;
      } else {
        const updated: CalendarEvent = {
          ...oldEvent,
          title: workEventTitle(profile),
          startDateTime: shiftDateTimes.startDateTime,
          endDateTime: shiftDateTimes.endDateTime,
          spanType: shiftDateTimes.crossesMidnight ? 'MULTI_DAY' : 'SINGLE_DAY',
          sourceWorkImportId: importId,
          sourceWorkEntryId: entry.id,
          updatedAt: timestamp,
          ...(profile.locationId ? { locationId: profile.locationId } : {}),
          ...(input.conflictDecision === 'USE_NEW' ? { userModified: false, userModifiedFields: [] } : {}),
        };
        entry.eventId = updated.id;
        eventsToPut.push(updated);
        if (!exactTime) updatedEvents += 1;
      }
    } else {
      const event = workEventFromEntry(profile, entry, timestamp);
      entry.eventId = event.id;
      eventsToPut.push(event);
      createdEvents += 1;
    }
    newEntries.push(entry);
  }

  for (const old of oldEntries) {
    if (matchedOld.has(old.id) || !old.eventId) continue;
    const event = oldEventById.get(old.eventId);
    if (!event) continue;
    if (event.userModified) {
      preservedUserChanges += 1;
      continue;
    }
    eventIdsToDelete.add(event.id);
    removedEvents += 1;
  }

  const db = await openDatabase();
  const tx = db.transaction([
    STORE_WORK_SCHEDULE_IMPORTS,
    STORE_WORK_SCHEDULE_ENTRIES,
    STORE_WORK_COWORKER_SHIFTS,
    STORE_EVENTS,
    STORE_CHANGE_JOURNAL,
  ], 'readwrite');
  if (active) tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).put({ ...active, lifecycleStatus: 'HISTORICAL' } satisfies WorkScheduleImport);
  tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).add(workImport);
  const entryStore = tx.objectStore(STORE_WORK_SCHEDULE_ENTRIES);
  for (const entry of newEntries) entryStore.add(entry);
  const coworkerStore = tx.objectStore(STORE_WORK_COWORKER_SHIFTS);
  for (const shift of coworkerRecords) coworkerStore.add(shift);
  const eventStore = tx.objectStore(STORE_EVENTS);
  for (const event of eventsToPut) eventStore.put(event);
  for (const id of eventIdsToDelete) eventStore.delete(id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: active ? 'UPDATE_WORK_SCHEDULE' : 'IMPORT_WORK_SCHEDULE',
    entityType: 'WORK_SCHEDULE',
    entityIds: [workImport.id],
    description: active ? `Zaktualizowano grafik pracy: ${input.periodStart.slice(0, 7)}` : `Zaimportowano grafik pracy: ${input.periodStart.slice(0, 7)}`,
    restorePointId: safety.id,
    metadata: { shiftCount: workImport.shiftCount, totalMinutes: workImport.totalMinutes },
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
  return { workImport, createdEvents, updatedEvents, removedEvents, preservedUserChanges };
}

export async function deleteWorkScheduleImport(id: string): Promise<void> {
  const workImport = await getWorkScheduleImport(id);
  if (!workImport || workImport.lifecycleStatus === 'DELETED') return;
  const safety = await createRestorePoint(`Przed usunięciem grafiku ${workImport.periodStart.slice(0, 7)}`, 'BEFORE_WORK_IMPORT_DELETE', true);
  const [entries, coworkers] = await Promise.all([listWorkScheduleEntries(id), listWorkCoworkerShifts(id)]);
  const db = await openDatabase();
  const tx = db.transaction([STORE_WORK_SCHEDULE_IMPORTS, STORE_WORK_SCHEDULE_ENTRIES, STORE_WORK_COWORKER_SHIFTS, STORE_EVENTS, STORE_CHANGE_JOURNAL], 'readwrite');
  tx.objectStore(STORE_WORK_SCHEDULE_IMPORTS).put({ ...workImport, lifecycleStatus: 'DELETED' } satisfies WorkScheduleImport);
  const eventStore = tx.objectStore(STORE_EVENTS);
  for (const entry of entries) if (entry.eventId) eventStore.delete(entry.eventId);
  const coworkerStore = tx.objectStore(STORE_WORK_COWORKER_SHIFTS);
  for (const coworker of coworkers) coworkerStore.delete(coworker.id);
  putJournalEntry(tx, buildJournalEntry({
    operationType: 'DELETE_WORK_IMPORT',
    entityType: 'WORK_SCHEDULE',
    entityIds: [id],
    description: `Usunięto grafik pracy: ${workImport.periodStart.slice(0, 7)}`,
    restorePointId: safety.id,
  }));
  await transactionDone(tx);
  await pruneChangeJournal();
}

export async function listCoworkersForWorkEvent(eventId: string): Promise<CoworkerOverlap[]> {
  const event = await getEvent(eventId);
  if (!event || event.source !== 'WORK_PDF' || !event.sourceWorkImportId) return [];
  const date = event.startDateTime.slice(0, 10);
  const startTime = event.startDateTime.slice(11, 16);
  const endTime = event.endDateTime.slice(11, 16);
  const coworkers = await listWorkCoworkerShifts(event.sourceWorkImportId);
  return coworkerOverlaps(date, startTime, endTime, coworkers);
}

export async function listConfirmedWorkBlocks(startDate: string, endDate: string): Promise<ConfirmedWorkBlock[]> {
  const events = await listEvents();
  return events
    .filter((event) => event.category === 'WORK' && (event.source === 'MANUAL' || event.source === 'WORK_PDF') && !event.allDay)
    .filter((event) => event.startDateTime.slice(0, 10) <= endDate && event.endDateTime.slice(0, 10) >= startDate)
    .map((event) => ({
      eventId: event.id,
      date: event.startDateTime.slice(0, 10),
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      minutes: Math.max(0, Math.round((Date.parse(event.endDateTime) - Date.parse(event.startDateTime)) / 60000)) || workMinutes(event.startDateTime.slice(11, 16), event.endDateTime.slice(11, 16)),
      source: event.source as 'MANUAL' | 'WORK_PDF',
    }))
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
}

export async function getConfirmedWorkMinutes(startDate: string, endDate: string): Promise<{ importedWorkMinutes: number; manualWorkMinutes: number; totalConfirmedWorkMinutes: number }> {
  const blocks = await listConfirmedWorkBlocks(startDate, endDate);
  const importedWorkMinutes = blocks.filter((block) => block.source === 'WORK_PDF').reduce((sum, block) => sum + block.minutes, 0);
  const manualWorkMinutes = blocks.filter((block) => block.source === 'MANUAL').reduce((sum, block) => sum + block.minutes, 0);
  return { importedWorkMinutes, manualWorkMinutes, totalConfirmedWorkMinutes: importedWorkMinutes + manualWorkMinutes };
}


function defaultNotificationRuntime(): NotificationRuntime {
  const timestamp = nowIso();
  return {
    id: 'runtime',
    masterEnabled: false,
    suspended: false,
    serverRegistrationState: 'DISABLED',
    backupReminderBaselineAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getNotificationRuntime(): Promise<NotificationRuntime> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NOTIFICATION_RUNTIME, 'readonly');
  const runtime = await requestToPromise(tx.objectStore(STORE_NOTIFICATION_RUNTIME).get('runtime') as IDBRequest<NotificationRuntime | undefined>);
  await transactionDone(tx);
  return runtime ?? defaultNotificationRuntime();
}

export async function updateNotificationRuntime(patch: Partial<Omit<NotificationRuntime, 'id' | 'updatedAt'>>): Promise<NotificationRuntime> {
  const current = await getNotificationRuntime();
  const next: NotificationRuntime = { ...current, ...patch, id: 'runtime', updatedAt: nowIso() };
  const db = await openDatabase();
  const tx = db.transaction(STORE_NOTIFICATION_RUNTIME, 'readwrite');
  tx.objectStore(STORE_NOTIFICATION_RUNTIME).put(next);
  await transactionDone(tx);
  return next;
}

export async function ensureNotificationInstallationIdentity(): Promise<NotificationRuntime> {
  const current = await getNotificationRuntime();
  if (current.installationId && current.installationToken) return current;
  const installationId = createId('installation');
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const installationToken = [...tokenBytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return updateNotificationRuntime({ installationId, installationToken });
}

export async function listNotificationReminders(): Promise<NotificationReminder[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NOTIFICATION_REMINDERS, 'readonly');
  const result = await requestToPromise(tx.objectStore(STORE_NOTIFICATION_REMINDERS).getAll() as IDBRequest<NotificationReminder[]>);
  await transactionDone(tx);
  return result.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
}

export async function replaceNotificationReminders(reminders: NotificationReminder[]): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NOTIFICATION_REMINDERS, 'readwrite');
  const store = tx.objectStore(STORE_NOTIFICATION_REMINDERS);
  store.clear();
  for (const reminder of reminders) store.put(reminder);
  await transactionDone(tx);
}

export async function clearNotificationReminders(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NOTIFICATION_REMINDERS, 'readwrite');
  tx.objectStore(STORE_NOTIFICATION_REMINDERS).clear();
  await transactionDone(tx);
}

export async function suspendNotificationsForDataReplace(): Promise<boolean> {
  const runtime = await getNotificationRuntime();
  if (!runtime.masterEnabled || runtime.suspended) return false;
  await updateNotificationRuntime({ suspended: true });
  return true;
}

async function resumeNotificationsAfterDataReplace(wasSuspended: boolean): Promise<void> {
  if (!wasSuspended) return;
  await updateNotificationRuntime({ suspended: false });
}

export async function recordBackupExportNow(): Promise<void> {
  await updateNotificationRuntime({ lastBackupExportAt: nowIso() });
}

export async function notificationRuntimeAndRemindersForTests(): Promise<{ runtime: NotificationRuntime; reminders: NotificationReminder[] }> {
  return { runtime: await getNotificationRuntime(), reminders: await listNotificationReminders() };
}

export function resetDatabaseConnectionForTests(): void {
  const pending = databasePromise;
  databasePromise = null;
  void pending?.then((db) => db.close()).catch(() => undefined);
}

export async function deleteDatabaseForTests(): Promise<void> {
  const pending = databasePromise;
  databasePromise = null;
  if (pending) {
    try {
      const db = await pending;
      db.close();
    } catch {
      // Test cleanup continues even if opening the previous database failed.
    }
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Nie udało się usunąć testowej bazy.'));
    request.onblocked = () => resolve();
  });
}
