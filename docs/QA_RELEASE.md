# QA i wydanie

## Aktualny `main` - Build244

Build244 został wypchnięty 26.09.2026 na `main` jako commit `c30711bee27ab1b7ebb406ae478f709aa9fe6722`. Windows `npm run check:public` zakończył się 324/324 wykonanych plików testowych i 1857/1857 wykonanych testów PASS z 2 optional skips. Produkcyjny Vite build, production-audit, service-worker, release-safety, travel i security-release były PASS; `npm run security:dependencies` zgłosił 0 vulnerabilities. Push-triggered GitHub CI/Pages Build244 nie został w tej sesji ponownie odczytany przez dostępny connector.


## Bieżący PRIVATE - Build248 stale Study test-contract cleanup

Windows QA Build247: strict TypeScript PASS. Public suite wykonał 1858 testów PASS, 2 optional skips i 2 FAIL. Oba FAIL były stale source-text assertions: stary `result.groups` w teście UX oraz stary tekst journala recurring-pattern backfillu. `security:dependencies` PASS z 0 vulnerabilities, `release:preflight` PASS, `source:hygiene` PASS (`runtime=151 intentionalNonRuntime=5 removedLegacy=8`). Build248 aktualizuje tylko te dwa kontrakty testowe i metadane. Produkt pozostaje bez zmian. Pełny Windows gate należy powtórzyć przed publikacją.

## Bieżący PRIVATE - Build246 Study assumptions + cleanup candidate

Build246 zachowuje polish Build245 i dodaje post-verification Study recurring-pattern assumptions oraz cleanup Source of Truth. Raw verified-source semantics/fingerprinty nie są zmieniane. Cleanup usuwa superseded player-facing shells i dodaje `source:hygiene`. Przed promocją wymagane są focused/static/release/checkpoint/fresh-unpack gates oraz dependency-complete Windows `check:public` + `security:dependencies`. Exact-source 25.09 enrichment count należy potwierdzić przy następnym dostępie do pliku; nie jest warunkiem poprawności raw parser freeze.

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
npm run source:hygiene
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
