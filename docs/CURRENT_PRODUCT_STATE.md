# Aktualny stan produktu - Build 233

## Status

Build233 jest **verified PRIVATE baseline**. Exact XLS 25.09 ma potwierdzony SHA-256, zielony `study:audit`, pełny dependency-complete Windows `check:public` Build232 oraz runtime QA. Public suite: 319/319 wykonanych test files i 1836/1836 wykonanych tests PASS, 2 opcjonalne skips; Vite build, production-audit, service-worker, release-safety, travel i security-release PASS; production dependency audit 0 vulnerabilities przy progu high. Runtime potwierdził `ZWERYFIKOWANY`, profil 7 / 7A / 7B2, 76 wynikowych importowalnych + 3 niepełne, jawny diff/apply oraz zachowany konflikt 08.10.2026. Schemat danych pozostaje 14. Ostatni potwierdzony PUBLIC na GitHub Pages to Build216, commit `5a633d68c7ccfbdc9d29ac315a494a94374e8fb2`; CI i Pages mają status success.

## Dzisiaj

- Stabilny, lekki dashboard dnia.
- Współpracownicy i najważniejsze zdarzenia pozostają czytelne bez dodatkowych ekranów.
- Nie przebudowywać bez konkretnego problemu z realnego QA.

## Kalendarz

- Miesiąc pozostaje kompaktowy i czytelny.
- Mobilne `+ Dodaj` jest dostępne zarówno w Miesiącu, jak i w Tygodniu.
- Tydzień na telefonie pokazuje wszystkie 7 dni jednocześnie oraz pełny zakres 06:00-23:00.
- Mobilne wydarzenia mają skróconą prezentację i szczegół po wejściu.
- Szybkie dodawanie/edycja/usuwanie, selected-day sheet, nakładanie wydarzeń i gesty pozostają aktywne.

## Praca

- Grafik, Dyspozycyjność i Podsumowanie pozostają zwarte.
- Zmiana podzakładki Pracy resetuje przewinięcie strony do góry; długie widoki mają dodatkowy clearance ponad dolną nawigacją.
- Cały wiersz zmiany jest klikalny; maksymalnie jedna lista osób jest rozwinięta.
- Desktop i mobile zachowują uzgodnioną hierarchię oraz safe-area.

## Finanse

- Miesiąc pozostaje transaction-first; `Pozycje` są drugim poziomem.
- Główna hierarchia Miesiąca: suma i porównanie -> trend 6 miesięcy -> donut kategorii -> KPI -> krótkie rankingi -> lista wydatków.
- Donut pokazuje maksymalnie 3 główne kategorie oraz `Pozostałe`; legenda ma jednoznaczne mapowanie koloru, ikony, kategorii, procentu i kwoty.
- `Miejsca zakupów` pomijają generyczne placeholdery typu `sklep`/`restauracja` oraz nazwy będące w praktyce nazwą produktu.
- Na telefonie dashboard pozostaje kompaktowy; jeden ranking jest widoczny naraz przez `Miejsca / Największe`.
- Wyjazdy używają tego samego języka dashboardu co Miesiąc.
- **Kontekst walut Build222:** w `Miesiąc` PLN jest kwotą główną, a waluta oryginalna jest drugorzędnym `oryginalnie ...`; w zagranicznym `Wyjeździe` waluta wyjazdu jest kwotą główną, a PLN jest drugorzędnym `≈ ...`, jeśli komplet danych oryginalnych jest spójny.
- Zasada walut obowiązuje w liście transakcji, największym wydatku, Top 3, rankingu miejsc i szczególe transakcji.
- Kategorie i pozycje, dla których aplikacja ma tylko wartości po przeliczeniu, pozostają w PLN i są jawnie opisane jako PLN.
- Mobilny clearance list Miesiąca i Wyjazdu uwzględnia stałą dolną nawigację.
- Katalog produktu, historia cen, eksport oraz `Cofnij` pozostają aktywne.

## Wspólna warstwa UX

- Build223 dodał skip link `Przejdź do treści`, nazwany main landmark i tytuł dokumentu zgodny z aktywną sekcją.
- Modale mają unikalne accessible title IDs, focus trap ignoruje kontrolki ukryte przez CSS, a dialog jest bezpiecznym fallbackiem focusu.
- Główne kontrolki mają wspólny focus-visible fallback; otwarty modal blokuje przewijanie strony pod spodem.
- Nie zmieniono kompozycji stabilnych ekranów ani ich logiki produktowej.


## Performance i lazy loading

- Build224 rozdziela `Finanse`, `Studia` i `Pracę` od startowego grafu przez React lazy/Suspense.
- Pełny `ReceiptScanFlow` jest pobierany/parsowany dopiero po otwarciu skanera.
- XLS/XLSX reader jest wybierany dynamicznie po rozpoznaniu formatu; `exceljs` nie jest już osiągalny z głównego statycznego grafu tylko przez sam start aplikacji.
- Eksport Excel ładuje runtime `exceljs` dopiero przy wykonaniu eksportu.
- `pdfjs-dist` i worker są ładowane dopiero przy analizie PDF grafiku Pracy.
- Service worker rekurencyjnie odkrywa i precachuje transitive lazy chunks, więc code splitting nie powinien odbierać installed PWA działania offline.
- Pomiar źródłowego statycznego grafu startowego: 113 modułów / 1 534 018 B w Build223 -> 54 moduły / 600 337 B w Build224. To nie jest pomiar skompresowanego bundle ani czasu startu urządzenia.

## Public-data flow smoke i runtime QA

- Użytkownik potwierdził na screenshotach desktop/mobile poprawne renderowanie Dzisiaj, Kalendarza Miesiąc/Tydzień, Finansów, Studiów, Pracy oraz Ustawień po Build224 lazy-load.
- Build225 dodał publiczny test regresyjny głównych ścieżek; Build226 zweryfikował realny plan 25.09 i wrześniowy PDF Pracy; Build228 dodaje runtime fail-closed dla exact źródła Studiów.
- Windows dependency-complete QA jest dostępny: Build230 typecheck PASS; public suite dotarł do 317/321 plików i 1834/1838 testów, a dwa pozostałe FAIL sklasyfikowano jako stale historical assertions. Production dependency audit: 0 vulnerabilities.

## Receipt Scanner 2.0

- Build228 nie zmienia implementacji skanera, OCR, parsera, reconciliacji ani review paragonu; lazy boundary z Build224 pozostaje bez zmian.
- `src/shopping/receipt-ocr` pozostaje bajtowo identyczny z Build226 w porównaniu wykonanym dla Build228.
- Parser pozostaje funkcjonalnie zamrożony i chroniony przez istniejący freeze proof.
- Nowe heurystyki tylko po reprodukowalnym błędzie finansowym.

## Studia

- Aktywny plan referencyjny: II rok pielęgniarstwa, semestr zimowy 2026/2027, źródło `licencjat-ii-rok-piel.-25.09.2026.xls` poza checkpointem. Exact plik jest rozpoznawany po SHA-256 i dopiero pełna zgodność fingerprintu wszystkich kandydatów, audytu MAIN/G12/G8/G4 oraz profilu 7/7A/7B2 daje status `ZWERYFIKOWANY`.
- Znane bajty z inną semantyką są blokowane. Plik o tej samej nazwie i innym SHA-256 jest nowym źródłem, nie dziedziczy statusu verified.
- Przyszły Excel korzysta z uniwersalnego parsera i istniejącego `prepareUniversityScheduleUpdate`, który pokazuje diff dat, czasu, lokalizacji, grup, dodań i usunięć przed zapisem.
- Aktywna mapa: `docs/STUDY_PLAN_II_2026_MAPPING.md`; runtime reference: `src/study/verified-study-plan.ts`.
- Model grup MAIN/G12/G8/G4 i bezpieczny review importu pozostają bez zmian. Nie utrzymujemy drugiej statycznej kopii 2313 rekordów.

## Dane i prywatność

- Local-first, IndexedDB schema 14.
- Brak własnego backendu i konta.
- Importowane pliki użytkownika nie są częścią repozytorium ani checkpointu.
- Backup JSON i eksport XLSX pozostają lokalne.

## Powierzchnie uznane za stabilne

Dzisiaj, Kalendarz, Praca, Studia, Finanse i Receipt Scanner pozostają stabilnymi powierzchniami. Exact plan Studiów 25.09 jest zamknięty runtime QA i nie wymaga ponownej pracy bez nowego źródła lub reprodukowalnej regresji. Build234 zamknął również Receipt Scanner first-open lazy-boundary QA oraz installed-PWA offline lazy-chunk QA.


## Build229 QA-contract hardening

Windows dependency install działa. Build229 naprawia strict TypeScript w teście Studiów i kieruje `study:audit` przez publiczny config Vitest, dzięki czemu clean checkpoint nie zależy od celowo pomijanego `_PRIVATE_HISTORY`. Exact-source runtime semantics pozostają bez zmian.


## Build230 public-suite closure

Exact plan 25.09 został potwierdzony na Windows po SHA-256 i `study:audit`. Build230 usuwa redundantny legacy merchant aggregate w Finansach, przywraca transaction-first filter contract, odsłania istniejący pusty stan porównania Praca/Dyspozycyjność, przywraca public self-containment i pełną politykę wersjonowania. Parser Studiów, Verified Study fingerprinty, Receipt OCR/parser oraz schema 14 nie zostały zmienione.


## Build231 historical test-contract alignment

Build231 nie zmienia produktu. Aktualizuje tylko dwa historyczne testy: Finance Build218 przyjmuje meaningful merchant pipeline ustanowiony w Build219, a Work Build174 przyjmuje późniejszy kontrakt zawsze osiągalnego panelu porównania Dyspozycyjności. Exact Study runtime semantics, XLS/XLSX parser, Receipt OCR/parser i schema 14 pozostają bez zmian.

## Build232 exact local Study source release gate

Build232 nie dodaje Excela do repozytorium ani checkpointu. Security gate akceptuje lokalnie wyłącznie exact `licencjat-ii-rok-piel.-25.09.2026.xls` (148992 B, SHA-256 `b6279b96e8cdfc7a95b9c7199686db424ef84e315215a03545957aee413964e4`). Ta sama nazwa z innymi bajtami oraz każdy inny prywatny/archiwalny plik nadal blokuje build. Dzięki temu standardowy katalog `D:\Projekty\inteligentny-kalendarz` może zawierać bieżący plik do QA Studiów bez osłabienia release hygiene.


## Build233 verified Study closure

Build233 nie zmienia produktu. Promuje zamrożony stan do verified PRIVATE po runtime QA exact źródła 25.09. Dla profilu 7 / 7A / 7B2 zmiana grup z wcześniej zaimportowanych 72 zdarzeń pokazała `+54 / -50 / 22 bez zmian`, czyli 76 zdarzeń po zastosowaniu, oraz 3 niepełne wpisy pozostające poza kalendarzem. Konflikt 08.10.2026 `POZ seminaria 12:00-15:45` vs `CHIRURGIA 15:00-16:30` został zachowany, oba wydarzenia są w Kalendarzu, a UI pokazuje warning o 45-minutowym overlapie.


## Build234 verified Service Worker closure

Build234 nie zmienia powierzchni użytkownika. Naprawia wyłącznie install-time offline precache: nierozwiązane bundlerowe referencje `${...}` nie są już traktowane jako konkretne URL-e assetów. Dependency-complete Windows QA, Service Worker register/activate, Receipt Scanner first-open lazy boundary, 24-entry transitive cache i installed-PWA offline lazy chunks są zamknięte PASS. Exact Study 25.09 i wszystkie zaakceptowane zachowania produktu pozostają bez zmian.
