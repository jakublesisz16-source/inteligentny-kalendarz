import { parseStudyGroupKey } from '../imports/xlsx/group-normalizer';
import type { SheetCellSnapshot, SheetSnapshot, WorkbookSnapshot } from '../imports/xlsx/xlsx.types';
import { reviewCandidate } from './import-review';
import type { ScheduleAnalysis, StudyHourAudit, StudyScheduleCandidate } from './study.types';
import { candidatesForSelectedGroups, findStudyScheduleConflicts, validateStudyGroupSelection } from './study.service';

export interface StudySourceConflictSignature {
  id: string;
  date: string;
  left: string;
  right: string;
  affectedProfileCount: number;
}

export interface StudySourceProfileAudit {
  profileCount: number;
  affectedProfileCount: number;
  uniqueConflictCount: number;
  conflicts: StudySourceConflictSignature[];
}

export interface StudySourceWeekdayMismatch {
  sheet: string;
  address: string;
  date: string;
  expectedWeekday: string;
  actualWeekday: string;
  headerAddress: string;
  headerText: string;
}

export interface StudySelectedProfileAudit {
  selectedGroups: string[];
  valid: boolean;
  validationErrors: string[];
  candidateCount: number;
  importableCount: number;
  readyCount: number;
  warningCount: number;
  incompleteCount: number;
  blockingCount: number;
  conflictCount: number;
  importableMonthCounts: Record<string, number>;
}

export interface StudySourceAuditReport {
  adapterId: string;
  candidateCount: number;
  readyCount: number;
  reviewRequiredCount: number;
  informationalCount: number;
  ignoredCount: number;
  groupCount: number;
  groupKinds: Record<'MAIN' | 'G12' | 'G8' | 'G4' | 'GENERIC', number>;
  sourceBlockCount: number;
  completenessSafe: boolean;
  incompleteSourceBlockCount: number;
  hourAnomalies: StudyHourAudit[];
  profileAudit: StudySourceProfileAudit;
  weekdayMismatches: StudySourceWeekdayMismatch[];
  unparsedAssignmentCellCount: number;
  unappliedDateExceptionCount: number;
}

const WEEKDAY_NAMES = ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'] as const;
const WEEKDAY_HEADER_PATTERNS: Array<{ label: string; day: number; pattern: RegExp }> = [
  { label: 'PONIEDZIAŁEK', day: 1, pattern: /\bponiedzial(?:ek|ki)\b/u },
  { label: 'WTOREK', day: 2, pattern: /\b(?:wtorek|wtorki)\b/u },
  { label: 'ŚRODA', day: 3, pattern: /\b(?:sroda|srody)\b/u },
  { label: 'CZWARTEK', day: 4, pattern: /\b(?:czwartek|czwartki)\b/u },
  { label: 'PIĄTEK', day: 5, pattern: /\b(?:piatek|piatki)\b/u },
  { label: 'SOBOTA', day: 6, pattern: /\b(?:sobota|soboty)\b/u },
  { label: 'NIEDZIELA', day: 0, pattern: /\b(?:niedziela|niedziele)\b/u },
];

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/[Łł]/gu, 'l').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function candidateLabel(candidate: StudyScheduleCandidate): string {
  return `${candidate.subject} ${candidate.startTime ?? '?'}-${candidate.endTime ?? '?'}`;
}

function conflictKey(date: string, left: StudyScheduleCandidate, right: StudyScheduleCandidate): { key: string; left: string; right: string } {
  const pair = [candidateLabel(left), candidateLabel(right)].sort((a, b) => a.localeCompare(b, 'pl'));
  return { key: `${date}|${pair[0]}|${pair[1]}`, left: pair[0]!, right: pair[1]! };
}

function structuredProfileSelections(groups: string[]): string[][] {
  const parsed = groups.map((value) => ({ value, parsed: parseStudyGroupKey(value) })).filter((entry) => entry.parsed.encoded && entry.parsed.number);
  const mainNumbers = [...new Set(parsed.filter((entry) => entry.parsed.kind === 'MAIN').map((entry) => entry.parsed.number!))].sort((a, b) => a - b);
  const profiles: string[][] = [];

  for (const number of mainNumbers) {
    const main = parsed.find((entry) => entry.parsed.kind === 'MAIN' && entry.parsed.number === number)?.value;
    if (!main) continue;
    const g12 = parsed.filter((entry) => entry.parsed.kind === 'G12' && entry.parsed.number === number).map((entry) => entry.value);
    const g8 = parsed.filter((entry) => entry.parsed.kind === 'G8' && entry.parsed.number === number).map((entry) => entry.value);
    const g4 = parsed.filter((entry) => entry.parsed.kind === 'G4' && entry.parsed.number === number).map((entry) => entry.value);
    const firstPartition = g12.length ? g12 : [undefined];
    const secondPartition = g4.length ? g4 : g8.length ? g8 : [undefined];

    for (const first of firstPartition) {
      for (const second of secondPartition) {
        const selection = [main, first, second].filter((value): value is string => Boolean(value));
        if (validateStudyGroupSelection(groups, selection).valid) profiles.push(selection);
      }
    }
  }

  return profiles;
}

export function auditSelectedStudyProfile(analysis: ScheduleAnalysis, selectedGroups: string[]): StudySelectedProfileAudit {
  const validation = validateStudyGroupSelection(analysis.groups, selectedGroups);
  if (!validation.valid) {
    return {
      selectedGroups: [...selectedGroups],
      valid: false,
      validationErrors: [...validation.errors],
      candidateCount: 0,
      importableCount: 0,
      readyCount: 0,
      warningCount: 0,
      incompleteCount: 0,
      blockingCount: 0,
      conflictCount: 0,
      importableMonthCounts: {},
    };
  }

  const candidates = candidatesForSelectedGroups(analysis, selectedGroups);
  const states = { READY: 0, WARNING: 0, INCOMPLETE: 0, BLOCKING: 0 };
  const importable: StudyScheduleCandidate[] = [];
  const importableMonthCounts: Record<string, number> = {};
  for (const candidate of candidates) {
    const review = reviewCandidate(candidate);
    if (review.state in states) states[review.state as keyof typeof states] += 1;
    if (!review.canImport) continue;
    importable.push(candidate);
    if (candidate.date && /^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) {
      const month = candidate.date.slice(0, 7);
      importableMonthCounts[month] = (importableMonthCounts[month] ?? 0) + 1;
    }
  }

  return {
    selectedGroups: [...selectedGroups],
    valid: true,
    validationErrors: [],
    candidateCount: candidates.length,
    importableCount: importable.length,
    readyCount: states.READY,
    warningCount: states.WARNING,
    incompleteCount: states.INCOMPLETE,
    blockingCount: states.BLOCKING,
    conflictCount: findStudyScheduleConflicts(importable).length,
    importableMonthCounts,
  };
}

export function auditStudyProfiles(analysis: ScheduleAnalysis): StudySourceProfileAudit {
  const profiles = structuredProfileSelections(analysis.groups);
  const conflictProfiles = new Map<string, { date: string; left: string; right: string; profiles: Set<number> }>();
  let affectedProfileCount = 0;

  profiles.forEach((selection, profileIndex) => {
    const conflicts = findStudyScheduleConflicts(candidatesForSelectedGroups(analysis, selection));
    if (conflicts.length) affectedProfileCount += 1;
    for (const conflict of conflicts) {
      const normalized = conflictKey(conflict.date, conflict.left, conflict.right);
      const existing = conflictProfiles.get(normalized.key);
      if (existing) existing.profiles.add(profileIndex);
      else conflictProfiles.set(normalized.key, {
        date: conflict.date,
        left: normalized.left,
        right: normalized.right,
        profiles: new Set([profileIndex]),
      });
    }
  });

  const conflicts = [...conflictProfiles.entries()].map(([id, entry]) => ({
    id,
    date: entry.date,
    left: entry.left,
    right: entry.right,
    affectedProfileCount: entry.profiles.size,
  })).sort((a, b) => `${a.date}|${a.left}|${a.right}`.localeCompare(`${b.date}|${b.left}|${b.right}`, 'pl'));

  return { profileCount: profiles.length, affectedProfileCount, uniqueConflictCount: conflicts.length, conflicts };
}

function academicYears(value: string | undefined): { start: number; end: number } | null {
  const match = /\b(20\d{2})\s*\/\s*(20\d{2})\b/u.exec(value ?? '');
  if (!match?.[1] || !match[2]) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function dateFromCell(cell: SheetCellSnapshot, years: { start: number; end: number } | null): string | null {
  const match = /^\s*(\d{1,2})\.(\d{1,2})\.(?:(20\d{2}))?\s*$/u.exec(cell.value);
  if (!match?.[1] || !match[2]) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const explicitYear = match[3] ? Number(match[3]) : undefined;
  const year = explicitYear ?? (years ? (month >= 7 ? years.start : years.end) : undefined);
  if (!year) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function headerWeekday(text: string): { label: string; day: number } | null {
  const normalized = fold(text);
  for (const candidate of WEEKDAY_HEADER_PATTERNS) if (candidate.pattern.test(normalized)) return { label: candidate.label, day: candidate.day };
  return null;
}

function cellCoversColumn(sheet: SheetSnapshot, cell: SheetCellSnapshot, column: number): boolean {
  if (cell.col === column) return true;
  return sheet.merges.some((merge) => cell.row === merge.startRow && cell.col === merge.startCol && column >= merge.startCol && column <= merge.endCol);
}

function nearestWeekdayHeader(sheet: SheetSnapshot, cell: SheetCellSnapshot): { cell: SheetCellSnapshot; label: string; day: number } | null {
  const candidates = sheet.cells
    .filter((entry) => entry.row < cell.row && entry.row >= Math.max(sheet.minRow, cell.row - 20) && cellCoversColumn(sheet, entry, cell.col))
    .map((entry) => ({ entry, weekday: headerWeekday(entry.value) }))
    .filter((entry): entry is { entry: SheetCellSnapshot; weekday: { label: string; day: number } } => Boolean(entry.weekday))
    .sort((a, b) => b.entry.row - a.entry.row);
  const nearest = candidates[0];
  return nearest ? { cell: nearest.entry, ...nearest.weekday } : null;
}

export function findStudySourceWeekdayMismatches(workbook: WorkbookSnapshot, detectedAcademicYear?: string): StudySourceWeekdayMismatch[] {
  const years = academicYears(detectedAcademicYear);
  const result: StudySourceWeekdayMismatch[] = [];
  for (const sheet of workbook.sheets) {
    for (const cell of sheet.cells) {
      const date = dateFromCell(cell, years);
      if (!date) continue;
      const header = nearestWeekdayHeader(sheet, cell);
      if (!header) continue;
      const [year, month, day] = date.split('-').map(Number);
      const actualDay = new Date(year!, month! - 1, day!, 12, 0, 0, 0).getDay();
      if (actualDay === header.day) continue;
      result.push({
        sheet: sheet.name,
        address: cell.address,
        date,
        expectedWeekday: header.label,
        actualWeekday: WEEKDAY_NAMES[actualDay]!,
        headerAddress: header.cell.address,
        headerText: header.cell.value,
      });
    }
  }
  return result.sort((a, b) => `${a.sheet}|${a.address}`.localeCompare(`${b.sheet}|${b.address}`, 'pl'));
}

export function buildStudySourceAudit(analysis: ScheduleAnalysis, workbook?: WorkbookSnapshot): StudySourceAuditReport {
  const statusCounts = { READY: 0, REVIEW_REQUIRED: 0, INFORMATIONAL: 0, IGNORED: 0 };
  for (const candidate of analysis.candidates) statusCounts[candidate.status] += 1;
  const groupKinds: StudySourceAuditReport['groupKinds'] = { MAIN: 0, G12: 0, G8: 0, G4: 0, GENERIC: 0 };
  for (const group of analysis.groups) groupKinds[parseStudyGroupKey(group).kind] += 1;
  const hourAnomalies = (analysis.completeness?.hourAudits ?? []).filter((audit) => ['SOURCE_INCONSISTENT', 'MISMATCH', 'OVERFLOW'].includes(audit.status));

  return {
    adapterId: analysis.adapterId,
    candidateCount: analysis.candidates.length,
    readyCount: statusCounts.READY,
    reviewRequiredCount: statusCounts.REVIEW_REQUIRED,
    informationalCount: statusCounts.INFORMATIONAL,
    ignoredCount: statusCounts.IGNORED,
    groupCount: analysis.groups.length,
    groupKinds,
    sourceBlockCount: analysis.sourceBlocks?.length ?? 0,
    completenessSafe: analysis.completeness?.safe ?? true,
    incompleteSourceBlockCount: analysis.completeness?.incompleteSourceBlockCount ?? 0,
    hourAnomalies,
    profileAudit: auditStudyProfiles(analysis),
    weekdayMismatches: workbook ? findStudySourceWeekdayMismatches(workbook, analysis.detectedAcademicYear) : [],
    unparsedAssignmentCellCount: analysis.diagnostics?.unparsedAssignmentCellCount ?? 0,
    unappliedDateExceptionCount: analysis.diagnostics?.unappliedDateExceptionCount ?? 0,
  };
}
