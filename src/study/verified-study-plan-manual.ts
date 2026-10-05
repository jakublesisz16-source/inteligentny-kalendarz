import type {
  ScheduleAnalysis,
  StudyLocationField,
  StudyLocationProvenance,
  StudyLocationProvenanceSource,
  StudyScheduleCandidate,
} from './study.types';
import { candidatesForSelectedGroups } from './study.service';
import { auditSelectedStudyProfile } from './study-source-audit';
import {
  candidateSemanticFingerprint,
  VERIFIED_STUDY_PLAN_2026_10_02,
  VERIFIED_STUDY_PLAN_2026_10_05,
} from './verified-study-plan';
import {
  VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_05,
  verifiedStudyCurrentScheduleCandidates,
} from './verified-study-current-schedule';

export const VERIFIED_STUDY_PROFILE_2026_10_02 = ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'] as const;

export const VERIFIED_STUDY_PROFILE_2026_10_05 = ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'] as const;
export const VERIFIED_STUDY_PROFILE_CURRENT = VERIFIED_STUDY_PROFILE_2026_10_05;

export const VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_05 = [
  {
    sourceRange: 'AY9',
    field: 'address',
    sourceValue: 'ul. Jadżwingów 9',
    canonicalValue: 'ul. Jadźwingów 9',
    provenance: 'OFFICIAL_EXTERNAL' as const,
    evidence: 'Zewnętrzne rejestry adresowe/EGiB potwierdzają nazwę ul. Jadźwingów 9. Surowy XLS z 05.10.2026 nadal zachowuje literówkę Jadżwingów.',
    appliedToSchedule: false,
    reason: 'Pozycja AY9 pozostaje source-only bez jednoznacznego dnia i godzin, więc korekta tekstu nie może tworzyć ani zmieniać wydarzenia kalendarza.',
  },
] as const;

export const VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05 = {
  selectedGroups: VERIFIED_STUDY_PROFILE_2026_10_05,
  candidateCount: 76,
  importableCount: 73,
  readyCount: 72,
  warningCount: 1,
  incompleteCount: 3,
  blockingCount: 0,
  conflictCount: 0,
  importableMonthCounts: {
    '2026-10': 16,
    '2026-11': 20,
    '2026-12': 19,
    '2027-01': 18,
  },
  candidatesSha256: '34ced58eff09d97809aca986928f3bd0465a3ea3185f66ed5451100178dcaf70',
} as const;


export const VERIFIED_STUDY_SOURCE_TEXT_CORRECTIONS_2026_10_02 = [
  {
    sourceRange: 'AZ9',
    field: 'address',
    sourceValue: 'ul. Jadżwingów 9',
    canonicalValue: 'ul. Jadźwingów 9',
    provenance: 'OFFICIAL_EXTERNAL' as const,
    evidence: 'Zewnętrzne rejestry adresowe/EGiB potwierdzają nazwę ul. Jadźwingów 9. Surowy XLS zachowuje literówkę Jadżwingów.',
    appliedToSchedule: false,
    reason: 'Pozycja AZ9 pozostaje source-only bez jednoznacznego dnia i godzin, więc korekta tekstu nie może tworzyć ani zmieniać wydarzenia kalendarza.',
  },
] as const;

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

const LOCATION_FIELDS = ['clinic', 'room', 'address', 'locationLabel'] as const satisfies readonly StudyLocationField[];
type LocationField = StudyLocationField;
type LocationPatch = Partial<Record<LocationField, string | null>>;

interface VerifiedLocationOverride {
  sourceSheet?: string;
  sourceRange: string;
  date?: string;
  subject?: string;
  patch: LocationPatch;
  evidence: string;
  provenance?: Partial<Record<LocationField, StudyLocationProvenanceSource>>;
}

// Manual review of the exact 02.10.2026 XLS for profile 11 / 11B / 11B / 11B2.
// These overrides are intentionally hash-bound. A newer plan must be reviewed again
// instead of silently inheriting rooms or addresses from this file.
const VERIFIED_LOCATION_OVERRIDES_2026_10_02: readonly VerifiedLocationOverride[] = [
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
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BD10', date: '2026-10-26', subject: 'PROM. ZDROWIA',
    patch: { room: 'sala 126 w CD', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'BD5: pon. - sala 126 w CD',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BD10', date: '2026-10-27', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla wtorku',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BD10', date: '2026-10-28', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla środy',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BD10', date: '2026-10-29', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BB3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla czwartku',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
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
    provenance: { address: 'OFFICIAL_EXTERNAL' },
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
    provenance: { address: 'OFFICIAL_EXTERNAL' },
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
    provenance: { clinic: 'OFFICIAL_EXTERNAL', address: 'OFFICIAL_EXTERNAL', locationLabel: 'OFFICIAL_EXTERNAL' },
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
    provenance: { clinic: 'OFFICIAL_EXTERNAL', address: 'OFFICIAL_EXTERNAL', locationLabel: 'OFFICIAL_EXTERNAL' },
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
    provenance: { locationLabel: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'T16', date: '2026-12-08', subject: 'INTERNA',
    patch: { address: 'ul. Banacha 1a', locationLabel: 'Klinika Onkologii' },
    evidence: 'R4: prof. R. Stec; A44: ul. Banacha 1a; oficjalna Klinika Onkologii WUM: Banacha 1A',
    provenance: { locationLabel: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BF16', date: '2026-12-11', subject: 'PROMOCJA ZDROWIA (seminaria)',
    patch: { room: 'sala 119', address: 'ul. Żwirki i Wigury 63', locationLabel: 'Centrum Biblioteczno-Informacyjne' },
    evidence: 'BF4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
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
    provenance: { address: 'OFFICIAL_EXTERNAL' },
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
    provenance: { clinic: 'OFFICIAL_EXTERNAL', address: 'OFFICIAL_EXTERNAL', locationLabel: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'D21', subject: 'CHIRURGIA I BLOK OPERACYJNY',
    patch: { clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a', locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej' },
    evidence: 'D4: prof. M. Słodkowski; A27/A28 wskazuje Banacha 1, ale aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B',
    provenance: { clinic: 'OFFICIAL_EXTERNAL', address: 'OFFICIAL_EXTERNAL', locationLabel: 'OFFICIAL_EXTERNAL' },
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
    provenance: { clinic: 'SOURCE_DIRECT', room: 'SOURCE_DIRECT', address: 'SOURCE_DIRECT', locationLabel: 'SOURCE_DIRECT' },
  },
];

const VERIFIED_SOURCE_INCOMPLETE_2026_10_02: ReadonlyArray<{
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


// Manual review of the exact 05.10.2026 XLS for profile 11 / 11B / 11B / 11B2.
// Every range and evidence cell was re-audited after the workbook column shift.
const VERIFIED_LOCATION_OVERRIDES_2026_10_05: readonly VerifiedLocationOverride[] = [
  {
    sourceRange: 'BJ7', date: '2026-10-05', subject: 'POZ seminaria',
    patch: { room: 's. 101 Pato', address: 'ul. Litewska 14/16', locationLabel: null },
    evidence: 'BG9: poniedziałek, gr. 11 - s. 101 Pato, ul. Litewska 14/16',
  },
  {
    sourceRange: 'CB7', date: '2026-10-07', subject: 'POZ seminaria',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'BG9: środa, gr. 11 - sala 210 w NZJ; BF3/A66: NZJ, ul. Ciołka 27',
  },
  {
    sourceRange: 'CK7', date: '2026-10-08', subject: 'POZ seminaria',
    patch: { room: 's. 101 Pato', address: 'ul. Litewska 14/16', locationLabel: null },
    evidence: 'BG9: czwartek, gr. 11 - sala 101 Pato, ul. Litewska 14/16',
  },
  {
    sourceRange: 'DC8', date: '2026-10-14', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'DC4: środa - sala 210 w NZJ; A64/A66/A71: NZJ, ul. Ciołka 27',
  },
  {
    sourceRange: 'DD8', date: '2026-10-15', subject: 'INTERNA (seminaria)',
    patch: { room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BC10', date: '2026-10-26', subject: 'PROM. ZDROWIA',
    patch: { room: 'sala 126 w CD', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'BC5: pon. - sala 126 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BC10', date: '2026-10-27', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BA3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla wtorku',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BC10', date: '2026-10-28', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BA3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla środy',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BC10', date: '2026-10-29', subject: 'PROM. ZDROWIA',
    patch: { room: null, address: 'ul. Ciołka 27', locationLabel: 'Zakład Propedeutyki Pielęgniarstwa' },
    evidence: 'BA3: Zakład Propedeutyki Pielęgniarstwa; oficjalny adres jednostki: ul. Erazma Ciołka 27; źródło nie podaje numeru sali dla czwartku',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'BC10', date: '2026-10-30', subject: 'PROM. ZDROWIA',
    patch: { room: 'sala 210 w NZJ', address: 'ul. Ciołka 27', locationLabel: 'Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych' },
    evidence: 'BC5: pt. 16.10-30.10 - sala 210 w NZJ; A71: NZJ, ul. Ciołka 27',
  },
  {
    sourceRange: 'DD10', date: '2026-10-29', subject: 'INTERNA (seminaria)',
    patch: { room: 'Aula A', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'DJ11', date: '2026-11-06', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala seminaryjna, I piętro, pawilon VIII', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Podstaw Pielęgniarstwa' },
    evidence: 'DI3/A73: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59',
  },
  {
    sourceRange: 'CY12', date: '2026-11-09', subject: 'FARMAKOLOGIA',
    patch: { room: 'sala 203 w CD', address: 'ul. Trojdena 2a', locationLabel: 'Centrum Dydaktyczne' },
    evidence: 'CY5: sala 203 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'CZ12', date: '2026-11-10', subject: 'FARMAKOLOGIA',
    patch: { room: 'sala nr 7, niski parter', address: 'ul. Pawińskiego 3c', locationLabel: null },
    evidence: 'CZ5: sala nr 7 niski parter, ul. Pawińskiego 3c',
  },
  {
    sourceRange: 'AP13', date: '2026-11-16', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AR13', date: '2026-11-18', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AT13', date: '2026-11-20', subject: 'Podst. Rehab. ćw.',
    patch: { room: 'sala 101', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27',
  },
  {
    sourceRange: 'AM14', subject: 'PEDIATRIA',
    patch: { clinic: 'Katedra i Klinika Pediatrii i Nefrologii' },
    evidence: 'AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A',
  },
  {
    sourceRange: 'CX14', date: '2026-11-27', subject: 'POZ ćw.',
    patch: { room: 'sala 102 w NZN', address: 'ul. Ciołka 27', locationLabel: 'Zakład Pielęgniarstwa Klinicznego' },
    evidence: 'CX3: piątek - sala 102 w NZN; A62: Zakład Pielęgniarstwa Klinicznego, ul. Ciołka 27',
  },
  {
    sourceRange: 'AM15', subject: 'PEDIATRIA',
    patch: { clinic: 'Katedra i Klinika Pediatrii i Nefrologii' },
    evidence: 'AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A',
  },
  {
    sourceRange: 'O16', subject: 'INTERNA',
    patch: { clinic: 'Klinika Chorób Wewnętrznych i Kardiologii', address: 'ul. Lindleya 4', locationLabel: 'Klinika Chorób Wewnętrznych i Kardiologii' },
    evidence: 'O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4',
  },
  {
    sourceRange: 'S16', date: '2026-12-07', subject: 'INTERNA',
    patch: { locationLabel: 'Klinika Onkologii' },
    evidence: 'R4: prof. R. Stec; A43/A44: Klinika Onkologii, ul. Banacha 1a',
  },
  {
    sourceRange: 'T16', date: '2026-12-08', subject: 'INTERNA',
    patch: { locationLabel: 'Klinika Onkologii' },
    evidence: 'R4: prof. R. Stec; A43/A44: Klinika Onkologii, ul. Banacha 1a',
  },
  {
    sourceRange: 'BE16', date: '2026-12-11', subject: 'PROMOCJA ZDROWIA (seminaria)',
    patch: { room: 'sala 119', address: 'ul. Żwirki i Wigury 63', locationLabel: 'Centrum Biblioteczno-Informacyjne' },
    evidence: 'BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'O17', subject: 'INTERNA',
    patch: { clinic: 'Klinika Chorób Wewnętrznych i Kardiologii', address: 'ul. Lindleya 4', locationLabel: 'Klinika Chorób Wewnętrznych i Kardiologii' },
    evidence: 'O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4',
  },
  {
    sourceRange: 'BE17', date: '2026-12-18', subject: 'PROMOCJA ZDROWIA (seminaria)',
    patch: { room: 'sala 119', address: 'ul. Żwirki i Wigury 63', locationLabel: 'Centrum Biblioteczno-Informacyjne' },
    evidence: 'BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63',
    provenance: { address: 'OFFICIAL_EXTERNAL' },
  },
  {
    sourceRange: 'DI17', date: '2026-12-16', subject: 'INTERNA (seminaria)',
    patch: { room: 'sala seminaryjna, I piętro, pawilon VIII', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Podstaw Pielęgniarstwa' },
    evidence: 'DI3/A73: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59',
  },
  {
    sourceRange: 'DH18', date: '2027-01-08', subject: 'PEDIATRIA NZYN (seminaria)',
    patch: { clinic: 'Klinika Neonatologii i Chorób Rzadkich', room: 'sala seminaryjna', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Klinika Neonatologii i Chorób Rzadkich' },
    evidence: 'DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a',
  },
  {
    sourceRange: 'DH19', date: '2027-01-15', subject: 'PEDIATRIA NZYN (seminaria)',
    patch: { clinic: 'Klinika Neonatologii i Chorób Rzadkich', room: 'sala seminaryjna', address: 'ul. Żwirki i Wigury 63A', locationLabel: 'Klinika Neonatologii i Chorób Rzadkich' },
    evidence: 'DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a',
  },
  {
    sourceRange: 'D20', subject: 'CHIRURGIA I BLOK OPERACYJNY',
    patch: { clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a', locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej' },
    evidence: 'B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B',
    provenance: { clinic: 'SOURCE_CROSS_REFERENCE', address: 'OFFICIAL_EXTERNAL', locationLabel: 'SOURCE_CROSS_REFERENCE' },
  },
  {
    sourceRange: 'D21', subject: 'CHIRURGIA I BLOK OPERACYJNY',
    patch: { clinic: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej', address: 'ul. Banacha 1a', locationLabel: 'Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej' },
    evidence: 'B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B',
    provenance: { clinic: 'SOURCE_CROSS_REFERENCE', address: 'OFFICIAL_EXTERNAL', locationLabel: 'SOURCE_CROSS_REFERENCE' },
  },
  {
    sourceRange: 'DK21', date: '2027-01-27', subject: 'CHIRURGIA (seminaria)',
    patch: { clinic: 'Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego', room: 'sala seminaryjna 128 w NZS, pawilon XI D1', address: 'ul. Nowogrodzka 59', locationLabel: 'Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego' },
    evidence: 'DK3/A76: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1',
  },
  {
    sourceSheet: 'WYKŁADY', sourceRange: 'A14,B14', date: '2027-01-05', subject: 'POZ',
    patch: { clinic: 'Microsoft Teams', room: null, address: null, locationLabel: null },
    evidence: 'WYKŁADY B14: POZ 15.00-18.45 TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B',
    provenance: { clinic: 'SOURCE_DIRECT', room: 'SOURCE_DIRECT', address: 'SOURCE_DIRECT', locationLabel: 'SOURCE_DIRECT' },
  },
];

const VERIFIED_SOURCE_INCOMPLETE_2026_10_05: ReadonlyArray<{
  sourceRange: string;
  date?: string;
  subject: string;
  warning: string;
}> = [
  {
    sourceRange: 'AY9',
    subject: 'POZ',
    warning: 'Plan z 05.10.2026 przypisuje POZ grupy 11B2 do tygodnia 19-23.10.2026 przy ul. Jadżwingów 9, ale nie podaje jednoznacznego dnia ani pełnego zakresu godzin. Wpis pozostaje source-only i nie tworzy fikcyjnego wydarzenia.',
  },
  {
    sourceRange: 'S16',
    date: '2026-12-07',
    subject: 'INTERNA',
    warning: 'Plan z 05.10.2026 wskazuje zajęcia u prof. R. Steca 07.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca.',
  },
  {
    sourceRange: 'T16',
    date: '2026-12-08',
    subject: 'INTERNA',
    warning: 'Plan z 05.10.2026 wskazuje zajęcia u prof. R. Steca 08.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca.',
  },
];

function normalizedHash(value: string): string {
  return value.trim().toLowerCase();
}

function manualConfigForHash(fileHash: string) {
  const hash = normalizedHash(fileHash);
  if (hash === VERIFIED_STUDY_PLAN_2026_10_05.sha256) {
    return {
      plan: VERIFIED_STUDY_PLAN_2026_10_05,
      selectedGroups: VERIFIED_STUDY_PROFILE_2026_10_05,
      audit: VERIFIED_STUDY_MANUAL_AUDIT_2026_10_05,
      overrides: VERIFIED_LOCATION_OVERRIDES_2026_10_05,
      incomplete: VERIFIED_SOURCE_INCOMPLETE_2026_10_05,
      auditDateLabel: '05.10.2026',
      informationId: 'verified-manual-plan-2026-10-05',
    } as const;
  }
  if (hash === VERIFIED_STUDY_PLAN_2026_10_02.sha256) {
    return {
      plan: VERIFIED_STUDY_PLAN_2026_10_02,
      selectedGroups: VERIFIED_STUDY_PROFILE_2026_10_02,
      audit: VERIFIED_STUDY_MANUAL_AUDIT_2026_10_02,
      overrides: VERIFIED_LOCATION_OVERRIDES_2026_10_02,
      incomplete: VERIFIED_SOURCE_INCOMPLETE_2026_10_02,
      auditDateLabel: '02.10.2026',
      informationId: 'verified-manual-plan-2026-10-02',
    } as const;
  }
  return null;
}

export function isVerifiedManualStudySource(fileHash: string): boolean {
  return manualConfigForHash(fileHash) !== null;
}

export function isVerifiedStudyProfileSelection(selectedGroups: readonly string[]): boolean {
  const expected = [...VERIFIED_STUDY_PROFILE_CURRENT].sort();
  const actual = [...new Set(selectedGroups.map((group) => group.trim().toUpperCase()).filter(Boolean))].sort();
  return actual.length === expected.length && actual.every((group, index) => group === expected[index]);
}

function matchesOverride(candidate: StudyScheduleCandidate, override: VerifiedLocationOverride): boolean {
  return candidate.sourceRange === override.sourceRange
    && (!override.sourceSheet || candidate.sourceSheet === override.sourceSheet)
    && (!override.date || candidate.date === override.date)
    && (!override.subject || candidate.subject === override.subject);
}

function provenanceForOverride(override: VerifiedLocationOverride): StudyLocationProvenance[] {
  return LOCATION_FIELDS
    .filter((field) => field in override.patch)
    .map((field) => ({
      field,
      source: override.provenance?.[field] ?? 'SOURCE_CROSS_REFERENCE',
      evidence: override.evidence,
    }));
}

function mergeLocationProvenance(
  current: StudyLocationProvenance[] | undefined,
  added: StudyLocationProvenance[],
): StudyLocationProvenance[] {
  const byKey = new Map<string, StudyLocationProvenance>();
  for (const item of [...(current ?? []), ...added]) {
    byKey.set(`${item.field}|${item.source}|${item.evidence}`, item);
  }
  return [...byKey.values()];
}

function applyLocationPatch(candidate: StudyScheduleCandidate, override: VerifiedLocationOverride): StudyScheduleCandidate {
  const next: StudyScheduleCandidate = {
    ...candidate,
    groupTags: [...candidate.groupTags],
    warnings: [...candidate.warnings],
    locationProvenance: mergeLocationProvenance(candidate.locationProvenance, provenanceForOverride(override)),
  };
  for (const field of LOCATION_FIELDS) {
    if (!(field in override.patch)) continue;
    const value = override.patch[field];
    if (value === null || value === undefined || !value.trim()) delete next[field];
    else next[field] = value.trim();
  }
  return next;
}

function enforceReviewedSourceIncomplete(
  candidate: StudyScheduleCandidate,
  incompleteRules: ReadonlyArray<{ sourceRange: string; date?: string; subject: string; warning: string }>,
): StudyScheduleCandidate {
  const rule = incompleteRules.find((item) => (
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

function applyCurrentManualScheduleSnapshot(candidates: StudyScheduleCandidate[], fileHash: string): {
  candidates: StudyScheduleCandidate[];
  matchedCanonicalCount: number;
} {
  if (normalizedHash(fileHash) !== VERIFIED_STUDY_PLAN_2026_10_05.sha256) {
    return { candidates, matchedCanonicalCount: 0 };
  }
  const canonical = verifiedStudyCurrentScheduleCandidates();
  const bySourceKey = new Map(canonical.map((candidate) => [candidate.sourceKey, candidate]));
  let matchedCanonicalCount = 0;
  const next = candidates.map((candidate) => {
    const manual = bySourceKey.get(candidate.sourceKey);
    if (!manual) return candidate;
    matchedCanonicalCount += 1;
    return {
      ...manual,
      groupTags: [...manual.groupTags],
      warnings: [...manual.warnings],
      ...(manual.locationProvenance?.length
        ? { locationProvenance: manual.locationProvenance.map((item) => ({ ...item })) }
        : {}),
    };
  });
  return { candidates: next, matchedCanonicalCount };
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
  const config = manualConfigForHash(fileHash);
  if (!config) return { candidates, appliedOverrideCount: 0, appliedCandidateCount: 0 };

  const usedOverrides = new Set<number>();
  let appliedCandidateCount = 0;
  const corrected = candidates.map((candidate) => {
    let next = candidate;
    let changed = false;
    config.overrides.forEach((override, index) => {
      if (!matchesOverride(next, override)) return;
      next = { ...applyLocationPatch(next, override), manuallyReviewed: true };
      usedOverrides.add(index);
      changed = true;
    });
    const reviewedIncomplete = enforceReviewedSourceIncomplete(next, config.incomplete);
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
  const config = manualConfigForHash(fileHash);
  if (!config) return analysis;
  const result = applyVerifiedStudyPlanManualCorrections(analysis.candidates, fileHash);
  const canonical = applyCurrentManualScheduleSnapshot(result.candidates, fileHash);
  const reviewedIds = new Set(
    candidatesForSelectedGroups({ ...analysis, candidates: canonical.candidates }, [...config.selectedGroups])
      .map((candidate) => candidate.id),
  );
  const candidates = canonical.candidates.map((candidate) => (
    reviewedIds.has(candidate.id) ? { ...candidate, manuallyReviewed: true } : candidate
  ));
  return {
    ...analysis,
    candidates,
    information: [
      ...analysis.information,
      {
        id: config.informationId,
        sheet: analysis.sheetNames[0] ?? 'PLAN ZAJĘĆ',
        title: 'Ręcznie zweryfikowany plan dla grupy 11 / 11B / 11B / 11B2',
        message: `Ręcznie sprawdzono wszystkie ${config.audit.candidateCount} wpisów profilu: grupy, daty, godziny, sale, jednostki i adresy. Dla planu 05.10.2026 kalendarz korzysta z jawnej, ręcznie zapisanej listy wszystkich 76 pozycji, a parser jest warstwą kontrolną. Zastosowano ${result.appliedOverrideCount} jawnych reguł korekcyjnych lokalizacji. Każde pole lokalizacji ma jawne pochodzenie: bezpośrednia komórka źródła, odwołanie do innego miejsca tego samego XLS albo oficjalne źródło zewnętrzne. Audyt jest przypięty wyłącznie do dokładnego SHA-256 planu z ${config.auditDateLabel} i nie przechodzi na kolejny plik.`,
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
  const config = manualConfigForHash(fileHash);
  if (!config) return { verified: false, reasons: ['Ten plik nie ma ręcznie zatwierdzonego audytu planu.'] };
  const corrected = applyVerifiedStudyPlanManualCorrectionsToAnalysis(analysis, fileHash);
  const selectedGroups = [...config.selectedGroups];
  const selected = candidatesForSelectedGroups(corrected, selectedGroups);
  const candidatesSha256 = await candidateSemanticFingerprint(selected);
  const audit = auditSelectedStudyProfile(corrected, selectedGroups);
  const expected = config.audit;
  const reasons: string[] = [];
  if (normalizedHash(fileHash) === VERIFIED_STUDY_PLAN_2026_10_05.sha256) {
    const expectedKeys = new Set(VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_05.map((candidate) => candidate.sourceKey));
    const selectedKeys = new Set(selected.map((candidate) => candidate.sourceKey));
    if (selectedKeys.size !== expectedKeys.size || [...expectedKeys].some((key) => !selectedKeys.has(key))) {
      reasons.push('Ręczna lista bieżącego kalendarza nie pokrywa dokładnie wszystkich 76 pozycji źródłowych.');
    }
  }
  if (candidatesSha256 !== expected.candidatesSha256) reasons.push('Ręcznie zatwierdzony fingerprint planu nie zgadza się z wynikiem analizy.');
  for (const key of ['candidateCount', 'importableCount', 'readyCount', 'warningCount', 'incompleteCount', 'blockingCount', 'conflictCount'] as const) {
    if (audit[key] !== expected[key]) reasons.push(`${key}: otrzymano ${audit[key]}, oczekiwano ${expected[key]}.`);
  }
  if (JSON.stringify(audit.importableMonthCounts) !== JSON.stringify(expected.importableMonthCounts)) {
    reasons.push('Liczba importowalnych zajęć w miesiącach nie zgadza się z ręcznie zatwierdzonym planem.');
  }
  return { verified: reasons.length === 0, reasons, candidatesSha256 };
}

export function verifiedStudyPlanManualEvidence(fileHash = VERIFIED_STUDY_PLAN_2026_10_05.sha256): ReadonlyArray<Readonly<VerifiedLocationOverride>> {
  return manualConfigForHash(fileHash)?.overrides ?? [];
}
