# Inteligentny Kalendarz

Local-first PWA do planowania dnia, kalendarza, Studiów, Pracy, Zakupów, Cyklu i Miejsc. Canonical dane użytkownika są przechowywane lokalnie w IndexedDB. Aplikacja nie wymaga konta ani synchronizacji chmurowej.

## Status

- APP_VERSION: `1.0.0`
- DATABASE_SCHEMA_VERSION: `12`
- `pdfjs-dist`: `6.2.108`
- architektura produkcyjna: GitHub-only, bez backendu i bez Web Push
- rozwój funkcjonalny wydania `1.0.0` jest zamknięty
- źródłowy artefakt `1.0.0` jest przygotowany do publikacji przez GitHub Pages

Release finalizuje cleanup warstwy Cloudflare/Web Push z aktywnego produktu. Zachowany czysty planner przypomnień i preferencje pozostają wyłącznie punktem integracyjnym dla ewentualnej przyszłej aplikacji Android z lokalnymi powiadomieniami.

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
- brak Web Push w finalnym zakresie `1.0.0`,
- globalne wyszukiwanie działa lokalnie i nie indeksuje danych Cyklu ani Dziennika Cyklu,
- `Trasa` otwiera Mapy Google dopiero po świadomym kliknięciu.

## Moduły

1. Dzisiaj
2. Kalendarz
3. Studia
4. Praca
5. Zakupy
6. Cykl
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

Powiadomienia systemowe nie są częścią webowego `1.0.0`. Zachowany czysty planner przypomnień i preferencje mają służyć późniejszej wersji Android, gdzie powiadomienia będą planowane lokalnie na urządzeniu bez Cloudflare, D1 i zewnętrznego backendu.

## Prywatność

Local-first nie oznacza, że absolutnie żaden bit nigdy nie może opuścić urządzenia. Świadome akcje użytkownika mogą przekazać destination do zewnętrznej usługi mapowej, a eksportowane pliki JSON są przenoszone przez użytkownika. Sam kalendarz nie ma backendu synchronizującego dane.

Więcej: `docs/PRIVACY.md`.

## Publiczne repo

Przed każdym push sprawdź:

```bash
git status
npm run check
```

Nie commituj `.env`, prywatnych PDF/XLS/XLSX, backupów, eksportów, logów ani kluczy/tokenów. `package-lock.json` jest częścią repo i stanowi zweryfikowany dependency graph wydania `1.0.0`.
