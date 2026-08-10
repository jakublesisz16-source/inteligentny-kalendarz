export type StudyGroupScope = 'ALL' | 'SPECIFIC' | 'UNKNOWN';
export type StudyCandidateStatus = 'READY' | 'REVIEW_REQUIRED' | 'INFORMATIONAL' | 'IGNORED';
export type UniversityImportStatus = 'COMPLETED';
export type UniversityImportLifecycleStatus = 'ACTIVE' | 'HISTORICAL';

export interface ParsedStudyLocation {
  room?: string;
  address?: string;
  label?: string;
}

export type StudyCandidateManualField = 'subject' | 'date' | 'startTime' | 'endTime' | 'room' | 'address' | 'clinic' | 'locationLabel';

export interface StudyScheduleCandidate {
  id: string;
  adapterId: string;
  sourceSheet: string;
  sourceRange: string;
  sourceKey: string;
  originalText: string;
  subject: string;
  activityType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  groupScope: StudyGroupScope;
  groupTags: string[];
  originalGroupText?: string;
  clinic?: string;
  room?: string;
  address?: string;
  locationLabel?: string;
  status: StudyCandidateStatus;
  warnings: string[];
  include?: boolean;
  manuallyReviewed?: boolean;
  manuallyModifiedFields?: StudyCandidateManualField[];
  occurrenceKey?: string;
  seriesKey?: string;
}

export interface ScheduleInformation {
  id: string;
  sheet: string;
  title: string;
  message: string;
}

export interface ScheduleDiagnostics {
  matchedSheet?: string;
  adapterReasons?: string[];
  detectedDays?: string[];
  timeGridCount?: number;
  timeGridIntervals?: number[];
  usedRanges?: string[];
  hiddenRowCount?: number;
  hiddenColumnCount?: number;
  unresolvedPatterns?: string[];
}

export interface ScheduleAnalysis {
  adapterId: string;
  sheetNames: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  groups: string[];
  candidates: StudyScheduleCandidate[];
  information: ScheduleInformation[];
  warnings: string[];
  diagnostics?: ScheduleDiagnostics;
}

export interface UniversityScheduleImport {
  id: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  importedAt: string;
  adapterId: string;
  sheetNames: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  selectedGroups: string[];
  availableGroups?: string[];
  importedEventCount: number;
  warningCount: number;
  status: UniversityImportStatus;
  lifecycleStatus?: UniversityImportLifecycleStatus;
  sourceDataComplete?: boolean;
  replacedImportId?: string;
}

export interface UniversityImportEntry {
  id: string;
  importId: string;
  adapterId?: string;
  sourceKey: string;
  eventId?: string;
  sourceOnly?: boolean;
  sourceSheet: string;
  sourceRange: string;
  originalText: string;
  subject: string;
  activityType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  groupScope?: StudyGroupScope;
  groupTags: string[];
  clinic?: string;
  room?: string;
  address?: string;
  locationLabel?: string;
  warnings: string[];
  occurrenceKey?: string;
  seriesKey?: string;
  userDeleted?: boolean;
}

export interface StudyProfile {
  id: 'university';
  selectedGroups: string[];
  availableGroups?: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  studyName?: string;
  activeImportId?: string;
  sourceDataComplete?: boolean;
  lastPlanUpdatedAt?: string;
  updatedAt: string;
}

export interface CommitUniversityImportInput {
  fileName: string;
  fileSize: number;
  fileHash: string;
  adapterId: string;
  sheetNames: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  selectedGroups: string[];
  availableGroups?: string[];
  candidates: StudyScheduleCandidate[];
  allCandidates?: StudyScheduleCandidate[];
  pendingCorrectionRules?: PendingStudyCorrectionRule[];
}

export interface CommitUniversityImportResult {
  importRecord: UniversityScheduleImport;
  eventCount: number;
  newLocationCount: number;
}

export type StudyCorrectionField = 'address' | 'room' | 'clinic' | 'locationLabel';

export interface StudyCorrectionRule {
  id: string;
  seriesKey: string;
  field: StudyCorrectionField;
  value: string;
  createdAt: string;
  updatedAt: string;
  source: 'USER_SERIES_CORRECTION';
  active: boolean;
}

export interface PendingStudyCorrectionRule {
  seriesKey: string;
  field: StudyCorrectionField;
  value: string;
}

export type ScheduleDiffKind = 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'CHANGED' | 'CONFLICT_USER_MODIFIED' | 'AMBIGUOUS';
export type ScheduleDiffChangeType =
  | 'CHANGED_TIME'
  | 'CHANGED_DATE'
  | 'CHANGED_LOCATION'
  | 'CHANGED_GROUP'
  | 'CHANGED_DETAILS';

export interface ScheduleDiffFieldChange {
  field: 'subject' | 'activityType' | 'date' | 'startTime' | 'endTime' | 'groupTags' | 'clinic' | 'room' | 'address' | 'locationLabel';
  label: string;
  before?: string;
  after?: string;
  changeType: ScheduleDiffChangeType;
}

export type ScheduleDiffResolution = 'APPLY' | 'KEEP_USER' | 'USE_NEW' | 'SKIP';

export interface ScheduleDiffItem {
  id: string;
  kind: ScheduleDiffKind;
  changeTypes: ScheduleDiffChangeType[];
  changes: ScheduleDiffFieldChange[];
  oldEntry?: UniversityImportEntry;
  newCandidate?: StudyScheduleCandidate;
  oldEventId?: string;
  oldEventUserModified?: boolean;
  oldEventUserModifiedFields?: string[];
  correctionConflictFields?: StudyCorrectionField[];
  resolution: ScheduleDiffResolution;
  note?: string;
}

export interface ScheduleDiffSummary {
  added: number;
  removed: number;
  changed: number;
  conflicts: number;
  unchanged: number;
  ambiguous: number;
}

export interface ScheduleUpdatePreview {
  id: string;
  baseImport: UniversityScheduleImport;
  fileName: string;
  fileSize: number;
  fileHash: string;
  adapterId: string;
  sheetNames: string[];
  detectedAcademicYear?: string;
  detectedTerm?: string;
  selectedGroups: string[];
  availableGroups: string[];
  candidates: StudyScheduleCandidate[];
  allCandidates: StudyScheduleCandidate[];
  items: ScheduleDiffItem[];
  summary: ScheduleDiffSummary;
  correctionConflicts: StudyCorrectionConflict[];
  createdAt: string;
}

export interface StudyCorrectionConflict {
  seriesKey: string;
  field: StudyCorrectionField;
  savedValue: string;
  planValue: string;
  candidateId: string;
}

export interface ScheduleUpdateSession {
  id: string;
  baseImportId: string;
  newFileHash: string;
  newFileName: string;
  createdAt: string;
  appliedAt?: string;
  cancelledAt?: string;
  status: 'PREVIEW' | 'APPLIED' | 'CANCELLED';
  summary: ScheduleDiffSummary;
}

export interface ApplyScheduleUpdateResult {
  importRecord: UniversityScheduleImport;
  added: number;
  changed: number;
  removed: number;
  keptUserModified: number;
  resolvedConflicts: number;
}

export interface GroupRecalculationPreview {
  selectedGroups: string[];
  currentGroups: string[];
  canRecalculate: boolean;
  requiresReupload: boolean;
  reason?: string;
  addedEntryIds: string[];
  removedEntryIds: string[];
  addedCandidates?: StudyScheduleCandidate[];
  removedEventIds?: string[];
  protectedRemovedEventIds?: string[];
  unchangedEventCount: number;
}

export interface StudyPreviewProfile {
  id: string;
  name: string;
  selectedGroups: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyGroupPreview {
  activeImportId: string;
  sourceFileName: string;
  selectedGroups: string[];
  availableGroups: string[];
  candidates: StudyScheduleCandidate[];
  sourceDataComplete: boolean;
  requiresReupload: boolean;
  reason?: string;
}
