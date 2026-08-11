## 0.7.0 - GlobalSearchResult

`GlobalSearchItem` / wynik wyszukiwania jest derived, ephemeral UI data. Powstaje w pamięci z `CalendarEvent` i `Location`, nie jest canonical user data i nie trafia do IndexedDB, backupu ani Data Transfer. Search kind: `EVENT | STUDY | WORK | LOCATION`. Query i ranking nie są przechowywane. Dane Cyklu nie są wejściem modelu wyszukiwania.

# Model danych 0.4.0

## CalendarEvent

Pola podstawowe:

- id,
- title,
- description,
- startDateTime,
- endDateTime,
- allDay,
- spanType - SINGLE_DAY | MULTI_DAY,
- locationId,
- category,
- source,
- createdAt,
- updatedAt.

Dla ręcznej serii wielu dat opcjonalnie:

- seriesId,
- seriesType = MANUAL_MULTI_DATE.

`seriesId` ręcznych wydarzeń jest niezależne od `seriesKey` planu studiów.

Dla `UNIVERSITY_XLSX` opcjonalnie:

- sourceImportId,
- sourceEntryId,
- occurrenceKey,
- seriesKey,
- studyIssueCodes,
- userModified,
- userModifiedFields.

`userModifiedFields` może wskazywać:

- title,
- startDateTime,
- endDateTime,
- locationId,
- description,
- category,
- allDay.

## StudyScheduleCandidate

Model roboczy importera zawiera m.in.:

- id,
- adapterId,
- sourceSheet,
- sourceRange,
- sourceKey,
- originalText,
- subject,
- activityType,
- date,
- startTime,
- endTime,
- groupScope,
- groupTags,
- clinic,
- room,
- address,
- locationLabel,
- status,
- warnings,
- include,
- manuallyReviewed,
- manuallyModifiedFields,
- occurrenceKey,
- seriesKey.

`manuallyModifiedFields` służy do ochrony konkretnych pól poprawionych jeszcze przed pierwszym importem.

## UniversityScheduleImport

Najważniejsze pola:

- id,
- fileName,
- fileSize,
- fileHash,
- importedAt,
- adapterId,
- sheetNames,
- detectedAcademicYear,
- detectedTerm,
- selectedGroups,
- availableGroups,
- importedEventCount,
- warningCount,
- status,
- lifecycleStatus - ACTIVE | HISTORICAL,
- sourceDataComplete,
- replacedImportId.

Oryginalny XLSX nie jest zapisywany.

## UniversityImportEntry

Ustandaryzowany rekord źródłowy:

- id,
- importId,
- adapterId,
- sourceKey,
- eventId,
- sourceOnly,
- sourceSheet,
- sourceRange,
- originalText,
- subject,
- activityType,
- date,
- startTime,
- endTime,
- groupScope,
- groupTags,
- clinic,
- room,
- address,
- locationLabel,
- warnings,
- occurrenceKey,
- seriesKey,
- userDeleted.

`sourceOnly = true` oznacza znormalizowany wpis potrzebny do późniejszego przeliczenia grup, który nie jest bezpośrednio powiązany z wydarzeniem kalendarza.

## StudyProfile

Rekord `id = university`:

- selectedGroups,
- availableGroups,
- detectedAcademicYear,
- detectedTerm,
- studyName,
- activeImportId,
- sourceDataComplete,
- lastPlanUpdatedAt,
- updatedAt.

## ScheduleUpdateSession

Lokalny zapis sesji porównania:

- id,
- baseImportId,
- newFileHash,
- newFileName,
- createdAt,
- appliedAt,
- cancelledAt,
- status - PREVIEW | APPLIED | CANCELLED,
- summary.

Nie przechowuje surowego XLSX.

## StudyCorrectionRule

- id,
- seriesKey,
- field - address | room | clinic | locationLabel,
- value,
- createdAt,
- updatedAt,
- source = USER_SERIES_CORRECTION,
- active.

Reguła nie jest globalna dla nazwy przedmiotu. Dotyczy konkretnego `seriesKey`.

## ScheduleUpdatePreview

Model tymczasowy obejmuje:

- bazowy import,
- metadane nowego pliku,
- kandydatów,
- pełny zestaw kandydatów źródłowych,
- listę diff items,
- summary,
- konflikty z zapisanymi correction rules.

## GroupRecalculationPreview

Podgląd zmiany grup przechowuje:

- stare i nowe grupy,
- kandydatów do dodania,
- wpisy i wydarzenia do usunięcia,
- wydarzenia ręcznie zmodyfikowane, które należy zachować jako MANUAL,
- liczbę niezmienionych wydarzeń,
- informację, czy wymagane jest ponowne wskazanie XLSX.

## Migracja 2 -> 3

Migracja:

- tworzy `scheduleUpdateSessions`,
- tworzy `studyCorrectionRules`,
- dodaje indeksy `seriesKey` i `occurrenceKey`,
- oznacza najnowszy istniejący import jako ACTIVE, starsze jako HISTORICAL,
- uzupełnia profil o aktywny import,
- wylicza seriesKey / occurrenceKey dla starych wpisów, jeśli dane są wystarczające,
- przenosi klucze do powiązanych CalendarEvent,
- nie zmienia treści wydarzeń i nie kasuje danych.


## Schema 3 w 0.2.2

`DATABASE_SCHEMA_VERSION` pozostaje 3. Hardening parsera nie dodaje store'ów ani migracji.

`ScheduleDiagnostics` jest wyłącznie modelem roboczym analizy XLSX i nie jest zapisywany w IndexedDB. Dodatkowe metadane snapshotu, takie jak ukryte wiersze/kolumny lub informacja o komórce daty, służą tylko interpretacji bieżącego pliku.

## Migracja 3 -> 4

Migracja:

- nie tworzy nowych store'ów,
- dodaje indeks `seriesId` do `events`,
- zachowuje wszystkie MANUAL i UNIVERSITY_XLSX,
- zachowuje userModified, importy, correction rules, profile, lokalizacje i ustawienia,
- ustawia `allDay = false` dla istniejących wydarzeń,
- wylicza `spanType` z istniejących startDateTime/endDateTime,
- nie tworzy `seriesId` dla starych rekordów.

## Ręczna seria wielu dat

Jedna operacja utworzenia na kilku wybranych dniach tworzy osobne wydarzenie dla każdej daty. Wspólne `seriesId` pozwala edytować lub usunąć serię atomowo. Data każdego wystąpienia pozostaje jego własną właściwością i nie jest zastępowana przy zbiorczej edycji.
## Schema 5 - bezpieczeństwo i podglądy

### ChangeJournalEntry

- id, timestamp, operationType, entityType, entityIds, description,
- beforeState / afterState lub restorePointId,
- reversible, undoneAt, groupId, metadata.

Historia jest ograniczona do 100 ostatnich operacji.

### TrashItem

- id, entityType, entityId/entityIds, displayName, deletedAt, source, payload, metadata.

Kosz przechowuje dane potrzebne do przywrócenia ręcznego wydarzenia lub serii.

### RestorePoint

- id, createdAt, label, reason, schemaVersion, appVersion, snapshot,
- checksum lub integrityMarker, sizeBytes, automatic, pinned.

Automatyczne nieprzypięte punkty mają limit 10.

### DayConstraint

- id, date (`YYYY-MM-DD`),
- type = `EXCLUDE_FROM_WORK_AVAILABILITY`,
- note, source = MANUAL, active, createdAt, updatedAt.

Ograniczenie nie blokuje ręcznych wydarzeń. Jest kontraktem dla przyszłego optymalizatora pracy.

### StudyPreviewProfile

- id, name, selectedGroups, createdAt, updatedAt.

Profil podglądowy nie posiada `activeImportId` i nie zastępuje `StudyProfile`. Służy tylko do szybkiego ponownego otwierania zestawu grup w izolowanym podglądzie.

### BackupDocument

- format = `inteligentny-kalendarz-backup`,
- backupVersion = 1,
- appVersion, databaseSchemaVersion, createdAt, checksum,
- data = wersjonowany `DatabaseSnapshot`.

Backup obejmuje aktywne dane, Kosz, DayConstraint, profile podglądowe i ograniczoną historię zmian. Nie zawiera oryginalnych XLSX ani wewnętrznych restore points.

## Migracja 4 -> 5

Migracja:

- zachowuje wszystkie CalendarEvent, w tym all-day, multi-day i manual multi-date,
- zachowuje importy, wpisy źródłowe, profil studiów, diff sessions i correction rules,
- tworzy `changeJournal`, `trashItems`, `restorePoints`, `dayConstraints` i `studyPreviewProfiles`,
- nie tworzy przypadkowych wpisów Kosza ani DayConstraint,
- nie zmienia treści istniejących wydarzeń.



## Schema 6 - praca

### WorkProfile

- `id`, `employeeMatchName`, `employerName`, `workplaceName`,
- opcjonalny `locationId`,
- `storeCoworkerSchedule`,
- `active`, `createdAt`, `updatedAt`, opcjonalne `notes`.

### WorkScheduleImport

- `id`, `profileId`, `fileName`, `fileHash`, `importedAt`,
- `periodStart`, `periodEnd`, `adapterId`, `lifecycleStatus`,
- `shiftCount`, `totalMinutes`, opcjonalne `sourceReportedMinutes`,
- `warningCount`, `blockingCount`, `coworkerShiftCount`.

### WorkScheduleEntry

- `id`, `importId`, `profileId`, `date`, `type`,
- opcjonalne `startTime`, `endTime`, `minutes`, `rawCode`,
- `status`, `issues`, `sourcePage`, opcjonalny `sourceContext`,
- `workOccurrenceKey`, opcjonalny `eventId`, `userDeleted`.

### WorkCoworkerShift

Opcjonalny minimalny rekord zespołu zapisywany wyłącznie po włączeniu funkcji podglądu:

- `id`, `importId`, `date`,
- `displayName`, techniczne `normalizedName`,
- `startTime`, `endTime`, `minutes`, `sourcePage`.

Nie zawiera surowego PDF ani danych kadrowych niezwiązanych z nakładaniem zmian.

### CalendarEvent WORK_PDF

`CalendarEvent.source` obsługuje `WORK_PDF`. Dodatkowo może posiadać `sourceWorkImportId` i `sourceWorkEntryId`. Ręczna edycja takiego wydarzenia ustawia `userModified`, tak samo jak chroniona ręczna korekta zajęć.

### Migracja 5 -> 6

Migracja tworzy `workProfiles`, `workScheduleImports`, `workScheduleEntries` i `workCoworkerShifts`, dodaje indeksy źródła pracy do `events` i zachowuje wszystkie wcześniejsze store'y. Nie tworzy automatycznie profilu z realnymi danymi osobowymi.


## Schema 7 - 0.3.1

Nowe dane trwałe: `DayPlanningProfile`, `DailyRoutineRule`, `DayAttribute` (`TRADING_SUNDAY`) oraz `ConsistencyAcknowledgement`. `CalendarEvent` może zawierać `availabilityImpact = BLOCKING | NON_BLOCKING`. Stare all-day bez pola są interpretowane jako nieblokujące; timed event bez pola pozostaje blokujący. Dynamiczny `CalendarConsistencyIssue` nie jest źródłem prawdy w IndexedDB.


## AvailabilityPlan - schema 8

Jeden rekord na tydzień zawiera:

- id, weekStart, weekEnd, createdAt, updatedAt,
- inputFingerprint,
- status: DRAFT | ACCEPTED | STALE,
- targetWeeklyWorkMinutes, confirmedWorkMinutes, requiredAvailabilityMinutes,
- acceptedAvailabilityMinutes, remainingMinutes, maximumSafeCoverageMinutes, deficitMinutes,
- blocks,
- sentSnapshots.

`AvailabilityBlock` zawiera datę, start/end, minuty, status `PROPOSED | ACCEPTED | EDITED | REJECTED`, `locked`, `userEdited`, `candidateKey` i krótkie `explanationFacts`. Nie jest `CalendarEvent` i nie zwiększa `workCount`.

`DayPlanningProfile` w schema 8 może dodatkowo przechowywać `allowedWorkStart`, `allowedWorkEnd` i `maximumWorkMinutesPerDay`. Twarde allowed hours są odrębne od miękkich preferred hours.


## 0.3.3 - brak nowego trwałego modelu

`DATABASE_SCHEMA_VERSION` pozostaje 8. Uproszczenie Ustawień i modułu Praca nie zmienia zapisanych rekordów `DayPlanningProfile`, `DailyRoutineRule` ani `WorkProfile`.

`AvailabilityWorkComparison` jest modelem pochodnym wyliczanym w pamięci z:

- wybranego `AvailabilitySentSnapshot`,
- rzeczywistych zmian `WORK_PDF`.

Zawiera podsumowanie liczby zmian oraz dla każdej zmiany m.in. `shiftMinutes`, `coveredMinutes`, `outsideMinutes`, `uncoveredIntervals` i status zgodności. Wynik nie jest store'em IndexedDB, nie wchodzi do backupu i po odtworzeniu danych jest liczony ponownie. `MANUAL + WORK` pozostaje potwierdzoną pracą dla optimizera, ale nie jest domyślnie traktowane jako grafik pracodawcy w comparison 0.3.3.


## 0.3.3-hotfix.1 - rozszerzenia bez migracji schema

`DATABASE_SCHEMA_VERSION = 8`. Nie dodano nowego store.

`AvailabilityPlan` może opcjonalnie zawierać `dayRules: AvailabilityDayRule[]`.

`AvailabilityDayRule`:
- `date`,
- `excluded`,
- opcjonalne `earliestTime`,
- opcjonalne `latestTime`,
- `blockedIntervals[]`,
- `updatedAt`.

`AvailabilityBlock` może zawierać:
- `origin: OPTIMIZER | MANUAL`,
- `validationState: VALID | CONFLICT`,
- `validationMessage`.

Pola są opcjonalne dla zgodności ze starymi rekordami schema 8. Stare bloki bez `origin` są interpretowane jako `OPTIMIZER`.


## 0.3.3-hotfix.3 - semantyka bez zmiany schema

`DATABASE_SCHEMA_VERSION = 8`. Nie dodano nowego pola ani store'a wymaganego przez hotfix. Zmieniono interpretację UI istniejącego modelu:

- brak `AvailabilityDayRule` = użyj automatycznie standardowych ram i kalendarza,
- brak `AvailabilityBlock` = optimizer może nadal zaproponować dyspozycyjność,
- `earliestTime` i `latestTime` są opcjonalnym zawężeniem konkretnej daty,
- dokładny `AvailabilityBlock` jest tworzony dopiero przez optimizer albo świadomy ręczny wpis użytkowniczki.


## Schema 9 - ShoppingItem

`DATABASE_SCHEMA_VERSION = 9`. Migracja 8 -> 9 dodaje wyłącznie store `shoppingItems` z `keyPath: id`; istniejące stores i rekordy nie są modyfikowane.

`ShoppingItem`:

- `id: string`
- `name: string`
- `quantity?: string`
- `isPurchased: boolean`
- `createdAt: string`
- `updatedAt: string`
- `purchasedAt?: string`

Brak kategorii, ceny, sklepu, terminu i powiązania z `CalendarEvent`. Starszy backup schema 8 jest migrowany z pustym `shoppingItems`.


## Kanoniczny plik backupu/transferu 0.3.6

Przenoszenie danych nie dodaje nowego store ani nowej encji trwałej. `DATABASE_SCHEMA_VERSION` pozostaje 9.

Dokument transferu używa istniejącego `BackupDocument`:

- `format = inteligentny-kalendarz-backup`,
- `backupVersion = 1` - wersja formatu pliku,
- `appVersion`,
- `databaseSchemaVersion`,
- `createdAt`,
- `checksum`,
- `data` - `DatabaseSnapshot` z logicznymi store'ami.

`DatabaseSnapshot` obejmuje m.in. wydarzenia, dane studiów, pracę i zespół, dyspozycyjność, ustawienia, lokalizacje, Kosz, historię zmian oraz `shoppingItems`. Restore points nie są wkładane rekurencyjnie do snapshotu. Podsumowanie pracy pozostaje derived i jest przeliczane po imporcie.

Import 0.3.6 jest trybem replace. Starsze kompatybilne schema 7 i 8 są migrowane do aktualnego modelu; schema nowsza niż 9 jest blokowana.


## 0.3.7 - bez zmiany modelu danych

`DATABASE_SCHEMA_VERSION = 9`. Persistent Storage API, stan dostępności instalacji PWA, aktywne modale, wybrana zakładka i statusy UX nie są trwałymi rekordami aplikacji. `Przenoszenie danych` nadal korzysta z kanonicznego `BackupDocument` 0.3.6; zmienia się jego ekspozycja w UI, nie format ani schema IndexedDB.

## Schema 10 - CyclePeriod

`DATABASE_SCHEMA_VERSION = 10`. Migracja 9 -> 10 dodaje wyłącznie store `cyclePeriods` z `keyPath: id` oraz unikalnym indeksem `startDate`. Stare store'y nie są przepisywane.

`CyclePeriod`:

- `id: string`
- `startDate: LocalDateString`
- `endDate?: LocalDateString`
- `isUserMarkedAtypical?: boolean`
- `previousGapDecision?: CONFIRMED_SINGLE_CYCLE | OBSERVATION_BREAK`
- `createdAt: string`
- `updatedAt: string`

`previousGapDecision` opisuje odstęp od poprzedniego chronologicznego `CyclePeriod`. `OBSERVATION_BREAK` wyklucza odstęp z uczenia, ale nie usuwa żadnej daty. Zmiana dat albo sąsiedztwa wpisów unieważnia decyzję dla dotkniętej relacji.

`CyclePrediction`, diagnostics, missed-log candidates i possible-shift state są danymi derived i nie mają osobnych store'ów.

## Schema 11 - historyczne lokalne struktury reminderów

Migracja 10 -> 11 dodała dwa lokalne store'y odtwarzalne i nie przepisywała store'ów użytkownika. Finalne `1.0.0` zachowuje je w schema 12 wyłącznie dla kompatybilności istniejących instalacji i aby uniknąć ryzykownej migracji czyszczącej.

`notificationRuntime` - device-local rekord techniczny. Finalny webowy `1.0.0` nie używa go do rejestracji zdalnego Push. Może nadal przechować lokalny timestamp ostatniego backupu/historyczne pola ze starszego RC. Nie jest częścią canonical backup/Data Transfer.

`notificationReminders` - historyczny/odtwarzalny store derived reminderów. Finalny webowy `1.0.0` nie synchronizuje go z siecią ani nie pokazuje z niego systemowych powiadomień. Nie jest eksportowany ani przenoszony.

`AppSettings.notificationPreferences` pozostaje trwałą preferencją użytkownika i może wejść do backup/Data Transfer. Zachowanie pola pozwala później podłączyć czysty planner do lokalnych powiadomień aplikacji Android bez zmiany canonical danych.

Finalny `1.0.0` nie ma zdalnego D1 ani backendowego modelu danych.

## AppSettings - 0.5.1

`AppSettings` ma utrwalane pole `decorativeBackgroundMode` o wartościach `off | static | animated`. Pole korzysta z istniejącego store `settings`, więc nie wymaga migracji i `DATABASE_SCHEMA_VERSION` pozostaje 11. Rekordy i backupy bez pola są normalizowane do `static`.

## 0.6.0 - Dziennik Cyklu i schema 12

`DATABASE_SCHEMA_VERSION = 12`. Migracja 11 -> 12 dodaje wyłącznie `cycleJournalEntries` z `keyPath: id` i unikalnym indeksem `date`. Istniejące `cyclePeriods` i inne dane użytkownika nie są przepisywane.

`CycleJournalEntry` przechowuje `date`, opcjonalne `bleeding`, `pain`, `wellbeing`, `note` oraz timestamps. Brak pola nie oznacza wartości `NONE`. Na jedną datę może istnieć jeden wpis. Dziennik jest canonical user data i wchodzi do Restore Points, backupu oraz Data Transfer. Nie jest wejściem `cycle-v1`.

## 0.6.1 - CyclePatternSummary jako derived data

0.6.1 nie dodaje trwałego modelu danych. `CyclePatternSummary` istnieje wyłącznie w pamięci i jest deterministycznie wyliczany z `CyclePeriod[]` + `CycleJournalEntry[]`.

Podsumowanie może zawierać:

- liczbę zakończonych miesiączek,
- liczbę wpisów Dziennika dopasowanych do ich dni,
- opcjonalną typową długość miesiączki,
- opcjonalny wynik `VALUE` albo `MIXED` dla krwawienia, bólu i samopoczucia.

Nie ma store `cyclePatterns`, nie ma migracji schema i nie ma osobnej sekcji wzorców w backupie. `DATABASE_SCHEMA_VERSION` pozostaje 12.

## 0.6.2 - rozszerzenie CycleJournalEntry

`CycleJournalEntry` i `CycleJournalEntryDraft` otrzymują opcjonalne pole:

- `painMedicationTaken?: boolean`

Semantyka jest trójstanowa mimo użycia opcjonalnego boolean:

- brak pola / `undefined` - nie zapisano odpowiedzi,
- `false` - użytkowniczka świadomie zaznaczyła `Nie`,
- `true` - użytkowniczka świadomie zaznaczyła `Tak`.

Pole nie tworzy nowego store ani indeksu i nie zmienia `DATABASE_SCHEMA_VERSION = 12`. Stare wpisy bez tego pola pozostają prawidłowe. `painMedicationTaken` nie jest wejściem `CyclePatternSummary` ani modelu `cycle-v1`.



## 0.6.3 - CycleOvulationEstimate

`CycleOvulationEstimate` jest derived / ephemeral data. Powstaje z `CyclePrediction` i nie jest canonical user data. Nie ma własnego store, migracji, backup field ani Data Transfer field. `DATABASE_SCHEMA_VERSION` pozostaje 12.
