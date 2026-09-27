# QA i wydanie

## Aktualny `main` - Build244

Build244 został wypchnięty 26.09.2026 na `main` jako commit `c30711bee27ab1b7ebb406ae478f709aa9fe6722`. Windows `npm run check:public` zakończył się 324/324 wykonanych plików testowych i 1857/1857 wykonanych testów PASS z 2 optional skips. Produkcyjny Vite build, production-audit, service-worker, release-safety, travel i security-release były PASS; `npm run security:dependencies` zgłosił 0 vulnerabilities. Push-triggered GitHub CI/Pages Build244 nie został w tej sesji ponownie odczytany przez dostępny connector.


## Bieżący PRIVATE - Build249 mobile polish + Study reality-check

Build248 Windows QA jest zamknięte: 325 wykonanych test files PASS, 1860 tests PASS, 2 optional skips, Vite production build i wszystkie release gates PASS, `security:dependencies` 0 vulnerabilities, release preflight PASS i source hygiene PASS (`runtime=151 intentionalNonRuntime=5 removedLegacy=8`). Build249 dodaje ograniczony polish mobilny oraz spójność recurring-pattern assumptions w przeliczeniu grup i podglądzie innej grupy. Przed publikacją wymagane są ponownie `npm run check:public`, `npm run security:dependencies` i runtime QA zgodności aktywnych grup Studiów z wydarzeniami kalendarza.

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

Build249 local proof: source hygiene PASS (`runtime=151 intentionalNonRuntime=5 removedLegacy=8`), release contract 10/10 PASS, parser freeze 7/7 PASS, release-preflight/service-worker/release-safety/travel/security PASS, checkpoint state/hygiene PASS, Build249 static proof 13/13 PASS, TS/TSX syntax 490 PASS, JS/MJS syntax 22 PASS, JSON parse 9 PASS. Dependency-complete Windows gates and active Study runtime QA remain required before publication.

## Build250 Study group gate

Before release, verify: four selectors appear for the 25.09 source (MAIN/G12/G8/G4); a synthetic `10 / 10A / 10C / 10A2` selection is accepted; G4 alone does not match G8 candidates; stored active/profile selections retain all four explicit keys; changing the manual G8 assignment changes only G8-targeted events plus normal shared/other selected partitions. Exact 25.09 full-candidate fingerprint remains unchanged.

Build250 local dependency-independent proof: four-field group static proof 18/18 PASS; release contract 10/10 PASS; parser freeze 7/7 PASS; source hygiene, preflight, Service Worker, release safety, travel and security release PASS; TS/TSX syntax 494 PASS; JS/MJS syntax 22 PASS; JSON parse 9 PASS. Windows dependency-complete gates and real persisted-profile G8/Calendar QA remain required.


## Build251 - exact current Study source QA

PRIVATE recovery przechowuje dokładny aktywny XLS. Po `npm ci` uruchom:

`npm run study:current-source:qa`

Gate weryfikuje SHA-256 źródła i uruchamia produkcyjny parser na exact XLS. Dla bieżącego PRIVATE stanu oczekuje profilu `MAIN:4 + G12:4A + G8:4B + G4:4C1`, surowego wyniku 79/76/3 oraz operacyjnego 79/78/1 po recurring-pattern assumptions. PUBLIC nie zawiera XLS i nie wykonuje tego prywatnego gate automatycznie.


## Build252 - Study validation message release blocker

Windows Build251: strict typecheck PASS, 1864 testy PASS, 1 FAIL, 2 optional skips. Jedyny FAIL dotyczył polskiej gramatyki tekstu walidacji (`więcej niż jedną grupa 8-osobowa` zamiast `więcej niż jedną grupę 8-osobową`). Security dependencies: 0 vulnerabilities, release preflight PASS, source hygiene PASS. Build252 zmienia wyłącznie ten komunikat i metadane wersji.

## Build253 - Study source visibility QA

Build252 Windows QA jest pełny: 327 plików testowych PASS, 1865 testów PASS, 2 optional skips, produkcyjny build i release gates PASS. Private exact-source audit 25.09 również PASS. Build253 zmienia wyłącznie prezentację source-only danych w Kalendarzu i dodaje test kontraktu: brak confidence labels, brak wymyślonej daty/godziny, week-only marker tylko raz w Miesiącu, neutralny pasek tygodniowy z informacją z Excela. Przed publikacją Build253 wymagany jest ponowny Windows `check:public` i dependency audit.



## Build254 - Windows Build253 stale assertion closure

Windows Build253 `check:public` wykonał 1868 testów merytorycznych: 1867 PASS, 1 FAIL, 2 optional skips. Jedyny FAIL był stale source-text assertion w `study-import-readability.test.ts`, wymagający superseded tekstu `to nie jest potwierdzone wydarzenie`. Security dependency audit miał 0 vulnerabilities, release preflight PASS i source hygiene PASS. Build254 aktualizuje tylko ten test-contract. Przed publikacją wymagany jest ponowny pełny Windows `check:public` i `security:dependencies`.
