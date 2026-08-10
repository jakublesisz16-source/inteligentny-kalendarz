export const WORK_IMPORT_LIFECYCLE = ['ACTIVE', 'HISTORICAL', 'DELETED'] as const;
export type WorkImportLifecycle = (typeof WORK_IMPORT_LIFECYCLE)[number];

export const WORK_ENTRY_TYPES = ['SHIFT', 'NON_WORK', 'UNKNOWN'] as const;
export type WorkEntryType = (typeof WORK_ENTRY_TYPES)[number];

export const WORK_ENTRY_STATUSES = ['READY', 'REVIEW_REQUIRED', 'BLOCKING'] as const;
export type WorkEntryStatus = (typeof WORK_ENTRY_STATUSES)[number];

export interface WorkProfile {
  id: string;
  employeeMatchName: string;
  employerName: string;
  workplaceName: string;
  locationId?: string;
  storeCoworkerSchedule: boolean;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkScheduleImport {
  id: string;
  profileId: string;
  fileName: string;
  fileHash: string;
  importedAt: string;
  periodStart: string;
  periodEnd: string;
  adapterId: string;
  lifecycleStatus: WorkImportLifecycle;
  shiftCount: number;
  totalMinutes: number;
  sourceReportedMinutes?: number;
  warningCount: number;
  blockingCount: number;
  coworkerShiftCount: number;
}

export interface WorkScheduleEntry {
  id: string;
  importId: string;
  profileId: string;
  date: string;
  type: WorkEntryType;
  startTime?: string;
  endTime?: string;
  minutes?: number;
  rawCode?: string;
  status: WorkEntryStatus;
  issues: string[];
  sourcePage: number;
  sourceContext?: string;
  workOccurrenceKey?: string;
  eventId?: string;
  userDeleted?: boolean;
}

export interface WorkCoworkerShift {
  id: string;
  importId: string;
  date: string;
  displayName: string;
  normalizedName: string;
  startTime: string;
  endTime: string;
  minutes: number;
  sourcePage: number;
}

export interface WorkCoworkerShiftDraft extends Omit<WorkCoworkerShift, 'id' | 'importId'> {}

export interface ParsedWorkShift {
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  sourcePage: number;
  sourceContext?: string;
}

export interface ParsedEmployeeSchedule {
  displayName: string;
  normalizedName: string;
  shifts: ParsedWorkShift[];
  sourceReportedMinutes?: number;
  pages: number[];
}

export interface WorkParseDiagnostics {
  adapterId: string;
  pageCount: number;
  schedulePages: number[];
  detectedEmployeeCount: number;
  unknownCodes: string[];
  warnings: string[];
  matchReasons: string[];
}

export interface WorkScheduleParseResult {
  adapterId: string;
  periodStart: string;
  periodEnd: string;
  monthLabel: string;
  employees: ParsedEmployeeSchedule[];
  diagnostics: WorkParseDiagnostics;
}

export interface WorkImportCandidate {
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  sourcePage: number;
  sourceContext?: string;
  status: WorkEntryStatus;
  issues: string[];
  workOccurrenceKey: string;
}

export type WorkDiffKind = 'UNCHANGED' | 'ADDED_SHIFT' | 'REMOVED_SHIFT' | 'CHANGED_TIME' | 'CONFLICT_USER_MODIFIED' | 'CONFLICT_USER_DELETED';

export interface WorkScheduleDiffItem {
  id: string;
  kind: WorkDiffKind;
  oldEntry?: WorkScheduleEntry;
  newShift?: WorkImportCandidate;
  eventId?: string;
  apply: boolean;
}

export interface WorkScheduleDiffSummary {
  unchanged: number;
  added: number;
  removed: number;
  changed: number;
  conflicts: number;
}

export interface WorkScheduleDiff {
  items: WorkScheduleDiffItem[];
  summary: WorkScheduleDiffSummary;
}

export interface WorkCollision {
  candidate: WorkImportCandidate;
  eventId: string;
  eventTitle: string;
  kind: 'OVERLAP' | 'TOUCHING' | 'POTENTIAL_DUPLICATE';
  eventStart: string;
  eventEnd: string;
}

export interface CoworkerOverlap {
  displayName: string;
  coworkerStartTime: string;
  coworkerEndTime: string;
  overlapStartTime: string;
  overlapEndTime: string;
  overlapMinutes: number;
}

export interface ConfirmedWorkBlock {
  eventId: string;
  date: string;
  startDateTime: string;
  endDateTime: string;
  minutes: number;
  source: 'MANUAL' | 'WORK_PDF';
}

export interface WorkImportCommitInput {
  profileId: string;
  fileName: string;
  fileHash: string;
  adapterId: string;
  periodStart: string;
  periodEnd: string;
  sourceReportedMinutes?: number;
  shifts: WorkImportCandidate[];
  coworkerShifts: WorkCoworkerShiftDraft[];
  conflictDecision?: 'PRESERVE_USER' | 'USE_NEW';
}

export interface WorkImportCommitResult {
  workImport: WorkScheduleImport;
  createdEvents: number;
  updatedEvents: number;
  removedEvents: number;
  preservedUserChanges: number;
}
