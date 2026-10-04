import type { ScheduleAnalysis, StudyScheduleCandidate } from './study.types';
import { candidatesForSelectedGroups } from './study.service';
import { auditSelectedStudyProfile } from './study-source-audit';
import { candidateSemanticFingerprint, VERIFIED_STUDY_PLAN_2026_10_02 } from './verified-study-plan';

export const VERIFIED_STUDY_PROFILE_2026_10_02 = ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'] as const;

export const VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02 = {
  selectedGroups: VERIFIED_STUDY_PROFILE_2026_10_02,
  candidateCount: 77,
  importableCount: 74,
  readyCount: 73,
  warningCount: 1,
  incompleteCount: 3,
  blockingCount: 0,
  conflictCount: 1,
  importableMonthCounts: {
    '2026-10': 17,
    '2026-11': 20,
    '2026-12': 19,
    '2027-01': 18,
  },
  candidatesSha256: '3f39d3358e0d3f6423d5ae18ad41ea357d9a8d960e2f09af1d7d4e8ca1f5360a',
} as const;

const LOCATION_FIELDS = ['clinic', 'room', 'address', 'locationLabel'] as const;
type LocationField = (typeof LOCATION_FIELDS)[number];
type LocationPatch = Partial<Record<LocationField, string | null>>;

interface VerifiedLocationOverride {
  sourceSheet?: string;
  sourceRange: string;
  date?: string;
  subject?: string;
  patch: LocationPatch;
  evidence: string;
}

// Manual review of the exact 02.10.2026 XLS for profile 11 / 11B / 11B / 11B2.
// These overrides are intentionally hash-bound. A newer plan must be reviewed again
// instead of silently inheriting rooms or addresses from this file.
const VERIFIED_LOCATION_OVERRIDES: readonly VerifiedLocationOverride[] = [
  {
    sourceRange: 'BK7', date: '2026-10-05', subject: 'POZ seminaria',
    patch: { room: 's. 101 Pato', address: 'ul. Litewska 14/16', locationLabel: null },
    evidence: 'BH9: poniedziałek, gr. 11 - s. 101 Pato, ul. Litewska 14/16',
  },
  {
    sourceRange: 'CC7', date: '2026-10-07', subject: 'POZ seminaria',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'BH9: środa, gr. 11 - sala 210 w NZJ; BG3/A59: NZJ, ul. Ciołka 27',
  },
  {
    sourceRange: 'CL7', date: '2026-10-08', subject: 'POZ seminaria',
    patch: { room: 's. 101 Pato', address: 'ul. Litewska 14/16', locationLabel: null },
    evidence: 'BH9: czwartek, gr. 11 - sala 101 Pato, ul. Litewska 14/16',
  },
  {
    sourceRange: 'DD8', date: '2026-10-14', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'DD4: środa - sala 210 w NZJ; A59/A61/A66: NZJ, ul. Ciołka 27',
  },
  {
    sourceRange: 'DE8', date: '2026-10-15', subject: 'INTERNA (seminaria)',
    patch: { room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'DE4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
  },
  {
    sourceRange: 'BD10', date: '2026-10-26', subject: 'PROM. ZDROWIA',
    patch: { room: 'sala 126 w CD', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'BD5: pon. - sala 126 w CD',
  },
  {
    sourceRange: 'BD10', date: '2026-10-27', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla wtorku',
  },
  {
    sourceRange: 'BD10', date: '2026-10-28', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla środy',
  },
  {
    sourceRange: 'BD10', date: '2026-10-29', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla czwartku',
  },
  {
    sourceRange: 'BD10', date: '2026-10-30', subject: 'PROM. ZDROWIA',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'BD5: pt. 16.10-30.10 - sala 210 w NZJ; NZJ: ul. Ciołka 27',
  },
  {
    sourceRange: 'DE10', date: '2026-10-29', subject: 'INTERNA (seminaria)',
    patch: { room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'DE4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
  },
  {
    sourceRange: 'DK11', date: '2026-11-06', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala seminaryjna, I piętro, pawilon VIII', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Podstaw Pielęgniarstwa' },
    evidence: 'DJ3: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59',
  },
  {
    sourceRange: 'CZ12', date: '2026-11-09', subject: 'FARMAKOLOGIA',
    patch: { room: 'sala 203 w CD', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'CZ5: sala 203 w CD',
  },
  {
    sourceRange: 'DA12', date: '2026-11-10', subject: 'FARMAKOLOGIA',
    patch: { room: 'sala nr 7, niski parter', address: 'ul. Pawińskiego 3c', locationLabel: null },
    evidence: 'DA5: sala nr 7 niski parter, ul. Pawińskiego 3c',
  },
  {
    sourceRange: 'AQ13', date: '2026-11-16', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AP3: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AS13', date: '2026-11-18', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AP3: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AU13', date: '2026-11-20', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AP3: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AM14', subject: 'PEDIATRIA',
    patch: { clinic: 'Katedra i Klinika Pediatrii i Nefrologii', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii' },
    evidence: 'AM4: prof. M. Mizerska-Wasiak; oficjalna jednostka prof. Mizerskiej-Wasiak: Katedra i Klinika Pediatrii i Nefrologii, Żwirki i Wigury 63A',
  },
  {
    sourceRange: 'CY14', date: '2026-11-27', subject: 'POZ ćw.',
    patch: { room: 'sala 102 w NZN', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'CY3: piątek - sala 102 w NZN; A57: NZN, ul. Ciołka 27',
  },
  {
    sourceRange: 'AM15', subject: 'PEDIATRIA',
    patch: { clinic: 'Katedra i Klinika Pediatrii i Nefrologii', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Katedra i Klinika Pediatrii i Nefrologii' },
    evidence: 'AM4: prof. M. Mizerska-Wasiak; oficjalna jednostka prof. Mizerskiej-Wasiak: Katedra i Klinika Pediatrii i Nefrologii, Żwirki i Wigury 63A',
  },
  {
    sourceRange: 'O16', subject: 'INTERNA',
    patch: { clinic: 'Klinika Chorób Wewnętrznych i Kardiologii', address: 'ul. Lindleya 4', locationLabel: 'Klinika Chorób Wewnętrznych i Kardiologii' },
    evidence: 'O4: dr hab. Ł. Czyżewski, zajęcia od 7.30; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4',
  },
  {
    sourceRange: 'S16', date: '2026-12-07', subject: 'INTERNA',
    patch: { address: 'ul. Banacha 1a', locationLabel: 'Klinika Onkologii' },
    evidence: 'R4: prof. R. Stec; A44: ul. Banacha 1a; oficjalna Klinika Onkologii WUM: Banacha 1A',
  },
  {
    sourceRange: 'T16', date: '2026-12-08', subject: 'INTERNA',
    patch: { address: 'ul. Banacha 1a', locationLabel: 'Klinika Onkologii' },
    evidence: 'R4: prof. R. Stec; A44: ul. Banacha 1a; oficjalna Klinika Onkologii WUM: Banacha 1A',
  },
  {
    sourceRange: 'BF16', date: '2026-12-11', subject: 'PROMOCJA ZDROWIA (seminaria)',
    patch: { room: 'sala 119', address: 'ul. Żwirki i Wigury 63', locationLabel: 'Centrum Biblioteczno-Informacyjne' },
    evidence: 'BF4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63',
  },
  {
    sourceRange: 'O17', subject: 'INTERNA',
    patch: { clinic: 'Klinika Chorób Wewnętrznych i Kardiologii', address: 'ul. Lindleya 4', locationLabel: 'Klinika Chorób Wewnętrznych i Kardiologii' },
    evidence: 'O4: dr hab. Ł. Czyżewski, zajęcia od 7.30; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4',
  },
  {
    sourceRange: 'BF17', date: '2026-12-18', subject: 'PROMOCJA ZDROWIA (seminaria)',
    patch: { room: 'sala 119', address: 'ul. Żwirki i Wigury 63', locationLabel: 'Centrum Biblioteczno-Informacyjne' },
    evidence: 'BF4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63',
  },
  {
    sourceRange: 'DJ17', date: '2026-12-16', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala seminaryjna, I piętro, pawilon VIII', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Podstaw Pielęgniarstwa' },
    evidence: 'DJ3: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59',
  },
  {
    sourceRange: 'DI18', date: '2027-01-08', subject: 'PEDIATRIA NZYN (seminaria)',
    patch: { clinic: 'Klinika Neonatologii i Chorób Rzadkich', room: 'sala seminaryjna', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Klinika Neonatologii i Chorób Rzadkich' },
    evidence: 'DH3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a',
  },
  {
    sourceRange: 'DI19', date: '2027-01-15', subject: 'PEDIATRIA NZYN (seminaria)',
    patch: { clinic: 'Klinika Neonatologii i Chorób Rzadkich', room: 'sala seminaryjna', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Klinika Neonatologii i Chorób Rzadkich' },
    evidence: 'DH3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a',
  },
  {
    sourceRange: 'D20', subject: 'CHIRURGIA I BLOK OPERACYJNY',
    patch: { clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a', locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej' },
    evidence: 'D4: prof. M. Słodkowski; A27/A28 wskazuje Banacha 1, ale aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B',
  },
  {
    sourceRange: 'D21', subject: 'CHIRURGIA I BLOK OPERACYJNY',
    patch: { clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a', locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej' },
    evidence: 'D4: prof. M. Słodkowski; A27/A28 wskazuje Banacha 1, ale aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B',
  },
  {
    sourceRange: 'DL21', date: '2027-01-27', subject: 'CHIRURGIA (seminaria)',
    patch: { clinic: 'Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego', room: 'sala seminaryjna 128 w NZS, pawilon XI D1', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego' },
    evidence: 'DL3/A71: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1',
  },
  {
    sourceSheet: 'WYKŁADY', sourceRange: 'A14,B14', date: '2027-01-05', subject: 'POZ',
    patch: { clinic: 'Microsoft Teams', room: null, address: null, locationLabel: null },
    evidence: 'WYKŁADY B14: POZ ... 15.00-18.45 ... TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B',
  },
];

const VERIFIED_SOURCE_INCOMPLETE: ReadonlyArray<{
  sourceRange: string;
  date?: string;
  subject: string;
  warning: string;
}> = [
  {
    sourceRange: 'AZ9',
    subject: 'POZ',
    warning: 'Plan przypisuje POZ grupy 11B2 do tygodnia 19-23.10.2026 przy ul. Jadźwingów 9, ale nie podaje jednoznacznego dnia ani pełnego zakresu godzin. Wpis pozostaje source-only i nie tworzy fikcyjnego wydarzenia.',
  },
  {
    sourceRange: 'S16',
    date: '2026-12-07',
    subject: 'INTERNA',
    warning: 'Plan wskazuje zajęcia u prof. R. Steca 07.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca.',
  },
  {
    sourceRange: 'T16',
    date: '2026-12-08',
    subject: 'INTERNA',
    warning: 'Plan wskazuje zajęcia u prof. R. Steca 08.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca.',
  },
];

function normalizedHash(value: string): string {
  return value.trim().toLowerCase();
}

export function isVerifiedManualStudySource(fileHash: string): boolean {
  return normalizedHash(fileHash) === VERIFIED_STUDY_PLAN_2026_10_02.sha256;
}

export function isVerifiedStudyProfileSelection(selectedGroups: readonly string[]): boolean {
  const expected = [...VERIFIED_STUDY_PROFILE_2026_10_02].sort();
  const actual = [...new Set(selectedGroups.map((group) => group.trim().toUpperCase()).filter(Boolean))].sort();
  return actual.length === expected.length && actual.every((group, index) => group === expected[index]);
}

function matchesOverride(candidate: StudyScheduleCandidate, override: VerifiedLocationOverride): boolean {
  return candidate.sourceRange === override.sourceRange
    && (!override.sourceSheet || candidate.sourceSheet === override.sourceSheet)
    && (!override.date || candidate.date === override.date)
    && (!override.subject || candidate.subject === override.subject);
}

function applyLocationPatch(candidate: StudyScheduleCandidate, patch: LocationPatch): StudyScheduleCandidate {
  const next: StudyScheduleCandidate = { ...candidate, groupTags: [...candidate.groupTags], warnings: [...candidate.warnings] };
  for (const field of LOCATION_FIELDS) {
    if (!(field in patch)) continue;
    const value = patch[field];
    if (value === null || value === undefined || !value.trim()) delete next[field];
    else next[field] = value.trim();
  }
  return next;
}

function enforceReviewedSourceIncomplete(candidate: StudyScheduleCandidate): StudyScheduleCandidate {
  const rule = VERIFIED_SOURCE_INCOMPLETE.find((item) => (
    item.sourceRange === candidate.sourceRange
    && item.subject === candidate.subject
    && (!item.date || item.date === candidate.date)
  ));
  if (!rule) return candidate;
  const next: StudyScheduleCandidate = {
    ...candidate,
    groupTags: [...candidate.groupTags],
    warnings: [rule.warning],
    status: 'REVIEW_REQUIRED',
    include: false,
    manuallyReviewed: true,
  };
  delete next.startTime;
  delete next.endTime;
  if (next.inferredFields?.length) {
    const fields = next.inferredFields.filter((field) => field !== 'startTime' && field !== 'endTime');
    if (fields.length) next.inferredFields = fields;
    else delete next.inferredFields;
  }
  delete next.inferenceNotes;
  return next;
}

export interface VerifiedStudyPlanManualResult {
  candidates: StudyScheduleCandidate[];
  appliedOverrideCount: number;
  appliedCandidateCount: number;
}

export function applyVerifiedStudyPlanManualCorrections(
  candidates: StudyScheduleCandidate[],
  fileHash: string,
): VerifiedStudyPlanManualResult {
  if (!isVerifiedManualStudySource(fileHash)) {
    return { candidates, appliedOverrideCount: 0, appliedCandidateCount: 0 };
  }

  const usedOverrides = new Set<number>();
  let appliedCandidateCount = 0;
  const corrected = candidates.map((candidate) => {
    let next = candidate;
    let changed = false;
    VERIFIED_LOCATION_OVERRIDES.forEach((override, index) => {
      if (!matchesOverride(next, override)) return;
      next = { ...applyLocationPatch(next, override.patch), manuallyReviewed: true };
      usedOverrides.add(index);
      changed = true;
    });
    const reviewedIncomplete = enforceReviewedSourceIncomplete(next);
    if (reviewedIncomplete !== next) {
      next = reviewedIncomplete;
      changed = true;
    }
    if (changed) appliedCandidateCount += 1;
    return next;
  });
  return { candidates: corrected, appliedOverrideCount: usedOverrides.size, appliedCandidateCount };
}

export function applyVerifiedStudyPlanManualCorrectionsToAnalysis(
  analysis: ScheduleAnalysis,
  fileHash: string,
): ScheduleAnalysis {
  if (!isVerifiedManualStudySource(fileHash)) return analysis;
  const result = applyVerifiedStudyPlanManualCorrections(analysis.candidates, fileHash);
  const reviewedIds = new Set(
    candidatesForSelectedGroups({ ...analysis, candidates: result.candidates }, [...VERIFIED_STUDY_PROFILE_2026_10_02])
      .map((candidate) => candidate.id),
  );
  const candidates = result.candidates.map((candidate) => (
    reviewedIds.has(candidate.id) ? { ...candidate, manuallyReviewed: true } : candidate
  ));
  return {
    ...analysis,
    candidates,
    information: [
      ...analysis.information,
      {
        id: 'verified-manual-plan-2026-10-02',
        sheet: analysis.sheetNames[0] ?? 'PLAN ZAJĘĆ',
        title: 'Ręcznie zweryfikowany plan dla grupy 11 / 11B / 11B / 11B2',
        message: `Ręcznie sprawdzono wszystkie ${VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02.candidateCount} wpisów profilu: grupy, daty, godziny, sale, jednostki i adresy. Zastosowano ${result.appliedOverrideCount} jawnych reguł korekcyjnych. Audyt jest przypięty wyłącznie do dokładnego SHA-256 planu z 02.10.2026 i nie przechodzi na kolejny plik.`,
      },
    ],
  };
}

export interface VerifiedStudyManualAuditResult {
  verified: boolean;
  reasons: string[];
  candidatesSha256?: string;
}

export async function verifyVerifiedStudyPlanManualAudit(
  analysis: ScheduleAnalysis,
  fileHash: string,
): Promise<VerifiedStudyManualAuditResult> {
  if (!isVerifiedManualStudySource(fileHash)) {
    return { verified: false, reasons: ['Ten plik nie ma ręcznie zatwierdzonego audytu planu.'] };
  }
  const corrected = applyVerifiedStudyPlanManualCorrectionsToAnalysis(analysis, fileHash);
  const selectedGroups = [...VERIFIED_STUDY_PROFILE_2026_10_02];
  const selected = candidatesForSelectedGroups(corrected, selectedGroups);
  const candidatesSha256 = await candidateSemanticFingerprint(selected);
  const audit = auditSelectedStudyProfile(corrected, selectedGroups);
  const expected = VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02;
  const reasons: string[] = [];
  if (candidatesSha256 !== expected.candidatesSha256) reasons.push('Ręcznie zatwierdzony fingerprint planu nie zgadza się z wynikiem analizy.');
  for (const key of ['candidateCount', 'importableCount', 'readyCount', 'warningCount', 'incompleteCount', 'blockingCount', 'conflictCount'] as const) {
    if (audit[key] !== expected[key]) reasons.push(`${key}: otrzymano ${audit[key]}, oczekiwano ${expected[key]}.`);
  }
  if (JSON.stringify(audit.importableMonthCounts) !== JSON.stringify(expected.importableMonthCounts)) {
    reasons.push('Liczba importowalnych zajęć w miesiącach nie zgadza się z ręcznie zatwierdzonym planem.');
  }
  return { verified: reasons.length === 0, reasons, candidatesSha256 };
}

export function verifiedStudyPlanManualEvidence(): ReadonlyArray<Readonly<VerifiedLocationOverride>> {
  return VERIFIED_LOCATION_OVERRIDES;
}
