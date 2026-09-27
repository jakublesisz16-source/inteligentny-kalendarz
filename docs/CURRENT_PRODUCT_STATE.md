# Aktualny stan produktu - Build 247

## Status

Build248 jest wąskim cleanupem dwóch przestarzałych kontraktów testowych na niezmienionym produkcie Build246/247. Windows QA Build247 przeszło strict TypeScript i wykonało 1858 testów PASS; jedyne 2 FAIL były asercjami tekstowymi, które nadal oczekiwały starego `result.groups` sprzed post-verification enrichment oraz starego tekstu journala backfillu. Build248 aktualizuje wyłącznie te testy i metadane wydania. Logika Studiów, recurring-pattern assumptions/backfill, raw parser/fingerprinty i schema 14 są bez zmian. Build244 pozostaje ostatnim opublikowanym baseline na `main`; Build248 przed publikacją wymaga pełnego Windows `check:public` oraz QA aktywnego planu.

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

## Studia — założenia powtarzalnego wzorca Build246

- Surowy XLS/XLSX jest analizowany i verified **przed** inferencją.
- Brakująca godzina i/lub lokalizacja może zostać uzupełniona tylko z co najmniej 2 zgodnych wystąpień tego samego przedmiotu + typu + grup.
- Konkurencyjne wzorce blokują uzupełnienie; jawne wartości nie są nadpisywane.
- Data/dzień nigdy nie są inferowane.
- `inferredFields`/`inferenceNotes` zachowują pochodzenie założenia w imporcie i UI.
- Już aktywny plan jest idempotentnie backfillowany z przechowanych surowych `sourceOnly` entries; nowe wydarzenia powstają po restore poincie, a raw entries pozostają bez zmian.
- Kolejny oficjalny plan ma pierwszeństwo i przechodzi normalny diff.

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

- Aktywny plan referencyjny: II rok pielęgniarstwa, semestr zimowy 2026/2027, źródło `licencjat-ii-rok-piel.-25.09.2026.xls` poza checkpointem. Exact plik jest rozpoznawany po SHA-256 i dopiero pełna zgodność fingerprintu wszystkich kandydatów, audytu MAIN/G12/G8/G4 oraz profilu `7 / 7A / 7B / 7B2` daje status `ZWERYFIKOWANY`.
- Znane bajty z inną semantyką są blokowane. Plik o tej samej nazwie i innym SHA-256 jest nowym źródłem, nie dziedziczy statusu verified.
- Przyszły Excel korzysta z uniwersalnego parsera i istniejącego `prepareUniversityScheduleUpdate`, który pokazuje diff dat, czasu, lokalizacji, grup, dodań i usunięć przed zapisem.
- Aktywna mapa: `docs/STUDY_PLAN_II_2026_MAPPING.md`; runtime reference: `src/study/verified-study-plan.ts`.
- Model grup MAIN/G12/G8/G4 pozostaje zgodny ze źródłem, ale od Build250 wszystkie cztery partycje są wybierane niezależnie i ręcznie. Nie utrzymujemy drugiej statycznej kopii 2313 rekordów.

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

Build233 nie zmienia produktu. Promuje zamrożony stan do verified PRIVATE po runtime QA exact źródła 25.09. Dla profilu 7 / 7A / 7B / 7B2 zmiana grup z wcześniej zaimportowanych 72 zdarzeń pokazała `+54 / -50 / 22 bez zmian`, czyli 76 zdarzeń po zastosowaniu, oraz 3 niepełne wpisy pozostające poza kalendarzem. Konflikt 08.10.2026 `POZ seminaria 12:00-15:45` vs `CHIRURGIA 15:00-16:30` został zachowany, oba wydarzenia są w Kalendarzu, a UI pokazuje warning o 45-minutowym overlapie.


## Build234 verified Service Worker closure

Build234 nie zmienia powierzchni użytkownika. Naprawia wyłącznie install-time offline precache: nierozwiązane bundlerowe referencje `${...}` nie są już traktowane jako konkretne URL-e assetów. Dependency-complete Windows QA, Service Worker register/activate, Receipt Scanner first-open lazy boundary, 24-entry transitive cache i installed-PWA offline lazy chunks są zamknięte PASS. Exact Study 25.09 i wszystkie zaakceptowane zachowania produktu pozostają bez zmian.


## Build235 mobile Receipt Scanner save reachability

Real-phone review wykazał, że przy długim paragonie dolna nawigacja mogła przykrywać końcowe akcje, bo Receipt Scanner był własnym full-screen dialogiem poza wspólnym kontraktem `modal-open`. Build235 podłączył scanner do wspólnego `modalOpenCount` i safe-area sticky actions. Kolejne real-phone QA potwierdziło zapis: bottom nav jest ukryty, `Zapisz paragon` jest osiągalne, a paragon 42,85 zł / 6 pozycji pojawia się w Finansach.

## Build236 Receipt -> Finance mobile polish

Po potwierdzeniu fixu Build235 usunięto awaryjny duplikat `Zapisz` w nagłówku i pozostawiono jedno sticky CTA na dole. Sugestie kategorii poza parserem OCR rozszerzono o konserwatywne sygnały dla płatków owsianych, `delicje`-style ciastek oraz skrótu `warzywa na patelnię`; na realnym paragonie trzy wcześniej nierozpoznane nazwy przechodzą z `Inne` do `Jedzenie`. Mobilne `Pozycje` pokazują sklep i datę jako mały kontekst pod produktem, bez osobnego trzeciego wiersza, a bulk correction na <=430 px jest niższy. OCR/parser i schema 14 pozostają zamrożone.


## Build237 Work shift expansion stability

Po wcześniejszych warstwach CSS dla `<details>[open]` rozwijanie współpracowników nadal mogło zmieniać geometrię wiersza. Build237 usuwa tę zależność strukturalnie: pełny wiersz zmiany jest zwykłym przyciskiem, licznik osób ma stałą szerokość 104 px na desktop/tablet i 84 px na telefonie, a `CoworkerOverlapList` jest osobnym blokiem renderowanym dopiero pod wierszem. Istniejący `expandedShiftId` nadal pilnuje maksymalnie jednej otwartej zmiany.

## Build238 Calendar mobile Week readability

Późniejszy polish mobilnego Tygodnia nadpisał wcześniejszy mobile-first kontrakt i ponownie ścisnął siedem kolumn timeline do szerokości telefonu. Build238 usuwa ten kierunek: siedem dni pozostaje kompaktowym selektorem, ale sam timeline renderuje tylko wybrany dzień na pełnej szerokości. Mobilny `weekHourHeight` wraca do kanonicznych 48 px/h i timeline przewija się pionowo, dzięki czemu nazwy oraz godziny nie są mikroetykietami. Ten sam kompaktowy podgląd wybranego dnia działa w Miesiącu i Tygodniu, a tap na wydarzeniu Tygodnia otwiera istniejący detail sheet. Desktop pozostaje bez zmian.


## Build239 Calendar mobile full-week readability

Real-phone QA Build238 pokazał, że pełnoszerokowy timeline jednego dnia usuwa najważniejszą wartość widoku Tydzień. Build239 zachowuje siedem kolumn jednocześnie i poprawia czytelność inną metodą: 38 px/h, pionowy scroll, krótkie kody wydarzeń w siatce oraz pełne nazwy w selected-day preview. Tap wydarzenia nadal otwiera istniejący detail sheet. Month i desktop pozostają bez zmian.


## Build240 - Clean handoff checkpoint

Build240 nie zmienia zachowania produktu. Synchronizuje pełny PRIVATE checkpoint po real-phone PASS Build239, usuwa z bieżącego stanu nieaktualny pending Build238/239 visual QA i przygotowuje jedno czyste Source of Truth do kolejnej rozmowy. Następny rozwój ma zaczynać się od konkretnego bounded slice, a małe poprawki nadal są wydawane jako patch-only ZIP-y.


## Build242 - stale historical test-contract cleanup

Dependency-complete Windows `check:public` Build241 przeszedł strict TypeScript i wykonał pełny public suite. Wynik 1850 PASS / 3 FAIL / 2 optional skips ujawnił, że trzy blokery były wyłącznie nieaktualnymi asercjami: mobilny Month oczekiwał dawnego `Pokaż szczegóły`, a testy Build235 i Build236 wymagały dokładnie `APP_VERSION = 1.2.0.236`. Dodatkowo regresja Build239 wciąż wymagała `1.2.0.241`, co stworzyłoby identyczny fałszywy blocker przy następnym buildzie. Build242 zmienia tylko testy i metadane wersji: historyczne testy pilnują bieżącej linii `1.2.0.x` oraz schema 14, natomiast dokładna synchronizacja numeru pozostaje w dedykowanym release-contract QA. Produkt i UI nie są zmieniane.

## Build241 - Calendar strict TypeScript release-blocker fix

Dependency-complete Windows preflight Build240 ujawnił jeden rzeczywisty blocker przed promocją: `CalendarView.tsx` zgłaszał TS18048 dla `first` w `mobileWeekEventLabel`, mimo wcześniejszego warunku odrzucającego pustą tablicę. Build241 zastępuje odczyt `words[0]` przez `words[0] ?? ''`, co spełnia strict/noUncheckedIndexedAccess bez zmiany wyniku dla niepustych etykiet. `npm ci` Build240 zakończył się poprawnie, a production dependency audit miał 0 vulnerabilities. Po Build241 wymagane jest ponowne pełne `npm run check:public`; do jego PASS Build241 pozostaje release candidate, nie opublikowanym baseline.


## Build243 - Mobile Finance Items + Study Current Plan Polish

Real-device QA po Build242 ujawnił dwa problemy kompozycji. Mobilne `Finanse -> Pozycje` miało równolegle aktywne geometrie z Build214 i Build236, co skracało nazwy i mogło mieszać kontekst sklepu/daty z resztą wiersza. Build243 usuwa konkurujące definicje i ustanawia jeden dwurzędowy kontrakt: do dwóch linii nazwy, kwota i szczegóły po prawej, sklep/data oraz opcjonalna ilość w kontekście produktu, a kategoria + necessity w drugim rzędzie. W `Studia` aktywny plan i `Wczytaj nowy` układają się na telefonie w jednej kolumnie, z osobnym kompaktowym statusem zmiany. Desktop i logika domenowa pozostają bez zmian.


## Build244 - historical Finance mobile test-contract cleanup

Windows `check:public` Build243 potwierdził 1855 testów PASS i 2 FAIL wynikające wyłącznie z nieaktualnych historycznych asercji CSS: Build236 oczekiwał dawnej pojedynczej reguły ukrycia kolumny daty, a Build213 oczekiwał superseded grid areas `product money` / `category necessity`. Build244 aktualizuje te regresje do kanonicznego layoutu Build243 oraz usuwa exact version pin z testu Build243. Kod produktu i UI nie są zmieniane.


## Build245 - minimal status-card accent polish

Real-device QA Kalendarza pokazał pozostawioną z wcześniejszego języka UI czerwono-różową belkę przy lewej krawędzi karty konfliktu. Build245 usuwa ten wzorzec z `consistency-card` oraz z analogicznych `diff-card` Studiów. Obramowanie pozostaje neutralne (`var(--line)`), a semantyka statusu korzysta z istniejących chipów oraz bardzo lekkiego gradientu powierzchni. Nie zmienia to priorytetu, treści, akcji `Edytuj`, akceptacji konfliktu ani danych.

## Build247 - release-blocker fixes after Windows QA

- Test recurring-pattern nie przekazuje już jawnego `undefined` do optional properties przy `exactOptionalPropertyTypes`; brak wartości jest modelowany przez pominięcie/usunięcie pola.
- `source:hygiene` ignoruje normalne artefakty lokalnego checkoutu i builda (`.git`, `node_modules`, `dist`, coverage/cache oraz root `tsconfig.*.tsbuildinfo`) zamiast traktować je jako błąd źródła.
- Checkpoint/public package gates nadal odpowiadają za blokowanie tych artefaktów w paczkach.
- Zero zmian produktu, parsera, założeń Studiów, backfillu i schema 14.


## Build248 - stale Study test-contract cleanup

Windows Build247 QA potwierdził strict TypeScript PASS i 1858 testów PASS z dwoma stale source-text assertions. Build248 aktualizuje test UX do `enrichedResult.groups` oraz test backfillu do stabilnych kontraktów zachowania/journala. Produkt pozostaje bez zmian.


## Build249 - mobile polish + Study operational consistency

- Mobile Finance Items keeps direct category/necessity editing but renders those controls as quieter metadata rather than large form fields.
- Empty Work availability-comparison states are guidance cards, not warning/status cards: neutral border/background, smaller copy and compact action.
- Mobile Calendar keeps the same controls and behavior but reduces visual weight in the view/filter/add row and period navigation so the grid remains dominant.
- Group recalculation and alternate-group preview now use the same post-verification recurring-pattern assumption layer as normal import and active backfill. Stored raw `sourceOnly` entries remain unchanged.
- No change to raw XLS/XLSX parsing, exact verified 25.09 fingerprints, Receipt OCR/parser or IndexedDB schema 14.
- Real-device screenshots on 27.09 show the Study group controls as 10 / 10B / 10B2, but this visual observation is not treated as canonical persisted active-import proof until runtime data is checked.

## Build250 - canonical Study group selection

- Active 25.09 mapping remains the canonical current-plan reference. The raw parser and all-candidate verified fingerprint are unchanged.
- The previous UI/runtime shortcut G4 -> G8 is removed. MAIN, G12, G8 and G4 are independent assignments coming from the Excel structure.
- Current-plan group counts remain MAIN 14, G12 28, G8 42, G4 84. For one MAIN group this means one MAIN choice plus 2 possible G12, 3 possible G8 and 6 possible G4 labels.
- Runtime event filtering uses exact partition kind + exact label. An intentionally mixed assignment such as `10 / 10A / 10C / 10A2` is valid when those four labels exist in their respective partitions.
- Existing profiles that were saved under the old three-field UI are not silently inferred. If G8 exists in the source and is missing from the stored selection, Study shows the missing assignment and requires an explicit manual choice before recalculation.
- Verified QA profile is now written explicitly as `MAIN:7 + G12:7A + G8:7B + G4:7B2`, preserving the previously verified candidate set without cross-partition inference.


## Build251 - Study exact source state

Aktualny plan 25.09 jest teraz samowystarczalnie zachowany w PRIVATE recovery i chroniony przez hash gate. Dla profilu `MAIN 4 / G12 4A / G8 4B / G4 4C1` exact XLS daje 79 wpisów surowych, 76 od razu importowalnych i 3 niepełne. Recurring-pattern assumptions uzupełniają godzinę dwóch terminów Interny 17-18.12, więc stan operacyjny ma 78 wydarzeń i 1 nierozstrzygnięty wpis POZ praktyczne. Publiczny runtime parser i schema 14 pozostają bez zmian.


## Build252 - Study copy fix

Model MAIN/G12/G8/G4, exact XLS 25.09 i wynik 78 operacyjnych wydarzeń pozostają bez zmian. Build252 poprawia wyłącznie gramatykę komunikatu walidacji, gdy użytkownik wybierze więcej niż jedną grupę w tej samej partycji.

## Build253 - wierne informacje źródłowe w Kalendarzu

Kalendarz pokazuje teraz source-only informacje ze Studiów bez poziomów pewności i bez zgadywania. Jeżeli Excel wskazuje dokładny dzień, wpis pozostaje przy tym dniu. Jeżeli wskazuje wyłącznie tydzień, informacja jest prezentowana jako neutralna informacja dotycząca całego tygodnia, a nie jako sztuczne wydarzenie w konkretnym dniu. Dla POZ `G4:4C1` z 12-16.10 pokazywane są wyłącznie dane obecne w źródle, w tym wymiar 40 godz. i notatka o pierwszym spotkaniu od 8:30. Nie jest dopisywany wymyślony dzień ani pełny zakres godzin.



## Build254 - stale kontrakt testu Studiów

Windows Build253 ujawnił jedną nieaktualną asercję tekstową: test wymagał superseded zdania `to nie jest potwierdzone wydarzenie`, mimo że zaakceptowany Build253 celowo używa neutralnego `Informacja z planu` / `Informacja z planu studiów`. Build254 zmienia wyłącznie ten kontrakt testowy. Zachowanie Kalendarza i wszystkie dane planu pozostają bez zmian.
