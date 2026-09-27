# Project Ledger — kanoniczny rejestr decyzji i dalszych prac

Ten dokument jest trwałym rejestrem decyzji projektowych, założeń i otwartych punktów. Ma zapobiegać utracie ustaleń między buildami i rozmowami. Szczegóły bieżącego wydania są dodatkowo w `CURRENT_STATE.json`, `BUILD_INFO.json`, `HANDOFF_NEW_CHAT.md` i `docs/QA_RELEASE.md`.

## 1. Kanoniczny stan

- Linia produktu: `1.2.0`.
- Ostatni opublikowany baseline przed Build246: Build244, commit `c30711bee27ab1b7ebb406ae478f709aa9fe6722`.
- Build245: zaakceptowany kierunek minimalistycznych kart statusowych, kandydat PRIVATE; nie zmienia logiki produktu.
- Build246: konsolidacja źródeł + uniwersalna warstwa założeń powtarzalnego planu Studiów.
- IndexedDB schema: `14`; Build246 nie wymaga migracji schematu.
- Aplikacja pozostaje local-first; prywatne pliki źródłowe i dane użytkownika nie są pakowane do repo/PUBLIC/PRIVATE recovery.

## 2. Trwałe decyzje UX/UI

- Mobile i desktop mają równy priorytet.
- Nie wracamy do kolorowych pionowych raili/statusowych obwódek na kafelkach. Statusy mają używać neutralnego obramowania, subtelnego gradientu/tła, chipa i tekstu.
- Nie dokładamy lokalnych override'ów bez końca. Gdy kilka reguł walczy o ten sam komponent, porządkujemy ownera geometrii zamiast dodawać kolejną łatkę.
- `Dzisiaj`, zaakceptowany mobilny Tydzień, Work po Build237 oraz Receipt/Finance po Build236 pozostają stabilnymi powierzchniami i nie są redesignowane bez konkretnej regresji lub nowej decyzji.
- Receipt OCR/parser jest funkcjonalnie zamrożony. Zmiana parsera wymaga reprodukowalnego błędu finansowego i testu regresyjnego.

## 3. Studia — źródło, prawda i założenia aplikacji

### 3.1 Surowe źródło

Aktywnym referencyjnym źródłem jest `licencjat-ii-rok-piel.-25.09.2026.xls`, trzymany poza checkpointem. Zweryfikowany SHA-256: `b6279b96e8cdfc7a95b9c7199686db424ef84e315215a03545957aee413964e4`.

Surowy parser pozostaje source-faithful. Dla exact źródła 25.09 verified reference nadal opisuje wynik **przed** założeniami aplikacji: 2313 kandydatów, 2145 READY, 168 REVIEW_REQUIRED; wybrany profil `MAIN:7 + G12:7A + G8:7B + G4:7B2` = 79 kandydatów, 76 importowalnych, 3 niepełne i 1 konflikt źródłowy. Te liczby/fingerprinty nie są zmieniane przez Build246.

### 3.2 Build246 — zasada powtarzalnego wzorca

Za zgodą użytkownika aplikacja może po weryfikacji surowego źródła uzupełnić **brakującą godzinę i/lub lokalizację** z powtarzalnego wzorca, jeżeli wszystkie poniższe warunki są spełnione:

1. porównujemy ten sam znormalizowany przedmiot, typ zajęć i dokładnie ten sam zestaw grup;
2. istnieją co najmniej **2 kompletne, zgodne wystąpienia** danej wartości;
3. dla uzupełnianej wartości nie ma konkurencyjnego wzorca — kompletne wystąpienia muszą wskazywać dokładnie jedną godzinę lub jedną lokalizację;
4. jawna wartość z bieżącego pliku nigdy nie jest nadpisywana;
5. **data/dzień nigdy nie są inferowane** z tej reguły;
6. uzupełnienie jest oznaczone `inferredFields` + `inferenceNotes` i przechowywane razem z importem;
7. nowy oficjalny plan zawsze ma pierwszeństwo. Jeśli później poda godzinę/miejsce, jego jawna wartość zastępuje wcześniejsze założenie przez normalny mechanizm aktualizacji/diffu.

Reguła jest uniwersalna. W kodzie nie ma warunku `if subject === 'INTERNA'` ani hardcodowania grupy/semestru. Dla już aktywnego importu Build246 może idempotentnie odtworzyć założenia z zachowanych `sourceOnly` entries i dodać dopiero teraz importowalne wydarzenia; surowe source entries nie są przy tym przepisywane. Przed takim backfillem powstaje restore point.

### 3.3 Fakt źródłowy a założenie

Dokumentacja i UI muszą rozróżniać:
- **fakt z arkusza** — wartość odczytana z pliku,
- **założenie aplikacji** — wartość odziedziczona z jednoznacznego wzorca.

Weryfikacja `verified-study-plan.ts` jest wykonywana na analizie surowej. Dopiero po jej zakończeniu działa `applyRecurringStudyPatternAssumptions()`. Dzięki temu założenie nie może zmienić kryptograficznej referencji źródła.

### 3.4 Aktualizacje planu

Każdy kolejny oficjalny XLS/XLSX:
1. przechodzi przez uniwersalny reader/parser,
2. jest audytowany jako nowe źródło lub exact verified source,
3. dopiero potem dostaje warstwę bezpiecznych założeń,
4. jest porównywany z aktywnym planem,
5. zmiany trafiają do Kalendarza dopiero po jawnej decyzji użytkownika.

Nie tworzymy drugiej statycznej bazy planu i nie dopisujemy ręcznie semestru do kodu.

## 4. Cleanup Build246 — co usunięto

Usunięto player-facing pliki, które nie były osiągalne z bieżącej aplikacji i były superseded przez aktualne ekrany:

- `src/shopping/ShoppingView.tsx`,
- `src/shopping/ExpensesView.tsx`,
- `src/cycle/CycleView.tsx`,
- `src/cycle/CycleJournalEditor.tsx`,
- `src/cycle/CyclePeriodEditor.tsx`,
- `src/locations/LocationsView.tsx`,
- `src/ui/AppBackgroundDecor.tsx`,
- `src/ui/FloralAccent.tsx`,
- stale UI-only test `src/tests/expenses-ui.test.ts`.

Nie usunięto modeli danych, storage/migracji ani unikalnej logiki domenowej. Cleanup ma zmniejszać martwą warstwę prezentacji, a nie kasować możliwość odczytu starych danych lub wiedzę domenową.

## 5. Świadomie zachowane moduły nieruntime'owe

Graf importów Build246 ma małą jawną allowlistę modułów, które nie są osiągalne od `src/main.tsx`, ale pozostają celowe:

- `src/app/devServiceWorkerRecovery.ts` — ładowany bezpośrednio z `index.html`, poza grafem TS,
- `src/cycle/cycle-ovulation.ts` — zachowana logika domenowa + regresje,
- `src/cycle/cycle-patterns.ts` — zachowana logika domenowa + regresje,
- `src/notifications/notification-planner.ts` — zachowana logika domenowa + regresje,
- `src/vite-env.d.ts` — deklaracje ambient Vite.

Benchmarki w `src/benchmarks` są osobnymi rootami narzędziowymi i nie są traktowane jako martwy runtime.

## 6. Higiena projektu od Build246

`scripts/source-hygiene-gate.mjs` i `npm run source:hygiene` pilnują:
- żeby usunięte stare ekrany nie wróciły,
- żeby nie pojawiły się nowe nieoczekiwane moduły poza grafem runtime/benchmarków,
- żeby allowlista celowych modułów nie zestarzała się,
- żeby źródło nie zawierało archiwów, backupów, logów, plików tymczasowych i katalogów build/cache.

Checkpoint/public gates nadal blokują przypadkowe XLS/XLSX/PDF; jedynym wyjątkiem jest jawnie dozwolony exact aktywny Study XLS w PRIVATE recovery, nigdy w PUBLIC, screenshoty, `.git`, `node_modules`, `dist`, cache i inne artefakty.

## 7. Frozen / chronione obszary

- schema 14 bez realnej potrzeby migracji,
- Receipt OCR/parser bez reprodukowalnego błędu,
- verified Study raw fingerprints bez exact-source reaudytu,
- zaakceptowane stabilne UI bez konkretnej regresji,
- ręczne wybory użytkownika kategorii/necessity nad sugestiami heurystycznymi.

## 8. Otwarte punkty po Build246

- Dependency-complete Windows `npm run check:public` + `npm run security:dependencies` przed publikacją Build246.
- Przy następnym dostępie do exact `25.09.2026.xls` wykonać runtime QA warstwy założeń i zapisać dokładną liczbę realnie uzupełnionych wpisów; nie zmieniać raw verified counts.
- Przy każdym nowym planie uczelni: audit -> diff -> review -> apply; jawne nowe wartości mają pierwszeństwo przed wcześniejszymi założeniami.
- Dalsze prace tylko jako bounded slice na podstawie konkretnego problemu lub uzgodnionej funkcji.

## 9. Build247 - decyzja po Windows QA Build246

- `exactOptionalPropertyTypes` traktujemy literalnie także w test fixtures: brak optional value oznacza brak property, nie `property: undefined`.
- `source:hygiene` bada źródła i martwe moduły, ale nie może failować tylko dlatego, że działa wewnątrz normalnego checkoutu po `npm ci`/`tsc`. Workspace-only `.git`, `node_modules`, build/cache i root `tsbuildinfo` są pomijane przez ten gate.
- Brak tych artefaktów w dystrybuowanych ZIP-ach nadal jest osobno egzekwowany przez checkpoint/public package gates.
- Build247 nie zmienia żadnego zachowania użytkowego ani reguły założeń Studiów z Build246.


## 10. Build248 - test-contract cleanup po Windows QA Build247

Windows Build247: typecheck PASS, 1858 testów PASS, 2 optional skips, 2 stale source-text assertions FAIL. Build248 aktualizuje tylko te asercje. Nie zmienia reguły recurring-pattern, aktywnego backfillu, raw parsera, verified fingerprintów, danych ani schema 14.


## Build249 - mobile polish + Study reality-check

- Real-device screenshots from 27.09 confirm the overall visual direction is stable. No broad redesign is opened.
- Finance Items: keep the two-row mobile structure from Build243, but reduce border/background weight of category and necessity selects. Direct editing stays available.
- Work: empty `Zgodność z dyspozycyjnością` is guidance, not an alert. Use neutral surface, compact copy and smaller action.
- Calendar: preserve Month/Week/filter/add behavior, but reduce visual weight of mobile controls. The grid remains the primary surface.
- Study: recurring-pattern assumptions are an operational post-verification layer and must be applied consistently to import, active backfill, group recalculation and alternate-group preview. Raw source-only entries are never rewritten.
- Reality-check observation: current phone screenshots show Study selectors 10 / 10B / 10B2. A separate Calendar screenshot previously showed a G12:7B event. This is recorded as a possible persisted-group/calendar consistency issue, not as a confirmed parser error. Runtime active-import data must decide it; do not change verified fingerprints or hardcode a repair from screenshots alone.
- Build248 Windows closure is green: 325 executed test files PASS, 1860 tests PASS, 2 optional skips, production/release gates PASS, 0 production dependency vulnerabilities. Local commit `2206680` was created, but the shown push command had a `mainm` typo, so publication was not confirmed in that log.
- Build249 final local proof: static operational/UI contract 13/13 PASS; source hygiene, release contract, raw parser freeze, release preflight, Service Worker, release safety, travel, security release, checkpoint state/hygiene PASS; syntax/JSON proof PASS. Windows dependency-complete gates and persisted active-plan group/calendar QA remain blockers before publication.

## 11. Build250 - niezależne przydziały grup z Excela

- Decyzja użytkownika: aktualny plan 25.09 ma być dopracowany jako kanoniczna referencja, nawet jeśli przyszłe plany będą wymagały ręcznego dopasowania nowego layoutu.
- MAIN/G12/G8/G4 są czterema niezależnymi przydziałami. Nie wyliczamy G8 z G4 ani żadnego innego poziomu z nazwy grupy.
- Dla aktualnego planu UI pokazuje cztery pola. Grupa główna jest 24-osobowa w tym konkretnym źródle.
- Profile takie jak `10 / 10A / 10C / 10A2` są dozwolone, jeśli etykiety istnieją w odpowiednich partycjach źródła.
- Filtrowanie wydarzeń jest exact: `kind + label`. G4 nie wybiera wydarzeń G8.
- Stare zapisane profile bez G8 nie są automatycznie naprawiane. UI ma pokazać brakujący wybór i użytkownik wskazuje oficjalny przydział ręcznie, po czym może zastosować przeliczenie planu.
- Raw parser, full candidate fingerprint exact 25.09, schema 14 i Receipt OCR/parser pozostają zamrożone. Referencyjne profile QA dostają jawny G8, aby odtworzyć ten sam zweryfikowany zestaw wydarzeń bez runtime inference.


## Build251 - decyzja o retencji aktywnego planu i exact-source QA

- Użytkownik jawnie zdecydował, że aktualny plan 25.09 ma być zachowany jako prywatne źródło referencyjne.
- Exact XLS wolno przechowywać tylko w PRIVATE recovery pod `private-fixtures/study/licencjat-ii-rok-piel.-25.09.2026.xls`.
- PUBLIC, patch PUBLIC i GitHub nie mogą zawierać tego pliku.
- PRIVATE checkpoint gate dopuszcza tylko ten jeden konkretny XLS i weryfikuje jego nazwę, rozmiar oraz SHA-256.
- Snapshot `active-profile-audit.json` utrwala wynik surowy i operacyjny aktualnego profilu bez potrzeby ręcznego odtwarzania ustaleń z rozmowy.
- Jedyny nierozstrzygnięty wpis bieżącego profilu to POZ G4:4C1 w tygodniu 12-16.10, bez dokładnego dnia/godzin/lokalizacji w źródle. Nie wolno go automatycznie datować.


## Build252 - korekta komunikatu walidacji grup

Windows Build251 wykonał 1864 testy PASS i zatrzymał się na jednej regresji copy: komunikat o wielokrotnym wyborze używał mianownika po `więcej niż jedną`. Build252 poprawia wyłącznie formy biernika dla MAIN/G12/G8/G4. Semantyka czterech niezależnych przydziałów i exact-source Study QA nie zmieniają się.

## Build253 - source truth w Kalendarzu

Po doprecyzowaniu kontraktu przez użytkownika usunięto koncepcję poziomów pewności. Zasada jest prosta: Kalendarz pokazuje tylko dane możliwe do odczytania z Excela. Wpis tygodniowy nie jest powielany jako wydarzenie każdego dnia. Widok Tydzień ma neutralny pasek `Plan` z zakresem źródłowym, wymiarem godzin i notatką źródłową, a Miesiąc kotwiczy taką informację jeden raz na początku zakresu z etykietą `tydz.`. Dane operacyjne, parser i fingerprint źródła nie są zmieniane.



## Build254 - stale Study readability contract closure

- Windows Build253: typecheck PASS, 1867 testów PASS poza jednym stale source-text assertion, 2 optional skips.
- Jedyny FAIL wymagał tekstu `to nie jest potwierdzone wydarzenie`, który został świadomie usunięty w Build253 zgodnie z minimalistycznym source-truth UI.
- Build254 aktualizuje wyłącznie test do aktualnego kontraktu `Informacja z planu` / `Informacja z planu studiów` oraz week-level source strip.
- Produkt, parser, exact XLS 25.09, 78 operacyjnych wydarzeń, MAIN/G12/G8/G4, recurring-pattern assumptions, Receipt OCR/parser i schema 14 pozostają bez zmian.
