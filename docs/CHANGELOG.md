## 1.1.0 - stabilne wydanie przygotowane do publikacji

- zamrożono zweryfikowany funkcjonalnie stan `1.1.0-rc.11` bez dodawania nowych funkcji i bez zmian schematu bazy,
- Studia zachowują bramkę kompletności bloków, bilans godzin, obsługę wpisów źródłowo niepełnych i bezpieczne aktualizacje planu bez zgadywania danych,
- miesięczny Kalendarz pozostaje kompaktowy, a aktywne grupy są jednoznacznie opisane wielkością,
- Service Worker otrzymuje finalny cache `v1.1.0`; prywatne PDF/XLS/XLSX/JSON nadal nie są cache'owane,
- `DATABASE_SCHEMA_VERSION` pozostaje `13`; wydanie nie wymaga migracji danych względem ostatniego RC.
- finalna ikona PWA zastępuje tymczasowy znak aplikacji w faviconie, ikonach 192/512 i Apple Touch,
- import PDF grafiku Pracy odrzuca pliki większe niż 32 MB przed pełnym odczytem i weryfikuje sygnaturę `%PDF-`,
- produkcyjne sourcemapy są wyłączone, a release gate skanuje paczkę pod kątem sekretów, prywatnych plików i artefaktów developerskich.

## 1.1.0-rc.11 - finalizacja czytelności i kompletności Studiów

- przywrócono kompaktowe liczniki w miesięcznym Kalendarzu; pełne dane pozostają w panelu dnia, a desktop może pokazać szczegóły pomocniczo bez zagęszczania siatki,
- równobrzmiące grupy są rozróżniane wielkością, np. `10A · 12-os.` i `10A · 8-os.`,
- tygodniowe wpisy bez jednoznacznego dnia/godziny pozostają jawnie `NIEPEŁNE` zamiast udawać normalne wydarzenia,
- rozszerzono regresje aktualizacji planu oraz ścieżki źródło -> parser -> baza -> kalendarz; schema 13 pozostaje bez zmian.

## 1.1.0-rc.9 - bramka kompletności planów Studiów

- parser rejestruje źródłowe bloki tygodniowe niezależnie od wygenerowanych wydarzeń i sprawdza semantykę `pon.-pt.` oraz wyjątków,
- deklaracje godzin dydaktycznych w jednoznacznych sekcjach praktycznych są porównywane z faktycznie odtworzonym harmonogramem; niedobór bez braku danych źródłowych i nadmiar blokują import,
- brak pełnego dnia lub godzin w samym Excelu pozostaje jawnie `NIEPEŁNE` i nie jest uzupełniany przez zgadywanie,
- tygodniowe przypisania bez dokładnego dnia/godziny są zachowane jako dane źródłowe i widoczne w Kalendarzu jako niepotwierdzone wpisy, a nie fikcyjne wydarzenia,
- importer zatrzymuje plik, jeżeli w rozpoznanym tygodniu pozostaje nierozpoznane przypisanie grupowe albo wiersz zawiera wiele grup bez rozpoznanego zakresu tygodnia,
- schema bazy pozostaje 13; metadane kompletności są przechowywane w istniejących rekordach źródłowych bez nowego store/indeksu.

## 1.1.0-rc.8 - czytelny kontekst aktywnych grup Studiów

- Kalendarz pokazuje nad siatką grupy aktywnego planu Studiów, więc od razu wiadomo, dla kogo wyświetlane są wydarzenia.
- Grupy na karcie aktywnego importu są prezentowane jako osobne, czytelne znaczniki zamiast zwartego tekstu.
- Ustawienia Studiów rozróżniają grupy aktywnego planu od grup zapisanych wyłącznie dla kolejnych importów.
- Zmiana dotyczy tylko prezentacji i nie zmienia doboru grup, wydarzeń ani schematu bazy.

## 1.1.0-rc.7 - mniej wymaganych kliknięć przy informacyjnych ostrzeżeniach Studiów

- konflikty godzin pozostają wyraźnie widoczne, ale nie wymagają osobnego checkboxa przed przejściem dalej,
- kliknięcie głównej akcji importu/aktualizacji jest wystarczającą decyzją użytkownika po wyświetleniu konfliktów,
- analogicznie uproszczono zmianę grup; niepełne wpisy i konflikty są informacją, a nie dodatkowym formularzem zgody,
- backendowe bramki konfliktów pozostają aktywne - UI przekazuje zgodę dopiero wraz z kliknięciem właściwej akcji zapisu,
- nie zmieniono schematu bazy, parsera źródłowego planu ani zasad fail-closed dla uszkodzonego Excela.

## 1.1.0-rc.6 - czytelność podglądu Studiów

- poprawiono układ decyzji o konfliktach godzin: checkbox z opisem ma teraz pełną szerokość i nie łamie tekstu pionowo,
- konflikty są prezentowane jako osobne, uporządkowane wiersze z datą i obiema kolidującymi pozycjami, z responsywnym układem mobilnym,
- nieprzeznaczone do importu karty nie są już przygaszane globalną przezroczystością, dzięki czemu pozostają czytelne do wglądu,
- zwiększono czytelność metadanych, statusów, źródła i komunikatów braków oraz wzmocniono widoczność przycisku ręcznego uzupełnienia,
- te same zasady zastosowano do zmiany grup i porównania aktualizacji planu; logika importu, schema 13 i fail-closed pozostają bez zmian.

## 1.1.0-dev.2 - analityka, kompaktowy dashboard i branding

- dodano szczegółowe lokalne statystyki wydatków: metryki miesiąca, porównanie z poprzednim miesiącem, trend sześciu miesięcy oraz agregacje kategorii, sklepów i produktów,
- statystyki pozostają derived data liczone z `receipts` i `expenseCategories`; `DATABASE_SCHEMA_VERSION` pozostaje `13`, bez migracji i nowych store,
- FIX1 porządkuje hierarchię Wydatków: `+ Paragon` jest wysoko, podstawowe metryki są zwarte, a dłuższe listy domyślnie pokazują najważniejsze pozycje i rozwijają się na żądanie,
- FIX2 zastępuje stary znak `IK` jednym minimalistycznym znakiem kalendarza używanym przez favicon, PWA/Apple icons i startup splash,
- startup splash jest powiązany z rzeczywistym bootstrapem, ma krótki minimalny czas tylko przy szybkim starcie, obsługuje reduced motion oraz bezpieczny skip bez omijania gotowości aplikacji,
- Service Worker otrzymuje nowy identyfikator shell cache dla odświeżenia tych samych nazw assetów; IndexedDB i dane użytkownika nie są czyszczone,
- brak OCR, zdjęć paragonów, AI, backendu, telemetry, nowych requestów sieciowych i nowych zależności.

## 1.1.0-dev.1 - fundament Paragonów i Wydatków

- `DATABASE_SCHEMA_VERSION` rośnie z 12 do 13 przez dwa addytywne store'y: `expenseCategories` i `receipts`; istniejące dane nie są przepisywane ani usuwane.
- Zakupy otrzymują wewnętrzne widoki `Lista` i `Wydatki`; dotychczasowa lista zakupów pozostaje domyślna i zachowuje dotychczasowe zachowanie.
- Dodano ręczne paragony, lokalne kategorie, historię oraz miesięczne sumy; kwoty są zapisywane jako całkowite grosze zamiast liczb zmiennoprzecinkowych.
- Backup/Restore/Data Transfer obejmuje paragony i kategorie; kompatybilne backupy schema 7-12 pozostają obsługiwane.
- Brak OCR, zdjęć, AI, backendu, telemetrii i nowych requestów sieciowych.

## 1.0.1 - ergonomia nawigacji i czytelniejszy zespół pracy

- uporządkowano nawigację na `Dziś | Kalendarz | Praca | Zakupy | Cykl | Studia | Miejsca | Ustawienia`, bez ukrywania zakładek i bez zmiany routingu,
- w `Dziś` oraz `Kalendarz -> Wybrany dzień` wydarzenie pracy pokazuje pełną listę współpracowników zamiast nieinteraktywnego `+N więcej`,
- poprawiono responsywne ułożenie długich nazwisk i wspólnych godzin tak, aby zawartość pozostawała czytelna wewnątrz karty,
- dodano regresje dla pełnej i kompaktowej listy współpracowników; nie zmieniono importu PDF, logiki nakładania zmian ani danych użytkownika,
- `DATABASE_SCHEMA_VERSION` pozostaje `12`; brak migracji, nowych zależności i zmian formatu backupu.

## 1.0.0 - stabilne wydanie GitHub-only

- zakończono rozwój funkcjonalny pierwszego stabilnego wydania,
- wycofano z aktywnego produktu niedokończony transport Web Push i sekcję jego konfiguracji,
- usunięto Cloudflare Worker/D1/Cron/VAPID, Wrangler i `web-push` z runtime/toolchainu produkcyjnego,
- Service Worker odpowiada wyłącznie za PWA/offline i nadal nie cache'uje prywatnych PDF/XLS/XLSX/JSON,
- zachowano schema 12, preferencje oraz czysty notification planner jako punkt integracji pod ewentualne przyszłe lokalne powiadomienia Android,
- dodano jawną walidację rozszerzenia `.pdf` przed odczytem grafiku Pracy,
- ustawiono APP/package/cache na finalne `1.0.0`; zmiana numeru nie wprowadza migracji danych ani nowych funkcji.

## 1.0.0-rc.7 - przygotowanie publicznego repo i GitHub Pages

- dołączono zweryfikowany `package-lock.json` użyty w lokalnej bramce stabilności RC.7,
- dodano deployment GitHub Pages przez GitHub Actions po pełnym `npm run check`,
- CI pull request pozostaje read-only i nie otrzymuje uprawnień Pages,
- publiczna paczka usuwa wewnętrzne prompty, handoffy, historię projektu i release audity,
- rozszerzono `.gitignore` o lokalne logi, archiwa i materiały wewnętrzne,
- kod funkcjonalny, schema 12, Worker, Service Worker i dependencies pozostają bez zmian.

## 1.0.0-rc.7 - Deterministyczna kolejność Change Journal

- Nowe wpisy Change Journal otrzymują timestamp ściśle nowszy od wszystkich już zapisanych wpisów w ramach tej samej transakcji `readwrite` IndexedDB.
- Usunięto źródło sporadycznego wyboru niewłaściwej operacji Undo przy dwóch zmianach wykonanych w tej samej milisekundzie; semantyka CREATE/UPDATE/DELETE undo pozostaje bez zmian.
- Dodano deterministyczne regresje dla Cycle Journal i Shopping oraz czysty test remisu/rollbacku zegara; schema pozostaje 12, `pdfjs-dist` pozostaje 6.2.108.
- Finalna lokalna bramka wymaga czystego `npm ci`, trzech kolejnych pełnych `npm run check` oraz focused stability runs bez pojedynczego FAIL.

## 1.0.0-rc.6 - Zgodność PDF.js 6 destroy API

- Zmieniono wyłącznie cleanup dokumentu PDF z `PDFDocumentProxy.destroy()` na `PDFDocumentLoadingTask.destroy()`, zgodnie z API używanego `pdfjs-dist 6.2.108`.
- `pdfjs-dist` pozostaje przypięty dokładnie do `6.2.108`; schema pozostaje 12, bez migracji, nowych store i nowych funkcji.
- Service Worker cache podbity do `v1.0.0-rc.6`; pozostała logika Service Workera bez zmian.
- Pełna stabilna bramka `npm ci` + dwa kolejne `npm run check` pozostaje do potwierdzenia lokalnie, ponieważ środowisko audytu nie ma dostępu do wymaganych pakietów npm.

## 1.0.0-rc.5 - Security PDF.js

- `pdfjs-dist` przypięty dokładnie do `6.2.108`.
- Brak nowych funkcji, migracji i store.
- Service Worker cache podbity do `v1.0.0-rc.5`; pozostała logika Service Workera bez zmian.
- Zweryfikowany lokalny lockfile nie jest rekonstruowany w source ZIP bez dostarczonego pliku.

## 1.0.0-rc.4 - Zgodność PDF.js i local check

- Usunięto nieobsługiwaną właściwość `isEvalSupported` z parametrów `pdfjs-dist/getDocument()`.
- Nie zmieniono algorytmu importu PDF, OCR, storage, schema ani funkcji produktu.
- Service Worker cache podbity do `v1.0.0-rc.4`.
- RC.4 oczekuje na pełne lokalne potwierdzenie `npm ci` + `npm run check`; finalne 1.0.0 pozostaje zablokowane przez bramki produkcyjne.

## 1.0.0-rc.3 - Test-suite hotfix

- poprawiono 10 failing testów ujawnionych przez rzeczywisty lokalny Vitest (326/336 PASS w RC.2),
- historyczne testy migracji po upgrade odczytują aktualną bazę zamiast próbować otwierać ją niższą wersją,
- backup tests używają `DATABASE_SCHEMA_VERSION`,
- test reminderów sprawdza brak starego `CALENDAR` bez błędnego wykluczania niezależnego `BACKUP`,
- `storage-v031` używa wspólnego `deleteDatabaseForTests()` w `beforeEach/afterEach`,
- brak zmian funkcjonalnych, migracji, store i dependencies; schema pozostaje 12.

## 1.0.0-rc.2 - Local check hotfix

- Zaktualizowano `@cloudflare/workers-types` z `5.20260730.1` do `5.20260810.1`, pozostawiając `wrangler` `4.120.0`.
- Dodano `@types/node` `22.19.21` dla testów importujących `node:fs`.
- Naprawiono TypeScript narrowing w generatorze identyfikatorów powiadomień bez zmiany fallbacku Web Crypto.
- Klucz VAPID jest dekodowany do jawnego `ArrayBuffer`, zgodnego z aktualnym `PushSubscriptionOptionsInit.applicationServerKey`.
- Naprawiono duplikowane właściwości w fabrykach fixtures Global Search bez zmiany algorytmu wyszukiwania.
- Cache Service Workera otrzymał nazwę RC.2. Schema pozostaje 12, bez migracji i nowych funkcji.
- W środowisku wykonawczym `npm install` nadal jest zablokowany przez wewnętrzny mirror npm, dlatego prawdziwy `package-lock.json`, `npm ci` i pełny `npm run check` pozostają do potwierdzenia lokalnie; lockfile nie został sfabrykowany.

## 1.0.0-rc.1 - Release Candidate

- Zamknięto rozwój funkcjonalny i rozpoczęto finalną bramkę wydania.
- Nowe instalacje nie dostają już konkretnych domyślnych lokalizacji ani przypisanego domu/pracy; istniejące dane starszych instalacji nie są usuwane.
- Service Worker używa cache `inteligentny-kalendarz-shell-v1.0.0-rc.1`.
- Usunięto automatyczny deploy GitHub Pages i dodano CI `npm ci` + `npm run check`.
- Zsanityzowano identyfikujące lokalizacje/profil z historycznej dokumentacji i fixtures.
- Schema pozostaje 12; brak nowej migracji i brak nowych funkcji.
- Release pozostaje BLOCKED do czasu pełnego npm check/build, Cloudflare/D1/VAPID oraz realnych testów PWA/Web Push i urządzeń.

# Changelog

## 0.7.0 - Globalne wyszukiwanie

- dodano jeden globalny trigger `Szukaj` bez nowej pozycji `AppView`, sidebaru ani mobile bottom-nav,
- wyszukiwarka działa na `CalendarEvent[] + Location[]` już znajdujących się w pamięci aplikacji,
- wyniki obejmują Wydarzenia, Studia, Pracę i Miejsca oraz zwykłe opisy wydarzeń i notatki Miejsc,
- dodano normalizację polskich znaków, multi-token matching, prosty deterministyczny ranking i limit 12 wyników,
- kliknięcie wyniku otwiera istniejący `EventForm` lub `LocationForm`, bez routera i drugiego systemu szczegółów,
- dane Cyklu, Dziennika Cyklu, Własnych wzorców i estimate owulacji są celowo wykluczone,
- query i index nie są persistowane ani wysyłane do sieci,
- schema pozostaje 12, bez migracji, nowego store i nowych dependencies,
- Web Push, backup, Data Transfer, cycle-v1 i floral UI pozostają bez zmian funkcjonalnych,
- 0.7.0 zamyka rozwój funkcjonalny przed finalizacją 1.0.0.

## 0.6.3 - Szacowane okno owulacji

- dodano jedno szerokie `Możliwe okno owulacji` jako derived data nad istniejącym `CyclePrediction`,
- estimate pojawia się wyłącznie przy `READY + MODERATE/HIGHER + primaryWindow`,
- zakres = początek primary window - 16 dni oraz koniec primary window - 10 dni,
- wynik jest zawsze zakresem, bez pojedynczego dnia owulacji, fertile window, safe days i probability,
- `cycle-v1`, Dziennik, Własne wzorce i Web Push pozostają odseparowane,
- schema pozostaje 12, bez migracji, nowego store i nowych zależności.

## 0.6.2 - Dziennik Cyklu - lek przeciwbólowy

- dodano do istniejącego wpisu Dziennika opcjonalne pole `painMedicationTaken?: boolean` z prostym UI `Tak / Nie / Wyczyść`,
- `undefined` oznacza brak zapisanej odpowiedzi, `false` świadomie zapisane `Nie`, a `true` świadomie zapisane `Tak`,
- `false` jest jawnie zachowywane przez formularz, normalizację storage, Change Journal, backup, Restore Point i Data Transfer,
- wpis zawierający wyłącznie `painMedicationTaken = false` albo wyłącznie `true` jest poprawnym wpisem Dziennika,
- nie dodano nazwy leku, dawki, liczby tabletek, godzin, skuteczności, porad ani reminderów lekowych,
- Własne wzorce 0.6.1 nie analizują pola `painMedicationTaken`, a `cycle-v1` i Web Push pozostają od niego całkowicie odseparowane,
- `DATABASE_SCHEMA_VERSION` pozostaje 12, bez migracji, nowego store i nowych dependencies.

## 0.6.1 - Własne wzorce Cyklu

- dodano minimalistyczne `Własne wzorce` wyłącznie w `Cykl -> Historia`, bez nowej zakładki, modala, dashboardu ani wykresów,
- wynik jest derived data liczonym lokalnie w pamięci przez czysty helper `buildCyclePatternSummary(periods, journalEntries)`,
- typowa długość miesiączki używa mediany co najmniej 3 zakończonych `CyclePeriod` i liczy dni inclusive,
- krwawienie, ból i samopoczucie są podsumowywane dopiero przy minimum 3 zapisanych wartościach z minimum 2 różnych zakończonych miesiączek,
- `undefined` jest pomijane, a świadome `NONE` pozostaje prawdziwą obserwacją; remis daje `Różnie`, bez arbitralnego tie-breakera,
- analizowane są wyłącznie wpisy Dziennika przypadające w dniach zakończonych miesiączek; treść `note` nie jest analizowana,
- brak procentów, trendów, korelacji, diagnoz, porad i prognozowania objawów,
- `DATABASE_SCHEMA_VERSION` pozostaje 12, bez migracji, nowego store i zmian formatu backupu,
- `cycle-v1`, Web Push, nawigacja i floral UI pozostają odseparowane,
- brak nowych dependencies.

## 0.6.0 - Dziennik Cyklu

- dodano minimalistyczny Dziennik Cyklu z jednym wpisem na dzień: krwawienie, ból, samopoczucie i opcjonalna notatka do 500 znaków,
- `DATABASE_SCHEMA_VERSION` wzrosło z 11 do 12; migracja tworzy osobny store `cycleJournalEntries` z unikalnym indeksem `date` i nie przepisuje `cyclePeriods`,
- brak wartości pozostaje semantycznie różny od świadomie zapisanego `NONE`,
- Dziennik jest dostępny w `Cykl -> Dzisiaj` oraz przez zaznaczony dzień w `Kalendarzu`; nie dodano czwartej zakładki ani nowej pozycji głównej nawigacji,
- operacje add/edit/delete są objęte Change Journal i `Cofnij`,
- backup, Restore Points i one-file Data Transfer obejmują `cycleJournalEntries`; podgląd pokazuje wyłącznie liczbę wpisów,
- pliki schema 7-11 pozostają obsługiwane, a schema 11 migruje z pustym Dziennikiem,
- `cycle-v1` nie korzysta z Dziennika, a CRUD dziennika nie uruchamia synchronizacji Web Push,
- brak diagnoz, analiz wzorców, owulacji i nowych powiadomień,
- brak nowych dependencies.

## 0.5.4 - Kwiatowy motyw przewodni UI

- kwiatowy motyw stał się rozpoznawalną tożsamością wizualną aplikacji, nie tylko delikatnym backgroundem,
- zwiększono widoczność istniejących siedmiu ornamentów tła bez zwiększania liczby animowanych elementów,
- dodano wspólne statyczne floral accents w brandingu, górnej części głównego widoku i `EmptyState`,
- jedno istniejące ustawienie nadal steruje całością: `Wyłączone` usuwa wszystkie floral decorations, `Statyczne` pokazuje pełny nieruchomy motyw, `Delikatnie animowane` porusza tylko wybrane elementy tła,
- `prefers-reduced-motion: reduce` nadal zamienia tryb animowany w pełny motyw statyczny,
- nie dodano kwiatowych ramek kart, dekoracji inputów, nowych opcji wyglądu ani nowych zależności npm,
- nawigacja 0.5.3, Web Push, dane i logika domenowa pozostają bez zmian,
- `DATABASE_SCHEMA_VERSION` pozostaje 11.

## 0.5.3 - Dopracowanie nawigacji i ikon

- dodano spójne, lekkie ikony SVG do wszystkich 8 pozycji głównej nawigacji: Dzisiaj, Kalendarz, Studia, Praca, Zakupy, Cykl, Miejsca i Ustawienia,
- tekst pozostaje zawsze widoczny - ikony wyłącznie przyspieszają wzrokowe rozpoznawanie sekcji,
- desktop i mobile korzystają z jednego źródła definicji pozycji oraz jednego lokalnego komponentu ikon,
- usunięto nieinformatywne kropki `nav-dot` / `bottom-nav-dot` i historyczne założenie `repeat(7, ...)`,
- mobilny pasek nadal używa czytelnych skrótów, przewijania poziomego, scroll-snap i wygodnych touch targetów,
- ikony są dekoracyjne dla accessibility (`aria-hidden`, `focusable=false`) i korzystają z `currentColor`,
- nie dodano zewnętrznej biblioteki ikon ani innych zależności,
- nie zmieniono tła kwiatowego, Web Push, danych ani logiki domenowej,
- `DATABASE_SCHEMA_VERSION` pozostaje 11.

## 0.5.2 - Dopracowanie tła kwiatowego

- rozwinięto istniejącą kompozycję z 2 do 7 lekkich grup kwiatowych/roślinnych na desktopie, bez tworzenia efektu tapety,
- dodano bardziej organiczne rozmieszczenie przy krawędziach oraz trzy poziomy widoczności dekoracji,
- tylko 3 wybrane motywy są animowane; używają różnych, bardzo wolnych cykli 38/47/55 s i wyłącznie `transform`/`opacity`,
- tablet ogranicza kompozycję do 5 grup, 390 px do 3, a bardzo wąskie ekrany do 2 grup,
- zachowano `Wyłączone / Statyczne / Delikatnie animowane` oraz domyślny tryb `Statyczne`,
- `prefers-reduced-motion: reduce` nadal wyłącza cały ruch dekoracyjny,
- brak zmian funkcjonalnych, brak nowych zależności i brak zmian w Web Push,
- `DATABASE_SCHEMA_VERSION` pozostaje 11.

## 0.5.1 - Subtelne tło kwiatowe

- dodano jedną wspólną, nieinteraktywną warstwę dekoracyjną SVG/CSS za treścią aplikacji,
- dodano trzy tryby w Ustawieniach: `Wyłączone`, `Statyczne`, `Delikatnie animowane`,
- domyślny tryb dla nowych i starszych ustawień to `Statyczne`,
- animacja jest bardzo wolna i używa wyłącznie `transform` oraz `opacity`,
- `prefers-reduced-motion: reduce` zatrzymuje animację i pozostawia dekorację statyczną,
- na małych ekranach motyw jest mniejszy i bardziej transparentny,
- dekoracja ma `pointer-events: none` i nie przechwytuje interakcji,
- zmiana trybu wyglądu nie przebudowuje harmonogramu Web Push,
- nie dodano nowych zależności npm ani nowych store'ów,
- `DATABASE_SCHEMA_VERSION` pozostaje 11.

## 0.5.0 - Fundament powiadomień

- dodano globalny, device-local master switch powiadomień; wyłączenie blokuje pokazywanie Push lokalnie nawet bez dostępu do backendu,
- dodano lokalny deterministyczny planner reminderów dla Kalendarza, Studiów, rzeczywistej Pracy, Cyklu i przypomnienia o kopii danych,
- Cykl tworzy reminder wyłącznie dla statusu `READY` i początku głównego okna prognozy - bez komunikowania pewnej daty miesiączki,
- domyślna treść jest dyskretna; pełna treść jest składana lokalnie na urządzeniu,
- dodano Web Push przez istniejący Service Worker oraz minimalny Cloudflare Worker + D1 + Cron,
- backend otrzymuje wyłącznie anonimową instalację/subskrypcję Push, `scheduleId` i `triggerAtUtc`; nie otrzymuje treści Kalendarza, Studiów, Pracy ani Cyklu,
- dodano migrację schema 10 -> 11 tworzącą wyłącznie `notificationRuntime` i `notificationReminders`; wcześniejsze store'y użytkownika nie są przepisywane,
- runtime/subskrypcja/master switch nie są częścią backupu ani Data Transfer; szczegółowe preferencje powiadomień mogą być przenoszone, ale nowe urządzenie zawsze zaczyna z master OFF,
- dodano testy planera, migracji/prywatności storage i statyczny audit prywatności Workera/Service Workera,
- dodano dokument wdrożeniowy `NOTIFICATIONS_DEPLOYMENT_0.5.0.md`.

## 0.4.1 - Trasa do miejsca + ciągłość projektu

- dodano wspólny helper budujący bezpieczny link `Trasa` do Map Google na podstawie istniejących `Location.name` i `Location.address`,
- `Trasa` jest dostępna w kartach wydarzeń używanych przez `Dzisiaj` i `Kalendarz` oraz w widoku `Miejsca`,
- pusty adres nie generuje linku; numer sali nie jest używany jako cel nawigacji,
- Google Maps otwierane są dopiero po świadomym kliknięciu - bez Google Maps API, klucza API, geolokalizacji i requestów do Google w tle,
- nie zmieniono modelu danych ani backup/restore/transfer; `DATABASE_SCHEMA_VERSION` pozostaje 10,
- dodano testy helpera obejmujące polskie znaki, znaki specjalne, trimming i pusty adres,
- dodano `docs/PROJECT_HANDOFF.md` jako żywy dziennik przekazania projektu między rozmowami; ma być aktualizowany przy każdym przyszłym wydaniu,
- dodano `docs/PROMPT_0.4.1.txt` z pełnym zakresem wykonanej aktualizacji.

## 0.4.0 - Cykl

- dodano osobny, prywatny moduł `Cykl` z widokami `Dzisiaj / Kalendarz / Historia`,
- dodano trwały store `cyclePeriods` i migrację schema 9 -> 10 bez przepisywania wcześniejszych domen,
- można rozpocząć od dzisiaj albo opcjonalnie dodać wcześniejsze rzeczywiste daty,
- `endDate` jest opcjonalne i brak końca oznacza tylko `Koniec nieuzupełniony`,
- model `cycle-v1` nie używa ukrytego 28-dniowego defaultu,
- UI pokazuje okna i `Wiarygodność szacunku`, bez procentów,
- model potrafi zwrócić `UNAVAILABLE`, `PRELIMINARY`, `UNRELIABLE` i wygaszony estimate,
- dodano wykrywanie `POSSIBLE_MISSED_LOG`, `CONFIRMED_SINGLE_CYCLE` i `OBSERVATION_BREAK`,
- `OBSERVATION_BREAK` zachowuje prawdziwe daty, ale nie zamienia luki w sztuczny cycle length,
- pojedynczy outlier nie jest usuwany ani automatycznie uznawany za zmianę wzorca,
- `POSSIBLE_SHIFT` wymaga serii wspierających obserwacji i wystarczającej historii,
- `isUserMarkedAtypical` jest wyłącznie metadanym użytkowniczki i nie zmienia wag modelu,
- historia cyklu jest objęta backupem, restore points i jednym plikiem transferu,
- Cykl pozostaje całkowicie odseparowany od Kalendarza głównego, Studiów, Pracy, Zakupów i optimizera dyspozycyjności.

## 0.3.7 - Domknięcie UX i stabilności

- ważne zablokowane akcje pokazują powód i następny krok zamiast samego nieaktywnego przycisku,
- `Praca -> Importuj PDF` bez profilu prowadzi do ustawienia profilu pracy; po zapisaniu poprawnego imienia z grafiku import jest dostępny,
- `Przenoszenie danych` jest osobną, widoczną sekcją Ustawień, a nie elementem schowanym w `Dane i bezpieczeństwo`,
- Centrum bezpieczeństwa obejmuje trwałość danych lokalnych, historię, Kosz, punkty przywracania i zaawansowany backup,
- dodano bezpieczną obsługę `navigator.storage.persisted()` i `navigator.storage.persist()` bez zmiany schematu bazy,
- dopracowano PWA: instalacja jest proponowana tylko, gdy przeglądarka faktycznie udostępnia prompt; Service Worker nie cache'uje prywatnych `.pdf`, `.xls`, `.xlsx` ani plików transferu `.json`,
- na mobile główna nawigacja jest przewijalna zamiast ściskać siedem pozycji w jednym wierszu, a trzy zakładki Pracy zachowują czytelny układ,
- poprawiono komunikaty konfiguracji Dyspozycyjności oraz stan, w którym nie da się bezpiecznie osiągnąć celu godzin,
- dodano `docs/UX_AUDIT_0.3.7.md`,
- `DATABASE_SCHEMA_VERSION` pozostaje 9.

## 0.3.6 - Przenoszenie danych

- dodano w `Ustawienia -> Dane i bezpieczeństwo` prostą sekcję `Przenoszenie danych`,
- cały logiczny stan aplikacji można wyeksportować do jednego lokalnego pliku JSON,
- transfer używa tego samego kanonicznego formatu i checksum co pełny backup, zamiast utrzymywać drugi format danych,
- przed importem aplikacja sprawdza format, checksum, wersję schematu i pokazuje podsumowanie zawartości,
- import działa świadomie jako `replace`, a nie merge,
- przed zastąpieniem danych automatycznie tworzony jest punkt przywracania stanu urządzenia docelowego,
- snapshot jest zapisywany w jednej transakcji IndexedDB i po imporcie dodatkowo weryfikowany,
- kompatybilne pliki schema 7/8/9 są obsługiwane, a pliki z nowszą schema są blokowane,
- transfer działa offline i nie zawiera surowych plików PDF/XLSX,
- `DATABASE_SCHEMA_VERSION` pozostaje 9.

## 0.3.5 - Lista zakupów

- dodano osobny moduł `Zakupy` z jedną prostą listą,
- szybkie pole `Dodaj produkt...` obsługuje Enter i pozostawia focus do kolejnych wpisów,
- produkt może mieć opcjonalną ilość jako prosty tekst,
- pozycje można oznaczać jako kupione, przywracać, edytować i usuwać,
- kupione pozycje można usunąć jedną akcją bez naruszania rzeczy do kupienia,
- zakupy są zapisywane lokalnie w IndexedDB i nie trafiają do Kalendarza ani optimizera,
- `DATABASE_SCHEMA_VERSION` rośnie z 8 do 9 przez nowy store `shoppingItems`,
- backup, restore point i import starszego backupu schema 8 obsługują nowy moduł,
- operacje zakupowe są objęte Change Journal i Undo bez tworzenia osobnego Kosza zakupów.

## 0.3.4 - Podsumowanie pracy

- dodano trzecią zakładkę `Praca -> Podsumowanie`,
- podsumowanie jest wyliczane dynamicznie i nie tworzy nowego store'a,
- pokazuje godziny, liczbę zmian, dni pracy, średnią i najdłuższą zmianę,
- pokazuje liczbę sobót i niedziel z potwierdzoną pracą,
- rozkłada minuty pracy na tygodnie poniedziałek-niedziela,
- identyczne `MANUAL WORK` i `WORK_PDF` są deduplikowane z preferencją źródła PDF,
- zmiany przez północ i granicę miesiąca są dzielone minutowo bez podwójnego liczenia,
- zgodność z dyspozycyjnością agreguje istniejący comparison engine i nie tworzy nowej logiki statusów,
- `DATABASE_SCHEMA_VERSION` pozostaje 8.

## 0.3.3-hotfix.4 - Czytelniejsze zmiany i zespół

- własna zmiana ma wyraźniejszą hierarchię i czas trwania,
- każdy współpracownik ma osobny wiersz z pełną zmianą i zakresem wspólnym,
- osoby są sortowane według długości overlapu, potem początku overlapu i nazwy,
- listy powyżej 4 osób są zwijane,
- podsumowanie zgodności z dyspozycyjnością jest prostsze,
- bez zmian w DATABASE_SCHEMA_VERSION 8.

# Changelog

## 0.3.3-hotfix.3 - Dyspozycyjność liczona z kalendarza

Wykonano:

- główny przepływ `Praca -> Dyspozycyjność` nie wymaga już ręcznego wpisywania godzin dla każdego dnia przed kliknięciem `Ułóż dyspozycyjność`,
- brak `AvailabilityDayRule` oznacza automatyczne użycie standardowych ram pracy pomniejszonych o zajęcia, pracę, blokujące wydarzenia, wymagane rutyny, konflikty i bufor,
- edytor dnia domyślnie pokazuje wyliczone `Automatycznie możliwe` i wyjaśnia, że niczego nie trzeba przepisywać,
- pola `najwcześniej od`, `najpóźniej do` i niedostępne przedziały są schowane jako opcjonalny wyjątek konkretnego dnia,
- dokładne `Od/Do` jest wymagane tylko przy świadomym wpisaniu własnego `AvailabilityBlock`,
- standardowe ramy pracy zostały opisane jako jednorazowa granica techniczna, a nie codzienna deklaracja dyspozycyjności,
- zachowano ręczne bloki, uzupełnianie tylko brakujących godzin, krótkie okna, soboty, niedziele handlowe i comparison z `WORK_PDF`,
- ograniczono generowanie kandydatów w całkowicie wolnych dniach, aby automatyczne analizowanie pełnego tygodnia nie powodowało eksplozji kombinacji; zachowano krótkie okna, naturalne godziny i dokładne pokrycie celu,
- `DATABASE_SCHEMA_VERSION` pozostaje 8 - hotfix nie dodaje store'a ani migracji.

## 0.3.3-hotfix.2 - Podgląd planu w kalendarzu

Wykonano:

- bezpieczny podgląd innej grupy ma teraz domyślny widok miesięcznego kalendarza oraz opcjonalny widok `Lista`,
- kalendarz podglądowy używa tych samych podstawowych reguł miesiąca co główny kalendarz, ale jest osobnym komponentem bez zależności od pracy i dyspozycyjności,
- komórka dnia pokazuje tylko lekki wskaźnik liczby zajęć, a kliknięcie dnia otwiera uporządkowane godzinowo szczegóły,
- zmiana miesiąca i grupy dotyczy wyłącznie sandboxu podglądu,
- wpisy bez pewnej daty nie są przypisywane do sztucznego dnia i pozostają dostępne w widoku listy,
- `DATABASE_SCHEMA_VERSION` pozostaje 8 - hotfix nie dodaje store'a ani nowych danych trwałych.

## 0.3.3-hotfix.1 - Dyspozycyjność pod pełną kontrolą

Wykonano:

- plan zajęć i aktualny kalendarz pozostają nadrzędną bazą do wyliczania możliwych godzin pracy,
- dodano ręczne ograniczenia konkretnego dnia: wykluczenie dnia, najwcześniejszą godzinę, najpóźniejszą godzinę i niedostępne przedziały,
- można dodać własną dyspozycyjność bezpośrednio z Kalendarza bez wcześniejszego uruchamiania optimizera,
- ręczne i ręcznie edytowane bloki są zachowywane i nie są przesuwane przez optimizer,
- optimizer uzupełnia tylko brakujące godziny po odjęciu potwierdzonej pracy i bezpiecznej zapisanej dyspozycyjności,
- ręczna sobota jest dozwolona nawet przy wyłączonych automatycznych sobotach, a niedziela wymaga oznaczenia `TRADING_SUNDAY`,
- blok konfliktujący po zmianie planu zajęć zostaje widoczny, ale nie jest liczony jako bezpieczna dyspozycyjność,
- generator potrafi dobierać naturalne podprzedziały wewnątrz dużych wolnych okien zamiast używać wyłącznie ich początku/końca,
- `Dlaczego?` pokazuje konkretne fakty z kalendarza, bufor i brakującą liczbę godzin,
- wysłany snapshot nadal zawiera tylko konkretne zaakceptowane przedziały, a porównanie z `WORK_PDF` działa bez zmiany modelu,
- `DATABASE_SCHEMA_VERSION` pozostaje 8 - nowe reguły dnia są opcjonalną częścią istniejącego `AvailabilityPlan`.

Świadomie niewdrożone:

- lista zakupów,
- kalendarz miesiączkowy,
- nowe dashboardy i rozbudowane statystyki.

## 0.3.3 - Prostsza Praca

Wykonano:

- moduł Praca uproszczono do dwóch głównych widoków: `Grafik` i `Dyspozycyjność`,
- ustawienia dyspozycyjności i profil pracy przeniesiono bliżej modułu Praca, a opcje zaawansowane są domyślnie zwinięte,
- usunięto ciężki `Planer dnia` z globalnych Ustawień; codzienne reguły są prezentowane jako lekkie `Dodatkowe ograniczenia`,
- ustawienia grup studiów przeniesiono bliżej modułu Studia, bez zmiany modelu danych,
- główne Ustawienia odchudzono do danych, bezpieczeństwa, lokalizacji i informacji o aplikacji,
- dodano lokalne, read-only porównanie wysłanej dyspozycyjności z rzeczywistym grafikiem `WORK_PDF`,
- porównanie rozróżnia zmiany zgodne, częściowo poza dyspozycyjnością i całkowicie poza nią oraz pokazuje dokładne niepokryte przedziały,
- stykające się bloki wysłanej dyspozycyjności są łączone, a rzeczywiste przerwy pozostają wykrywane jako czas poza dyspozycyjnością,
- dyspozycyjność niewykorzystana przez pracodawcę jest informacją, a nie błędem,
- obsłużono zmiany przechodzące przez północ i granicę tygodnia,
- przy wielu wysłanych snapshotach można wybrać wersję do porównania; domyślnie preferowana jest najnowsza wersja sprzed importu grafiku,
- porównanie nie modyfikuje wysłanej dyspozycyjności, grafiku, historii zmian ani Centrum niespójności,
- `DATABASE_SCHEMA_VERSION` pozostaje 8, ponieważ wynik porównania jest wyliczany dynamicznie i nie wymaga nowego store'a.

Świadomie niewdrożone w 0.3.3:

- duży dashboard statystyk,
- miesięczne wykresy pracy,
- synchronizacja chmurowa,
- kalendarz cyklu,
- zmiany w optimizerze 0.3.2 niezwiązane z regresją.


## 0.3.2 - Automatyczna dyspozycyjność

Wykonano:

- dodano prosty `AvailabilityPlan` i `AvailabilityBlock`, całkowicie oddzielone od rzeczywistego `CalendarEvent WORK`,
- optimizer tygodnia odejmuje potwierdzoną pracę i układa tylko brakujące godziny,
- uwzględnia zajęcia, blokujące wydarzenia, `DayConstraint`, soboty, oznaczone niedziele handlowe, wymagane rutyny i bufor bezpieczeństwa,
- brak ukrytego minimum długości zmiany - krótkie 1-2 godzinne okna są prawidłowe, jeśli użytkowniczka nie ustawi minimum,
- generowany jest jeden rekomendowany plan zamiast kilku sztucznych wariantów,
- każdy blok można zaakceptować, edytować, odrzucić i sprawdzić przez `Dlaczego?`,
- zaakceptowane/edytowane bloki są domyślnie blokowane przed cichym przesuwaniem przy ponownym przeliczeniu,
- plan dostaje status `STALE`, jeśli po wyliczeniu zmieni się kalendarz lub istotne ustawienia,
- `ACKNOWLEDGED` twardej niespójności nie odblokowuje czasu dla optimizera,
- dyspozycyjność jest widoczna jako lekki osobny overlay w Kalendarzu i Dziś, ale nie zwiększa licznika `WORK`,
- dodano kopiowanie zaakceptowanej dyspozycyjności bez prywatnych szczegółów kalendarza oraz proste niezmienne snapshoty wysłanych wersji,
- dane dyspozycyjności są objęte backupem, Change Journal i Undo,
- backup schema 7 może być bezpiecznie przywrócony do schema 8 z pustym `availabilityPlans`,
- karta rzeczywistej pracy w Dziś/Kalendarzu może od razu pokazać zapisany zespół z realnego grafiku PDF,
- ciemny panel podsumowania Dzisiaj zastąpiono jaśniejszym, spokojniejszym stylem premium.

Świadomie niewdrożone w 0.3.2:

- rzeczywiste czasy dojazdu,
- porównanie wysłanej dyspozycyjności z finalnym grafikiem,
- dashboardy i rozbudowane statystyki,
- kalendarz miesiączkowy,
- synchronizacja chmurowa.

## 0.3.1 - Spójny plan dnia

Wykonano:

- dodano `DayPlanningProfile` z tygodniowym celem pracy, preferowanymi godzinami, opcjonalnym minimum/maksimum zmiany, sobotami i niedzielami handlowymi,
- dodano `DailyRoutineRule` typu `FIXED` i `FLEXIBLE` dla nauki, snu, posiłków, odpoczynku i innych czynności,
- dodano lokalny `DayAttribute` `TRADING_SUNDAY`, bez pobierania listy z internetu,
- dodano `CalendarConsistencyEngine` wykrywający `HARD_OVERLAP`, `TOUCHING`, `SOURCE_INCONSISTENCY`, `POTENTIAL_DUPLICATE`, `ALL_DAY_CONFLICT` i konflikty ze stałymi wymaganymi czynnościami,
- konflikty STUDY-STUDY są oznaczane jako możliwa niespójność planu źródłowego, bez automatycznego wskazywania winnego wydarzenia,
- dodano Centrum niespójności z filtrowaniem, acknowledgement oraz szybką edycją powiązanych wydarzeń,
- korekta godzin całej serii studiów używa wyłącznie stabilnego `seriesKey`, pokazuje preview i tworzy Restore Point przed transakcją,
- dodano API `buildDayPlanningContext`, `buildWeekPlanningContext` i `getPlanningBlockingIssues` pod optimizer 0.3.2,
- dodano `availabilityImpact` dla wydarzeń całodniowych i informacyjnych,
- kalendarz ma osobne kolory i liczniki `STUDY`, `WORK`, `PERSONAL`, `OTHER`; kolor wynika z kategorii, nie ze źródła,
- zaznaczenie dnia, kolory kategorii i badge konfliktu są niezależnymi stanami wizualnymi,
- widok Kalendarza otrzymał bardzo delikatną minimalistyczną teksturę CSS bez dodatkowego obrazu.

Świadomie niewdrożone w 0.3.1:

- automatyczne układanie dyspozycyjności,
- rzeczywiste czasy dojazdów i travel conflicts,
- automatyczne pobieranie niedziel handlowych,
- automatyczne poprawianie błędnych godzin planu bez decyzji użytkowniczki.

## 0.3.0 - Grafik pracy

Wykonano:

- dodano lokalny `WorkProfile` i osobną sekcję `Praca`,
- dodano import PDF z warstwą tekstową bez OCR i bez zapisywania surowego pliku,
- dodano `workScheduleAdapterRegistry` oraz pierwszy deterministyczny adapter tabelarycznego grafiku,
- pracownik jest dopasowywany po znormalizowanej pełnej nazwie z lokalnego profilu, a nie po numerze strony,
- dodano `WorkScheduleImport`, `WorkScheduleEntry` i source `WORK_PDF`,
- godziny pracy są liczone wewnętrznie w minutach, w tym krótkie zmiany oraz zmiany przechodzące przez północ,
- nowa wersja PDF tego samego okresu jest porównywana z aktywnym grafikiem i nie tworzy drugiego kompletu wydarzeń,
- ręczne wydarzenia WORK pozostają niezależne od PDF, a ręczne poprawki `WORK_PDF` są chronione przez `userModified`,
- wykrywane są kolizje `OVERLAP`, brak buforu `TOUCHING` oraz możliwy duplikat ręcznej pracy,
- dodano API potwierdzonej pracy obejmujące PDF i ręczne WORK pod przyszły optymalizator dyspozycyjności,
- dane pracy zostały włączone do Change Journal, Restore Points i lokalnego backupu,
- opcjonalna funkcja `Pokazuj kto jest ze mną na zmianie` zapisuje lokalnie minimalne przedziały pracy zespołu i pokazuje rzeczywiste nakładanie z własną zmianą,
- dane zespołu nie wpływają na etap planowania dyspozycyjności przed opublikowaniem rzeczywistego grafiku.

Świadomie niewdrożone w 0.3.0:

- automatyczne układanie dyspozycyjności,
- cel godzin tygodniowych, nauka/posiłki/odpoczynek jako ograniczenia optymalizatora,
- rzeczywiste czasy dojazdów i komunikacja miejska,
- OCR dla skanowanych grafików.

## 0.2.4 - Bezpieczniejsze dane

Wykonano:

- dodano `ChangeJournalEntry` i szybkie `Cofnij` dla odwracalnych operacji,
- historia zmian przechowuje maksymalnie 100 ostatnich operacji,
- zwykłe usuwanie ręcznych wydarzeń i serii korzysta z Kosza zamiast natychmiastowego trwałego usunięcia,
- dodano przywracanie z Kosza, trwałe usuwanie i bezpieczne opróżnianie Kosza,
- duże operacje tworzą lokalne punkty przywracania; automatycznie przechowywanych jest maksymalnie 10 nieprzypiętych punktów,
- dodano ręczne punkty przywracania oraz safety point przed przywróceniem wcześniejszego stanu,
- dodano pełny lokalny backup JSON z wersją formatu i SHA-256 oraz dry run przed restore,
- restore backupu zastępuje lokalne dane atomowo dopiero po walidacji i wcześniej zabezpiecza bieżący stan,
- dodano `DayConstraint` typu `EXCLUDE_FROM_WORK_AVAILABILITY` - dzień może być wyłączony z przyszłych automatycznych propozycji pracy bez blokowania ręcznych wydarzeń,
- ręcznie wpisana praca w wykluczonym dniu pozostaje dozwolona i będzie w przyszłości miała pierwszeństwo przed propozycjami optymalizatora,
- ręcznie usunięte zajęcie z planu studiów zostawia źródłowy tombstone, aby kolejna aktualizacja nie przywróciła go po cichu,
- dodano izolowany `StudyPreviewProfile` i widok `Sprawdź plan innej grupy`, który korzysta z danych `sourceOnly` i nie zmienia głównych grup, aktywnego importu ani wydarzeń,
- jeżeli starszy import nie zawiera pełnych danych wszystkich grup, podgląd prosi o ponowne wskazanie XLSX zamiast zgadywać,
- migracja IndexedDB 4 -> 5 zachowuje dotychczasowe dane i tworzy store'y bezpieczeństwa oraz profile podglądowe.

Świadomie niewdrożone w 0.2.4:

- import grafiku pracy PDF,
- automatyczne wyliczanie dyspozycyjności,
- dojazdy i komunikacja miejska,
- synchronizacja chmurowa,
- szyfrowanie backupu.

## 0.2.3 - Więcej możliwości planowania

Wykonano:

- dodano wydarzenia całodniowe z jawnym polem `allDay`,
- dodano pojedyncze wydarzenia wielodniowe obejmujące kolejne dni,
- wydarzenia wielodniowe są renderowane na każdym dniu zakresu bez duplikowania rekordu w bazie,
- dodano tryb `Wybierz dni` w widoku miesiąca,
- ciągły wybór dni pozwala utworzyć jedno wydarzenie wielodniowe albo serię osobnych terminów,
- niekolejne dni tworzą wyłącznie ręczną serię `MANUAL_MULTI_DATE`,
- ręczna seria posiada wspólne `seriesId`, niezależne od `seriesKey` planu studiów,
- edycja i usuwanie serii pozwalają wybrać pojedynczy termin albo całą serię,
- zbiorcza edycja serii zachowuje indywidualne daty wystąpień,
- tworzenie, zbiorcza edycja i usuwanie serii korzystają z transakcji IndexedDB,
- poprawiono widok Dzisiaj i licznik wydarzeń w miesiącu dla all-day i multi-day,
- obsłużono zakresy przechodzące między miesiącami i latami,
- lokalne klucze dat nie są konwertowane przez UTC, co ogranicza ryzyko przesunięcia all-day przy DST,
- migracja IndexedDB 3 -> 4 zachowuje stare wydarzenia i ustawia im `allDay = false`,
- naprawiono rozjechany układ opcji `Zakres poprawki` w oknie `Uzupełnij dane zajęcia`,
- `DATABASE_SCHEMA_VERSION` podniesiono do 4 bez zmiany store'ów planu studiów.

Świadomie niewdrożone w 0.2.3:

- cykliczne RRULE,
- planer miejsc do zwiedzania,
- mapy i komunikacja miejska,
- eksport ICS / Google Calendar,
- grafik pracy PDF.

## 0.2.2 - Stabilniejszy import planu

Wykonano:

- wzmocniono deterministyczne rozpoznawanie arkusza planu bez zależności od nazwy `PRAKTYKI`,
- adapter rozpoznaje plan na podstawie dni tygodnia, spójnych siatek czasu, roku akademickiego i sygnałów grupowych,
- nagłówki dni tolerują wielkość liter, brak polskich znaków, zmienioną kolejność i sobotę,
- siatka czasu nie zakłada już stałych 15 minut i rozpoznaje m.in. formaty z kropką, dwukropkiem oraz różnymi odstępami,
- parser dat obsługuje dodatkowo `16.02`, `16/02`, daty z rokiem oraz listy rozdzielone przecinkami, średnikami i nowymi liniami,
- czytnik XLSX zachowuje informację o rzeczywistych komórkach dat oraz ukrytych wierszach i kolumnach do diagnostyki,
- poprawiono normalizację grup `Gr.`, `gr`, `grupa nr`, grup łączonych i klinik zapisywanych cyfrą rzymską lub arabską,
- usunięto fałszywe rozpoznawanie fragmentu adresu `63a` jako grupy `63A`,
- poprawiono rozpoznawanie adresów `ul.`, `al.`, `Aleja`, `pl.` oraz nazw kampusów i szpitali,
- źródło bezpośrednio zapisane przy zajęciach ma wyższy priorytet niż ogólny opis pod planem,
- dodano rozszerzoną diagnostykę nierozpoznanego i rozpoznanego skoroszytu,
- dodano ukryty panel diagnostyczny parsera w widoku Studia,
- wzmocniono testy przesuniętego layoutu, zmienionej kolejności dni, soboty, 30-minutowej siatki, merges, dat, godzin, grup, lokalizacji i nieznanych plików,
- zachowano `DATABASE_SCHEMA_VERSION = 3` - wersja nie wymaga migracji bazy,
- diff, correction rules, profil grup i ochrona ręcznych poprawek z 0.2.1 pozostają kompatybilne.

Świadomie niewdrożone w 0.2.2:

- nowy adapter dla niepotwierdzonego formatu planu,
- Web Worker bez pomiaru wskazującego realny problem wydajności,
- mapy, dojazdy, eksport ICS, grafik pracy PDF i wydarzenia wielodniowe.

## 0.2.1 - Aktualizacja planu, profil grup i poprawki serii

Wykonano:

- dodano porównanie nowego planu XLSX z ostatnim aktywnym planem przed zmianą kalendarza,
- dodano ekran "Co się zmieniło?" z kategoriami nowych, zmienionych, usuniętych, konfliktowych i niejednoznacznych wpisów,
- dodano `occurrenceKey` dla konkretnego terminu oraz `seriesKey` dla logicznej serii zajęć,
- `seriesKey` uwzględnia adapter, arkusz, przedmiot, typ zajęć, grupy i klinikę, a nie sam tytuł,
- dodano bezpieczne dopasowanie zmiany daty lub czasu w obrębie tej samej serii,
- konflikty z ręcznymi zmianami wymagają jawnej decyzji: zachowaj własną zmianę albo użyj danych nowego planu,
- ręczne pola niezwiązane z nową zmianą planu pozostają zachowane,
- rezygnacja z usunięcia wydarzenia, którego nie ma już w planie, zachowuje je jako wydarzenie ręczne,
- zastosowanie aktualizacji odbywa się w jednej transakcji IndexedDB,
- historia importów zachowuje stare wersje, a jedna wersja jest oznaczona jako aktywna,
- zapisane grupy są automatycznie podpowiadane przy kolejnym imporcie,
- w Ustawieniach można zmienić grupy tylko na przyszłość albo przygotować podgląd przeliczenia aktywnego planu,
- ręcznie zmienione zajęcia usuwane przez zmianę grup są zachowywane jako wydarzenia ręczne,
- dodano akcję "Uzupełnij dane" również po imporcie,
- brakujący adres, sala, klinika lub etykieta lokalizacji mogą zostać poprawione dla jednego wydarzenia albo bezpiecznie powiązanej serii,
- przed poprawką serii aplikacja pokazuje liczbę wydarzeń z tym samym brakiem,
- poprawka serii zapisuje lokalną `StudyCorrectionRule`,
- nowy plan z jawną wartością inną niż zapisana poprawka tworzy konflikt zamiast cichego nadpisania,
- w Ustawieniach dodano przyjazne "Co nowego" oraz Roadmapę,
- dodano store'y `scheduleUpdateSessions` i `studyCorrectionRules`,
- migracja IndexedDB 2 -> 3 zachowuje istniejące wydarzenia, importy, miejsca, ustawienia i profil studiów,
- dla wpisów z poprzedniego schematu migracja wylicza klucze serii i wystąpień tam, gdzie dane na to pozwalają,
- parser `nursing-plan-v1` nie został przebudowany w tej wersji.

Świadomie niewdrożone w 0.2.1:

- import grafiku pracy PDF,
- mapy i komunikacja miejska,
- eksport ICS i integracja Google Calendar,
- wydarzenia wielodniowe i zaznaczanie kilku dni,
- parser kolejnych formatów planu,
- backend, logowanie i synchronizacja między urządzeniami.

## 0.2.0-hotfix.1 - Import review UX

Wykonano:

- cała karta kandydata jest klikalna i przełącza Importuj / Pomiń,
- karty można przełączać klawiaturą przez Enter lub Spację,
- wpisy bez problemów oraz z nieblokującymi brakami są domyślnie zaznaczone,
- wprowadzono czytelne stany GOTOWE / DO SPRAWDZENIA / WYMAGA POPRAWY,
- problemy lokalizacyjne są ostrzeżeniami i nie blokują importu,
- braki daty, czasu lub tytułu blokują import do chwili korekty,
- karta pokazuje konkretne przyczyny,
- dodano akcje zbiorcze i liczniki,
- DATABASE_SCHEMA_VERSION pozostaje 2.

## 0.2.0 - Plan studiów - import XLSX i wybór grup

Wykonano:

- ekran Studia z lokalnym importem `.xlsx`,
- adapter `nursing-plan-v1`,
- dynamiczne wykrywanie struktury wizualnego planu,
- normalizację i wybór wielu grup,
- podgląd i korektę kandydatów,
- lokalny fingerprint SHA-256,
- trwałe metadane importu,
- source `UNIVERSITY_XLSX`,
- migrację schema 1 -> 2,
- usuwanie importu bez usuwania wydarzeń ręcznych,
- informację o wykładach e-learningowych bez tworzenia fikcyjnych wydarzeń.

## 0.1.0 - Fundament aplikacji

- wydarzenia ręczne,
- widok Dzisiaj i Kalendarz,
- lokalizacje i ustawienia,
- lokalna baza IndexedDB,
- responsywny interfejs,
- opcjonalne PWA.