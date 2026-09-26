# QA i wydanie

## Aktualny dowód release

Build216 został sprawdzony 24.09.2026 na Windows i następnie opublikowany na `main`; commit `5a633d68c7ccfbdc9d29ac315a494a94374e8fb2`, CI i Deploy GitHub Pages success:

- `npm run check:public` - PASS,
- 310 plików testowych PASS,
- 1782 testy PASS,
- 2 opcjonalne testy skipped,
- 0 failed,
- produkcyjny Vite build PASS,
- production audit PASS,
- service-worker gate PASS,
- release-safety gate PASS,
- travel release gate PASS,
- security release gate PASS,
- `npm run security:dependencies` dla tego samego drzewa zależności - 0 vulnerabilities.

Build225 był public-data flow smoke + mobile edge hardening po Build224 lazy loading. Jego odroczone release wymagania zostały domknięte w kolejnych buildach; aktualny release proof jest przypisany do Build234. Receipt parser freeze pozostaje obowiązkowym kontraktem.


## Aktualny verified PRIVATE proof - Build234

Build234 przeszedł 26.09.2026 dependency-complete Windows `check:public`: 319/319 wykonanych test files i 1836/1836 wykonanych tests PASS, 2 optional skips. Produkcyjny Vite build oraz production-audit, service-worker, release-safety, travel i security-release są zielone; `security:dependencies` zgłosił 0 vulnerabilities. Release-runtime QA potwierdził Service Worker register/activate, Receipt Scanner first-open lazy boundary, 24-entry transitive cache oraz installed-PWA offline lazy chunks. Build234 jest frozen verified PRIVATE baseline następnego PUBLIC. Finalny PUBLIC Build234 jest generowany wyłącznie z tego baseline’u; fresh PUBLIC musi zachować wspólne pliki bitowo identycznie i przejść release:preflight/security:public oraz finalne release gates przed handoffem.

## Codzienny development

Najpierw focused/adjacent testy odpowiednie do zmiany. Pełny core wykonujemy raz na zamrożonym końcowym PRIVATE przed wydaniem produktu.

Podstawowe komendy:

```powershell
npm run typecheck
npm run test:public
npm run check:public
npm run security:dependencies
```

Dodatkowe aktywne QA:

```powershell
npm run release:preflight
npm run release:parser-freeze:qa
npm run release:contract:qa
npm run checkpoint:state
npm run checkpoint:hygiene
npm run checkpoint:manifest
npm run checkpoint:gate
npm run study:mobile-smoke
npm run receipt:corpus:qa
npm run visual:qa
```

Historyczne jednorazowe proof scripts zostały usunięte w Build217. Ich zachowanie jest chronione przez `src/tests` i przez aktualne release gates. Testów regresyjnych nie usuwamy tylko dlatego, że mają starszy numer buildu w nazwie.

## PRIVATE checkpoint

Checkpoint nie może zawierać `.git`, `node_modules`, `dist`, coverage, cache, logów, archiwów, XLS/XLSX/PDF, backupów ani prywatnych screenshotów. `CHECKPOINT_MANIFEST.sha256` obejmuje wszystkie pliki paczki poza samym manifestem.

Lokalny working tree może podczas QA Studiów zawierać exact `licencjat-ii-rok-piel.-25.09.2026.xls`, ale `security-release` akceptuje go tylko po zgodności nazwy, rozmiaru 148992 B i SHA-256 `b6279b96e8cdfc7a95b9c7199686db424ef84e315215a03545957aee413964e4`. Plik nadal nie może wejść do checkpointu ani PUBLIC; drift lub każdy inny XLS/XLSX/PDF/archiwum blokuje gate.

## PUBLIC

PUBLIC powstaje z zamrożonego PRIVATE w czystym katalogu. Usuwa się prywatne root docs, `project-skills`, manifest checkpointu i inne private-only materiały. Wspólne pliki PRIVATE/PUBLIC muszą być bitowo identyczne.

## Kanoniczny push

Gdy finalny PUBLIC jest już w `D:\Projekty\inteligentny-kalendarz-publish` i istniejący `.git` został zachowany:

```powershell
cd "D:\Projekty\inteligentny-kalendarz-publish"
git add -A
git diff --cached --check
git commit -m "Release <release> Build <build>"
git push origin main
```

Nie tworzymy dodatkowych clone'ów, folderów ani skryptów push bez potrzeby.
