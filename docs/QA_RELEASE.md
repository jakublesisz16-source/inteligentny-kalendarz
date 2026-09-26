# QA i wydanie

## Ostatni opublikowany release - Build242

Build242 został opublikowany 26.09.2026 na `main` jako commit `30de2295f81d60bc07735dfdcad203e6f217ae76`. Windows `npm run check:public` zakończył się 323/323 wykonanych plików testowych i 1853/1853 wykonanych testów PASS z 2 optional skips. Produkcyjny Vite build, production-audit, service-worker, release-safety, travel i security-release były PASS; `npm run security:dependencies` zgłosił 0 vulnerabilities. GitHub workflow `CI` oraz `Deploy GitHub Pages` zakończyły się `success`.

## Bieżący PRIVATE - Build244 stale-test-contract cleanup candidate

Build243 wprowadził wyłącznie uzgodniony mobilny polish Finance Items + Study current-plan. Dependency-complete Windows `check:public` wykonał 1855 testów PASS, 2 optional skips i 2 FAIL; oba FAIL to stale historyczne asercje CSS w Build213/236, nie regresja produktu. `security:dependencies` Build243: 0 vulnerabilities. Lokalny commit `986e1ef` został utworzony, ale GitHub `main` nadal wskazuje Build242, więc release nie został opublikowany.

Build244 aktualizuje tylko te kontrakty testowe i metadane wersji. Przed promocją wymagany jest ponowny dependency-complete Windows `check:public` + `security:dependencies`; real-phone visual QA nadal dotyczy niezmienionych powierzchni produktu z Build243.

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
