import type { StudyScheduleCandidate } from '../../study/study.types';

export interface CandidateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCandidateForImport(candidate: StudyScheduleCandidate): CandidateValidationResult {
  const errors: string[] = [];
  if (!candidate.subject.trim()) errors.push('Uzupełnij przedmiot.');
  if (!candidate.date || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)) errors.push('Uzupełnij poprawną datę.');
  if (!candidate.startTime || !/^\d{2}:\d{2}$/.test(candidate.startTime)) errors.push('Uzupełnij godzinę rozpoczęcia.');
  if (!candidate.endTime || !/^\d{2}:\d{2}$/.test(candidate.endTime)) errors.push('Uzupełnij godzinę zakończenia.');
  if (candidate.startTime && candidate.endTime && candidate.startTime >= candidate.endTime) errors.push('Godzina zakończenia musi być późniejsza od rozpoczęcia.');
  return { valid: errors.length === 0, errors };
}
