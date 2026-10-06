import type { StudyScheduleCandidate } from './study.types';

export const VERIFIED_STUDY_CURRENT_SCHEDULE_SOURCE_SHA256 = '5e5ea210abbcc972b2928372505eaee5d9a58ffeba6c7d7162eb3514bb9570b9';
export const VERIFIED_STUDY_CURRENT_SCHEDULE_PROFILE = ['MAIN:11', 'G12:11B', 'G8:11B', 'G4:11B2'] as const;
export const VERIFIED_STUDY_CURRENT_TIMED_EVENT_COUNT = 74;
export const VERIFIED_STUDY_CURRENT_SOURCE_ONLY_COUNT = 3;
export const VERIFIED_STUDY_CURRENT_CALENDAR_OPERATIONAL_SHA256 = '85555718ade7376a375332631ff52a2c182bfcc628c741f600a6a8d29093facd';

// Canonical, manually audited snapshot of every source position for the user's current profile.
// This is intentionally explicit and hash-bound. The generic XLS parser remains a verification layer,
// but for this exact source/profile the calendar fields below are the final authority.
export const VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_06: readonly StudyScheduleCandidate[] =
[
  {
    "id": "candidate-4900ffbb",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BJ7",
    "sourceKey": "PLAN ZAJĘĆ|BJ7|2026-10-05|12:00|15:45|POZ seminaria|MAIN:11",
    "originalText": "05.10. - 09.10.2026 | grupa 11 | POZ seminaria 15g | poniedziałek | 12.00 - 15.45",
    "subject": "POZ seminaria",
    "activityType": "Seminaria",
    "date": "2026-10-05",
    "startTime": "12:00",
    "endTime": "15:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-05",
    "sourceWeekEnd": "2026-10-09",
    "sourceSectionKey": "PLAN ZAJĘĆ|BF2:CU2",
    "declaredTeachingHours": 15,
    "address": "ul. Litewska 14/16",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: poniedziałek, gr. 11 - s. 101 Pato, ul. Litewska 14/16"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: poniedziałek, gr. 11 - s. 101 Pato, ul. Litewska 14/16"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: poniedziałek, gr. 11 - s. 101 Pato, ul. Litewska 14/16"
      }
    ],
    "room": "s. 101 Pato",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-5d3a6c98",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "CB7",
    "sourceKey": "PLAN ZAJĘĆ|CB7|2026-10-07|12:00|15:45|POZ seminaria|MAIN:11",
    "originalText": "05.10. - 09.10.2026 | grupa 11 | POZ seminaria 15g | środa | 12.00 - 15.45",
    "subject": "POZ seminaria",
    "activityType": "Seminaria",
    "date": "2026-10-07",
    "startTime": "12:00",
    "endTime": "15:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-05",
    "sourceWeekEnd": "2026-10-09",
    "sourceSectionKey": "PLAN ZAJĘĆ|BF2:CU2",
    "declaredTeachingHours": 15,
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: środa, gr. 11 - sala 210 w NZJ; BF3/A67: NZJ, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: środa, gr. 11 - sala 210 w NZJ; BF3/A67: NZJ, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: środa, gr. 11 - sala 210 w NZJ; BF3/A67: NZJ, ul. Ciołka 27"
      }
    ],
    "room": "sala 210 w NZJ",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-77b7be76",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "CK7",
    "sourceKey": "PLAN ZAJĘĆ|CK7|2026-10-08|12:00|15:45|POZ seminaria|MAIN:11",
    "originalText": "05.10. - 09.10.2026 | grupa 11 | POZ seminaria 15g | czwartek | 12.00 - 15.45",
    "subject": "POZ seminaria",
    "activityType": "Seminaria",
    "date": "2026-10-08",
    "startTime": "12:00",
    "endTime": "15:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-05",
    "sourceWeekEnd": "2026-10-09",
    "sourceSectionKey": "PLAN ZAJĘĆ|BF2:CU2",
    "declaredTeachingHours": 15,
    "address": "ul. Litewska 14/16",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: czwartek, gr. 11 - sala 101 Pato, ul. Litewska 14/16"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: czwartek, gr. 11 - sala 101 Pato, ul. Litewska 14/16"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BG9: czwartek, gr. 11 - sala 101 Pato, ul. Litewska 14/16"
      }
    ],
    "room": "s. 101 Pato",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-0ad4ff4d",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A21,C21",
    "sourceKey": "WYKŁADY|C21|2026-10-08|16:30|18:00|CHIRURGIA",
    "originalText": "08.10. | CHIRURGIA dr M. Hreńczuk 16.30 - 18.00 (2h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2026-10-08",
    "startTime": "16:30",
    "endTime": "18:00",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-7b2b02a1",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A4,B4",
    "sourceKey": "WYKŁADY|B4|2026-10-13|15:00|17:15|FARMAKOLOGIA",
    "originalText": "13.10. | FARMAKOLOGIA prof. D. Mirowska-Guzel 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "FARMAKOLOGIA",
    "activityType": "Wykład",
    "date": "2026-10-13",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cfce3254",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DC8",
    "sourceKey": "PLAN ZAJĘĆ|DC8|2026-10-14|15:45|19:30|INTERNA (seminaria)|MAIN:11",
    "originalText": "12.10. - 16.10.2026 | grupa 11 | INTERNA (seminaria) 15g | Dr hab. T. Kryczka, | środa sala 210 w NZJ | 15.45 - 19.30",
    "subject": "INTERNA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-10-14",
    "startTime": "15:45",
    "endTime": "19:30",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-12",
    "sourceWeekEnd": "2026-10-16",
    "sourceSectionKey": "PLAN ZAJĘĆ|DB2:DF2",
    "declaredTeachingHours": 15,
    "room": "sala 210 w NZJ",
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DC4: środa - sala 210 w NZJ; A64/A67/A72: NZJ, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DC4: środa - sala 210 w NZJ; A64/A67/A72: NZJ, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DC4: środa - sala 210 w NZJ; A64/A67/A72: NZJ, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-88da444c",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A22,B22",
    "sourceKey": "WYKŁADY|B22|2026-10-15|15:00|16:30|CHIRURGIA",
    "originalText": "15.10. | CHIRURGIA dr M. Hreńczuk 15.00 - 16.30 (2h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2026-10-15",
    "startTime": "15:00",
    "endTime": "16:30",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-aeda43a9",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DD8",
    "sourceKey": "PLAN ZAJĘĆ|DD8|2026-10-15|16:45|20:30|INTERNA (seminaria)|MAIN:11",
    "originalText": "12.10. - 16.10.2026 | grupa 11 | INTERNA (seminaria) 15g | Dr hab. T. Kryczka, | czwartek aula A w CD | 16.45 - 20.30",
    "subject": "INTERNA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-10-15",
    "startTime": "16:45",
    "endTime": "20:30",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-12",
    "sourceWeekEnd": "2026-10-16",
    "sourceSectionKey": "PLAN ZAJĘĆ|DB2:DF2",
    "declaredTeachingHours": 15,
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      }
    ],
    "room": "Aula A",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-9d7dc25b",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BC10",
    "sourceKey": "PLAN ZAJĘĆ|BC10|2026-10-26|08:00|11:00|PROM. ZDROWIA|G8:11B",
    "originalText": "26.10. - 30.10.2026 |  11b | PROM. ZDROWIA zajęcia praktyczne 20 godz. grupy 8-osobowe | Prof. dr hab. E. Krzych-Fałta, Zakład Propedeutyki Pielęgniarstwa | pon. - pt. 8.00 - 11.00 | pon. - sala 126 w CD pt. - 16.10. - 30.10. - sala 210 w NZJ 06.11. - 29.01. sala 104, ul. Litewska 14/16",
    "subject": "PROM. ZDROWIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-10-26",
    "startTime": "08:00",
    "endTime": "11:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": " 11b",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|BA2:BC2",
    "declaredTeachingHours": 20,
    "room": "sala 126 w CD",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "address": "ul. Trojdena 2a",
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BC5: pon. - sala 126 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "BC5: pon. - sala 126 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BC5: pon. - sala 126 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-374f74aa",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BC10",
    "sourceKey": "PLAN ZAJĘĆ|BC10|2026-10-27|08:00|11:00|PROM. ZDROWIA|G8:11B",
    "originalText": "26.10. - 30.10.2026 |  11b | PROM. ZDROWIA zajęcia praktyczne 20 godz. grupy 8-osobowe | Prof. dr hab. E. Krzych-Fałta, Zakład Propedeutyki Pielęgniarstwa | pon. - pt. 8.00 - 11.00 | pon. - sala 126 w CD pt. - 16.10. - 30.10. - sala 210 w NZJ 06.11. - 29.01. sala 104, ul. Litewska 14/16",
    "subject": "PROM. ZDROWIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-10-27",
    "startTime": "08:00",
    "endTime": "11:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": " 11b",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|BA2:BC2",
    "declaredTeachingHours": 20,
    "clinic": "Zakład Propedeutyki Pielęgniarstwa",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BA3-BC3 wskazuje jednostkę prowadzącą Zakład Propedeutyki Pielęgniarstwa, a BC5 przypisuje miejsca tylko poniedziałkowi i piątkom; dla wtorku źródło nie potwierdza sali ani miejsca zajęć"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-9ce6389c",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A6,B6",
    "sourceKey": "WYKŁADY|B6|2026-10-27|15:00|17:15|PEDIATRIA",
    "originalText": "27.10. | PEDIATRIA prof. B. Kociszewska-Najman 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "PEDIATRIA",
    "activityType": "Wykład",
    "date": "2026-10-27",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cfc55821",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BC10",
    "sourceKey": "PLAN ZAJĘĆ|BC10|2026-10-28|08:00|11:00|PROM. ZDROWIA|G8:11B",
    "originalText": "26.10. - 30.10.2026 |  11b | PROM. ZDROWIA zajęcia praktyczne 20 godz. grupy 8-osobowe | Prof. dr hab. E. Krzych-Fałta, Zakład Propedeutyki Pielęgniarstwa | pon. - pt. 8.00 - 11.00 | pon. - sala 126 w CD pt. - 16.10. - 30.10. - sala 210 w NZJ 06.11. - 29.01. sala 104, ul. Litewska 14/16",
    "subject": "PROM. ZDROWIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-10-28",
    "startTime": "08:00",
    "endTime": "11:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": " 11b",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|BA2:BC2",
    "declaredTeachingHours": 20,
    "clinic": "Zakład Propedeutyki Pielęgniarstwa",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BA3-BC3 wskazuje jednostkę prowadzącą Zakład Propedeutyki Pielęgniarstwa, a BC5 przypisuje miejsca tylko poniedziałkowi i piątkom; dla środy źródło nie potwierdza sali ani miejsca zajęć"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-dd080580",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BC10",
    "sourceKey": "PLAN ZAJĘĆ|BC10|2026-10-29|08:00|11:00|PROM. ZDROWIA|G8:11B",
    "originalText": "26.10. - 30.10.2026 |  11b | PROM. ZDROWIA zajęcia praktyczne 20 godz. grupy 8-osobowe | Prof. dr hab. E. Krzych-Fałta, Zakład Propedeutyki Pielęgniarstwa | pon. - pt. 8.00 - 11.00 | pon. - sala 126 w CD pt. - 16.10. - 30.10. - sala 210 w NZJ 06.11. - 29.01. sala 104, ul. Litewska 14/16",
    "subject": "PROM. ZDROWIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-10-29",
    "startTime": "08:00",
    "endTime": "11:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": " 11b",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|BA2:BC2",
    "declaredTeachingHours": 20,
    "clinic": "Zakład Propedeutyki Pielęgniarstwa",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BA3-BC3 wskazuje jednostkę prowadzącą Zakład Propedeutyki Pielęgniarstwa, a BC5 przypisuje miejsca tylko poniedziałkowi i piątkom; dla czwartku źródło nie potwierdza sali ani miejsca zajęć"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-bd3767ad",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A24,B24",
    "sourceKey": "WYKŁADY|B24|2026-10-29|15:00|16:30|CHIRURGIA",
    "originalText": "29.10. | CHIRURGIA dr M. Hreńczuk 15.00 - 16.30 (2h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2026-10-29",
    "startTime": "15:00",
    "endTime": "16:30",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-3896c09b",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DD10",
    "sourceKey": "PLAN ZAJĘĆ|DD10|2026-10-29|16:45|20:30|INTERNA (seminaria)|MAIN:11",
    "originalText": "26.10. - 30.10.2026 | grupa 11 | INTERNA (seminaria) 15g | Dr hab. T. Kryczka, | czwartek aula A w CD | 16.45 - 20.30",
    "subject": "INTERNA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-10-29",
    "startTime": "16:45",
    "endTime": "20:30",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|DB2:DF2",
    "declaredTeachingHours": 15,
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DD4: czwartek - aula A w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      }
    ],
    "room": "Aula A",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-1eea263a",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BC10",
    "sourceKey": "PLAN ZAJĘĆ|BC10|2026-10-30|08:00|11:00|PROM. ZDROWIA|G8:11B",
    "originalText": "26.10. - 30.10.2026 |  11b | PROM. ZDROWIA zajęcia praktyczne 20 godz. grupy 8-osobowe | Prof. dr hab. E. Krzych-Fałta, Zakład Propedeutyki Pielęgniarstwa | pon. - pt. 8.00 - 11.00 | pon. - sala 126 w CD pt. - 16.10. - 30.10. - sala 210 w NZJ 06.11. - 29.01. sala 104, ul. Litewska 14/16",
    "subject": "PROM. ZDROWIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-10-30",
    "startTime": "08:00",
    "endTime": "11:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": " 11b",
    "sourceWeekStart": "2026-10-26",
    "sourceWeekEnd": "2026-10-30",
    "sourceSectionKey": "PLAN ZAJĘĆ|BA2:BC2",
    "declaredTeachingHours": 20,
    "room": "sala 210 w NZJ",
    "locationLabel": "Zakład Rozwoju Pielęgniarstwa, Nauk Społecznych i Medycznych",
    "status": "READY",
    "warnings": [],
    "include": true,
    "address": "ul. Ciołka 27",
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BC5: pt. 16.10-30.10 - sala 210 w NZJ; A72: NZJ, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BC5: pt. 16.10-30.10 - sala 210 w NZJ; A72: NZJ, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BC5: pt. 16.10-30.10 - sala 210 w NZJ; A72: NZJ, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-ed44dbaa",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A7,B7",
    "sourceKey": "WYKŁADY|B7|2026-11-03|15:00|17:15|PEDIATRIA",
    "originalText": "03.11. | PEDIATRIA prof. B. Kociszewska-Najman 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "PEDIATRIA",
    "activityType": "Wykład",
    "date": "2026-11-03",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-6011190f",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DJ11",
    "sourceKey": "PLAN ZAJĘĆ|DJ11|2026-11-06|15:15|19:00|INTERNA (seminaria)|MAIN:11",
    "originalText": "02.11. - 06.11.2026 | grupa 11 | INTERNA (seminaria) 10G | Prof. J. Wyzgał sala seminaryjna Ip, pawilon nr VIII, ul. Nowogrodzka 59 (boczne wejście do laboratorium) | piątek | 15.15 - 19.00",
    "subject": "INTERNA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-11-06",
    "startTime": "15:15",
    "endTime": "19:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-11-02",
    "sourceWeekEnd": "2026-11-06",
    "sourceSectionKey": "PLAN ZAJĘĆ|DI2:DJ2",
    "declaredTeachingHours": 10,
    "address": "ul. Nowogrodzka 59",
    "locationLabel": "Zakład Podstaw Pielęgniarstwa",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      }
    ],
    "room": "sala seminaryjna, I piętro, pawilon VIII",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-01808fe5",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "CY12",
    "sourceKey": "PLAN ZAJĘĆ|CY12|2026-11-09|10:15|14:00|FARMAKOLOGIA|MAIN:11",
    "originalText": "09.11. - 13.11.2026 | grupa 11 | FARMAKOLOGIA | Prof. dr hab. D. Mirowska-Guzel, seminaria PON. , WT. i CZW. 10.15 - 14.00 | poniedziałek | sala 203 w CD",
    "subject": "FARMAKOLOGIA",
    "activityType": "Seminaria",
    "date": "2026-11-09",
    "startTime": "10:15",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-11-09",
    "sourceWeekEnd": "2026-11-13",
    "sourceSectionKey": "PLAN ZAJĘĆ|CY2:DA2",
    "room": "sala 203 w CD",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CY5: sala 203 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "CY5: sala 203 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CY5: sala 203 w CD; oficjalny adres CD: ul. Księcia Trojdena 2a"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-a6d25cda",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "CZ12",
    "sourceKey": "PLAN ZAJĘĆ|CZ12|2026-11-10|10:15|14:00|FARMAKOLOGIA|MAIN:11",
    "originalText": "09.11. - 13.11.2026 | grupa 11 | FARMAKOLOGIA | Prof. dr hab. D. Mirowska-Guzel, seminaria PON. , WT. i CZW. 10.15 - 14.00 | wtorek | sala nr 7 niski parter, ul. Pawińskiego 3c",
    "subject": "FARMAKOLOGIA",
    "activityType": "Seminaria",
    "date": "2026-11-10",
    "startTime": "10:15",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-11-09",
    "sourceWeekEnd": "2026-11-13",
    "sourceSectionKey": "PLAN ZAJĘĆ|CY2:DA2",
    "room": "sala nr 7, niski parter",
    "address": "ul. Pawińskiego 3c",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CZ5: sala nr 7 niski parter, ul. Pawińskiego 3c"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CZ5: sala nr 7 niski parter, ul. Pawińskiego 3c"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CZ5: sala nr 7 niski parter, ul. Pawińskiego 3c"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-2f8497a4",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A8,B8",
    "sourceKey": "WYKŁADY|B8|2026-11-10|15:00|17:15|CHIRURGIA",
    "originalText": "10.11. | CHIRURGIA prof. M. Kuśmierczyk 15.00 - 17.15 (3h) | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2026-11-10",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-99e2354e",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DA12",
    "sourceKey": "PLAN ZAJĘĆ|DA12|2026-11-12|10:15|14:00|FARMAKOLOGIA|MAIN:11",
    "originalText": "09.11. - 13.11.2026 | grupa 11 | FARMAKOLOGIA | Prof. dr hab. D. Mirowska-Guzel, seminaria PON. , WT. i CZW. 10.15 - 14.00 | czwartek | sala komputerowa sala 234 w CD",
    "subject": "FARMAKOLOGIA",
    "activityType": "Seminaria",
    "date": "2026-11-12",
    "startTime": "10:15",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-11-09",
    "sourceWeekEnd": "2026-11-13",
    "sourceSectionKey": "PLAN ZAJĘĆ|CY2:DA2",
    "room": "sala komputerowa, sala 234 w CD",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DA5: sala komputerowa, sala 234 w CD"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DA5: sala komputerowa, sala 234 w CD; WYKŁADY A1: Centrum Dydaktyczne, ul. Trojdena 2a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DA5: sala komputerowa, sala 234 w CD; WYKŁADY A1: Centrum Dydaktyczne, ul. Trojdena 2a"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cca88c57",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A26,B26",
    "sourceKey": "WYKŁADY|B26|2026-11-12|15:00|18:45|INTERNA",
    "originalText": "12.11. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2026-11-12",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-2af2ca12",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AP13",
    "sourceKey": "PLAN ZAJĘĆ|AP13|2026-11-16|11:15|14:15|Podst. Rehab. ćw.|G12:11B",
    "originalText": "16.11. - 20.11.2026 | 11b | Podst. Rehab. ćw. 20 godz. grupy 12-osobowe | Prof. dr hab. B. Czarkowska-Pączek Zakład Pielegniarstwa Klinicznego sala 101, ul. Ciołka 27 | poniedziałek 11.15 - 14.15",
    "subject": "Podst. Rehab. ćw.",
    "activityType": "Ćwiczenia",
    "date": "2026-11-16",
    "startTime": "11:15",
    "endTime": "14:15",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G12:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-11-16",
    "sourceWeekEnd": "2026-11-20",
    "sourceSectionKey": "PLAN ZAJĘĆ|AO2:AT2",
    "declaredTeachingHours": 20,
    "room": "sala 101",
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Pielęgniarstwa Klinicznego",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-ad604adb",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A9,B9",
    "sourceKey": "WYKŁADY|B9|2026-11-17|15:00|17:15|POZ",
    "originalText": "17.11. | POZ dr hab. T. Kryczka 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2026-11-17",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-47a9a494",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AR13",
    "sourceKey": "PLAN ZAJĘĆ|AR13|2026-11-18|08:00|14:00|Podst. Rehab. ćw.|G12:11B",
    "originalText": "16.11. - 20.11.2026 | 11b | Podst. Rehab. ćw. 20 godz. grupy 12-osobowe | Prof. dr hab. B. Czarkowska-Pączek Zakład Pielegniarstwa Klinicznego sala 101, ul. Ciołka 27 | środa 8.00 - 14.00",
    "subject": "Podst. Rehab. ćw.",
    "activityType": "Ćwiczenia",
    "date": "2026-11-18",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G12:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-11-16",
    "sourceWeekEnd": "2026-11-20",
    "sourceSectionKey": "PLAN ZAJĘĆ|AO2:AT2",
    "declaredTeachingHours": 20,
    "room": "sala 101",
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Pielęgniarstwa Klinicznego",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-88f85cb3",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A27,B27",
    "sourceKey": "WYKŁADY|B27|2026-11-19|15:00|18:45|INTERNA",
    "originalText": "19.11. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2026-11-19",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-8472eec5",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AT13",
    "sourceKey": "PLAN ZAJĘĆ|AT13|2026-11-20|08:00|14:00|Podst. Rehab. ćw.|G12:11B",
    "originalText": "16.11. - 20.11.2026 | 11b | Podst. Rehab. ćw. 20 godz. grupy 12-osobowe | Prof. dr hab. B. Czarkowska-Pączek Zakład Pielegniarstwa Klinicznego sala 101, ul. Ciołka 27 | piątek 8.00 - 14.00",
    "subject": "Podst. Rehab. ćw.",
    "activityType": "Ćwiczenia",
    "date": "2026-11-20",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G12:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-11-16",
    "sourceWeekEnd": "2026-11-20",
    "sourceSectionKey": "PLAN ZAJĘĆ|AO2:AT2",
    "declaredTeachingHours": 20,
    "room": "sala 101",
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Pielęgniarstwa Klinicznego",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AO3/A62: Zakład Pielęgniarstwa Klinicznego, sala 101, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-3a769cc4",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM14",
    "sourceKey": "PLAN ZAJĘĆ|AM14|2026-11-23|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "23.11. - 27.11.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-23",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-9ca95785",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM14",
    "sourceKey": "PLAN ZAJĘĆ|AM14|2026-11-24|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "23.11. - 27.11.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-24",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-0565f509",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A10,B10",
    "sourceKey": "WYKŁADY|B10|2026-11-24|15:00|17:15|POZ",
    "originalText": "24.11. | POZ dr hab. T. Kryczka 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2026-11-24",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-c26bc2ee",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM14",
    "sourceKey": "PLAN ZAJĘĆ|AM14|2026-11-25|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "23.11. - 27.11.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-25",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-d145b7ef",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM14",
    "sourceKey": "PLAN ZAJĘĆ|AM14|2026-11-26|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "23.11. - 27.11.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-26",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-a4146c72",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A28,B28",
    "sourceKey": "WYKŁADY|B28|2026-11-26|15:00|18:45|INTERNA",
    "originalText": "26.11. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2026-11-26",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-700d9b60",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM14",
    "sourceKey": "PLAN ZAJĘĆ|AM14|2026-11-27|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "23.11. - 27.11.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-27",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-da91a615",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "CX14",
    "sourceKey": "PLAN ZAJĘĆ|CX14|2026-11-27|15:00|18:45|POZ ćw.|G12:11B",
    "originalText": "23.11. - 27.11.2026 | 11b | POZ ćw. 5 godz. grupy 12-osobowe | piątek sala 102 w NZN | 15.00 - 18.45",
    "subject": "POZ ćw.",
    "activityType": "Ćwiczenia",
    "date": "2026-11-27",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G12:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-11-23",
    "sourceWeekEnd": "2026-11-27",
    "sourceSectionKey": "PLAN ZAJĘĆ|CV2:CX2",
    "declaredTeachingHours": 5,
    "room": "sala 102 w NZN",
    "address": "ul. Ciołka 27",
    "locationLabel": "Zakład Pielęgniarstwa Klinicznego",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CX3: piątek - sala 102 w NZN; A62: Zakład Pielęgniarstwa Klinicznego, ul. Ciołka 27"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CX3: piątek - sala 102 w NZN; A62: Zakład Pielęgniarstwa Klinicznego, ul. Ciołka 27"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "CX3: piątek - sala 102 w NZN; A62: Zakład Pielęgniarstwa Klinicznego, ul. Ciołka 27"
      }
    ],
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cacd9525",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM15",
    "sourceKey": "PLAN ZAJĘĆ|AM15|2026-11-30|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "30.11. - 04.12.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-11-30",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-30",
    "sourceWeekEnd": "2026-12-04",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-1fbba616",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM15",
    "sourceKey": "PLAN ZAJĘĆ|AM15|2026-12-01|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "30.11. - 04.12.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-01",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-30",
    "sourceWeekEnd": "2026-12-04",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-40b4b78e",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A11,B11",
    "sourceKey": "WYKŁADY|B11|2026-12-01|15:00|17:15|POZ",
    "originalText": "01.12. | POZ dr hab. T. Kryczka 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2026-12-01",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-c22d6ab7",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM15",
    "sourceKey": "PLAN ZAJĘĆ|AM15|2026-12-02|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "30.11. - 04.12.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-02",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-30",
    "sourceWeekEnd": "2026-12-04",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-7776dbe8",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM15",
    "sourceKey": "PLAN ZAJĘĆ|AM15|2026-12-03|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "30.11. - 04.12.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-03",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-30",
    "sourceWeekEnd": "2026-12-04",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-86a7afe1",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AM15",
    "sourceKey": "PLAN ZAJĘĆ|AM15|2026-12-04|08:00|14:00|PEDIATRIA|G4:11B2",
    "originalText": "30.11. - 04.12.2026 | 11b2 | PEDIATRIA zajęcia praktyczne 80 godz. grupy 4-osobowe | pon. - pt. 8.00 - 14.00 | prof. m. Mizerska-Wasiak",
    "subject": "PEDIATRIA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-04",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-11-30",
    "sourceWeekEnd": "2026-12-04",
    "sourceSectionKey": "PLAN ZAJĘĆ|AA2:AN2",
    "declaredTeachingHours": 80,
    "address": "ul. Żwirki i Wigury 63A",
    "locationLabel": "Katedra i Klinika Pediatrii i Nefrologii",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "AM4: prof. M. Mizerska-Wasiak; A59: Katedra i Klinika Pediatrii i Nefrologii, ul. Żwirki i Wigury 63A"
      }
    ],
    "clinic": "Katedra i Klinika Pediatrii i Nefrologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-855b33d4",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "S16",
    "sourceKey": "PLAN ZAJĘĆ|S16|2026-12-07|unknown-start|unknown-end|INTERNA|G8:11B",
    "originalText": "07.12. - 11.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | wskazane poniżej dni tygodnia | Prof. R.Stec | poniedziałek",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-07",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "REVIEW_REQUIRED",
    "warnings": [
      "Plan z 06.10.2026 wskazuje zajęcia u prof. R. Steca 07.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca."
    ],
    "include": false,
    "locationProvenance": [
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "R4: prof. R. Stec; A43/A44: Klinika Onkologii, ul. Banacha 1a"
      }
    ],
    "locationLabel": "Klinika Onkologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-e39e439a",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A12,B12",
    "sourceKey": "WYKŁADY|B12|2026-12-08|15:00|17:15|POZ",
    "originalText": "08.12. | POZ dr hab. T. Kryczka 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2026-12-08",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-0444ff5a",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "T16",
    "sourceKey": "PLAN ZAJĘĆ|T16|2026-12-08|unknown-start|unknown-end|INTERNA|G8:11B",
    "originalText": "07.12. - 11.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | wskazane poniżej dni tygodnia | Prof. R.Stec | wtorek",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-08",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "REVIEW_REQUIRED",
    "warnings": [
      "Plan z 06.10.2026 wskazuje zajęcia u prof. R. Steca 08.12.2026 przy ul. Banacha 1a, ale nie podaje pełnego zakresu godzin. Nie wolno uzupełniać czasu z powtarzalnego wzorca."
    ],
    "include": false,
    "locationProvenance": [
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "R4: prof. R. Stec; A43/A44: Klinika Onkologii, ul. Banacha 1a"
      }
    ],
    "locationLabel": "Klinika Onkologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-07b62c50",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O16",
    "sourceKey": "PLAN ZAJĘĆ|O16|2026-12-09|07:30|14:00|INTERNA|G8:11B",
    "originalText": "07.12. - 11.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-09",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-40011602",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O16",
    "sourceKey": "PLAN ZAJĘĆ|O16|2026-12-10|07:30|14:00|INTERNA|G8:11B",
    "originalText": "07.12. - 11.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-10",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-2a4f769f",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O16",
    "sourceKey": "PLAN ZAJĘĆ|O16|2026-12-11|07:30|14:00|INTERNA|G8:11B",
    "originalText": "07.12. - 11.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-11",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-9fbe3558",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BE16",
    "sourceKey": "PLAN ZAJĘĆ|BE16|2026-12-11|15:00|18:45|PROMOCJA ZDROWIA (seminaria)|MAIN:11",
    "originalText": "07.12. - 11.12.2026 | grupa 11 | PROMOCJA ZDROWIA (seminaria) 10g | Prof. M. Gujski | piątek 119 CBI | 15.00 - 18.45",
    "subject": "PROMOCJA ZDROWIA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-12-11",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-12-07",
    "sourceWeekEnd": "2026-12-11",
    "sourceSectionKey": "PLAN ZAJĘĆ|BD2:BE2",
    "declaredTeachingHours": 10,
    "locationLabel": "Centrum Biblioteczno-Informacyjne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      }
    ],
    "room": "sala 119",
    "address": "ul. Żwirki i Wigury 63",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-11b5dabd",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O17",
    "sourceKey": "PLAN ZAJĘĆ|O17|2026-12-14|07:30|14:00|INTERNA|G8:11B",
    "originalText": "14.12. - 18.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-14",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-d130a2c0",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O17",
    "sourceKey": "PLAN ZAJĘĆ|O17|2026-12-15|07:30|14:00|INTERNA|G8:11B",
    "originalText": "14.12. - 18.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-15",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-b999bfd5",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A13,B13",
    "sourceKey": "WYKŁADY|B13|2026-12-15|15:00|17:15|POZ",
    "originalText": "15.12. | POZ dr hab. T. Kryczka 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2026-12-15",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-58584f47",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O17",
    "sourceKey": "PLAN ZAJĘĆ|O17|2026-12-16|07:30|14:00|INTERNA|G8:11B",
    "originalText": "14.12. - 18.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-16",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-134f88a8",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DI17",
    "sourceKey": "PLAN ZAJĘĆ|DI17|2026-12-16|15:15|19:00|INTERNA (seminaria)|MAIN:11",
    "originalText": "14.12. - 18.12.2026 | grupa 11 | INTERNA (seminaria) 10G | Prof. J. Wyzgał sala seminaryjna Ip, pawilon nr VIII, ul. Nowogrodzka 59 (boczne wejście do laboratorium) | środa | 15.15 - 19.00",
    "subject": "INTERNA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-12-16",
    "startTime": "15:15",
    "endTime": "19:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|DI2:DJ2",
    "declaredTeachingHours": 10,
    "address": "ul. Nowogrodzka 59",
    "locationLabel": "Zakład Podstaw Pielęgniarstwa",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DI3/A74: sala seminaryjna I p., pawilon VIII, ul. Nowogrodzka 59"
      }
    ],
    "room": "sala seminaryjna, I piętro, pawilon VIII",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cd317b6a",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O17",
    "sourceKey": "PLAN ZAJĘĆ|O17|2026-12-17|07:30|14:00|INTERNA|G8:11B",
    "originalText": "14.12. - 18.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-17",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-c406fd9b",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A31,B31",
    "sourceKey": "WYKŁADY|B31|2026-12-17|15:00|18:45|INTERNA",
    "originalText": "17.12. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2026-12-17",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-5e43c981",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "O17",
    "sourceKey": "PLAN ZAJĘĆ|O17|2026-12-18|07:30|14:00|INTERNA|G8:11B",
    "originalText": "14.12. - 18.12.2026 | 11b | INTERNA zajęcia praktyczne 80 godz. grupy 8-osobowe | pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca) | Dr hab. Ł. Czyżewski zajęcia od 7.30",
    "subject": "INTERNA",
    "activityType": "Zajęcia praktyczne",
    "date": "2026-12-18",
    "startTime": "07:30",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|K2:Z2",
    "declaredTeachingHours": 80,
    "address": "ul. Lindleya 4",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "O4: dr hab. Ł. Czyżewski; A38: zajęcia realizowane w Klinice Chorób Wewnętrznych i Kardiologii, ul. Lindleya 4"
      }
    ],
    "clinic": "Klinika Chorób Wewnętrznych i Kardiologii",
    "locationLabel": "Klinika Chorób Wewnętrznych i Kardiologii",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-27f8997a",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "BE17",
    "sourceKey": "PLAN ZAJĘĆ|BE17|2026-12-18|15:00|18:45|PROMOCJA ZDROWIA (seminaria)|MAIN:11",
    "originalText": "14.12. - 18.12.2026 | grupa 11 | PROMOCJA ZDROWIA (seminaria) 10g | Prof. M. Gujski | piątek 119 CBI | 15.00 - 18.45",
    "subject": "PROMOCJA ZDROWIA (seminaria)",
    "activityType": "Seminaria",
    "date": "2026-12-18",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2026-12-14",
    "sourceWeekEnd": "2026-12-18",
    "sourceSectionKey": "PLAN ZAJĘĆ|BD2:BE2",
    "declaredTeachingHours": 10,
    "locationLabel": "Centrum Biblioteczno-Informacyjne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "BE4: piątek - 119 CBI; oficjalny adres CBI WUM: ul. Żwirki i Wigury 63"
      }
    ],
    "room": "sala 119",
    "address": "ul. Żwirki i Wigury 63",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-09bc6506",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A14,B14",
    "sourceKey": "WYKŁADY|B14|2027-01-05|15:00|18:45|POZ",
    "originalText": "05.01. | POZ dr hab. T. Kryczka 15.00 - 18.45 (5)  TEAMS | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "POZ",
    "activityType": "Wykład",
    "date": "2027-01-05",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_DIRECT",
        "evidence": "WYKŁADY B14: POZ 15.00-18.45 TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B"
      },
      {
        "field": "room",
        "source": "SOURCE_DIRECT",
        "evidence": "WYKŁADY B14: POZ 15.00-18.45 TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B"
      },
      {
        "field": "address",
        "source": "SOURCE_DIRECT",
        "evidence": "WYKŁADY B14: POZ 15.00-18.45 TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_DIRECT",
        "evidence": "WYKŁADY B14: POZ 15.00-18.45 TEAMS; wpis online ma pierwszeństwo przed globalną Aulą B"
      }
    ],
    "clinic": "Microsoft Teams",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-d7413112",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A32,B32",
    "sourceKey": "WYKŁADY|B32|2027-01-07|15:00|18:45|INTERNA",
    "originalText": "07.01. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2027-01-07",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-c184d38b",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DH18",
    "sourceKey": "PLAN ZAJĘĆ|DH18|2027-01-08|15:15|19:00|PEDIATRIA NZYN (seminaria)|MAIN:11",
    "originalText": "04.01. - 08.01.2027 | grupa 11 | PEDIATRIA NZYN (seminaria) 10g | sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a | piątek | 15.15 - 19.00",
    "subject": "PEDIATRIA NZYN (seminaria)",
    "activityType": "Seminaria",
    "date": "2027-01-08",
    "startTime": "15:15",
    "endTime": "19:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2027-01-04",
    "sourceWeekEnd": "2027-01-08",
    "sourceSectionKey": "PLAN ZAJĘĆ|DG2:DH2",
    "declaredTeachingHours": 10,
    "room": "sala seminaryjna",
    "address": "ul. Żwirki i Wigury 63A",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      }
    ],
    "clinic": "Klinika Neonatologii i Chorób Rzadkich",
    "locationLabel": "Klinika Neonatologii i Chorób Rzadkich",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-74adb502",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A15,B15",
    "sourceKey": "WYKŁADY|B15|2027-01-12|15:00|17:15|CHIRURGIA",
    "originalText": "12.01. | CHIRURGIA dr hab. P. Sosnowska-Sienkiewicz 15.00 - 17.15 (3h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2027-01-12",
    "startTime": "15:00",
    "endTime": "17:15",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-c3d2a773",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A33,B33",
    "sourceKey": "WYKŁADY|B33|2027-01-14|15:00|18:45|INTERNA",
    "originalText": "14.01. | INTERNA dr hab. T. Kryczka 15.00 - 18.45 (5h)  | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) CZWARTKI (AULA A) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "INTERNA",
    "activityType": "Wykład",
    "date": "2027-01-14",
    "startTime": "15:00",
    "endTime": "18:45",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA A",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-56045c26",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DH19",
    "sourceKey": "PLAN ZAJĘĆ|DH19|2027-01-15|15:15|19:00|PEDIATRIA NZYN (seminaria)|MAIN:11",
    "originalText": "11.01. - 15.01.2027 | grupa 11 | PEDIATRIA NZYN (seminaria) 10g | sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a | piątek | 15.15 - 19.00",
    "subject": "PEDIATRIA NZYN (seminaria)",
    "activityType": "Seminaria",
    "date": "2027-01-15",
    "startTime": "15:15",
    "endTime": "19:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2027-01-11",
    "sourceWeekEnd": "2027-01-15",
    "sourceSectionKey": "PLAN ZAJĘĆ|DG2:DH2",
    "declaredTeachingHours": 10,
    "room": "sala seminaryjna",
    "address": "ul. Żwirki i Wigury 63A",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DG3: sala seminaryjna w Klinice Neonatologii i Chorób Rzadkich, ul. Żwirki i Wigury 63a"
      }
    ],
    "clinic": "Klinika Neonatologii i Chorób Rzadkich",
    "locationLabel": "Klinika Neonatologii i Chorób Rzadkich",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-5c13cfab",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D20",
    "sourceKey": "PLAN ZAJĘĆ|D20|2027-01-18|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "18.01. - 22.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-18",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-18",
    "sourceWeekEnd": "2027-01-22",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-de382406",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D20",
    "sourceKey": "PLAN ZAJĘĆ|D20|2027-01-19|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "18.01. - 22.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-19",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-18",
    "sourceWeekEnd": "2027-01-22",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-21b26e38",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "WYKŁADY",
    "sourceRange": "A16,B16",
    "sourceKey": "WYKŁADY|B16|2027-01-19|15:00|16:30|CHIRURGIA",
    "originalText": "19.01. | CHIRURGIA dr hab. P. Sosnowska-Sienkiewicz 15.00 - 16.30 (2h) | WYKŁADY II ROK PIELĘGNIARSTWO STACJONARNE PIERWSZEGO STOPNIA (SEMESTR ZIMOWY 2026/2027) WTORKI (AULA B) Centrum Dydaktyczne, ul. Trojdena 2a",
    "subject": "CHIRURGIA",
    "activityType": "Wykład",
    "date": "2027-01-19",
    "startTime": "15:00",
    "endTime": "16:30",
    "groupScope": "ALL",
    "groupTags": [],
    "room": "AULA B",
    "address": "ul. Trojdena 2a",
    "locationLabel": "Centrum Dydaktyczne",
    "status": "READY",
    "warnings": [],
    "include": true,
    "manuallyReviewed": true
  },
  {
    "id": "candidate-0defb412",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D20",
    "sourceKey": "PLAN ZAJĘĆ|D20|2027-01-20|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "18.01. - 22.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-20",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-18",
    "sourceWeekEnd": "2027-01-22",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-19d7a6c7",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D20",
    "sourceKey": "PLAN ZAJĘĆ|D20|2027-01-21|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "18.01. - 22.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-21",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-18",
    "sourceWeekEnd": "2027-01-22",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-1920af74",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D20",
    "sourceKey": "PLAN ZAJĘĆ|D20|2027-01-22|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "18.01. - 22.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-22",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-18",
    "sourceWeekEnd": "2027-01-22",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-1c2b2b1c",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D21",
    "sourceKey": "PLAN ZAJĘĆ|D21|2027-01-25|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "25.01. - 29.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-25",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-cf94a54f",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D21",
    "sourceKey": "PLAN ZAJĘĆ|D21|2027-01-26|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "25.01. - 29.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-26",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-4fa2e4ba",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D21",
    "sourceKey": "PLAN ZAJĘĆ|D21|2027-01-27|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "25.01. - 29.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-27",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-137fd627",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "DK21",
    "sourceKey": "PLAN ZAJĘĆ|DK21|2027-01-27|15:15|19:00|CHIRURGIA (seminaria)|MAIN:11",
    "originalText": "25.01. - 29.01.2027 | grupa 11 | CHIRURGIA (seminaria) 15g | Dr M. Hreńczuk sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, paw. XI D1 | środa | 15.15 - 19.00",
    "subject": "CHIRURGIA (seminaria)",
    "activityType": "Seminaria",
    "date": "2027-01-27",
    "startTime": "15:15",
    "endTime": "19:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "MAIN:11"
    ],
    "originalGroupText": "grupa 11",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|DK2:DL2",
    "declaredTeachingHours": 15,
    "room": "sala seminaryjna 128 w NZS, pawilon XI D1",
    "address": "ul. Nowogrodzka 59",
    "locationLabel": "Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DK3/A77: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1"
      },
      {
        "field": "room",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DK3/A77: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1"
      },
      {
        "field": "address",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DK3/A77: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "DK3/A77: sala seminaryjna 128 w NZS, ul. Nowogrodzka 59, pawilon XI D1"
      }
    ],
    "clinic": "Zakład Pielęgniarstwa Chirurgicznego, Transplantacyjnego i Leczenia Pozaustrojowego",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-e4b595dd",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D21",
    "sourceKey": "PLAN ZAJĘĆ|D21|2027-01-28|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "25.01. - 29.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-28",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-9ad5cbc0",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "D21",
    "sourceKey": "PLAN ZAJĘĆ|D21|2027-01-29|08:00|14:00|CHIRURGIA I BLOK OPERACYJNY|G8:11B",
    "originalText": "25.01. - 29.01.2027 | 11b | CHIRURGIA I BLOK OPERACYJNY zajęcia praktyczne 80 godz. chirurgia - grupy 8-osobowe, blok operacyjny - grupy 4-osobowe | pon. - pt. 8.00 - 14.00 zajęcia prowadzi Zakład NZS, po. kierownika dr Marta Hreńczuk w Klinikach kierowanych przez wskazanych Panów Profesorów | Prof. M. Słodkowski",
    "subject": "CHIRURGIA I BLOK OPERACYJNY",
    "activityType": "Zajęcia praktyczne",
    "date": "2027-01-29",
    "startTime": "08:00",
    "endTime": "14:00",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G8:11B"
    ],
    "originalGroupText": "11b",
    "sourceWeekStart": "2027-01-25",
    "sourceWeekEnd": "2027-01-29",
    "sourceSectionKey": "PLAN ZAJĘĆ|B2:J2",
    "declaredTeachingHours": 80,
    "address": "ul. Banacha 1a",
    "locationLabel": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "status": "READY",
    "warnings": [],
    "include": true,
    "locationProvenance": [
      {
        "field": "clinic",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "address",
        "source": "OFFICIAL_EXTERNAL",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      },
      {
        "field": "locationLabel",
        "source": "SOURCE_CROSS_REFERENCE",
        "evidence": "B3/D4/A27-A28: blok prof. M. Słodkowskiego w Katedrze i Klinice Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej; arkusz podaje Banacha 1, aktualny oficjalny adres jednostki WUM to ul. Banacha 1a, budynek B"
      }
    ],
    "clinic": "Katedra i Klinika Chirurgii Ogólnej, Gastroenterologicznej i Onkologicznej",
    "manuallyReviewed": true
  },
  {
    "id": "candidate-264b0cf5",
    "adapterId": "nursing-week-matrix-v2",
    "sourceSheet": "PLAN ZAJĘĆ",
    "sourceRange": "AY9",
    "sourceKey": "PLAN ZAJĘĆ|AY9|19.10. - 23.10.2026|unknown-start|unknown-end|POZ|G4:11B2",
    "originalText": "19.10. - 23.10.2026 | 11b2 | POZ zajęcia praktyczne 40 godz. grupy 4- osobowe | Pierwsze spotkanie - szkolenie RODO i BHP od godz. 8.30; adresy jednostek, w których będą odbywać się szkolenia podane zostaną na stronie Zakładu Rozwoju Pielęgniarstwa | Przychodnia lekarska, ul. Jadżwingów 9",
    "subject": "POZ",
    "activityType": "Zajęcia praktyczne",
    "groupScope": "SPECIFIC",
    "groupTags": [
      "G4:11B2"
    ],
    "originalGroupText": "11b2",
    "sourceWeekStart": "2026-10-19",
    "sourceWeekEnd": "2026-10-23",
    "sourceSectionKey": "PLAN ZAJĘĆ|AU2:AZ2",
    "declaredTeachingHours": 40,
    "address": "ul. Jadżwingów 9",
    "status": "REVIEW_REQUIRED",
    "warnings": [
      "Plan z 06.10.2026 przypisuje POZ grupy 11B2 do tygodnia 19-23.10.2026 przy ul. Jadżwingów 9, ale nie podaje jednoznacznego dnia ani pełnego zakresu godzin. Wpis pozostaje source-only i nie tworzy fikcyjnego wydarzenia."
    ],
    "include": false,
    "manuallyReviewed": true
  }
];

export const VERIFIED_STUDY_CURRENT_UNDATED_REQUIREMENTS_2026_10_06 = [
  {
    sourceSheet: 'WYKŁADY',
    sourceRange: 'A20',
    subject: 'PROMOCJA ZDROWIA',
    activityType: 'E-learning',
    declaredTeachingHours: 5,
    note: 'Plan podaje 5 godzin na platformie e-learningowej, ale nie podaje konkretnej daty ani przedziału czasu. Nie wolno tworzyć sztucznego wydarzenia kalendarza.',
  },
] as const;

export function verifiedStudyCurrentScheduleCandidates(): StudyScheduleCandidate[] {
  return VERIFIED_STUDY_CURRENT_SCHEDULE_2026_10_06.map((candidate) => ({
    ...candidate,
    groupTags: [...candidate.groupTags],
    warnings: [...candidate.warnings],
    ...(candidate.locationProvenance?.length
      ? { locationProvenance: candidate.locationProvenance.map((item) => ({ ...item })) }
      : {}),
  }));
}
