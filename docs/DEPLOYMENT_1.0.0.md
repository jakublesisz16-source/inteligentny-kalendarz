# Deployment 1.0.0 - finalny runbook

Ten dokument opisuje docelowy układ: publiczny GitHub + GitHub Pages dla frontendu oraz Cloudflare Worker + D1 + Cron tylko dla technicznej warstwy Web Push.

Finalne `1.0.0` wolno zatwierdzić dopiero po rzeczywistych testach produkcyjnych.

## 1. Lokalny gate

```bash
rm -rf node_modules dist
npm ci
npm run check
npm audit
```

Wymagane: wszystkie testy/build PASS oraz 0 High i 0 Critical. Nie używaj `npm audit fix --force`.

## 2. GitHub Pages frontend

Utwórz publiczne repo i wypchnij przygotowane źródło na `main`.

W ustawieniach repo:

```text
Settings -> Pages -> Source -> GitHub Actions
```

Workflow `.github/workflows/pages.yml` wykonuje pełne `npm run check`, uploaduje `dist/` i wdraża Pages.

Projekt ma `base: './'`, manifest `start_url: './'`, scope `./` oraz względną rejestrację Service Workera, więc jest przygotowany do project site pod ścieżką repo.

## 3. Frontend Web Push URL

Po wdrożeniu Workera ustaw w GitHub:

```text
Settings -> Secrets and variables -> Actions -> Variables
VITE_PUSH_WORKER_URL=https://<rzeczywisty-worker>.workers.dev
```

To nie jest sekret. Ponowny push lub ręczne uruchomienie workflow zbuduje frontend z tym adresem.

## 4. D1

Zaloguj Wrangler do właściwego konta Cloudflare i utwórz D1:

```bash
npx wrangler login
npx wrangler d1 create inteligentny-kalendarz-push
```

Skopiuj prawdziwy `database_id` do konfiguracji produkcyjnej. Nie commituj wymyślonego lub tajnego tokenu; samo D1 `database_id` nie jest sekretem.

Następnie:

```bash
npm run worker:migrate:remote
```

## 5. Production origin

Dla standardowego GitHub Pages project site nagłówek `Origin` ma postać:

```text
https://<user>.github.io
```

Ścieżka repo nie jest częścią Origin. Produkcyjne `ALLOWED_ORIGINS` Workera musi zawierać dokładnie ten HTTPS origin i nie może być `*`.

Jeżeli wiele aplikacji działa pod tym samym `user.github.io`, wszystkie współdzielą origin. Chronione endpointy Workera nadal wymagają tokenu instalacji, ale jeśli potrzebna jest pełna izolacja originów między aplikacjami, użyj osobnych custom domains/subdomains.

## 6. VAPID

Wygeneruj produkcyjną parę VAPID lokalnie:

```bash
npx web-push generate-vapid-keys
```

Ustaw sekrety Workera:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

Nigdy nie commituj `VAPID_PRIVATE_KEY`.

## 7. Worker

```bash
npm run worker:typecheck
npm run worker:test
npm run worker:deploy
```

Potwierdź HTTPS endpoint, D1 binding i Cron. Sam wpis w `wrangler.jsonc` nie jest dowodem produkcyjnego działania.

## 8. Realny production gate

Po wdrożeniu sprawdź na GitHub Pages:

- pierwszy online load,
- manifest i PWA install,
- ponowne otwarcie offline,
- update bez utraty IndexedDB,
- Backup/Restore/Data Transfer,
- PDF i XLS/XLSX smoke test na syntetycznych danych,
- Web Push registration i test Push,
- realny reminder po zamknięciu aplikacji,
- master OFF przy istniejącym zdalnym schedule,
- Windows,
- Android,
- iOS Add to Home Screen,
- responsive i accessibility.

## 9. Finalne 1.0.0

Dopiero gdy wszystkie obowiązkowe bramki są PASS:

- `APP_VERSION`: `1.0.0`,
- `package.json`: `1.0.0`,
- root `package-lock.json`: `1.0.0`,
- cache Service Workera: `v1.0.0`,
- schema pozostaje `12`, jeśli storage się nie zmienił.

Następnie ponownie wykonaj `npm ci`, `npm run check`, `npm audit` i realny deploy/update test.
