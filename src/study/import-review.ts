import { hasValidStudyTimeRange, isValidStudyDate, isValidStudyTime } from '../imports/xlsx/import-validation';
import type { StudyScheduleCandidate } from './study.types';

export type ImportIssueSeverity = 'WARNING' | 'INCOMPLETE' | 'BLOCKING';
export type ImportReviewState = 'READY' | 'WARNING' | 'INCOMPLETE' | 'BLOCKING' | 'IGNORED';

export type ImportIssueCode =
  | 'MISSING_ADDRESS'
  | 'MISSING_ROOM'
  | 'MISSING_BUILDING'
  | 'MISSING_CLINIC'
  | 'AMBIGUOUS_LOCATION'
  | 'INCOMPLETE_LOCATION'
  | 'MISSING_DATE'
  | 'AMBIGUOUS_DATE'
  | 'MISSING_START_TIME'
  | 'MISSING_END_TIME'
  | 'INVALID_START_TIME'
  | 'INVALID_END_TIME'
  | 'INVALID_TIME_RANGE'
  | 'MISSING_SUBJECT'
  | 'OTHER_WARNING';

export interface ImportIssue {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  label: string;
  source?: string;
}

export interface CandidateReview {
  state: ImportReviewState;
  issues: ImportIssue[];
  canImport: boolean;
}

const ISSUE_LABELS: Record<ImportIssueCode, string> = {
  MISSING_ADDRESS: 'Brak dokładnego adresu.',
  MISSING_ROOM: 'Brak numeru sali.',
  MISSING_BUILDING: 'Nie udało się ustalić budynku.',
  MISSING_CLINIC: 'Nie udało się jednoznacznie ustalić kliniki.',
  AMBIGUOUS_LOCATION: 'Nie udało się jednoznacznie ustalić lokalizacji.',
  INCOMPLETE_LOCATION: 'Lokalizacja jest niepełna.',
  MISSING_DATE: 'Brak poprawnej daty zajęć.',
  AMBIGUOUS_DATE: 'Data zajęć wymaga ręcznego potwierdzenia.',
  MISSING_START_TIME: 'Brak godziny rozpoczęcia.',
  MISSING_END_TIME: 'Brak godziny zakończenia.',
  INVALID_START_TIME: 'Godzina rozpoczęcia ma nieprawidłowy format.',
  INVALID_END_TIME: 'Godzina zakończenia ma nieprawidłowy format.',
  INVALID_TIME_RANGE: 'Godzina zakończenia musi być późniejsza od rozpoczęcia.',
  MISSING_SUBJECT: 'Brak nazwy przedmiotu.',
  OTHER_WARNING: 'Wpis zawiera informację wymagającą sprawdzenia.',
};

export function importIssueLabel(code: string): string {
  return ISSUE_LABELS[code as ImportIssueCode] ?? 'Wpis wymaga sprawdzenia.';
}

const WARNING_CODES = new Set<ImportIssueCode>([
  'MISSING_ADDRESS',
  'MISSING_ROOM',
  'MISSING_BUILDING',
  'MISSING_CLINIC',
  'AMBIGUOUS_LOCATION',
  'INCOMPLETE_LOCATION',
  'OTHER_WARNING',
]);

const INCOMPLETE_CODES = new Set<ImportIssueCode>([
  'MISSING_START_TIME',
  'MISSING_END_TIME',
]);

function issue(code: ImportIssueCode, source?: string): ImportIssue {
  return {
    code,
    severity: WARNING_CODES.has(code) ? 'WARNING' : INCOMPLETE_CODES.has(code) ? 'INCOMPLETE' : 'BLOCKING',
    label: ISSUE_LABELS[code],
    ...(source ? { source } : {}),
  };
}

function normalized(text: string): string {
  return text.toLocaleLowerCase('pl-PL').replace(/\s+/g, ' ').trim();
}

function codeForParserWarning(warning: string): ImportIssueCode {
  const text = normalized(warning);

  if (text.includes('lokalizac')) return 'AMBIGUOUS_LOCATION';
  if (text.includes('adres')) return 'MISSING_ADDRESS';
  if (text.includes('sali') || text.includes('sala')) return 'MISSING_ROOM';
  if (text.includes('budyn')) return 'MISSING_BUILDING';
  if (text.includes('klinik')) return 'MISSING_CLINIC';

  if (text.includes('nie znaleziono daty') || text.includes('nie rozpoznano daty')) return 'MISSING_DATE';
  if (text.includes('data') || text.includes('daty') || text.includes('dniowi tygodnia') || text.includes('roku akademickiego')) return 'AMBIGUOUS_DATE';

  if (text.includes('czasu') || text.includes('godzin')) {
    return 'OTHER_WARNING';
  }
  if (text.includes('przedmiot')) return 'MISSING_SUBJECT';

  return 'OTHER_WARNING';
}

function addUnique(target: ImportIssue[], next: ImportIssue): void {
  if (target.some((entry) => entry.code === next.code && entry.source === next.source)) return;
  target.push(next);
}


export function classifyCandidateIssues(candidate: StudyScheduleCandidate): ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (!candidate.subject.trim()) addUnique(issues, issue('MISSING_SUBJECT'));
  const hasSourceWeek = Boolean(candidate.sourceWeekStart && candidate.sourceWeekEnd);
  if (!isValidStudyDate(candidate.date)) {
    addUnique(issues, hasSourceWeek
      ? { code: 'MISSING_DATE', severity: 'INCOMPLETE', label: 'Plan przypisuje zajęcia do tygodnia, ale nie podaje jednoznacznego dnia.' }
      : issue('MISSING_DATE'));
  }
  if (!candidate.startTime) addUnique(issues, issue('MISSING_START_TIME'));
  else if (!isValidStudyTime(candidate.startTime)) addUnique(issues, issue('INVALID_START_TIME'));
  if (!candidate.endTime) addUnique(issues, issue('MISSING_END_TIME'));
  else if (!isValidStudyTime(candidate.endTime)) addUnique(issues, issue('INVALID_END_TIME'));
  if (isValidStudyTime(candidate.startTime) && isValidStudyTime(candidate.endTime) && !hasValidStudyTimeRange(candidate.startTime, candidate.endTime)) {
    addUnique(issues, issue('INVALID_TIME_RANGE'));
  }

  for (const warning of candidate.warnings) {
    const code = codeForParserWarning(warning);

    // Parser warnings about fields that have already been corrected manually should not keep blocking the entry.
    if (code === 'MISSING_SUBJECT' && candidate.subject.trim()) continue;
    if ((code === 'MISSING_DATE' || code === 'AMBIGUOUS_DATE') && candidate.manuallyReviewed && isValidStudyDate(candidate.date)) continue;
    if (code === 'MISSING_DATE' && hasSourceWeek) {
      addUnique(issues, { code, severity: 'INCOMPLETE', label: 'Plan przypisuje zajęcia do tygodnia, ale nie podaje jednoznacznego dnia.', source: warning });
      continue;
    }
    if (code === 'AMBIGUOUS_LOCATION' && candidate.manuallyReviewed && Boolean(candidate.address || candidate.locationLabel)) continue;

    // A generic time warning becomes obsolete after the user supplies a valid full range.
    if (code === 'OTHER_WARNING' && /czas|godzin/i.test(warning) && candidate.manuallyReviewed && isValidStudyTime(candidate.startTime) && isValidStudyTime(candidate.endTime)) continue;

    addUnique(issues, issue(code, warning));
  }

  // In this adapter lack of any usable location was the main reason for REVIEW_REQUIRED.
  // It is useful to import the class anyway, but the UI must clearly expose the missing data.
  if (!candidate.address && !candidate.locationLabel) {
    addUnique(issues, issue('MISSING_ADDRESS'));
  }

  return issues;
}

export function reviewCandidate(candidate: StudyScheduleCandidate): CandidateReview {
  if (candidate.status === 'IGNORED' || candidate.status === 'INFORMATIONAL') {
    return { state: 'IGNORED', issues: [], canImport: false };
  }

  const issues = classifyCandidateIssues(candidate);
  if (issues.some((entry) => entry.severity === 'BLOCKING')) {
    return { state: 'BLOCKING', issues, canImport: false };
  }
  if (issues.some((entry) => entry.severity === 'INCOMPLETE')) {
    return { state: 'INCOMPLETE', issues, canImport: false };
  }
  if (issues.length) {
    return { state: 'WARNING', issues, canImport: true };
  }
  return { state: 'READY', issues: [], canImport: true };
}

export function defaultIncludeForCandidate(candidate: StudyScheduleCandidate): boolean {
  return reviewCandidate(candidate).canImport;
}

export function toggleCandidateSelection(candidate: StudyScheduleCandidate): StudyScheduleCandidate {
  const review = reviewCandidate(candidate);
  if (!review.canImport) return { ...candidate, include: false };
  return { ...candidate, include: !Boolean(candidate.include) };
}

export function selectAllImportable(candidates: StudyScheduleCandidate[]): StudyScheduleCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, include: reviewCandidate(candidate).canImport }));
}

export function deselectAllCandidates(candidates: StudyScheduleCandidate[]): StudyScheduleCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, include: false }));
}

export function applyManualCorrection(candidate: StudyScheduleCandidate): StudyScheduleCandidate {
  const corrected: StudyScheduleCandidate = { ...candidate, manuallyReviewed: true };
  const review = reviewCandidate(corrected);
  return { ...corrected, include: review.canImport };
}
