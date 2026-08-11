## 1.0.0 - finalizacja GitHub-only

Docelowa architektura `1.0.0` nie ma backendu aplikacji. Produkcja to `GitHub Pages -> PWA -> IndexedDB`. Service Worker obsługuje wyłącznie cache/offline i nie ma listenera `push`. Warstwa Cloudflare Worker/D1/Cron/VAPID oraz klient Web Push zostały usunięte z aktywnego kodu i toolchainu przed finalnym wydaniem.

`DATABASE_SCHEMA_VERSION` pozostaje 12. Historyczne store'y techniczne notificationRuntime/notificationReminders nie są usuwane migracją, aby nie ryzykować danych istniejących instalacji. Zachowane są `NotificationPreferences` oraz czysty `notification-planner.ts` jako lokalny punkt integracyjny pod przyszłą aplikację Android; nie wykonują sieci ani side effectów.

## 1.0.0-rc.2 - hotfix toolchainu

Brak zmian architektury produktu. Zmiany dotyczą wyłącznie zgodności typów/dependencies i nie zmieniają przepływów danych, IndexedDB, Web Push ani modułów funkcjonalnych.

## 1.0.0-rc.1 - stabilizacja architektury

RC nie dodaje domeny ani danych. `DATABASE_SCHEMA_VERSION` pozostaje 12. Inicjalizacja nowej bazy tworzy wyłącznie neutralny rekord ustawień i pozostawia `locations` puste; wcześniejsze lokalizacje istniejących użytkowników nie są migrowane ani usuwane. Publiczny frontend jest przygotowany do GitHub Pages z deploymentem przez GitHub Actions, a techniczna warstwa Web Push pozostaje osobnym minimalnym Cloudflare Worker/D1/Cron. Service Worker ma wersjonowany cache RC i scope zgodny z project-site path.

## 0.7.0 - globalne wyszukiwanie

Global Search jest lekką warstwą derived nad danymi już załadowanymi do `App.tsx`. Przepływ: `events + locations -> buildGlobalSearchItems() -> normalize/query/ranking -> max 12 wyników -> istniejący EventForm / LocationForm`. `src/search/global-search.ts` nie czyta IndexedDB ani sieci, a `src/search/GlobalSearch.tsx` nie tworzy nowego `AppView`. Nie istnieje search store, background indexing, router ani persistence query. Cycle data nie są wejściem wyszukiwarki.

## 0.6.3 - derived okno możliwej owulacji

0.6.3 dodaje wyłącznie czysty helper `src/cycle/cycle-ovulation.ts`. Przepływ danych jest jednokierunkowy: `CyclePeriod -> cycle-v1 -> CyclePrediction -> deriveOvulationEstimate -> UI`. Helper nie czyta IndexedDB, Dziennika, Własnych wzorców ani sieci. Wynik nie jest zapisywany i nie trafia do backupu, Workera, D1 ani Web Push. `CycleView` oblicza estimate przez `useMemo` z istniejącego `prediction` i renderuje go w tej samej karcie prognozy.

## 0.6.2 - opcjonalny fakt w istniejącym Dzienniku

0.6.2 nie dodaje nowej warstwy architektonicznej. Pole `painMedicationTaken?: boolean` jest częścią istniejącego `CycleJournalEntry` i przechodzi przez ten sam CRUD, Change Journal, backup, Restore Points i Data Transfer. Nie powstaje nowy store, cache ani derived model.

Kod musi zachować trzy stany `undefined / false / true`; szczególnie `false` nie może być filtrowane przez truthiness. Pole nie jest używane przez `cycle-patterns.ts`, `cycle-prediction.ts`, notification planner, Worker ani Service Worker.

## 0.3.4 - Podsumowanie pracy jako derived view

## 0.6.1 - Wzorce jako czysta warstwa derived-data

`src/cycle/cycle-patterns.ts` jest małym, czystym helperem. Przyjmuje `CyclePeriod[]` oraz `CycleJournalEntry[]` i zwraca krótkie `CyclePatternSummary`. Nie otwiera IndexedDB, nie używa React, czasu bieżącego, sieci ani losowości.

`CycleView` ma już oba zbiory danych w pamięci, dlatego wynik jest liczony przez `useMemo`; nie ma dodatkowego fetchu ani cache. Nie powstał nowy store, migracja, format backupu ani serwerowa analityka. Zmiana dowolnych danych źródłowych naturalnie powoduje ponowne wyliczenie podsumowania. `cycle-prediction.ts` i system powiadomień pozostają osobnymi warstwami.

`src/work/work-summary.ts` zawiera czyste helpery miesięcznej agregacji. `WorkMonthlySummary` i `WorkWeeklyBucket` nie są rekordami bazy. Pipeline wygląda tak:

`CalendarEvent WORK (WORK_PDF + MANUAL) -> dedupe exact intervals -> clip do miesiąca -> split po dniach/tygodniach -> WorkMonthlySummary -> WorkSummaryView`

Deduplikacja preferuje `WORK_PDF` nad identycznym `MANUAL`, ale nie zgaduje duplikatu dla częściowo podobnych przedziałów. Zmiana przechodząca przez granicę miesiąca jest przycinana do właściwego miesiąca, więc te same minuty nie trafiają do dwóch podsumowań. Zgodność z dyspozycyjnością korzysta z istniejącego `compareAvailabilityWithWorkSchedule`; `aggregateAvailabilityComparisonResults` tylko sumuje gotowe wyniki tygodniowe.

0.3.4 nie dodaje store'a i pozostaje na `DATABASE_SCHEMA_VERSION = 8`.

## 0.3.3-hotfix.4 - prezentacja zespołu

Warstwa Praca nadal korzysta z istniejącego `CoworkerOverlap`. `sortCoworkerOverlaps` wykonuje czyste, deterministyczne sortowanie po długości wspólnego czasu, początku overlapu i nazwie. `CoworkerOverlapList` jest wyłącznie komponentem prezentacyjnym i nie zapisuje nowych danych.

# Architektura

## Zasada główna

Aplikacja jest local-first. UI korzysta z modułów domenowych, a trwały zapis przechodzi przez warstwę storage.

Kierunek zależności:

UI -> domena / importery -> storage -> IndexedDB

## Moduły

- `src/app` - składanie głównych widoków i modalnych przepływów,
- `src/calendar` - widoki dnia i miesiąca,
- `src/events` - wydarzenia i ręczna edycja,
- `src/locations` - lokalizacje,
- `src/settings` - ustawienia, profil grup, release notes i roadmapa,
- `src/study` - import, kontrola jakości, identyfikacja serii, diff i poprawki,
- `src/imports/xlsx` - czytnik XLSX, parsery i adaptery,
- `src/storage` - produkcyjna obsługa IndexedDB,
- `src/safety` - historia zmian, Kosz, backup, restore points i ograniczenia dnia,
- `src/styles` - warstwa wizualna,
- `src/core` - wersjonowanie,
- `src/tests` - testy.

## Wersjonowanie

W 0.3.4:

- APP_VERSION = 0.3.4,
- DATABASE_SCHEMA_VERSION = 8.

Wersja aplikacji wzrosła bez migracji IndexedDB. Podsumowanie pracy jest widokiem derived/read-only i nie dodaje trwałych statystyk do bazy.

## IndexedDB

Store'y:

- events,
- locations,
- settings,
- meta,
- universityImports,
- universityImportEntries,
- studyProfile,
- scheduleUpdateSessions,
- studyCorrectionRules,
- changeJournal,
- trashItems,
- restorePoints,
- dayConstraints,
- studyPreviewProfiles.

Schema 5 zachowuje wszystkie store'y z schema 4. Migracja 4 -> 5 tworzy nowe store'y bezpieczeństwa i podglądu grup bez reinterpretowania istniejących wydarzeń. W transakcji upgrade powstaje przypięty safety snapshot stanu schema 4, gdy środowisko IndexedDB pozwala go odczytać w tej samej transakcji.

## Ręczny kalendarz 0.2.3

Ręczne planowanie rozróżnia dwa modele:

- `MULTI_DAY` - jeden `CalendarEvent` obejmujący ciągły zakres dat,
- `MANUAL_MULTI_DATE` - wiele osobnych `CalendarEvent` mających wspólne `seriesId`.

`seriesId` nie jest `seriesKey`. Pierwszy identyfikuje ręczną serię użytkownika, drugi logiczną serię zajęć pochodzących z planu studiów. Te dwa mechanizmy nie są ze sobą łączone.

Dla all-day aplikacja używa jawnego `allDay = true`. Daty zakresu są interpretowane lokalnie i inclusive w UI. Warstwa danych zapisuje start jako lokalny początek pierwszego dnia i koniec jako lokalne `23:59` ostatniego dnia. Renderowanie zakresu korzysta z części daty `YYYY-MM-DD`, a nie z konwersji UTC.

## Tryb wyboru wielu dni

`CalendarView` utrzymuje tymczasowy wybór dat wyłącznie w stanie UI. Zaznaczenie ciągłe daje wybór między jednym wydarzeniem wielodniowym a ręczną serią. Zaznaczenie nieciągłe może utworzyć tylko serię, aby aplikacja nie dopisywała niewybranych dni.

## Transakcje ręcznych serii

Storage udostępnia osobne operacje batch:

- `createManualEventSeries`,
- `updateManualEventSeries`,
- `deleteManualEventSeries`.

Każda operacja korzysta z jednej transakcji store `events`. Zbiorcza edycja zachowuje datę każdego wystąpienia i zmienia wyłącznie wspólne pola oraz godzinę/all-day.

## Renderowanie zakresów

`eventDateKeys` i `eventOccursOnDate` są wspólną logiką dla widoków Dzisiaj i Kalendarz. Jedno wydarzenie wielodniowe jest liczone i wyświetlane na każdym dniu zakresu, ale w IndexedDB istnieje tylko jeden rekord.

## Pipeline XLSX

File -> ArrayBuffer -> ExcelJS -> WorkbookSnapshot -> adapter -> StudyScheduleCandidate -> kontrola -> diff lub pierwszy import -> transakcja IndexedDB -> CalendarEvent

Parser pozostaje oddzielony od Reacta. W 0.2.2 adapter `nursing-plan-v1` został utwardzony bez zmiany trwałego modelu danych.

## Hardening adaptera 0.2.2

Rozpoznanie arkusza nie zależy od samej nazwy. Każdy arkusz jest oceniany na podstawie sygnałów:

- znormalizowanych nagłówków dni tygodnia,
- spójnych pionowych siatek czasu,
- wykrytego roku akademickiego,
- jawnego kontekstu grup,
- pomocniczo nazwy arkusza.

Adapter zostaje uruchomiony tylko wtedy, gdy ma co najmniej trzy nagłówki dni i trzy spójne siatki czasu. Częściowo podobny plik bez czasu nie generuje fikcyjnych wydarzeń.

Bloki dni są wiązane z najbliższą spójną siatką czasu i nie zależą od historycznych kolumn D/FT/MR ani od kolejności poniedziałek-piątek. Obsługiwana jest również sobota. Interwał siatki jest wykrywany z danych, nie jest na stałe ustawiony na 15 minut.

## Priorytet źródeł lokalizacji

Dane są łączone deterministycznie:

1. bezpośrednia sala/adres przy bloku zajęć,
2. jednoznaczny opis kliniki lub przedmiotu z sekcji pod planem,
3. brak wartości - ostrzeżenie, bez zgadywania.

Wartość ogólna nie nadpisuje wartości bezpośredniej.

## Diagnostyka parsera

`ScheduleAnalysis.diagnostics` jest modelem runtime i nie trafia do IndexedDB. Zawiera m.in. wykryty arkusz, dni, liczbę siatek czasu, ich dominujące interwały, zakresy arkuszy i nierozwiązane wzorce. W UI panel jest domyślnie zwinięty.

Dla nierozpoznanego pliku rejestr adapterów zwraca lokalną diagnostykę zamiast stack trace lub częściowego importu.

## Zasada dodawania kolejnego adaptera

Nowy adapter powstaje dopiero po otrzymaniu realnego pliku o znacząco odmiennej strukturze. Nie tworzymy adapterów do hipotetycznych formatów. Stary adapter i jego testy regresyjne pozostają wtedy zachowane.

## occurrenceKey

`occurrenceKey` identyfikuje konkretne wystąpienie zajęć.

Składa się logicznie z:

- `seriesKey`,
- daty,
- godziny rozpoczęcia.

Zmiana daty lub początku może zmienić `occurrenceKey`, dlatego diff ma drugi, ostrożny etap dopasowania w obrębie tej samej serii.

## seriesKey

`seriesKey` identyfikuje serię zajęć niezależnie od daty.

Uwzględnia:

- adapter,
- arkusz źródłowy,
- znormalizowany przedmiot,
- typ zajęć,
- znormalizowane grupy,
- klinikę.

Data nie wchodzi do `seriesKey`.

Ten sam tytuł nie wystarcza do połączenia dwóch serii. Dzięki temu np. ta sama nazwa przedmiotu dla 13A / Klinika I i 13B / Klinika II nie jest automatycznie traktowana jako jedna seria.

## Diff engine

`src/study/study-diff.ts` jest czystą warstwą domenową.

Kolejność dopasowania:

1. dokładny `occurrenceKey`,
2. ostrożne dopasowanie unikalnego, najbliższego terminu w tym samym `seriesKey`,
3. brak bezpiecznego dopasowania -> ADDED / REMOVED,
4. remis lub blokujący brak -> AMBIGUOUS.

Kategorie widoczne w UI:

- UNCHANGED,
- ADDED,
- REMOVED,
- CHANGED,
- CONFLICT_USER_MODIFIED,
- AMBIGUOUS.

Szczegół zmiany zachowuje typy CHANGED_TIME, CHANGED_DATE, CHANGED_LOCATION, CHANGED_GROUP i CHANGED_DETAILS.

## Ochrona ręcznych zmian

`CalendarEvent` może przechowywać `userModifiedFields`.

Jeżeli nowy plan zmienia pole, które użytkowniczka zmieniła ręcznie, powstaje konflikt wymagający jawnej decyzji. Konflikt nie ma domyślnej decyzji w UI.

Jeżeli ręcznie zmieniono inne pole niż to, które zmienia nowy plan, aktualizacja planu może zostać zastosowana, a ręczne pole jest nakładane z powrotem na świeże dane.

Dla starszych rekordów mających tylko `userModified = true` bez listy pól system zachowuje wszystkie edytowalne pola, ponieważ nie udaje wiedzy, której nie ma.

## Atomowa aktualizacja

Po zatwierdzeniu diffu jedna transakcja IndexedDB:

- dodaje nowe wydarzenia,
- aktualizuje istniejące,
- usuwa zatwierdzone REMOVED,
- zachowuje decyzje konfliktów,
- zapisuje nowy aktywny import,
- oznacza poprzedni import jako historyczny,
- zapisuje nowe wpisy źródłowe,
- aktualizuje profil,
- oznacza sesję diff jako APPLIED.

Anulowanie podglądu nie zmienia kalendarza ani aktywnego importu.

## Pełne dane źródłowe od schema 3

Nowe importy przechowują oprócz wpisów powiązanych z wydarzeniami także znormalizowane `sourceOnly` dla wszystkich kandydatów planu. Nie są to bajty XLSX.

Dzięki temu zmiana grup może zostać przeliczona lokalnie bez ponownego wybierania tego samego pliku.

Importy utworzone wcześniej nie posiadają pełnego `sourceOnly`. W takim przypadku UI uczciwie prosi o ponowne wskazanie XLSX zamiast rekonstruować brakujące dane.

## StudyCorrectionRule

Bezpieczna poprawka serii dotyczy wyłącznie:

- address,
- room,
- clinic,
- locationLabel.

Reguła jest związana z `seriesKey`, nie z samym tytułem.

Przy nowym planie:

- brak wartości w XLSX -> reguła może uzupełnić wartość,
- ta sama wartość -> brak konfliktu,
- inna jawna wartość -> konflikt, bez cichego nadpisania.

Daty i godziny nie są propagowane na całą serię.

## Profil grup

`StudyProfile` przechowuje domyślne grupy i aktywny import. Zmiana grup w Ustawieniach ma dwa tryby:

- tylko kolejne importy,
- przelicz aktualny plan po wcześniejszym podglądzie zmian.

Ręcznie zmieniane wydarzenie, które wypadłoby z planu po zmianie grup, jest zachowywane jako wydarzenie MANUAL.

## Release notes i roadmapa

Widoki użytkowe nie odczytują plików markdown w runtime.

- `src/settings/releaseNotes.ts` zawiera przyjazne informacje "Co nowego",
- `src/settings/roadmap.ts` zawiera użytkową roadmapę bez technicznych szczegółów i bez terminów.
## Warstwa bezpieczeństwa 0.2.4

`ChangeJournalEntry` zapisuje logiczne operacje użytkownika, a nie kliknięcia UI. Historia jest ograniczona do 100 ostatnich wpisów. Operacja zbiorcza ma wspólny wpis/groupId i jest cofana jako całość. Jeśli operacja ma powiązany restore point, Undo przywraca bezpieczny snapshot zamiast odtwarzać złożone handlery UI.

Usunięcie ręcznego wydarzenia lub serii jest soft-delete: rekord znika z aktywnego kalendarza i trafia do `trashItems`. Ręcznie usunięte wydarzenie `UNIVERSITY_XLSX` zostawia w `UniversityImportEntry` znacznik `userDeleted`, dzięki czemu kolejny diff nie przywraca go po cichu.

`RestorePoint` przechowuje wersjonowany lokalny snapshot danych aplikacji. Automatyczne nieprzypięte punkty są ograniczone do 10 najnowszych. Przed odtworzeniem punktu lub pełnego backupu tworzony jest safety point bieżącego stanu.

Backup jest lokalnym dokumentem JSON z `backupVersion`, wersją aplikacji, wersją schematu i SHA-256. Przywracanie ma osobny dry run (`inspectBackupText`), waliduje checksum i dopiero potem atomowo zastępuje objęte backupem store'y. Checksum wykrywa zmianę pliku, ale nie jest szyfrowaniem.

## DayConstraint i przyszła dyspozycyjność

`DayConstraint(EXCLUDE_FROM_WORK_AVAILABILITY)` zapisuje lokalny klucz daty `YYYY-MM-DD`. Ograniczenie oznacza tylko: przyszły optimizer nie ma generować nowych propozycji pracy w tej dacie. Nie blokuje zwykłych wydarzeń ani ręcznie wpisanej pracy. Warstwa domenowa udostępnia `listActiveDayConstraints`, aby przyszły optimizer nie czytał bezpośrednio IndexedDB.

## Bezpieczny podgląd innych grup

`StudyPreviewProfile` jest profilem sandboxowym, a nie drugim aktywnym `StudyProfile`. `buildStudyGroupPreview` filtruje `sourceOnly` aktywnego, kompletnego importu i zwraca kandydatów tylko do odczytu. Nie zapisuje `CalendarEvent`, nie zmienia `selectedGroups`, `activeImportId`, diffu ani correction rules. Nazwany profil podglądowy przechowuje wyłącznie zestaw grup i nazwę.

Jeżeli aktywny import pochodzi ze starszej wersji i `sourceDataComplete` jest false, aplikacja nie rekonstruuje brakujących grup. Panel pozwala wskazać XLSX wyłącznie do podglądu: plik jest analizowany lokalnie w pamięci, bez zapisu jako aktywny import i bez zmiany kalendarza.

### Kalendarzowy podgląd 0.3.3-hotfix.2

`StudyPreviewCalendar` jest osobnym, tylko do odczytu komponentem. Korzysta z istniejących helperów miesiąca oraz czystego modułu `study-preview-calendar.ts`, który grupuje `StudyScheduleCandidate` po `date`, sortuje wpisy dnia po godzinie i wybiera datę po zmianie miesiąca. Komponent nie importuje warstwy availability/work/storage i nie zapisuje wyników. Widok `Lista` pozostaje dotychczasową agendą. Kandydaci bez pewnej daty nie trafiają do fałszywej komórki kalendarza - są sygnalizowani i dostępni w Liście.



## Moduł pracy 0.3.0

`src/imports/pdf` zawiera czytnik PDF do neutralnego snapshotu tekstowego oraz osobny rejestr adapterów grafików. `retail-roster-v1` rozpoznaje strukturę po nagłówkach miesiąca, dnia miesiąca, powtarzalnych kolumnach `od/do/suma` i siatce godzin. Numer strony, nazwa pliku i nazwa pracodawcy nie są regułami parsera. Brak warstwy tekstowej kończy się kontrolowanym komunikatem - OCR nie jest częścią 0.3.0.

`WorkProfile` przechowuje lokalne dane potrzebne do znalezienia właściwego wiersza i przypisania lokalizacji. `WorkScheduleImport` opisuje wersję pliku, a `WorkScheduleEntry` znormalizowaną własną zmianę. `CalendarEvent` z `source = WORK_PDF` odwołuje się do importu i wpisu źródłowego. Aktualizacja tego samego okresu zachowuje poprzedni import jako historyczny i stosuje nowy zestaw atomowo.

Warstwa `work.service.ts` odpowiada za `workOccurrenceKey`, różnice wersji grafiku, kolizje, długość zmian i przecięcia zmian zespołu. `listConfirmedWorkBlocks()` jest publicznym kontraktem dla przyszłego optymalizatora i łączy potwierdzone `WORK_PDF` z ręcznymi wydarzeniami `MANUAL + WORK`.

### Kto jest ze mną na zmianie

Funkcja jest opcjonalna w `WorkProfile`. Po zaimportowaniu rzeczywistego grafiku przechowywane są lokalnie minimalne `WorkCoworkerShift`: nazwa wyświetlana, data, początek, koniec i odniesienie do importu. Nie jest przechowywana pełna treść strony PDF ani dane kadrowe. Dla wydarzenia użytkowniczki aplikacja liczy rzeczywiste przecięcie przedziałów czasu; samo `TOUCHING` nie oznacza wspólnej zmiany. Historyczne i aktywne wersje zespołu pozostają rozdzielone przez `importId`.

Przed powstaniem rzeczywistego grafiku optymalizator dyspozycyjności nie ma danych zespołu i nie może ich zgadywać. Po imporcie grafiku funkcja zespołu jest informacyjna i nie zmienia zaakceptowanej dyspozycji.


## 0.3.1 - model dnia i spójność

Warstwa `planning` jest oddzielona od UI. `CalendarConsistencyEngine` deterministycznie analizuje przedziały CalendarEvent i stałe wymagane DailyRoutineRule. Wydarzenia pozostają źródłem prawdy; konflikty są wyliczane ponownie, a trwałe są tylko acknowledgement fingerprints. `buildDayPlanningContext`, `buildWeekPlanningContext` i `getPlanningBlockingIssues` stanowią kontrakt pod optimizer 0.3.2. Zbiorcza korekta godzin studiów działa wyłącznie po stable `seriesKey`, pokazuje preview i jest zabezpieczona Restore Point + jedną transakcją. Kolor UI wynika z `CalendarEvent.category`; selected state i conflict state są niezależne.


## 0.3.2 - uproszczony optimizer dyspozycyjności

Nowy moduł `src/availability` jest oddzielony od `CalendarEvent`. `AvailabilityPlan` przechowuje tygodniowy plan i listę `AvailabilityBlock`, ale blok dyspozycyjności nie oznacza rzeczywistej pracy.

Przepływ:

`DayPlanningProfile + CalendarEvent + confirmed work + DayConstraint + DailyRoutineRule + consistency issues -> AvailabilityOptimizationInput -> czysty deterministic optimizer -> AvailabilityPlan -> overlay UI`

Optimizer działa na kroku 15 minut, generuje ograniczony zbiór kandydatów i używa bounded/beam search z deterministycznym tie-breakiem. Priorytetem jest brak naruszeń twardych ograniczeń, pokrycie brakujących minut i dopiero później miękkie preferencje. Nie istnieje ukryta kara za 1-2 godzinne okna.

`ACKNOWLEDGED` dla twardej niespójności jest wyłącznie decyzją UI - `planningImpact = BLOCKING` nadal blokuje czas dla automatycznej dyspozycyjności.

Schema 8 dodaje jeden store `availabilityPlans`. Plan posiada `inputFingerprint`; zmiana istotnych danych oznacza plan jako `STALE`, ale zaakceptowane/edytowane bloki nie są przesuwane po cichu.


## 0.3.3 - prostsza Praca i porównanie read-only

Warstwa danych pozostaje schema 8. `AvailabilityPlan.sentSnapshots` jest historycznym źródłem wysłanej dyspozycyjności, a `WORK_PDF` / `WorkScheduleEntry` źródłem rzeczywistego grafiku. Wynik zgodności nie jest utrwalany.

Przepływ:

`AvailabilitySentSnapshot + aktywne WORK_PDF -> compareAvailabilityWithWorkSchedule(...) -> AvailabilityWorkComparison -> lekkie UI Praca`

`src/work/availability-work-comparison.ts` jest czystą warstwą domenową bez React i IndexedDB. Dla każdej rzeczywistej zmiany tworzy union wysłanych przedziałów, wylicza `coveredMinutes`, `outsideMinutes` oraz konkretne `uncoveredIntervals`. Stykające się bloki są łączone; luka pomiędzy blokami pozostaje niepokryta. Przedziały mogą przechodzić przez północ.

Statusy domenowe `WITHIN_AVAILABILITY`, `PARTIALLY_OUTSIDE_AVAILABILITY` i `OUTSIDE_AVAILABILITY` nie są pokazywane użytkowniczce jako surowe enumy. Niewykorzystana wysłana dyspozycyjność jest informacją, a nie konfliktem. Manualne `WORK` nie jest domyślnie traktowane jako grafik pracodawcy w tym porównaniu.

Porównanie jest read-only: nie zapisuje wyniku do bazy, nie modyfikuje `CalendarEvent`, `WorkScheduleEntry`, `sentSnapshot`, Change Journal ani `CalendarConsistencyIssue`. Przy wielu snapshotach domyślnie wybierana jest najnowsza wysłana wersja sprzed importu aktywnego grafiku, jeśli można ją jednoznacznie wskazać, a UI pozwala wybrać inną wersję.

UI został skonsolidowany zgodnie z zasadą colocation: `Praca` zawiera `Grafik` i `Dyspozycyjność`, ustawienia optimizera są dostępne z lekkiego panelu przy Dyspozycyjności, a `WorkProfile` z modułu Praca. Globalne Ustawienia przechowują głównie dane, bezpieczeństwo, lokalizacje i informacje o aplikacji. `DailyRoutineRule` pozostaje tym samym modelem, ale w UI występuje jako `Dodatkowe ograniczenia`, bez technicznych nazw FIXED/FLEXIBLE/REQUIRED/PREFERRED.


## Dyspozycyjność 0.3.3-hotfix.1

Hotfix utrzymuje jeden store `availabilityPlans`. `AvailabilityDayRule` jest opcjonalną częścią tygodniowego `AvailabilityPlan` i przechowuje wyłącznie wyjątki dnia: `excluded`, `earliestTime`, `latestTime` i znormalizowane `blockedIntervals`. Reguła dnia nie jest `CalendarEvent` i nie wpływa na liczniki kategorii.

`AvailabilityBlock.origin` rozróżnia `MANUAL` i `OPTIMIZER`. Ręczne oraz ręcznie edytowane zaakceptowane bloki są `locked`. Przed każdym uzupełnieniem są ponownie walidowane z aktualnym kalendarzem. Blok z twardym konfliktem otrzymuje stan `CONFLICT`, pozostaje widoczny, ale nie wchodzi do bezpiecznego coverage.

Pipeline optimizera:

1. plan zajęć i inne blokujące wydarzenia,
2. potwierdzona praca,
3. wymagane stałe ograniczenia,
4. `AvailabilityDayRule`,
5. ważne ręczne/zaakceptowane bloki,
6. wyszukanie wyłącznie brakujących minut.

Ręczna sobota może być zapisana mimo wyłączenia sobót dla automatycznych propozycji. Ręczna niedziela wymaga lokalnego `TRADING_SUNDAY`. `sentSnapshots` zapisują tylko konkretne bezpieczne zaakceptowane bloki - nie zapisują reguł dnia.


### Automatyczne godziny dyspozycyjności 0.3.3-hotfix.3

Podstawowy przepływ nie tworzy ręcznej deklaracji godzin dla każdego dnia. `DayPlanningProfile.allowedWorkStart/allowedWorkEnd` wyznacza jednorazowe standardowe granice możliwej pracy. Dla każdej daty `buildAvailabilityInput` nakłada na nie plan zajęć, blocking events, confirmed work, wymagane rutyny, blocking consistency issues, bufor oraz opcjonalny `AvailabilityDayRule`.

Brak `AvailabilityDayRule` ma znaczenie pozytywne: dzień jest liczony automatycznie z kalendarza, jeśli spełnia reguły soboty/niedzieli. `earliestTime`, `latestTime`, `blockedIntervals` i `excluded` zawężają tylko konkretną datę. Ręczny `AvailabilityBlock` pozostaje osobną świadomą decyzją i nie jest wymagany do uruchomienia optimizera.


## 0.3.5 - Zakupy

Moduł `shopping` jest niezależny od domen kalendarza, studiów, pracy i dyspozycyjności. `ShoppingItem` jest przechowywany w osobnym store `shoppingItems` (schema 9). Widok pobiera listę bezpośrednio przez storage API, a kolejność jest wyliczana deterministycznie w pamięci. Zakupy nie tworzą `CalendarEvent`, nie wpływają na liczniki kategorii i nie są wejściem optimizera. Operacje CRUD są zapisywane w Change Journal i mogą być cofane przez istniejący mechanizm Undo. Store jest częścią pełnego snapshotu, backupu i restore pointów.


## Przenoszenie danych 0.3.6

`DataTransferPanel` jest cienką warstwą UI nad kanonicznym mechanizmem pełnego backupu. Eksport transferowy nie tworzy drugiego modelu danych: `createDataTransferFile()` generuje ten sam dokument `inteligentny-kalendarz-backup` w wersji formatu 1, ale z przyjazną nazwą pliku `inteligentny-kalendarz-dane-...json`.

Przepływ importu:

1. odczyt jednego pliku JSON,
2. walidacja formatu,
3. walidacja checksum SHA-256,
4. blokada nieobsługiwanej nowszej `databaseSchemaVersion`,
5. podgląd liczników bez zapisu do IndexedDB,
6. jawne potwierdzenie trybu replace,
7. utworzenie Restore Point `Przed importem danych - ...`,
8. migracja starszego kompatybilnego snapshotu do aktualnego schematu,
9. zastąpienie wszystkich logicznych store'ów w jednej transakcji IndexedDB,
10. weryfikacja zawartości store'ów po zapisie.

Restore pointy nie są częścią zastępowanego snapshotu, dlatego punkt sprzed importu pozostaje dostępny na urządzeniu docelowym. `WorkMonthlySummary` nadal jest derived i nie trafia do transferu jako osobny rekord. Surowe PDF/XLSX, uchwyty plików, cache i stan Service Workera nie są elementem snapshotu.

`backupVersion` pełni rolę wersji kanonicznego formatu pliku i pozostaje oddzielone od `DATABASE_SCHEMA_VERSION`, która opisuje trwały model IndexedDB.


## Domknięcie UX i stabilności 0.3.7

0.3.7 nie dodaje nowej domeny ani store'a. `APP_VERSION = 0.3.7`, `DATABASE_SCHEMA_VERSION = 9`.

`SettingsView` rozdziela dwa zastosowania, które wcześniej były wizualnie połączone: `DataTransferPanel` jest samodzielną, widoczną sekcją Przenoszenie danych, natomiast `SafetyCenter` pozostaje zwijanym centrum historii, Kosza, punktów przywracania, backupu i trwałości danych. Transfer nadal używa kanonicznego backup engine 0.3.6.

`StoragePersistencePanel` korzysta wyłącznie z przeglądarkowych `navigator.storage.persisted()` i `navigator.storage.persist()`. Brak wsparcia albo odmowa nie blokuje aplikacji i nie tworzy żadnego rekordu w IndexedDB.

`pwa/installPrompt.ts` przechwytuje `beforeinstallprompt` globalnie i udostępnia CTA instalacji dopiero, gdy przeglądarka rzeczywiście ma prompt. iOS Safari otrzymuje wyłącznie prostą instrukcję systemową. Service Worker cache'uje powłokę aplikacji, ale omija rozszerzenia prywatnych plików użytkownika (`pdf`, `xls`, `xlsx`, `json`).

Zasada blocked-action UX: jeżeli ważna operacja wymaga konfiguracji, UI pokazuje brakujący warunek i CTA prowadzące do właściwego miejsca. Przykładem jest import grafiku PDF, który bez poprawnego `WorkProfile.employeeMatchName` prowadzi do edycji profilu zamiast pozostawiać niewyjaśniony disabled button.

## 0.4.0 - osobny moduł Cykl

`src/cycle/cycle-prediction.ts` jest czystą warstwą domenową bez React i IndexedDB. `CycleView` czyta wyłącznie `cyclePeriods` i nie tworzy `CalendarEvent`.

Pipeline:

`CyclePeriod[] -> walidacja luk -> completedCycleLengths -> robust center/spread -> walk-forward error -> prediction windows + reliability`

Długie luki mogą pozostać nierozstrzygnięte jako `POSSIBLE_MISSED_LOG`, zostać potwierdzone jako jeden cykl albo oznaczone trwałym `OBSERVATION_BREAK`. Unresolved gap i observation break nie są cycle length. Model nie rekonstruuje brakujących dat.

Niepewność ma jedną główną ścieżkę obliczeń: robust spread + rzeczywisty błąd walk-forward + minimalny modeling floor. Surprise i possible shift wpływają przede wszystkim na reliability i recency, aby nie liczyć jednej anomalii kilka razy.

Moduł jest izolowany od Calendar/Work/Study/Availability/Shopping. Backup, restore point i canonical Data Transfer obejmują `cyclePeriods`, ale nie obejmują prognoz derived.

## 0.5.0 - historyczny fundament powiadomień

0.5.0 wprowadziło eksperymentalną warstwę Web Push. Przed finalnym `1.0.0` transport sieciowy został wycofany, ponieważ docelowa wersja ma pozostać GitHub-only. Historyczny kod jest zachowany w Git/archiwach, ale nie jest częścią aktywnego runtime ani deploymentu.

W aktualnym drzewie `src/notifications` pozostają tylko czyste elementy lokalne: typy/preferencje i planner. Nie ma klienta Push, UI aktywacji, Workera ani zdalnego harmonogramu.

## 0.6.0 - Dziennik Cyklu jako osobna warstwa danych

Kierunek zależności: `CycleJournalEditor/CycleView -> cycleJournalEntries (IndexedDB) -> backup/restore/transfer`. `CyclePeriod -> cycle-v1` pozostaje osobną ścieżką. Dziennik nie jest przekazywany do `predictNextPeriod` ani notification plannera. Journal CRUD odświeża lokalny stan Dziennika i celowo nie wywołuje globalnego `onDataChanged`, ponieważ zmiana wpisu Dziennika nie wymaga odświeżenia pozostałych modułów.