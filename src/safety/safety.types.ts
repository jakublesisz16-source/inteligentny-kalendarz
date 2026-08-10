export const DAY_CONSTRAINT_TYPES = ['EXCLUDE_FROM_WORK_AVAILABILITY'] as const;
export type DayConstraintType = (typeof DAY_CONSTRAINT_TYPES)[number];

export interface DayConstraint {
  id: string;
  date: string;
  type: DayConstraintType;
  note?: string;
  source: 'MANUAL';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChangeOperationType =
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'DELETE_EVENT'
  | 'CREATE_MANUAL_SERIES'
  | 'UPDATE_MANUAL_SERIES'
  | 'DELETE_MANUAL_SERIES'
  | 'RESTORE_TRASH'
  | 'SET_DAY_CONSTRAINT'
  | 'UPDATE_STUDY_GROUPS'
  | 'IMPORT_STUDY_PLAN'
  | 'UPDATE_STUDY_PLAN'
  | 'DELETE_STUDY_IMPORT'
  | 'RECALCULATE_STUDY_GROUPS'
  | 'APPLY_STUDY_CORRECTION'
  | 'RESTORE_POINT'
  | 'RESTORE_BACKUP'
  | 'EMPTY_TRASH'
  | 'SAVE_WORK_PROFILE'
  | 'IMPORT_WORK_SCHEDULE'
  | 'UPDATE_WORK_SCHEDULE'
  | 'DELETE_WORK_IMPORT'
  | 'SAVE_DAY_PLANNING_PROFILE'
  | 'SAVE_ROUTINE_RULE'
  | 'DELETE_ROUTINE_RULE'
  | 'SET_DAY_ATTRIBUTE'
  | 'ACKNOWLEDGE_CONSISTENCY_ISSUE'
  | 'UPDATE_STUDY_SERIES_TIMING'
  | 'GENERATE_AVAILABILITY_PLAN'
  | 'ACCEPT_AVAILABILITY_BLOCK'
  | 'EDIT_AVAILABILITY_BLOCK'
  | 'REJECT_AVAILABILITY_BLOCK'
  | 'ACCEPT_AVAILABILITY_PLAN'
  | 'MARK_AVAILABILITY_SENT'
  | 'SET_AVAILABILITY_DAY_RULE'
  | 'ADD_MANUAL_AVAILABILITY_BLOCK'
  | 'REMOVE_AVAILABILITY_BLOCK'
  | 'MERGE_AVAILABILITY_BLOCKS'
  | 'ADD_SHOPPING_ITEM'
  | 'EDIT_SHOPPING_ITEM'
  | 'PURCHASE_SHOPPING_ITEM'
  | 'UNPURCHASE_SHOPPING_ITEM'
  | 'DELETE_SHOPPING_ITEM'
  | 'DELETE_PURCHASED_SHOPPING_ITEMS'
  | 'IMPORT_DATA_TRANSFER'
  | 'ADD_CYCLE_PERIOD'
  | 'EDIT_CYCLE_PERIOD'
  | 'DELETE_CYCLE_PERIOD'
  | 'SET_CYCLE_GAP_DECISION'
  | 'ADD_CYCLE_JOURNAL_ENTRY'
  | 'EDIT_CYCLE_JOURNAL_ENTRY'
  | 'DELETE_CYCLE_JOURNAL_ENTRY';

export type ChangeEntityType =
  | 'CALENDAR_EVENT'
  | 'MANUAL_SERIES'
  | 'DAY_CONSTRAINT'
  | 'STUDY_GROUPS'
  | 'STUDY_PLAN'
  | 'STUDY_CORRECTION'
  | 'APPLICATION_DATA'
  | 'WORK_PROFILE'
  | 'WORK_SCHEDULE'
  | 'DAY_PLANNING_PROFILE'
  | 'DAILY_ROUTINE_RULE'
  | 'DAY_ATTRIBUTE'
  | 'CONSISTENCY_ISSUE'
  | 'AVAILABILITY_PLAN'
  | 'SHOPPING_ITEM'
  | 'CYCLE_PERIOD'
  | 'CYCLE_JOURNAL_ENTRY';

export interface ChangeJournalEntry {
  id: string;
  timestamp: string;
  operationType: ChangeOperationType;
  entityType: ChangeEntityType;
  entityIds: string[];
  description: string;
  beforeState?: unknown;
  afterState?: unknown;
  reversible: boolean;
  undoneAt?: string;
  groupId?: string;
  restorePointId?: string;
  metadata?: Record<string, unknown>;
}

export type TrashEntityType = 'CALENDAR_EVENT' | 'MANUAL_SERIES' | 'DAY_CONSTRAINT';

export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  entityIds: string[];
  displayName: string;
  deletedAt: string;
  source?: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface DatabaseSnapshot {
  format: 'inteligentny-kalendarz-snapshot';
  snapshotVersion: 1;
  appVersion: string;
  databaseSchemaVersion: number;
  capturedAt: string;
  stores: Record<string, unknown[]>;
}

export type RestorePointReason =
  | 'MIGRATION'
  | 'MANUAL'
  | 'BEFORE_STUDY_IMPORT'
  | 'BEFORE_STUDY_UPDATE'
  | 'BEFORE_GROUP_RECALCULATION'
  | 'BEFORE_IMPORT_DELETE'
  | 'BEFORE_SERIES_BULK_CHANGE'
  | 'BEFORE_BACKUP_RESTORE'
  | 'BEFORE_RESTORE_POINT'
  | 'BEFORE_EMPTY_TRASH'
  | 'BEFORE_STUDY_CORRECTION'
  | 'FUTURE_AVAILABILITY_APPLY'
  | 'BEFORE_WORK_IMPORT'
  | 'BEFORE_WORK_UPDATE'
  | 'BEFORE_WORK_IMPORT_DELETE'
  | 'BEFORE_DATA_TRANSFER_IMPORT';

export interface RestorePoint {
  id: string;
  createdAt: string;
  label: string;
  reason: RestorePointReason;
  schemaVersion: number;
  appVersion: string;
  snapshot: DatabaseSnapshot;
  checksum?: string;
  integrityMarker?: string;
  sizeBytes?: number;
  automatic: boolean;
  pinned?: boolean;
}

export interface BackupDocument {
  format: 'inteligentny-kalendarz-backup';
  backupVersion: 1;
  appVersion: string;
  databaseSchemaVersion: number;
  createdAt: string;
  checksum: string;
  data: DatabaseSnapshot;
}

export interface BackupSummary {
  createdAt: string;
  appVersion: string;
  databaseSchemaVersion: number;
  events: number;
  locations: number;
  universityImports: number;
  trashItems: number;
  dayConstraints: number;
  studyPreviewProfiles: number;
  workProfiles: number;
  workScheduleImports: number;
  workScheduleEntries: number;
  workCoworkerShifts: number;
  dayPlanningProfiles: number;
  dailyRoutineRules: number;
  dayAttributes: number;
  consistencyAcknowledgements: number;
  availabilityPlans: number;
  shoppingItems: number;
  cyclePeriods: number;
  cycleJournalEntries: number;
}

export interface BackupInspection {
  document: BackupDocument;
  summary: BackupSummary;
}
