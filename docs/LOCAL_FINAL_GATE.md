# Local FINAL PRODUCTION GATE - 1.0.0

Status: **RELEASE ARTIFACT APPROVED**.

## Zamrożone parametry

- APP/package: `1.0.0`
- DATABASE_SCHEMA_VERSION: `12`
- `pdfjs-dist`: `6.2.108`
- frontend: GitHub Pages
- backend produktu: brak
- Web Push: poza zakresem `1.0.0`

## Potwierdzony gate kodu

Na dostarczonym `1.0.0-rc.7` po cleanupie GitHub-only potwierdzono na Windows:

- `npm ci` - PASS,
- `npm run check` - PASS,
- typecheck - PASS,
- Vitest - 49 plików testowych, 344/344 testów PASS,
- production build - PASS,
- `npm audit` - 2 Moderate, 0 High, 0 Critical.

Nie używać `npm audit fix --force`, ponieważ dostępna automatyczna ścieżka naprawy wymusza breaking change zależności `exceljs`.

Finalny bump `rc.7 -> 1.0.0` zmienia wyłącznie identyfikatory wydania, wpis release notes/roadmapy, nazwę cache Service Workera i odpowiadające im testy/dokumentację. Nie zmienia schema, zależności ani logiki domenowej.

## Zakres finalnego produktu

- GitHub Pages,
- PWA online/offline,
- IndexedDB local-first,
- lokalny import PDF/XLSX,
- Backup/Restore/Data Transfer,
- brak backendu aplikacji,
- brak Web Push.

## Weryfikacja po publikacji

Po push finalnego `1.0.0` sprawdź działający artefakt:

- GitHub Actions PASS,
- GitHub Pages PASS,
- pierwszy online load,
- instalację/aktualizację PWA,
- ponowne otwarcie offline,
- IndexedDB persistence,
- PDF/XLSX,
- Backup/Restore/Data Transfer,
- brak UI Web Push.

Jeżeli ten smoke ujawni rzeczywisty blocker, popraw wyłącznie blocker. Nie otwieraj ponownie rozwoju funkcjonalnego `1.0.0`.
