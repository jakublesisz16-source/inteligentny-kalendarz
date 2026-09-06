## 1.0.0-rc.1 - audit prywatności wydania

Nowa instalacja nie otrzymuje predefiniowanego domu ani miejsca pracy. Historyczne materiały i fixtures zostały zsanityzowane z konkretnych danych mogących identyfikować właściciela projektu. Canonical dane pozostają local-first. Finalne `1.0.0` nie ma backendu aplikacji ani Web Push. Nie należy jednak twierdzić, że żadne dane nigdy nie opuszczają urządzenia: destination może trafić do zewnętrznej usługi mapowej po świadomym kliknięciu `Trasa`, a nieszyfrowany plik backup/transfer może zostać ręcznie przeniesiony przez użytkownika.

## Globalne wyszukiwanie 0.7.0

Global Search działa wyłącznie lokalnie na danych `CalendarEvent` i `Location` już obecnych w pamięci aplikacji. Query nie jest zapisywane w IndexedDB, backupie ani historii i nie jest wysyłane do sieci. `CyclePeriod`, `CycleJournalEntry`, notatki Dziennika Cyklu, `CyclePatternSummary` i `CycleOvulationEstimate` są celowo wykluczone z globalnego indeksu, aby prywatne informacje zdrowotne nie pojawiały się przypadkowo w globalnym overlayu.

## Szacowane okno owulacji 0.6.3

`CycleOvulationEstimate` powstaje wyłącznie lokalnie z istniejącego `CyclePrediction`. Nie jest canonical user data, nie jest zapisywany w IndexedDB ani eksportowany. Historia Cyklu, Dziennik i estimate nie są wysyłane do zewnętrznego API w celu tego obliczenia.

# Prywatność

## Lek przeciwbólowy w Dzienniku Cyklu 0.6.2

Opcjonalna odpowiedź `Tak / Nie` dotycząca przyjęcia leku przeciwbólowego jest prywatną informacją zdrowotną i pozostaje lokalnie w `cycleJournalEntries`. Nie jest wysyłana do backendu aplikacji, analytics, AI, Google ani innych usług.

Ręczny backup i Data Transfer mogą zawierać to pole razem z pozostałym wpisem Dziennika. Eksport JSON nadal nie jest szyfrowany, więc powinien być przechowywany jak prywatny plik. Aplikacja nie zapisuje nazwy leku, dawki ani godziny przyjęcia.

## Własne wzorce Cyklu 0.6.1

Wzorce są liczone wyłącznie lokalnie z już zapisanych `CyclePeriod` i `CycleJournalEntry`. Wynik nie jest zapisywany jako osobny rekord, nie jest wysyłany do żadnego backendu aplikacji ani zewnętrznego API i nie dodaje nowych danych do backupu. Treść pola `note` jest celowo wyłączona z analizy.

Podsumowanie opisuje tylko własne zapisane obserwacje z dni zakończonych miesiączek. Nie klasyfikuje ich medycznie, nie przypisuje przyczyn i nie tworzy profilu zdrowotnego poza lokalnymi danymi, które użytkowniczka sama zapisała.

## Zasada local-first

Dane kalendarza są przechowywane lokalnie w IndexedDB konkretnej przeglądarki i urządzenia.

Aplikacja 0.4.0 nie posiada:

- kont użytkowników,
- backendu,
- chmurowej bazy,
- analytics,
- trackerów,
- reklam,
- mechanizmu wysyłającego wydarzenia, miejsca, grupy lub poprawki na serwer.

## XLSX i diff

Plik planu jest odczytywany lokalnie w przeglądarce.

Nie jest wysyłany do:

- GitHuba,
- backendu,
- zewnętrznego API,
- AI,
- usługi analitycznej.

Nowa wersja planu jest porównywana ze starymi znormalizowanymi rekordami lokalnie.

Oryginalne bajty XLSX nie są trwale zapisywane w IndexedDB.

## Co jest zapisywane

Lokalnie mogą zostać zapisane:

- SHA-256 pliku,
- nazwa i rozmiar pliku,
- metadane importu,
- wybrane i dostępne grupy,
- znormalizowane wpisy źródłowe,
- wydarzenia i lokalizacje,
- sesje aktualizacji,
- lokalne correction rules,
- historia aktywnych i historycznych importów.

`sourceOnly` to znormalizowane dane potrzebne do przeliczenia grup, a nie kopia XLSX.

## Correction rules

Uzupełnienia takie jak adres lub sala są przechowywane lokalnie. Reguła może zostać ponownie użyta dla tej samej serii zajęć. Jeśli nowy XLSX poda inną jawną wartość, aplikacja nie nadpisuje jej po cichu.

## GitHub Pages

Hosting statyczny dostarcza kod aplikacji. Nie przechowuje prywatnej bazy IndexedDB ani plików XLSX.

Finalne ZIP-y i repozytorium nie mogą zawierać prawdziwych planów, eksportów bazy ani grafików pracy.

## Wiele urządzeń

Telefon i komputer nadal mają niezależne lokalne bazy. 0.3.6 dodaje ręczne przenoszenie całego logicznego stanu przez jeden lokalny plik JSON, ale nie dodaje synchronizacji online. Plik jest wybierany i odczytywany lokalnie, a aplikacja nie wysyła go do serwera.

## Ryzyko utraty danych i backup

Dane local-first mogą zostać utracone po wyczyszczeniu danych witryny, usunięciu profilu przeglądarki albo awarii urządzenia. Aplikacja udostępnia ręczny eksport pełnego lokalnego backupu oraz przywracanie po walidacji. Backup może zawierać wydarzenia, lokalizacje, plan studiów, Kosz i preferencje, dlatego powinien być przechowywany w bezpiecznym miejscu.

Backup 0.2.4 nie jest szyfrowany. SHA-256 służy wyłącznie do sprawdzenia integralności i nie chroni treści przed odczytem.


## Diagnostyka parsera

Diagnostyka 0.2.2 działa lokalnie. Pokazuje wyłącznie informacje potrzebne do zrozumienia rozpoznania planu, np. nazwy arkuszy, zakresy, wykryte dni i liczbę siatek czasu. Nie wysyła pliku ani diagnostyki poza urządzenie i nie zapisuje pełnej zawartości XLSX w IndexedDB.

## Ręczne wydarzenia wielodniowe i serie

Nazwy wyjazdów, wybrane dni, lokalizacje, opisy oraz `seriesId` ręcznych serii pozostają wyłącznie w lokalnym IndexedDB. Tryb wyboru wielu dni jest stanem UI i nie jest wysyłany poza urządzenie. 0.2.3 nie dodaje map, geokodowania ani integracji kalendarzowych.
## Historia, Kosz i punkty przywracania

Change Journal, Kosz i Restore Points pozostają w lokalnym IndexedDB. Nie są wysyłane do serwera ani usług analitycznych. Automatyczne punkty przywracania mają ograniczony limit, aby historia nie rosła bez końca.

## Bezpieczny podgląd grup

Profile podglądowe grup i wygenerowany podgląd są lokalne. Podgląd korzysta ze znormalizowanych `sourceOnly` aktywnego importu albo z XLSX wskazanego wyłącznie do jednorazowej analizy w pamięci. Nie tworzy drugiego zestawu wydarzeń, nie zapisuje wskazanego pliku jako aktywnego importu i nie wysyła danych na zewnątrz.

## Wykluczenia dni

`DayConstraint` zawiera datę i opcjonalną notatkę. Informacja jest lokalna i w przyszłości ma służyć wyłącznie do ograniczania automatycznych propozycji dyspozycyjności.



## Grafik pracy PDF 0.3.0

PDF jest analizowany lokalnie w przeglądarce i nie jest wysyłany do backendu, AI ani usług analitycznych. Surowy plik nie jest przechowywany w IndexedDB ani w backupie. Profil pracy i własne znormalizowane zmiany pozostają lokalne.

### Minimalne dane zespołu

Na wyraźne życzenie użytkownika 0.3.0 może lokalnie przechowywać minimalne dane potrzebne do funkcji `kto jest ze mną na zmianie`. Ustawienie można wyłączyć w profilu pracy. Przy włączonej funkcji zapisywane są tylko nazwa wyświetlana współpracownika oraz data i przedział jego zmiany potrzebne do policzenia przecięcia z własną zmianą. Aplikacja nie zapisuje surowej strony PDF, danych kontaktowych, identyfikatorów kadrowych ani statystyk współpracownika.

Pełny lokalny backup może zawierać te minimalne rekordy zespołu, jeśli funkcja była włączona, dlatego plik backupu powinien być traktowany jako prywatny. Dane zespołu nie są używane podczas układania dyspozycyjności przed opublikowaniem rzeczywistego grafiku.


## 0.3.1

Preferencje modelu dnia, rutyny, ręczne oznaczenia niedziel handlowych i acknowledgement konfliktów pozostają wyłącznie w IndexedDB oraz lokalnym backupie. System spójności nie wykonuje żadnych zewnętrznych zapytań. Tekstura kalendarza jest generowana CSS i nie pobiera zasobów z sieci.


## Dyspozycyjność 0.3.2

Optimizer działa wyłącznie lokalnie i nie wysyła wydarzeń, targetu godzin, rutyn ani ograniczeń do zewnętrznych usług. `AvailabilityPlan` oraz snapshoty wysłanej dyspozycyjności są przechowywane w IndexedDB i mogą wejść do pełnego lokalnego backupu. Funkcja kopiowania generuje wyłącznie daty, godziny i opcjonalną sumę - bez tytułów zajęć, prywatnych wydarzeń, adresów czy danych współpracowników.


## Porównanie dyspozycyjności z grafikiem 0.3.3

Porównanie działa wyłącznie lokalnie. Aplikacja używa istniejącego niezmiennego `sentSnapshot` oraz lokalnie zapisanych znormalizowanych zmian `WORK_PDF`. Wynik jest wyliczany w pamięci i nie tworzy nowej kopii danych w IndexedDB ani nowego wpisu Change Journal.

Silnik nie wysyła dyspozycyjności, grafiku ani danych współpracowników do zewnętrznych usług. Porównanie nie modyfikuje historycznego snapshotu ani rzeczywistego grafiku. Dane zespołu mogą być nadal pokazane przy konkretnej zmianie, ale nie wpływają na wynik zgodności.


## Ręczna dyspozycyjność

Reguły konkretnych dni, ręcznie wpisane godziny dyspozycyjności i propozycje optimizera są przechowywane wyłącznie lokalnie w IndexedDB. Podgląd bezpiecznych okien jest obliczany na urządzeniu. Do schowka trafiają wyłącznie konkretne zaakceptowane przedziały dyspozycyjności, bez tytułów zajęć, prywatnych wydarzeń i reguł dnia.


## Automatyczne okna 0.3.3-hotfix.3

Wyliczanie bezpiecznych godzin z kalendarza odbywa się lokalnie. Standardowe ramy pracy, wyjątki konkretnego dnia i derived safe windows nie są wysyłane do zewnętrznych usług. Brak reguły dnia nie tworzy dodatkowego rekordu - oznacza tylko użycie istniejącego kalendarza i ustawień do lokalnego obliczenia.


## Zakupy

Lista zakupów jest przechowywana wyłącznie lokalnie w IndexedDB. Nazwy produktów i ilości nie są wysyłane do usług zewnętrznych. Pełny lokalny backup zawiera także `shoppingItems`, dlatego plik backupu może ujawniać treść listy osobie, która uzyska do niego dostęp.


## Przenoszenie danych 0.3.6

Plik transferu może zawierać prywatne dane z całej aplikacji, w tym wydarzenia, plan studiów, znormalizowane dane pracy i zespołu, dyspozycyjność, ustawienia oraz listę zakupów. Plik nie jest szyfrowany. SHA-256 wykrywa uszkodzenie lub zmianę treści, ale nie ukrywa danych przed osobą mającą dostęp do pliku.

Eksport i import działają offline. Aplikacja nie wysyła pliku transferu do backendu, chmury, AI ani usługi analitycznej. Surowe PDF i XLSX nie są częścią transferu; odtwarzany jest zapisany logiczny stan aplikacji.


## Trwałość danych i PWA 0.3.7

Żądanie `navigator.storage.persist()` jest lokalną funkcją przeglądarki. Nie wysyła zawartości IndexedDB do serwera i nie tworzy konta. Przyznanie trwałego przechowywania zmniejsza ryzyko automatycznego usunięcia danych przez mechanizmy porządkowania pamięci przeglądarki, ale nie zastępuje eksportu danych i nie chroni przed ręcznym wyczyszczeniem danych witryny lub awarią urządzenia.

Instalacja PWA również nie wysyła danych użytkownika. Service Worker 0.3.7 nie cache'uje plików `.pdf`, `.xls`, `.xlsx` ani `.json`, dzięki czemu surowe dokumenty i eksporty danych nie stają się częścią runtime cache aplikacji.

## Dane cyklu 0.4.0

Historia cyklu jest traktowana jako prywatna, długoterminowa historia użytkowniczki. Pozostaje w lokalnym IndexedDB i nie jest wysyłana do API, analytics ani chmury. Lokalny model predykcyjny działa bez zewnętrznych usług.

Pełny backup i plik `Przenoszenie danych` zawierają `cyclePeriods`, dlatego interfejs ostrzega, że nieszyfrowany plik może zawierać prywatną historię cyklu i należy przechowywać go bezpiecznie. Prognozy i diagnostics nie są eksportowane - po odzyskaniu historii są przeliczane od nowa.

## Powiadomienia - decyzja finalna 1.0.0

W 0.5.0 powstał eksperymentalny fundament Web Push, ale przed finalnym `1.0.0` warstwa sieciowa została wycofana z aktywnego produktu. Finalna PWA nie rejestruje PushSubscription, nie wysyła harmonogramów do serwera i nie ma Cloudflare Worker/D1/Cron/VAPID.

W schema 12 mogą pozostać historyczne, lokalne store'y techniczne i preferencje reminderów, ponieważ ich fizyczne usuwanie wymagałoby niepotrzebnej migracji IndexedDB. Nie są one synchronizowane z siecią i nie są częścią canonical backup/Data Transfer poza samymi preferencjami. Czysty planner przypomnień pozostaje kodem lokalnym przygotowanym pod ewentualną przyszłą aplikację Android z lokalnymi powiadomieniami.

## Dziennik Cyklu 0.6.0

`cycleJournalEntries` może zawierać prywatne informacje o krwawieniu, bólu, samopoczuciu i własnej notatce. Dane pozostają w lokalnym IndexedDB i nie są wysyłane do backendu aplikacji, analytics, AI, Google ani innych API.

Pełny backup, Restore Points i ręczny plik transferu zawierają Dziennik Cyklu. Eksport JSON nadal nie jest szyfrowany; checksum SHA-256 służy integralności i nie ukrywa treści. Podglądy backupu/transferu pokazują tylko liczbę wpisów, nie ich treść.
## Paragony i Wydatki 1.1.0-dev.1

Ręcznie zapisane paragony, nazwy sklepów, pozycje, kategorie i kwoty pozostają wyłącznie w lokalnym IndexedDB. Moduł nie wykonuje requestów do usług OCR, AI, analytics, banków ani backendu aplikacji.

`expenseCategories` i `receipts` są canonical user data i wchodzą do Restore Points, pełnego backupu oraz Data Transfer. Nieszyfrowany JSON może więc ujawnić historię zakupów i wydatków osobie mającej dostęp do pliku; należy przechowywać go jak prywatny dokument.

`1.1.0-dev.1` nie przyjmuje zdjęć paragonów i ich nie zapisuje. Planowany lokalny OCR jest osobnym przyszłym etapem i nie jest częścią bieżącego kandydata.


## Lokalny OCR paragonów 1.1.0-dev.3

Zdjęcia i pliki PDF paragonów są przetwarzane lokalnie w przeglądarce przez lokalne zasoby Tesseract.js i lokalnie spakowany PDF.js. Przepływ OCR nie wysyła obrazu, PDF, surowego tekstu OCR ani danych rozpoznania do zewnętrznego API, chmury, CDN OCR, analytics ani telemetry.

Obraz/PDF, renderowane strony PDF, surowy OCR, metadane fragmentów, kandydaci merchant oraz diagnostyka jakości są stanem przejściowym sesji i nie są zapisywane do IndexedDB, backupu JSON ani eksportu Excel. Po świadomym zapisie do canonical danych trafiają wyłącznie sprawdzone dane paragonu zgodne z istniejącym modelem: sklep, data, pozycje, kategorie i końcowe kwoty pozycji.

Produkcja zachowuje komunikaty potrzebne użytkownikowi do bezpiecznego review, np. o bardzo niskiej jakości źródła lub konieczności sprawdzenia nazw. Techniczny panel FIX1J i kopiowanie surowego OCR są dostępne wyłącznie w buildzie developerskim.

Service Worker może wymieniać stare wpisy Cache Storage podczas aktualizacji aplikacji, ale nie ma ścieżki usuwającej IndexedDB. Surowe prywatne pliki `.pdf`, `.xls`, `.xlsx` i `.json` nie są celowo cache'owane jako dane użytkownika.
