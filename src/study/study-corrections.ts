import { identifyCandidate } from './study-identity';
import type {
  PendingStudyCorrectionRule,
  StudyCorrectionConflict,
  StudyCorrectionField,
  StudyCorrectionRule,
  StudyScheduleCandidate,
} from './study.types';

function candidateValue(candidate: StudyScheduleCandidate, field: StudyCorrectionField): string | undefined {
  const value = candidate[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export interface ApplyCorrectionRulesResult {
  candidates: StudyScheduleCandidate[];
  conflicts: StudyCorrectionConflict[];
}

export function applyCorrectionRules(candidates: StudyScheduleCandidate[], rules: StudyCorrectionRule[]): ApplyCorrectionRulesResult {
  const active = rules.filter((rule) => rule.active);
  const conflicts: StudyCorrectionConflict[] = [];
  const updated = candidates.map((rawCandidate) => {
    let candidate = identifyCandidate(rawCandidate);
    const matching = active.filter((rule) => rule.seriesKey === candidate.seriesKey);
    for (const rule of matching) {
      const planValue = candidateValue(candidate, rule.field);
      if (planValue && planValue !== rule.value) {
        conflicts.push({
          seriesKey: rule.seriesKey,
          field: rule.field,
          savedValue: rule.value,
          planValue,
          candidateId: candidate.id,
        });
        continue;
      }
      if (!planValue) {
        candidate = { ...candidate, [rule.field]: rule.value, manuallyReviewed: true, manuallyModifiedFields: [...new Set([...(candidate.manuallyModifiedFields ?? []), rule.field])] };
        candidate.warnings = candidate.warnings.filter((warning) => {
          const text = warning.toLocaleLowerCase('pl-PL');
          if (rule.field === 'address' || rule.field === 'locationLabel') return !/adres|lokalizac/.test(text);
          if (rule.field === 'room') return !/sal/.test(text);
          if (rule.field === 'clinic') return !/klinik/.test(text);
          return true;
        });
      }
    }
    return candidate;
  });
  return { candidates: updated, conflicts };
}

export function pendingRulesForSeriesCorrection(
  before: StudyScheduleCandidate,
  after: StudyScheduleCandidate,
): PendingStudyCorrectionRule[] {
  const identified = identifyCandidate(after);
  if (!identified.seriesKey) return [];
  const fields: StudyCorrectionField[] = ['address', 'room', 'clinic', 'locationLabel'];
  return fields.flatMap((field) => {
    const oldValue = candidateValue(before, field);
    const newValue = candidateValue(after, field);
    if (!newValue || newValue === oldValue) return [];
    return [{ seriesKey: identified.seriesKey!, field, value: newValue }];
  });
}

export function applySafeSeriesCorrection(
  candidates: StudyScheduleCandidate[],
  source: StudyScheduleCandidate,
  corrected: StudyScheduleCandidate,
): StudyScheduleCandidate[] {
  const sourceIdentity = identifyCandidate(source);
  const correctedIdentity = identifyCandidate(corrected);
  const rules = pendingRulesForSeriesCorrection(sourceIdentity, correctedIdentity);
  if (!sourceIdentity.seriesKey || !rules.length) {
    return candidates.map((candidate) => candidate.id === corrected.id ? correctedIdentity : candidate);
  }
  return candidates.map((rawCandidate) => {
    const candidate = identifyCandidate(rawCandidate);
    if (candidate.seriesKey !== sourceIdentity.seriesKey) return candidate.id === corrected.id ? correctedIdentity : candidate;
    let next: StudyScheduleCandidate = { ...candidate };
    for (const rule of rules) {
      const existing = candidateValue(next, rule.field);
      if (candidate.id !== corrected.id && existing) continue;
      next = { ...next, [rule.field]: rule.value, manuallyReviewed: true, manuallyModifiedFields: [...new Set([...(next.manuallyModifiedFields ?? []), rule.field])] };
      next.warnings = next.warnings.filter((warning) => {
        const text = warning.toLocaleLowerCase('pl-PL');
        if (rule.field === 'address' || rule.field === 'locationLabel') return !/adres|lokalizac/.test(text);
        if (rule.field === 'room') return !/sal/.test(text);
        if (rule.field === 'clinic') return !/klinik/.test(text);
        return true;
      });
    }
    return next;
  });
}
