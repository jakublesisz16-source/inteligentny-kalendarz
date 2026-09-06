import type { StudyScheduleCandidate } from '../../study/study.types';

export interface CandidateValidationResult {
  valid: boolean;
  errors: string[];
}

export function isValidStudyDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function studyTimeMinutes(value: string | undefined): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour! < 0 || hour! > 23 || minute! < 0 || minute! > 59) return null;
  return hour! * 60 + minute!;
}

export function isValidStudyTime(value: string | undefined): value is string {
  return studyTimeMinutes(value) !== null;
}

export function hasValidStudyTimeRange(startTime: string | undefined, endTime: string | undefined): boolean {
  const start = studyTimeMinutes(startTime);
  const end = studyTimeMinutes(endTime);
  return start !== null && end !== null && end > start;
}

export function validateCandidateForImport(candidate: StudyScheduleCandidate): CandidateValidationResult {
  const errors: string[] = [];
  if (!candidate.subject.trim()) errors.push('Uzupełnij przedmiot.');
  if (!isValidStudyDate(candidate.date)) errors.push('Uzupełnij poprawną datę.');
  if (!isValidStudyTime(candidate.startTime)) errors.push('Uzupełnij godzinę rozpoczęcia.');
  if (!isValidStudyTime(candidate.endTime)) errors.push('Uzupełnij godzinę zakończenia.');
  if (isValidStudyTime(candidate.startTime) && isValidStudyTime(candidate.endTime) && !hasValidStudyTimeRange(candidate.startTime, candidate.endTime)) {
    errors.push('Godzina zakończenia musi być późniejsza od rozpoczęcia.');
  }
  return { valid: errors.length === 0, errors };
}
