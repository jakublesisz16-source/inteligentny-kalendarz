# Globalne wyszukiwanie 0.7.0

## Zakres

0.7.0 dodaje jedną lekką wyszukiwarkę dostępną globalnie bez tworzenia dziewiątej pozycji głównej nawigacji. Działa wyłącznie na danych, które `App.tsx` już posiada w pamięci: `CalendarEvent[]` oraz `Location[]`.

Typy wyników:

- Wydarzenie,
- Studia,
- Praca,
- Miejsce.

Zaimportowane Studia i Praca są klasyfikowane z `CalendarEvent.source` (`UNIVERSITY_XLSX` / `WORK_PDF`), z kategorią jako bezpiecznym fallbackiem dla wpisów ręcznych.

## Wyszukiwane pola

Dla `CalendarEvent`:

- `title`,
- `description`,
- czytelna nazwa rodzaju wyniku,
- nazwa i adres powiązanego `Location`.

Dla `Location`:

- `name`,
- `address`,
- `note`,
- czytelna nazwa typu miejsca.

Nie są indeksowane techniczne identyfikatory, raw importy Studiów/Pracy, Availability, dane współpracowników, Settings, Notifications ani dane Cyklu.

## Prywatność Cyklu

Globalne wyszukiwanie celowo nie przyjmuje `CyclePeriod`, `CycleJournalEntry`, `CyclePatternSummary` ani `CycleOvulationEstimate`. Notatki Dziennika Cyklu nie mogą więc przypadkowo pojawić się w globalnym overlayu.

## Normalizacja i dopasowanie

`normalizeSearchText()`:

- zamienia tekst na małe litery,
- usuwa polskie znaki diakrytyczne (`Łódź` -> `lodz`, `Zajęcia` -> `zajecia`),
- zwija wielokrotne spacje,
- przycina początek i koniec.

Zapytanie jest dzielone na tokeny i wszystkie tokeny muszą wystąpić w `searchableText`. Nie ma fuzzy search, korekcji literówek ani AI.

## Ranking

Prosty ranking:

1. dokładne dopasowanie tytułu/nazwy,
2. tytuł/nazwa zaczyna się od query,
3. tytuł/nazwa zawiera query,
4. dopasowanie w pozostałych polach.

Przy remisie wydarzeń preferowany jest termin najbliższy jawnie przekazanemu `todayKey`. Miejsca sortują się stabilnie po nazwie. Wynik jest deterministyczny.

## Limit i UX

- minimum 2 znaki po normalizacji,
- maksymalnie 12 widocznych wyników,
- przy większej liczbie aplikacja prosi o doprecyzowanie,
- brak query nie pokazuje całej bazy,
- wyniki otwierają istniejący `EventForm` lub `LocationForm`,
- search modal jest zamykany przed otwarciem edytora wyniku.

## Architektura

`events + locations -> buildGlobalSearchItems() -> normalize query -> searchGlobalItems() -> max 12 wyników -> istniejący editor`

Indeks jest derived data w pamięci. Nie ma `STORE_SEARCH`, migracji, historii wyszukiwań, backupu query ani połączeń sieciowych.
