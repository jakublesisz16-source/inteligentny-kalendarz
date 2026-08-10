# Inteligentny Kalendarz

Local-first PWA do planowania dnia, kalendarza, Studiów, Pracy, Zakupów, Cyklu i Miejsc. Canonical dane użytkownika są przechowywane lokalnie w IndexedDB. Aplikacja nie wymaga konta ani synchronizacji chmurowej.

## Status

- APP_VERSION: `1.0.0-rc.7`
- DATABASE_SCHEMA_VERSION: `12`
- `pdfjs-dist`: `6.2.108`
- status: Release Candidate - finalne `1.0.0` wymaga jeszcze realnego deploymentu i testów urządzeń
- rozwój funkcjonalny jest zamknięty

RC.7 zawiera deterministyczne porządkowanie Change Journal oraz stabilny lokalny zestaw testów. Publiczna wersja repozytorium nie zawiera prywatnych plików użytkownika, sekretów ani wewnętrznej historii promptów/handoffów.

## Uruchomienie lokalne

```bash
npm ci
npm run check
npm run dev -- --port 5174
```

Nie używaj `npm audit fix --force`, `npm install --force` ani `npm install --legacy-peer-deps`.

## Najważniejsze założenia

- dane aplikacji pozostają lokalnie w IndexedDB,
- brak kont użytkowników i cloud sync,
- backup i Data Transfer używają lokalnego JSON i mogą zawierać prywatne dane,
- XLSX i PDF są analizowane lokalnie,
- brak OCR,
- globalny master switch powiadomień jest device-local i ma najwyższy priorytet,
- Global Search działa lokalnie i nie indeksuje danych Cyklu ani Dziennika Cyklu,
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

Frontend jest przygotowany do publikacji jako GitHub Pages z publicznego repozytorium.

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

`vite.config.ts` używa `base: './'`, a manifest i Service Worker korzystają ze ścieżek względnych, dlatego projekt może działać jako project site pod ścieżką `https://<user>.github.io/<repo>/` bez wpisywania nazwy repo do źródła.

Szczegóły: `docs/DEPLOYMENT_1.0.0.md` i `docs/PUBLIC_REPOSITORY.md`.

## Web Push

GitHub Pages hostuje wyłącznie frontend. Pełny Web Push nadal wymaga małego backendu Cloudflare Worker + D1 + Cron + VAPID.

Publiczny adres Workera przekazuje się do builda przez repozytoryjną zmienną GitHub Actions:

```text
VITE_PUSH_WORKER_URL
```

To nie jest sekret. Prywatny klucz VAPID nigdy nie może trafić do repo ani bundle frontendu.

Bez skonfigurowanego Workera aplikacja nadal działa jako local-first PWA, ale funkcje Web Push pozostają nieskonfigurowane.

## Prywatność

Nie należy interpretować local-first jako "żadne dane nigdy nie opuszczają urządzenia". Techniczne dane PushSubscription są przesyłane do backendu Web Push, destination może zostać przekazane do Google po kliknięciu `Trasa`, a eksportowane pliki JSON są przenoszone przez użytkownika.

Więcej: `docs/PRIVACY.md`.

## Publiczne repo

Przed każdym push sprawdź:

```bash
git status
npm run check
```

Nie commituj `.env`, `.dev.vars`, prywatnych PDF/XLS/XLSX, backupów, eksportów, logów ani kluczy/tokenów. `package-lock.json` jest częścią repo i stanowi zweryfikowany dependency graph RC.7.
