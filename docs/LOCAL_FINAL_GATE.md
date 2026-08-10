# Local FINAL PRODUCTION GATE - RC.7

Status: **LOCAL PUBLIC-REPOSITORY PREPARATION = PASS**. Realny deployment i testy urządzeń pozostają PENDING.

## Zamrożone parametry

- APP/package: `1.0.0-rc.7`
- schema: `12`
- `pdfjs-dist`: `6.2.108`
- funkcjonalny kod `src/`, `worker/` i `public/`: bajtowo bez zmian względem źródłowego RC.7
- `package.json`, `vite.config.ts`, `wrangler.jsonc`: bajtowo bez zmian
- zweryfikowany `package-lock.json`: dołączony

## Wykonane lokalnie

- przygotowanie drzewa pod publiczne repo,
- usunięcie wewnętrznych promptów/handoffów/release auditów z publicznej paczki,
- rozszerzenie `.gitignore`,
- przygotowanie read-only CI dla pull request,
- przygotowanie GitHub Pages workflow dla `main`,
- weryfikacja ścieżek Vite/manifest/Service Worker pod project site `/repo/`,
- secret/private-data scan,
- forbidden-artifact scan,
- kontrola zgodności `package.json` i root lockfile,
- YAML parse workflow PASS,
- JSON parse PASS,
- Service Worker syntax PASS,
- kontrolne rozpakowanie ZIP i porównanie bajtowe PASS.

## npm w środowisku audytu

Próba `npm ci` w tym środowisku zakończyła się E404 na wewnętrznym mirrorze dla `zip-stream-4.1.1.tgz`. Nie jest to nowy błąd dependency tree i nie jest oznaczane jako PASS.

Zweryfikowany lokalny RC.7 użytkownika przeszedł wcześniej na Windows:

- `npm install` PASS,
- `npm ci` PASS,
- wielokrotne `npm run check` PASS,
- 339/339 testów frontendu,
- 5/5 testów Workera,
- production build PASS,
- 20/20 focused stability runs PASS,
- `npm audit`: 0 High, 0 Critical, 2 Moderate przez `uuid -> ExcelJS`.

## Pozostałe bramki

- rzeczywisty publiczny GitHub push,
- GitHub Actions PASS,
- GitHub Pages deploy,
- realny PWA install/offline/update,
- Cloudflare Worker/D1/Cron/VAPID dla Web Push,
- realny Push i master OFF,
- Windows/Android/iOS,
- responsive/accessibility,
- finalny bump i update do `1.0.0`.
