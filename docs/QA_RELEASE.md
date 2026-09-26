# QA i wydanie

## Ostatni opublikowany release - Build234

Build234 został opublikowany 26.09.2026 na `main` jako commit `5c05438101b09c70aa6ec92609efbfe7d0dead3c`. GitHub workflow `CI` oraz `Deploy GitHub Pages` zakończyły się `success`. Przed publikacją dependency-complete Windows `check:public` miał 319/319 wykonanych test files i 1836/1836 wykonanych tests PASS, 2 optional skips; production/release/security gates PASS i production dependency audit 0 vulnerabilities. Release-runtime potwierdził Service Worker, lazy Receipt Scanner i installed-PWA offline lazy chunks.

## Bieżący PRIVATE - Build242 release-test contract cleanup candidate

Build240 synchronizował clean checkpoint. Build241 naprawił strict-TypeScript TS18048 w `mobileWeekEventLabel`. Dependency-complete Windows walidacja Build241 następnie potwierdziła `npm ci` PASS, typecheck PASS i 1850 testów publicznych PASS. Trzy jedyne FAIL były przestarzałymi asercjami historycznych testów: stary tekst `Pokaż szczegóły` wobec zaakceptowanego `Szczegóły` oraz dwa twarde oczekiwania `APP_VERSION = 1.2.0.236`. Dodatkowo regresja Build239 miała przyszły twardy pin do `1.2.0.241`.

Build242 nie zmienia produktu. Aktualizuje wyłącznie te kontrakty testowe tak, aby historyczne testy chroniły zachowanie i schema 14, a nie konkretny numer późniejszego buildu. Dokładna synchronizacja bieżącej wersji pozostaje chroniona przez `release:contract:qa`. `npm run security:dependencies` Build241 zakończył się PASS z 0 produkcyjnymi podatnościami. Po podmianie patcha wymagane jest ponowne `npm run check:public`; dopiero jego PASS pozwala na commit/push.

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
