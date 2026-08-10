import { groupSetsIntersect } from '../imports/xlsx/group-normalizer';
import type { ScheduleAnalysis, StudyScheduleCandidate } from './study.types';

export async function hashFile(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function candidatesForSelectedGroups(analysis: ScheduleAnalysis, selectedGroups: string[]): StudyScheduleCandidate[] {
  const matching = analysis.candidates.filter((candidate) => {
    if (candidate.groupScope === 'ALL' || candidate.groupScope === 'UNKNOWN') return true;
    return groupSetsIntersect(candidate.groupTags, selectedGroups);
  });

  const deduped = new Map<string, StudyScheduleCandidate>();
  for (const candidate of matching) {
    const signature = [candidate.date, candidate.startTime, candidate.endTime, candidate.subject.toLowerCase(), candidate.address ?? candidate.locationLabel ?? '', candidate.clinic ?? '', candidate.room ?? ''].join('|');
    const existing = deduped.get(signature);
    if (!existing) {
      deduped.set(signature, { ...candidate, groupTags: [...candidate.groupTags], warnings: [...candidate.warnings] });
      continue;
    }
    existing.groupTags = [...new Set([...existing.groupTags, ...candidate.groupTags])];
    existing.warnings = [...new Set([...existing.warnings, ...candidate.warnings])];
    existing.sourceRange = `${existing.sourceRange}, ${candidate.sourceRange}`;
    existing.originalText = `${existing.originalText} || ${candidate.originalText}`;
    existing.sourceKey = `${existing.sourceKey}||${candidate.sourceKey}`;
  }
  return [...deduped.values()].sort((a, b) => `${a.date ?? ''}${a.startTime ?? ''}${a.subject}`.localeCompare(`${b.date ?? ''}${b.startTime ?? ''}${b.subject}`, 'pl'));
}
