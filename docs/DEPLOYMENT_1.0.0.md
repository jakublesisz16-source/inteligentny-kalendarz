# Deployment 1.0.0 - GitHub-only

Docelowy `1.0.0` ma jedną produkcyjną warstwę hostingową: publiczny GitHub + GitHub Pages. Nie ma Cloudflare Workera, D1, Cron, VAPID ani Web Push.

Artefakt `1.0.0` jest przygotowany do publikacji po potwierdzonym gate kodu. Po push wykonaj rzeczywisty smoke test wdrożonej PWA; ewentualny blocker popraw wyłącznie minimalną poprawką.

## 1. Lokalny gate

```bash
rm -rf node_modules dist
npm ci
npm run check
npm audit
```

Wymagane: wszystkie testy/build PASS oraz 0 High i 0 Critical. Nie używaj `npm audit fix --force`.

## 2. GitHub Pages

Repozytorium ma mieć aktywne:

```text
Settings -> Pages -> Source -> GitHub Actions
```

Workflow `.github/workflows/pages.yml` wykonuje `npm ci`, pełne `npm run check`, upload `dist/` i deployment Pages.

Projekt używa `base: './'`, manifestu ze względnym `start_url`/`scope` oraz względnej rejestracji Service Workera, dlatego jest przygotowany do GitHub Pages project site pod ścieżką repo.

## 3. Brak zmiennych produkcyjnego backendu

Finalny build `1.0.0` nie wymaga `VITE_PUSH_WORKER_URL` ani sekretów infrastrukturalnych. Nie trzeba konfigurować Cloudflare ani innego serwera aplikacji.

## 4. Production verification

Po wdrożeniu sprawdź:

- pierwszy online load,
- manifest i instalację PWA,
- ponowne otwarcie offline,
- aktualizację Service Workera bez utraty IndexedDB,
- zapis i odczyt lokalnych danych po restarcie,
- Backup/Restore i Data Transfer,
- PDF i XLSX smoke test na danych testowych,
- brak sekcji/komunikatów sugerujących niedokończony Web Push,
- podstawowy responsive/accessibility smoke test na desktopie i Androidzie.

## 5. Finalne 1.0.0

Finalny artefakt ma:

- `APP_VERSION`: `1.0.0`,
- `package.json`: `1.0.0`,
- root `package-lock.json`: `1.0.0`,
- cache Service Workera: `inteligentny-kalendarz-shell-v1.0.0`,
- schema: `12`.

Po publikacji wykonaj realny deploy/update smoke. Brak nowych funkcji, migracji i zależności w bumpie `rc.7 -> 1.0.0`.
