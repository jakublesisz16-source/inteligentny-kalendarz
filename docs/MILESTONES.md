# Najważniejsze kamienie milowe

Ten plik zastępuje dziesiątki jednorazowych dokumentów `*_BUILDxxx.md`. Szczegółowe regresje pozostają w `src/tests`, a aktualne zasady i stan są w rootowych plikach checkpointu.

## Studia i import planu - Builds 130-150

Importer XLS/XLSX został przebudowany pod realne plany WUM, model grup MAIN/G12/G8/G4, scalenia, inline daty/godziny/lokalizacje, completeness audit i bezpieczny diff aktualizacji. Aktywną referencją jest plan II roku 25.09.2026 i `STUDY_PLAN_II_2026_MAPPING.md`; Build226 dodał dokładne terminy CSM oraz semantyczny fingerprint całego wyniku i bieżącego profilu.

## Receipt Scanner 2.0 - Builds 151-163

Powstała lokalna ścieżka OCR/PDF oraz e-paragon JSON, review finansowe, reconciliacja sum/rabatów/kaucji, duplicate guard, corpus QA i freeze parsera. Od Build163 parser jest funkcjonalnie zamrożony bez reproduktora błędu finansowego.

## Finanse - Builds 164-173

Ujednolicono kategorie, katalog produktu, necessity, historię cen, klasyfikację Miesiąc/Wyjazd/export, drill-down kategorii i bezpieczną edycję transakcji zagranicznych.

## Uproszczenie interfejsu - Builds 174-200

Przebudowano hierarchię Studiów, Pracy, Kalendarza, Dzisiaj i Finansów pod zasadę „następna decyzja najpierw”; usunięto globalny search, ograniczono karty w kartach i dopracowano mobile/safe-area.

## Release/UI polish - Builds 201-216

- Build201 - poprzedni szeroki publiczny baseline przed końcowym polerowaniem.
- Builds 202-210 - Dzisiaj, pełny mobilny Tydzień, Praca, Dyspozycyjność, Podsumowanie i Finanse otrzymały finalny polish.
- Build211 - test-contract sync i publiczne wydanie; commit `7a3a488a5c0913babccd9f53608d41f9312399a8`, CI/Pages success.
- Builds 212-215 - usability system, desktop Work, mobilne Finance Items i usunięcie pustej przestrzeni w Wyjazdach.
- Build216 - wyłącznie synchronizacja czterech starych testów kontraktowych z zaakceptowanym UI; pełny Windows check: 1782 PASS, 0 FAIL; opublikowany na `main` jako commit `5a633d68c7ccfbdc9d29ac315a494a94374e8fb2`, CI/Pages success.

## Build217 - clean checkpoint

Build217 nie zmienia produktu. Usuwa superseded build-docs i jednorazowe proof scripts, konsoliduje dokumentację do aktualnego stanu/roadmapy/QA, upraszcza package scripts i dodaje hygiene gate, żeby stary bałagan nie wrócił.


## Build218 - Finance Dashboard Visual Polish

Build218 dopracowuje wyłącznie główny Miesiąc Finansów: dodaje trend 6 miesięcy, donut kategorii, kluczowe KPI, Top 3 miejsc zakupów i Top 3 największych wydatków oraz klikalny filtr miejsca. Receipt Scanner/OCR/parser pozostają bez zmian.

## Build219 - Finance + Trips Compact Responsive Polish

Po real-data QA Build218 spłaszczono Miesiąc, zmniejszono donut i trend, naprawiono pełnoszerokie KPI 2x2 na telefonie, ograniczono mobilne rankingi do jednego panelu naraz oraz odfiltrowano generyczne „miejsca zakupów”. Ten sam dashboard przeniesiono do szczegółu Wyjazdu z donutem, KPI, rankingami i filtrem miejsca. Receipt Scanner/OCR/parser pozostają bez zmian.


## Build220 - Finance Donut Legend Readability Polish

Po runtime QA Build219 doprecyzowano wykres donut bez zmiany jego modelu: legenda Miesiąca i Wyjazdu dostała znaczniki w tych samych tonach co segmenty koła, procent pozostaje widoczny na wąskim telefonie, `Pozostałe` używa poprawnego tonu 4, a wyjazd w walucie innej niż PLN jawnie opisuje, że kwoty kategorii są prezentowane w PLN. Receipt OCR/parser pozostał zamrożony.


## Build221 - Finance Donut Legend Alignment Polish

Po kolejnych real-data screenshotach Build220 nie zmieniono modelu wykresu, tylko uporządkowano legendę: na desktopie każdy wiersz ma stały układ okrągły marker + ikona + nazwa + wyrównany procent/kwota, a na telefonie wartości pozostają pionowe i zwarte. Adnotacja PLN w zagranicznym Wyjeździe jest czytelniejszym podtytułem. Receipt OCR/parser pozostaje zamrożony.

## Build222 - Finance Currency Context Polish

- po real-data QA Build221 donut i legenda pozostają bez dalszego redesignu,
- Miesiąc pokazuje PLN jako kwotę główną, a walutę oryginalną jako pomocnicze `oryginalnie ...`,
- zagraniczny Wyjazd pokazuje walutę wyjazdu jako główną, a PLN jako pomocnicze `≈ ...` przy kompletnych danych oryginalnych,
- hierarchia obejmuje listy, największy wydatek, Top 3, miejsca i szczegół transakcji,
- kategorie/pozycje bez natywnych kwot są jawnie opisane jako PLN,
- mobile clearance obejmuje również listę wydatków Wyjazdu,
- Receipt Scanner/OCR/parser pozostają zamrożone; schema 14.


## Build223 - App-wide UX Quality Audit

- po zaakceptowanym runtime QA Build222 nie przebudowano stabilnych ekranów,
- dodano skip navigation i nazwany main landmark,
- tytuł karty przeglądarki odpowiada aktywnej sekcji,
- Modal dostał unikalne accessible title IDs, widocznościowy focus trap i fallback focusu dialogu,
- dodano wspólny focus-visible fallback oraz blokadę przewijania tła pod modalem,
- Receipt Scanner/OCR/parser pozostają zamrożone; schema 14.

## Build224 - Performance + Lazy Loading

- Finance/Study/Work zostały wyjęte ze statycznego grafu startowego przez lazy/Suspense,
- skaner paragonu ładuje pełny ReceiptScanFlow dopiero po otwarciu, bez zmian w zamrożonym katalogu OCR/parsera,
- XLS/XLSX, ExcelJS export oraz PDF.js są ładowane na żądanie,
- service worker rekurencyjnie precachuje transitive lazy chunks, aby utrzymać offline/PWA,
- źródłowy graf startowy zmniejszył się z 113 modułów / 1 534 018 B do 54 modułów / 600 337 B; schema 14.

## Build225 - Public-data Flow Smoke + Mobile Edge Hardening

- runtime screenshot QA użytkownika potwierdziło główne widoki desktop/mobile po Build224 lazy-load,
- dodano public-data smoke contracts dla Dzisiaj, Kalendarza, Finansów, Studiów, Pracy i Ustawień oraz syntetyczny smoke obliczeń Finansów/Pracy,
- przełączanie `Grafik / Dyspozycyjność / Podsumowanie` resetuje przewinięcie strony,
- mobilne `+ Dodaj` działa również w Kalendarzu Tydzień,
- Praca dostała dodatkowy clearance ponad stałą dolną nawigacją,
- Receipt Scanner/OCR/parser pozostają zamrożone; schema 14.


## Build226 - Study 25.09 Source Fidelity + Final Source QA

- aktywna referencja Studiów została zmieniona na oficjalny plan `25.09.2026`,
- parser obsługuje dedykowane dokładne daty CSM jako bardziej szczegółowe od szerokiego nagłówka sąsiedniej komórki, także przy jawnych przesunięciach dnia,
- bieżący profil `7/7A/7B2` ma deterministyczny fingerprint semantyczny i zachowuje jeden konflikt pochodzący ze źródła,
- wrześniowy PDF Pracy przeszedł realny source QA; parser Pracy nie wymagał zmiany,
- Receipt Scanner pozostał zamrożony.


## Build228 - Verified Study Plan Runtime Guard

- exact plan WUM 25.09.2026 jest w runtime rozpoznawany po SHA-256, nie po nazwie pliku,
- znany plik musi odtworzyć pełny fingerprint 2313 kandydatów, audyt MAIN/G12/G8/G4 oraz fingerprint profilu 7/7A/7B2; drift blokuje import fail-closed,
- real-source test korzysta z tej samej implementacji fingerprintu co runtime,
- nowy Excel nadal używa uniwersalnego parsera i istniejącego diffu aktualizacji Kalendarza; nie powstał drugi statyczny owner planu,
- UI pokazuje `ZWERYFIKOWANY` tylko po pełnym PASS referencji,
- Build227 pozostaje historycznym niezaakceptowanym WIP-em; nie jest baseline'em ani ponownie używanym numerem,
- Receipt Scanner/OCR/parser i schema 14 pozostają bez zmian.


## Build229 - QA contract hardening

Dependency-complete Windows run potwierdził działające `npm ci` i 0 production dependency vulnerabilities. `check:public` ujawnił jeden strict TypeScript problem w nowym teście Studiów; Build229 naprawia nullable `startTime`. `test:private` na clean checkpointcie zgłaszał wyłącznie brak celowo niepakowanego `_PRIVATE_HISTORY`, dlatego exact-source `study:audit` został przepięty na `vitest.public.config.ts`. Semantyka parsera i Verified Study Plan nie zmieniły się.


## Build230 - Public-suite closure after exact-source PASS

Windows QA potwierdził exact XLS 25.09 po SHA-256 oraz zielony `study:audit`. Public Vitest Build229 ujawnił 6 regresji kontraktów. Build230 usuwa redundantny legacy merchant aggregate z FinanceDashboard, przywraca transaction-first filter contract, naprawia osiągalność pustego stanu Praca/Dyspozycyjność, przywraca public self-containment i pełną politykę wersjonowania. Parser Studiów, fingerprinty Verified Study, Receipt OCR/parser i schema 14 pozostają bez zmian.


## Build231 - Historical test-contract alignment

Dependency-complete Windows QA Build230 przeszedł typecheck i 317/321 public test files / 1834/1838 tests; dwa pozostałe FAIL były starymi asercjami sprzecznymi z późniejszymi zaakceptowanymi kontraktami. Build231 aktualizuje Build218 Finance test do meaningful merchant pipeline z Build219 oraz Build174 Work test do zawsze osiągalnego AvailabilityWorkComparisonPanel. Nie zmienia zachowania produktu, parsera Studiów, Verified Study, Receipt OCR/parsera ani schema 14.


## Build232 - Exact local Study source security-gate alignment

Dependency-complete Windows QA Build231: 319/319 wykonanych public test files PASS, 1836/1836 wykonanych tests PASS, 2 optional skips, produkcyjny build i release gates do travel PASS, dependency audit 0 produkcyjnych podatności przy progu high. Jedyny blocker: security gate odrzucał exact Study XLS obecny lokalnie w root. Build232 pozwala wyłącznie na kanoniczny plik 25.09 po nazwie + 148992 B + SHA-256 `b6279b96e8cdfc7a95b9c7199686db424ef84e315215a03545957aee413964e4`; drift i inne prywatne/archiwalne pliki nadal fail-closed.


## Build233 - Verified Study runtime closure

Build232 przeszedł dependency-complete Windows QA w całości: 319/319 wykonanych public test files, 1836/1836 wykonanych tests, Vite build oraz production-audit/service-worker/release-safety/travel/security-release PASS, a production dependency audit zgłosił 0 vulnerabilities przy progu high. Runtime QA exact źródła 25.09 potwierdził `ZWERYFIKOWANY`, profil 7/7A/7B2, 76 wynikowych importowalnych + 3 niepełne, jawny diff/apply i zapis do Kalendarza. Konflikt 08.10.2026 POZ 12:00-15:45 vs CHIRURGIA 15:00-16:30 pozostał zachowany i widoczny jako 45-minutowa niespójność źródła. Build233 nie zmienia produktu; synchronizuje closure metadata i staje się verified PRIVATE baseline.


## Build234 - Installed-PWA Service Worker Template Fix

Release-runtime QA po Build233 wykrył rzeczywisty błąd instalacji Service Workera: recursive bundle discovery uznał nierozwiązany string `assets/${t}` za konkretny plik precache, pobrał HTML fallback i odrzucił install event. Build234 pomija unresolved `${...}` refs i dodaje dokładną regresję do `service-worker-gate`. UI produktu, Study parser/Verified Study i Receipt OCR/parser pozostają bez zmian. Dependency-complete Windows QA zakończył się 319/319 wykonanych test files i 1836/1836 wykonanych tests PASS, 2 optional skips, wszystkimi release/security gates PASS i 0 production dependency vulnerabilities. Runtime potwierdził aktywację Service Workera, first-open lazy Receipt Scanner, 24 transitive cache entries oraz installed-PWA offline lazy chunks; Build234 staje się verified PRIVATE baseline. Z tego exact baseline’u przygotowano i fresh-zwalidowano czysty PUBLIC candidate bez private-only plików; następny krok to kanoniczny push z istniejącego katalogu publish.
