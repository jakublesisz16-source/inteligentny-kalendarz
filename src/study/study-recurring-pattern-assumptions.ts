import { foldPolishText } from '../imports/xlsx/parser-normalization';
import type { ScheduleAnalysis, StudyCandidateInferredField, StudyScheduleCandidate } from './study.types';

const MIN_PATTERN_SUPPORT = 2;
const MISSING_TIME_WARNING = /(?:pełnego zakresu godzin|pełnych godzin|nie podaje jednoznacznego.*godzin)/iu;
const MISSING_LOCATION_WARNING = /nie udało się jednoznacznie ustalić lokalizacji/iu;

export interface StudyRecurringPatternSummary {
  inferredCandidateCount: number;
  inferredTimeCandidateCount: number;
  inferredLocationCandidateCount: number;
  inferredFieldCount: number;
}

function normalized(value: string | undefined): string {
  return foldPolishText(value ?? '').replace(/\s+/gu, ' ').trim();
}

function patternKey(candidate: StudyScheduleCandidate): string {
  return [
    normalized(candidate.subject),
    normalized(candidate.activityType),
    [...candidate.groupTags].map((group) => group.trim().toUpperCase()).sort((a, b) => a.localeCompare(b, 'pl')).join('+'),
  ].join('|');
}

function timePair(candidate: StudyScheduleCandidate): string | null {
  return candidate.startTime && candidate.endTime ? `${candidate.startTime}|${candidate.endTime}` : null;
}

function usableLocation(candidate: StudyScheduleCandidate): boolean {
  return Boolean(candidate.address || candidate.locationLabel);
}

function locationSignature(candidate: StudyScheduleCandidate): string | null {
  if (!usableLocation(candidate)) return null;
  return [
    normalized(candidate.clinic),
    normalized(candidate.address),
    normalized(candidate.locationLabel),
    normalized(candidate.room),
  ].join('|');
}

function uniqueSupportedValue(values: Array<string | null>): { value: string; support: number } | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size !== 1) return null;
  const [entry] = counts.entries();
  if (!entry || entry[1] < MIN_PATTERN_SUPPORT) return null;
  return { value: entry[0], support: entry[1] };
}

function locationCompatible(target: StudyScheduleCandidate, peer: StudyScheduleCandidate): boolean {
  if (target.clinic && peer.clinic && normalized(target.clinic) !== normalized(peer.clinic)) return false;
  if (target.address && peer.address && normalized(target.address) !== normalized(peer.address)) return false;
  if (target.locationLabel && peer.locationLabel && normalized(target.locationLabel) !== normalized(peer.locationLabel)) return false;
  if (target.room && peer.room && normalized(target.room) !== normalized(peer.room)) return false;
  return true;
}

function removeResolvedWarnings(candidate: StudyScheduleCandidate): string[] {
  return candidate.warnings.filter((warning) => {
    if (candidate.startTime && candidate.endTime && MISSING_TIME_WARNING.test(warning)) return false;
    if (usableLocation(candidate) && MISSING_LOCATION_WARNING.test(warning)) return false;
    return true;
  });
}

function updateOperationalState(candidate: StudyScheduleCandidate): StudyScheduleCandidate {
  if (candidate.status === 'IGNORED' || candidate.status === 'INFORMATIONAL') return candidate;
  const warnings = removeResolvedWarnings(candidate);
  const complete = Boolean(candidate.subject.trim() && candidate.date && candidate.startTime && candidate.endTime);
  return {
    ...candidate,
    warnings,
    status: complete && warnings.length === 0 ? 'READY' : 'REVIEW_REQUIRED',
    include: complete,
  };
}

function inferredNote(fields: StudyCandidateInferredField[], support: number): string {
  const labels: string[] = [];
  if (fields.includes('startTime') || fields.includes('endTime')) labels.push('godziny');
  if (fields.some((field) => field === 'clinic' || field === 'address' || field === 'locationLabel' || field === 'room')) labels.push('lokalizację');
  return `Uzupełniono ${labels.join(' i ')} z ${support} zgodnych wystąpień tego samego przedmiotu, typu zajęć i grupy. Oficjalna wartość z kolejnej wersji planu ma pierwszeństwo.`;
}

export function applyRecurringPatternToCandidates(candidates: StudyScheduleCandidate[]): { candidates: StudyScheduleCandidate[]; summary: StudyRecurringPatternSummary } {
  const raw = candidates.map((candidate) => ({ ...candidate, groupTags: [...candidate.groupTags], warnings: [...candidate.warnings] }));
  const groups = new Map<string, StudyScheduleCandidate[]>();
  for (const candidate of raw) {
    if (!candidate.subject.trim() || candidate.groupScope === 'UNKNOWN') continue;
    const key = patternKey(candidate);
    const list = groups.get(key) ?? [];
    list.push(candidate);
    groups.set(key, list);
  }

  let inferredCandidateCount = 0;
  let inferredTimeCandidateCount = 0;
  let inferredLocationCandidateCount = 0;
  let inferredFieldCount = 0;

  const next = raw.map((candidate) => {
    const peers = (groups.get(patternKey(candidate)) ?? []).filter((peer) => peer.id !== candidate.id);
    if (!peers.length) return candidate;

    let updated: StudyScheduleCandidate = candidate;
    const inferredFields: StudyCandidateInferredField[] = [];
    let strongestSupport = 0;

    if (!candidate.startTime || !candidate.endTime) {
      const pattern = uniqueSupportedValue(peers.map(timePair));
      if (pattern) {
        const [startTime, endTime] = pattern.value.split('|');
        const matchesExisting = (!candidate.startTime || candidate.startTime === startTime)
          && (!candidate.endTime || candidate.endTime === endTime);
        if (matchesExisting && startTime && endTime) {
          updated = {
            ...updated,
            ...(!candidate.startTime ? { startTime } : {}),
            ...(!candidate.endTime ? { endTime } : {}),
          };
          if (!candidate.startTime) inferredFields.push('startTime');
          if (!candidate.endTime) inferredFields.push('endTime');
          strongestSupport = Math.max(strongestSupport, pattern.support);
        }
      }
    }

    if (!usableLocation(candidate) || !candidate.room) {
      const compatiblePeers = peers.filter((peer) => usableLocation(peer) && locationCompatible(candidate, peer));
      const targetClinic = normalized(candidate.clinic);
      const peerClinics = new Set(compatiblePeers.map((peer) => normalized(peer.clinic)).filter(Boolean));
      const clinicScopeIsSafe = Boolean(targetClinic) || peerClinics.size <= 1;
      const locationPattern = clinicScopeIsSafe ? uniqueSupportedValue(compatiblePeers.map(locationSignature)) : null;
      if (locationPattern) {
        const representative = compatiblePeers.find((peer) => locationSignature(peer) === locationPattern.value);
        if (representative) {
          const patch: Partial<StudyScheduleCandidate> = {};
          if (!candidate.address && representative.address) { patch.address = representative.address; inferredFields.push('address'); }
          if (!candidate.locationLabel && representative.locationLabel) { patch.locationLabel = representative.locationLabel; inferredFields.push('locationLabel'); }
          if (!candidate.room && representative.room) { patch.room = representative.room; inferredFields.push('room'); }
          if (!candidate.clinic && representative.clinic) { patch.clinic = representative.clinic; inferredFields.push('clinic'); }
          if (Object.keys(patch).length) {
            updated = { ...updated, ...patch };
            strongestSupport = Math.max(strongestSupport, locationPattern.support);
          }
        }
      }
    }

    if (!inferredFields.length) return candidate;
    const priorFields = updated.inferredFields ?? [];
    const fields = [...new Set([...priorFields, ...inferredFields])];
    const notes = [...(updated.inferenceNotes ?? []), inferredNote(inferredFields, strongestSupport || MIN_PATTERN_SUPPORT)];
    updated = updateOperationalState({ ...updated, inferredFields: fields, inferenceNotes: [...new Set(notes)] });

    inferredCandidateCount += 1;
    if (inferredFields.includes('startTime') || inferredFields.includes('endTime')) inferredTimeCandidateCount += 1;
    if (inferredFields.some((field) => field === 'clinic' || field === 'address' || field === 'locationLabel' || field === 'room')) inferredLocationCandidateCount += 1;
    inferredFieldCount += inferredFields.length;
    return updated;
  });

  return {
    candidates: next,
    summary: { inferredCandidateCount, inferredTimeCandidateCount, inferredLocationCandidateCount, inferredFieldCount },
  };
}

export function applyRecurringStudyPatternAssumptions(analysis: ScheduleAnalysis): ScheduleAnalysis {
  const result = applyRecurringPatternToCandidates(analysis.candidates);
  if (!result.summary.inferredCandidateCount) return analysis;
  const details: string[] = [];
  if (result.summary.inferredTimeCandidateCount) details.push(`godziny: ${result.summary.inferredTimeCandidateCount}`);
  if (result.summary.inferredLocationCandidateCount) details.push(`lokalizacja: ${result.summary.inferredLocationCandidateCount}`);
  return {
    ...analysis,
    candidates: result.candidates,
    information: [
      ...analysis.information,
      {
        id: 'recurring-pattern-assumptions',
        sheet: analysis.sheetNames[0] ?? 'PLAN',
        title: 'Założenia z powtarzalnego wzorca',
        message: `Uzupełniono ${result.summary.inferredCandidateCount} wpisów na podstawie co najmniej ${MIN_PATTERN_SUPPORT} zgodnych wystąpień (${details.join(' · ')}). To założenie aplikacji, nie dodatkowa informacja z pliku. Jawne dane z kolejnej wersji planu zawsze mają pierwszeństwo.`,
      },
    ],
    diagnostics: {
      ...analysis.diagnostics,
      recurringPatternInferredCandidateCount: result.summary.inferredCandidateCount,
      recurringPatternInferredTimeCandidateCount: result.summary.inferredTimeCandidateCount,
      recurringPatternInferredLocationCandidateCount: result.summary.inferredLocationCandidateCount,
    },
  };
}
