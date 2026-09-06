# Inteligentny Kalendarz

Local-first PWA do planowania dnia, kalendarza, Studiów, Pracy, Zakupów, Cyklu i Miejsc. Canonical dane użytkownika są przechowywane lokalnie w IndexedDB. Aplikacja nie wymaga konta ani synchronizacji chmurowej.

## Status

- APP_VERSION: `1.1.0`
- DATABASE_SCHEMA_VERSION: `13`
- `pdfjs-dist`: `6.2.108`
- architektura produkcyjna: GitHub-only, bez backendu i bez Web Push
- bieżące stabilne wydanie: `1.1.0`
- `1.1.0` zamraża zweryfikowany stan RC11 oraz końcowy hardening bezpieczeństwa przed publikacją
- schema bazy pozostaje `13`; aktualizacja z ostatniego RC nie wymaga dodatkowej migracji
- wydanie obejmuje nową ikonę PWA, bramkę kompletności Studiów, bezpieczne aktualizacje planu, twardszą walidację plików PDF i publiczne bramki bezpieczeństwa

Wydanie `1.1.0` jest przygotowane jako statyczna aplikacja GitHub Pages. Dane użytkownika pozostają lokalne, a prywatne pliki źródłowe nie są częścią repozytorium publicznego.

## Uruchomienie lokalne

```bash
npm ci
npm run check
npm run dev -- --port 5174
```

Nie używaj `npm audit fix --force`, `npm install --force` ani `npm install --legacy-peer-deps`.

## Najważniejsze założenia

- dane aplikacji pozostają lokalnie w IndexedDB,
- brak kont użytkowników, backendu aplikacji i cloud sync,
- frontend produkcyjny jest statycznie hostowany na GitHub Pages,
- PWA działa offline po poprawnym pierwszym załadowaniu,
- backup i Data Transfer używają lokalnego JSON i mogą zawierać prywatne dane,
- XLS, XLSX i PDF są analizowane lokalnie,
- OCR paragonów działa lokalnie na zasobach dołączonych do aplikacji; pliki wejściowe nie są wysyłane do backendu,
- brak Web Push w webowym zakresie aplikacji,
- globalne wyszukiwanie działa lokalnie i nie indeksuje danych Cyklu ani Dziennika Cyklu,
- `Trasa` otwiera Mapy Google dopiero po świadomym kliknięciu.

## Import planu studiów Excel XLS/XLSX

Importer używa rejestru adapterów zamiast jednego luźnego parsera. Obsługiwane są pliki OOXML `.xlsx` oraz stare binarne skoroszyty Excel 97-2003 `.xls`, a format jest weryfikowany po zawartości pliku. Obsługiwane są pionowe siatki czasu oraz szerokie macierze tygodniowe z wielowierszowymi nagłówkami, grupami w komórkach, wyjątkami dat i osobnymi sekcjami wykładów. Wielopoziomowe podziały grup są rozróżniane zamiast łączone po samym napisie, a niekompletny lub niespójny wybór grup jest blokowany przed zapisem. Nakładające się zajęcia są wykrywane przed pierwszym importem, aktualizacją planu i zmianą własnych grup i pozostają wyraźnie pokazane bez dodatkowego checkboxa. Plan bez podziału na grupy może przejść do podglądu jako plan wspólny. Jeżeli rozpoznany blok źródłowy przypisuje zajęcia do tygodnia, ale sam Excel nie podaje jednoznacznego dnia lub pełnych godzin, wpis pozostaje jawnie NIEPEŁNY i nie tworzy fikcyjnego wydarzenia. Nieprawidłowa data, godzina, zakres czasu albo strukturalnie nierozpoznawalny plan nadal blokują import.

Aktualizacja aktywnego planu waliduje końcowy zestaw wydarzeń po decyzjach użytkownika, odrzuca nieaktualny podgląd, chroni ręcznie zmienione i świadomie usunięte zajęcia oraz utrzymuje spójne powiązania przy przywracaniu wydarzeń z Kosza. Niemożliwe daty i godziny są blokowane również w warstwie zapisu, a zmiana grup jawnie pokazuje wpisy niekompletne, które pozostaną poza kalendarzem.

## Moduły

1. Dzisiaj
2. Kalendarz
3. Praca
4. Zakupy
5. Cykl
6. Studia
7. Miejsca
8. Ustawienia

Wyszukiwanie jest utility, a nie osobną pozycją nawigacji.

## GitHub Pages

Workflow:

```text
.github/workflows/pages.yml
```

Na push do `main` workflow wykonuje:

```text
npm ci
npm run check
upload dist
GitHub Pages deploy
```

`vite.config.ts` używa `base: './'`, a manifest i Service Worker korzystają ze ścieżek względnych, dlatego projekt działa jako GitHub Pages project site bez wpisywania nazwy repo do kodu źródłowego.

## PWA i offline

`public/service-worker.js` odpowiada wyłącznie za cache powłoki aplikacji i działanie offline. Nie obsługuje Web Push. Prywatne pliki `.pdf`, `.xlsx`, `.xls` i `.json` są wykluczone z Cache Storage.

## Powiadomienia - dalszy kierunek

Powiadomienia systemowe nie są częścią webowego `1.1.0`. Zachowany czysty planner przypomnień i preferencje mają służyć późniejszej wersji Android, gdzie powiadomienia będą planowane lokalnie na urządzeniu bez Cloudflare, D1 i zewnętrznego backendu.

## Prywatność

Local-first nie oznacza, że absolutnie żaden bit nigdy nie może opuścić urządzenia. Świadome akcje użytkownika mogą przekazać destination do zewnętrznej usługi mapowej, a eksportowane pliki JSON są przenoszone przez użytkownika. Sam kalendarz nie ma backendu synchronizującego dane.

Więcej: `docs/PRIVACY.md`.

## Publiczne repo

Przed każdym push sprawdź:

```bash
git status
npm run check
```

Nie commituj `.env`, prywatnych PDF/XLS/XLSX, backupów, eksportów, logów ani kluczy/tokenów. `package-lock.json` jest częścią repo i pozostaje częścią projektu. Przed publikacją uruchom pełny `npm run check` oraz `node scripts/public-package-gate.mjs <katalog-paczki-publicznej>`.
