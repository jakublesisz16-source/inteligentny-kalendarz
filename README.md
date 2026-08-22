# Inteligentny Kalendarz

Local-first PWA do planowania dnia, kalendarza, Studiów, Pracy, Zakupów, Cyklu i Miejsc. Canonical dane użytkownika są przechowywane lokalnie w IndexedDB. Aplikacja nie wymaga konta ani synchronizacji chmurowej.

## Status

- APP_VERSION: `1.0.2`
- DATABASE_SCHEMA_VERSION: `12`
- `pdfjs-dist`: `6.2.108`
- architektura produkcyjna: GitHub-only, bez backendu i bez Web Push
- zakres poprawkowego wydania `1.0.2` obejmuje bezpieczniejszy import planów Studiów XLSX oraz czytelniejsze kafelki zajęć
- kandydat `1.0.2` przechodzi przez pull request i pełne GitHub Actions przed publikacją na `main`

Wydanie 1.0.2 rozszerza lokalny importer Studiów o szerokie tygodniowe macierze XLSX i osobne arkusze `WYKŁADY`, poprawia normalizację dat Excela oraz pokazuje grupę przy godzinie na kafelku zajęć. Zachowany jest dotychczasowy format `nursing-plan-v1`. Zmiana nie dodaje backendu, OCR, nowych zależności ani migracji danych.

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
- XLSX i PDF są analizowane lokalnie,
- brak OCR,
- brak Web Push w webowym zakresie `1.0.2`,
- globalne wyszukiwanie działa lokalnie i nie indeksuje danych Cyklu ani Dziennika Cyklu,
- `Trasa` otwiera Mapy Google dopiero po świadomym kliknięciu.

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

Powiadomienia systemowe nie są częścią webowego `1.0.2`. Zachowany czysty planner przypomnień i preferencje mają służyć późniejszej wersji Android, gdzie powiadomienia będą planowane lokalnie na urządzeniu bez Cloudflare, D1 i zewnętrznego backendu.

## Prywatność

Local-first nie oznacza, że absolutnie żaden bit nigdy nie może opuścić urządzenia. Świadome akcje użytkownika mogą przekazać destination do zewnętrznej usługi mapowej, a eksportowane pliki JSON są przenoszone przez użytkownika. Sam kalendarz nie ma backendu synchronizującego dane.

Więcej: `docs/PRIVACY.md`.

## Publiczne repo

Przed każdym push sprawdź:

```bash
git status
npm run check
```

Nie commituj `.env`, prywatnych PDF/XLS/XLSX, backupów, eksportów, logów ani kluczy/tokenów. `package-lock.json` pozostaje zweryfikowanym dependency graph z 1.0.1, ponieważ 1.0.2 nie zmienia zależności.
