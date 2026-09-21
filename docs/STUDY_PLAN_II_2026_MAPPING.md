# Plan studiów II rok - mapa źródła 18.09.2026

## Status dokumentu

To jest aktywna mapa referencyjna dla aktualnego planu przekazanego do projektu:

- plik źródłowy: `licencjat-ii-rok-piel.-18.09.2026.xls`,
- kierunek: pielęgniarstwo stacjonarne pierwszego stopnia,
- rok: II,
- semestr: zimowy 2026/2027,
- arkusz planu grupowego: `PLAN ZAJĘĆ`, zakres `A1:DK73`,
- arkusz wykładów: `WYKŁADY`, zakres `A1:C34`.

Poprzednia mapa `STUDY_PLAN_III_2026_MAPPING.md` dotyczy wcześniej przekazanego pliku III roku i nie jest aktywnym źródłem dla bieżącego kalendarza.

## Zasada nadrzędna

Importer odwzorowuje wyłącznie dane, które można jednoznacznie wyprowadzić ze źródła. Brak dnia, pełnego zakresu godzin lub jednoznacznego przypisania lokalizacji pozostaje oznaczony jako niepełny. Parser nie uzupełnia takich danych przez domysł.

## Zakres semestru

Rozpoznano 15 wierszy tygodniowych:

1. 05.10.2026 - 09.10.2026
2. 12.10.2026 - 16.10.2026
3. 19.10.2026 - 23.10.2026
4. 26.10.2026 - 30.10.2026
5. 02.11.2026 - 06.11.2026
6. 09.11.2026 - 13.11.2026
7. 16.11.2026 - 20.11.2026
8. 23.11.2026 - 27.11.2026
9. 30.11.2026 - 04.12.2026
10. 07.12.2026 - 11.12.2026
11. 14.12.2026 - 18.12.2026
12. 04.01.2027 - 08.01.2027
13. 11.01.2027 - 15.01.2027
14. 18.01.2027 - 22.01.2027
15. 25.01.2027 - 29.01.2027

## Model grup

Aktualny plan ma cztery poziomy przypisania. Parser rozpoznaje łącznie 168 identyfikatorów:

| Poziom | Znaczenie | Liczba | Przykład |
| --- | --- | ---: | --- |
| MAIN | grupa główna/dziekańska | 14 | `MAIN:2` |
| G12 | grupa 12-osobowa | 28 | `G12:2A` |
| G8 | grupa 8-osobowa | 42 | `G8:2B` |
| G4 | grupa 4-osobowa | 84 | `G4:2B1` |

Dla planu zawierającego G4 użytkownik wskazuje grupę główną, jedną grupę 12-osobową oraz jedną grupę 4-osobową. Grupa G4 jednoznacznie określa odpowiadającą jej grupę G8, dlatego UI nie pokazuje G8 jako osobnego wyboru. W planach bez G4 wybór G8 pozostaje dostępny.

Przykład: jeśli osoba należy do grupy głównej 2, podziału 12-osobowego 2A oraz podziału 8-osobowego 2B, aplikacja nadal potrzebuje informacji, czy dokładną grupą 4-osobową jest `2B1` czy `2B2`. Tego nie wolno zgadywać.

## Mapa sekcji arkusza PLAN ZAJĘĆ

| Kolumny | Sekcja | Typ | Deklaracja | Model grup | Reguła czasu/dnia |
| --- | --- | --- | --- | --- | --- |
| B:J | CHIRURGIA I BLOK OPERACYJNY | zajęcia praktyczne | 80 godz. | źródłowe wpisy G8; nagłówek wspomina też blok G4 | zasadniczo pon.-pt. 08:00-14:00; J zawiera konkretne wtorki CSM 08:00-14:00 |
| K:AA | INTERNA | zajęcia praktyczne | 80 godz. | G8 | baza pon.-pt. 08:00-14:00, z wyłączeniem dni zajęć u prof. R. Steca; kolumny Steca mają jawne dni, ale brak pełnej godziny |
| AB:AP | PEDIATRIA | zajęcia praktyczne | 80 godz. | G4 | zasadniczo pon.-pt. 08:00-14:00; AP zawiera konkretne terminy CSM 08:00-14:00 |
| AQ:AV | Podst. Rehab. ćw. | ćwiczenia | 20 godz. | G12 | część układu ma stałe dni/godziny, a AQ7:AV7 zawiera dokładne grupy + daty + godziny + sale w jednej komórce |
| AW:BB | POZ | zajęcia praktyczne | 40 godz. | G4 | źródło przypisuje tygodnie/grupy, ale nie podaje wystarczająco jednoznacznego dnia i pełnych godzin - pozostaje REVIEW_REQUIRED |
| BC:BE | PROM. ZDROWIA | zajęcia praktyczne | 20 godz. | G8 | pon.-pt.; konkretne zakresy czasu w nagłówku, lokalizacje ograniczone do jawnych dni/dat |
| BF:BG | PROMOCJA ZDROWIA | seminaria | 10 godz. | MAIN | środa/piątek 15:00-18:45 według kolumn |
| BH:CW | POZ | seminaria | 15 godz. | MAIN | rozbudowana macierz pon.-pt. z trzema zakresami czasu; parser nie interpretuje narracyjnej tabeli sal jako zajęć |
| CX:CZ | POZ | ćwiczenia | 5 godz. | G12 | CX 08:00-11:45, CY 12:00-15:45, CZ 15:00-18:45; jawne dni/lokalizacje z nagłówków |
| DA:DC | FARMAKOLOGIA | seminaria | źródło bez osobnej liczby w nagłówku sekcji | MAIN | poniedziałek/wtorek/czwartek 10:15-14:00 |
| DD:DE | INTERNA | seminaria | 15 godz. | MAIN | środa 15:45-19:30 / piątek 15:15-19:00 |
| DF:DG | PEDIATRIA NZYN | seminaria | 10 godz. | MAIN | środa 15:30-19:15 / piątek 15:15-19:00 |
| DH:DI | INTERNA | seminaria | 10 godz. | MAIN | środa/piątek 15:15-19:00 |
| DJ:DK | CHIRURGIA | seminaria | 15 godz. | MAIN | środa/piątek 15:15-19:00 |

## Szczególne reguły i wyjątki

### Rehabilitacja AQ7:AV7

Te komórki nie są zwykłymi etykietami grup. Każda zawiera jednocześnie grupę, dokładną datę, pełny czas i salę. Muszą mieć pierwszeństwo przed tygodniem wiersza i nagłówkiem kolumny.

| Komórka | Grupa | Data | Godziny | Lokalizacja |
| --- | --- | --- | --- | --- |
| AQ7 | 10A | 05.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. Ciołka 27 |
| AR7 | 10B | 05.10.2026 | 08:00-11:00 | sala 102 ZPK, ul. Ciołka 27 |
| AS7 | 10A | 06.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. Ciołka 27 |
| AT7 | 10A | 07.10.2026 | 12:00-15:00 | sala 101 ZPK, ul. Ciołka 27 |
| AU7 | 10B | 08.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. Ciołka 27 |
| AV7 | 10B | 06.11.2026 | 08:00-14:00 | sala 101 ZPK, ul. Ciołka 27 |

AV7 jest szczególnie ważne: dokładna data 06.11 jest wpisana w komórce znajdującej się w wierszu tygodnia 05.10-09.10. Jest to jawny wyjątek źródłowy, a nie błąd do przesunięcia na 09.10.

### INTERNA - prof. R. Stec

Nagłówek bazowy K3 mówi `pon. - pt. 8.00 - 14.00 (bez dni, w których odbywają się zajęcia u Prof. R. Steca)`.

Kolumny związane z prof. R. Stecem podają jawne dni tygodnia, ale nie podają pełnego zakresu godzin. Nie wolno odziedziczyć dla nich 08:00-14:00 z bazy, ponieważ sama baza jawnie te dni wyłącza.

Skutek: 84 wpisy mają poprawną datę i lokalizację, ale pozostają `REVIEW_REQUIRED` bez czasu i nie są automatycznie zapisywane do kalendarza.

### POZ - zajęcia praktyczne

Nagłówek AW3 podaje jedynie, że pierwsze spotkanie to szkolenie RODO/BHP od 08:30 oraz że adresy jednostek zostaną opublikowane później. W samych tygodniach są przypisania grup, ale źródło nie rozstrzyga pełnego dnia i godzin.

Skutek: 84 wpisy G4 pozostają `REVIEW_REQUIRED`. Parser nie tworzy z nich fikcyjnych wydarzeń całodniowych ani nie wymyśla 08:30 jako pełnego zakresu.

### PROMOCJA ZDROWIA - lokalizacje zależne od dnia i daty

Reguły lokalizacji są zakresowe, nie globalne dla całej kolumny:

- BC: `pon. - sala 202 w NZA` - tylko poniedziałek,
- BD: `pt. - sala 202 w NZA` - tylko piątek,
- BE: poniedziałek `sala 126 w CD`,
- BE: piątki 16.10-30.10 `sala 210 w NZJ`,
- BE: piątki 06.11-29.01 `sala 104, ul. Litewska 14/16`.

Wtorek-czwartek nie dziedziczą sali z reguły piątkowej lub poniedziałkowej.

### POZ seminaria - narracyjna tabela sal

Duże scalenie w obszarze BI9:CV20 opisuje przypisania grup do sal. Nie jest to komórka przypisująca zajęcia i nie może generować dodatkowego wydarzenia.

W źródle występuje także przesunięte scalenie czasu przy CO/CQ. Jeśli zakres czasu nakłada się na dokładnie jeden jednoznaczny nagłówek dnia, parser może bezpiecznie odziedziczyć ten dzień. Dzięki temu CO7 `grupa 14` ma piątek 09.10.2026, 08:00-11:45 zamiast braku daty.

### POZ ćwiczenia - kody jednostek

- CX: środa, sala 210 w NZJ,
- CZ: piątek, sala 102 w NZN.

Jednoznaczne kody jednostek mogą zostać powiązane z pełnym adresem ze stopki, ale tylko gdy w źródle istnieje jedno unikalne dopasowanie. Dla tego pliku adres to ul. Ciołka 27.

### Literówka daty w stopce

W wierszu 57 źródło zawiera zapis `12.11.2025`. Dokument dotyczy semestru 2026/2027, ale parser nie poprawia tej daty na 2026 bez jednoznacznego sygnału w źródle. Jest to notatka źródłowa, nie podstawa do tworzenia syntetycznego wydarzenia.

## Wykłady

Wykłady są wspólne dla wszystkich grup (`groupScope=ALL`). Parser znalazł 22 rzeczywiste wpisy z godzinami.

### Wtorki - AULA B, Centrum Dydaktyczne, ul. Trojdena 2a

- 13.10.2026 - FARMAKOLOGIA - 15:00-17:15
- 21.10.2026 - brak wykładów
- 27.10.2026 - PEDIATRIA - 15:00-17:15
- 03.11.2026 - PEDIATRIA - 15:00-17:15
- 10.11.2026 - CHIRURGIA - 15:00-17:15
- 17.11.2026 - POZ - 15:00-17:15
- 24.11.2026 - POZ - 15:00-17:15
- 01.12.2026 - POZ - 15:00-17:15
- 08.12.2026 - POZ - 15:00-17:15
- 15.12.2026 - POZ - 15:00-17:15
- 05.01.2027 - POZ - 15:00-18:45 - Teams
- 12.01.2027 - CHIRURGIA - 15:00-17:15
- 19.01.2027 - CHIRURGIA - 15:00-16:30
- 26.01.2027 - brak wpisu wykładowego

Źródło informuje też, że Pediatria ma 6 godz. stacjonarnie i 44 godz. e-learning. E-learning bez konkretnych dat i godzin pozostaje informacją, nie wydarzeniami kalendarza.

### Czwartki - AULA A, Centrum Dydaktyczne, ul. Trojdena 2a

- 08.10.2026 - CHIRURGIA - 15:00-16:30
- 08.10.2026 - PROMOCJA ZDROWIA - 16:30-18:00
- 15.10.2026 - CHIRURGIA - 15:00-16:30
- 29.10.2026 - CHIRURGIA - 15:00-16:30
- 12.11.2026 - INTERNA - 15:00-18:45
- 19.11.2026 - INTERNA - 15:00-18:45
- 26.11.2026 - INTERNA - 15:00-18:45
- 17.12.2026 - INTERNA - 15:00-18:45
- 24.12.2026 - brak wykładów
- 11.12.2026 - brak wykładów w źródle
- 18.12.2026 - brak wykładów w źródle
- 07.01.2027 - INTERNA - 15:00-18:45
- 14.01.2027 - INTERNA - 15:00-18:45
- 21.01.2027 - brak wykładów

Źródło informuje, że Podstawy rehabilitacji mają 25 godz. na platformie e-learningowej. Bez konkretnych terminów nie są tworzone wydarzenia.

## Wynik parsera po poprawkach Build 131

Dla dokładnie tego pliku:

- adapter: `nursing-week-matrix-v2`,
- 15 tygodni,
- 861 źródłowych komórek przypisań grup,
- 861 bloków źródłowych,
- 2313 kandydatów łącznie,
- 2291 kandydatów grupowych,
- 22 wykłady wspólne,
- 2145 `READY`,
- 168 `REVIEW_REQUIRED`,
- 168 rozpoznanych identyfikatorów grup,
- 0 grup `GENERIC`,
- 0 nieprzetworzonych komórek przypisań,
- 0 podejrzanych wierszy grup poza tygodniami,
- 0 niepogodzonych wyjątków daty,
- completeness gate: `safe`,
- integrity gate: `safe`.

Wszystkie 168 wpisów `REVIEW_REQUIRED` wynika z jawnych braków źródła:

- 84 x INTERNA / prof. R. Stec - brak pełnego zakresu godzin,
- 84 x POZ zajęcia praktyczne - brak jednoznacznego dnia i pełnych godzin; część nie ma jeszcze jednoznacznej lokalizacji.

Nie są to wpisy do automatycznego zapisania w kalendarzu.

## Przykład walidacji grupy 2

Dla przykładowego wyboru:

- `MAIN:2`,
- `G12:2A`,
- `G4:2B1`,

wybór jest poprawny i automatycznie obejmuje zajęcia `G8:2B`. Parser zwraca 80 kandydatów dla tej osoby, z czego 77 jest `READY`, a 3 pozostają do weryfikacji źródła:

- INTERNA 22.10.2026 - brak pełnych godzin,
- INTERNA 23.10.2026 - brak pełnych godzin,
- POZ w tygodniu 04.01-08.01.2027 - brak dokładnego dnia/godzin/lokalizacji.

Jeżeli właściwa podgrupa użytkownika to `2B2`, wynik należy liczyć z `G4:2B2`; aplikacja nie może sama wybrać między `2B1` i `2B2`.

## Reguły, których nie wolno łamać przy kolejnych aktualizacjach parsera

- nie dziedziczyć godzin z nagłówka, który jawnie wyłącza dany wyjątek/prowadzącego,
- nie zamieniać czasu rozpoczęcia w pełny zakres godzin,
- nie rozciągać lokalizacji ograniczonej do konkretnego dnia/dat na inne dni,
- nie interpretować dużych narracyjnych tabel sal jako komórek zajęć,
- dokładna data wpisana w samej komórce grupy ma pierwszeństwo przed tygodniem wiersza,
- nie poprawiać literówek dat w źródle przez domysł,
- nie tworzyć wydarzeń dla e-learningu bez konkretnej daty i czasu,
- nie zgadywać podgrupy G4 użytkownika,
- brak źródłowej informacji ma pozostać jawnie niepełny, a nie zostać uzupełniony heurystyką.

## Build 134 - fingerprint i audyt jakości źródła

Build 134 nie zmienia parsera bieżącego planu. Dodaje warstwę QA, która ma odróżniać "parser wiernie odczytał źródło" od "źródło jest wewnętrznie spójne".

Aktywny plik:
- nazwa: `licencjat-ii-rok-piel.-18.09.2026.xls`,
- rozmiar: 147968 bajtów,
- SHA-256: `2f3a36e9f4ec2baa0b3962ac1c5f4b01a5adb03150955eabb7deacd6c7b9d363`,
- format: XLS.

Fingerprint jest częścią `CURRENT_STATE.json`. Ta sama nazwa pliku przy innym SHA-256 oznacza nowe źródło i wymaga ponownego audytu.

Deterministyczny audyt wykonany tym samym readerem i adapterem co aplikacja potwierdza:
- 861 bloków źródłowych,
- 2313 kandydatów,
- 2145 READY,
- 168 REVIEW_REQUIRED,
- 168 grup: MAIN 14, G12 28, G8 42, G4 84, GENERIC 0,
- 168 niepełnych bloków źródłowych,
- 0 nieprzetworzonych komórek przypisań,
- 0 niepogodzonych wyjątków daty,
- completeness `safe`,
- 16 nieblokujących anomalii bilansu godzin,
- 168 poprawnych kombinacji profilu MAIN + G12 + G4,
- 52 kombinacje z co najmniej jednym konfliktem godzin,
- 5 unikalnych sygnatur konfliktu,
- 3 rozbieżności daty z nagłówkiem dnia tygodnia.

`safe` oznacza, że parser nie wykrył blokującej utraty semantyki źródła. Nie oznacza, że uczelniany arkusz nie zawiera sprzeczności.

### 16 anomalii bilansu godzin

Wszystkie są `SOURCE_INCONSISTENT` i pozostają nieblokujące, ponieważ dotyczą deklaracji informacyjnych/advisory, a parser zachowuje konkretne terminy z arkusza.

- CHIRURGIA seminaria: MAIN 10, 11 i 12 - po 5 godz. odczytanych wobec deklarowanych 15 godz.,
- INTERNA seminaria: MAIN 10, 11 i 12 - po 5 godz. wobec deklarowanych 15 godz.,
- POZ ćw.: G12:2A - 10 godz. wobec deklarowanych 5 godz.; źródło zawiera dwa terminy tej grupy, 18.11.2026 i 16.12.2026,
- POZ seminaria: MAIN 2, 3 i 8 - po 12.33 godz. dydaktycznych wobec deklarowanych 15 godz.,
- POZ seminaria: MAIN 4, 5, 7, 9, 10 i 13 - po 13.67 godz. wobec deklarowanych 15 godz.

Nie wolno automatycznie usuwać drugiego terminu `G12:2A` ani wydłużać/skrócać seminariów w celu matematycznego dopasowania deklaracji. Konkretne daty i godziny mają pierwszeństwo przed bilansem opisowym.

### Konflikty godzin - pięć unikalnych sygnatur

Audyt enumeruje wszystkie 168 poprawnych kombinacji MAIN + G12 + G4 i liczy konflikty dopiero po filtrze pojedynczej osoby. Nie należy interpretować 52 kombinacji jako 52 faktycznych studentów.

- 08.10.2026 - CHIRURGIA 15:00-16:30 vs POZ seminaria 12:00-15:45 - dotyczy 36 kombinacji,
- 18.11.2026 - PEDIATRIA 08:00-14:00 vs POZ ćw. 12:00-15:45 - 2 kombinacje,
- 09.12.2026 - POZ ćw. 08:00-11:45 vs PROM. ZDROWIA 08:00-11:00 - 2 kombinacje,
- 08.01.2027 - INTERNA seminaria 15:15-19:00 vs PROMOCJA ZDROWIA seminaria 15:00-18:45 - 12 kombinacji,
- 13.01.2027 - INTERNA 08:00-14:00 vs POZ ćw. 08:00-11:45 - 2 kombinacje.

Konflikty są informacją QA. Parser nie przesuwa zajęć i nie usuwa jednego z nakładających się wpisów.

### Rozbieżności dnia tygodnia w arkuszu WYKŁADY

Audyt porównuje komórki zawierające samą datę z najbliższym nagłówkiem dnia tygodnia. W tym pliku wykrywa trzy rozbieżności:

- A5: `21.10.` znajduje się pod nagłówkiem WTORKI, ale 21.10.2026 to środa,
- A30: `11.12.` znajduje się pod nagłówkiem CZWARTKI, ale 11.12.2026 to piątek,
- A31: `18.12.` znajduje się pod nagłówkiem CZWARTKI, ale 18.12.2026 to piątek.

Wszystkie trzy wiersze mówią o braku wykładów, więc nie tworzą wydarzeń i nie wpływają na 22 rzeczywiste wpisy wykładowe. Nadal pozostają błędami jakości źródła.

### Powtarzalny audyt przyszłych planów

Kod: `src/study/study-source-audit.ts`.

Po zainstalowaniu zależności można uruchomić:

`IK_STUDY_XLS_PATH=<ścieżka_do_pliku> IK_STUDY_XLS_SHA256=<opcjonalny_oczekiwany_hash> npm run study:audit`

Runner używa produkcyjnego readera XLS/XLSX i produkcyjnego adapter registry. Nie ma osobnej logiki interpretacji planu. Nowy plan może zmienić liczby audytu; wtedy należy najpierw ustalić, czy jest to rzeczywista zmiana źródła, błąd parsera czy poprawna nowa struktura, a dopiero potem aktualizować `CURRENT_STATE.activeStudyAudit` i tę mapę.


## Release QA - Build 137

Aktywne źródło do lokalnej kontroli release: `licencjat-ii-rok-piel.-18.09.2026.xls`, SHA-256 `2f3a36e9f4ec2baa0b3962ac1c5f4b01a5adb03150955eabb7deacd6c7b9d363`, 147968 B. Plik nie jest dołączany do repozytorium ani checkpointu.

Produkcyny parser na tym źródle daje deterministycznie: 2313 kandydatów, 2145 READY, 168 REVIEW_REQUIRED, 168 grup, 861 bloków źródłowych, 16 anomalii bilansu godzin, 168 poprawnych kombinacji profili, 52 kombinacje z co najmniej jedną kolizją, 5 unikalnych sygnatur kolizji i 3 rozbieżności dnia tygodnia w źródle. Integrity pozostaje `safe`; brak nieprzetworzonych przypisań grup i brak niezaaplikowanych wyjątków daty.

Referencyjny profil QA `MAIN:10 + G12:10A + G4:10B2` nie jest ustawieniem domyślnym aplikacji. Służy wyłącznie jako regresja end-to-end obecnego źródła: 75 pozycji źródłowych, 72 importowalne, 3 niepełne, 0 konfliktów. Importowalne zajęcia rozkładają się na 21 w październiku 2026, 14 w listopadzie, 9 w grudniu i 28 w styczniu 2027.

Build 137 dodaje też fail-closed dla zduplikowanych `candidate.id`, zduplikowanych `sourceKey` i niespójnych referencji `StudySourceBlock -> candidate`. Są to reguły uniwersalne - nie zależą od nazw przedmiotów, grup ani tego semestru.

## Release QA - Build 138

Build 138 nie zmienia interpretacji arkusza. Dodaje powtarzalny mobile smoke prawdziwej ścieżki `XLS/XLSX -> wybór grup -> podgląd -> IndexedDB -> Kalendarz`.

Po uruchomieniu Vite na `http://127.0.0.1:5174`:

`npm run study:mobile-smoke -- --file="<ścieżka>/licencjat-ii-rok-piel.-18.09.2026.xls" --main=MAIN:10 --g12=G12:10A --g4=G4:10B2 --events=72 --incomplete=3`

Prywatny release reference dla tego źródła sprawdza `MAIN:10 + G12:10A + G4:10B2`, 72 importowalne wydarzenia i 3 wpisy niepełne na viewportach `390x844` oraz `360x800`. Wartości nie są zaszyte jako domyślne w runnerze. Sprawdza też, że G8 nie wraca jako ręczny wybór, gdy wybrana G4 jednoznacznie go wyznacza, oraz że zapisane dane w IndexedDB odpowiadają podglądowi. Screenshoty trafiają do `artifacts/visual-qa/study-mobile-smoke` i nie są częścią checkpointu.

Dla przyszłego planu oczekiwane grupy i liczby można podać argumentami `--main`, `--g12`, `--g4`, `--events`, `--incomplete`. Zmiana tych wartości jest zmianą oczekiwań testu dla konkretnego źródła, a nie zmianą reguł parsera. Runner ma failować, jeśli struktura interfejsu lub zapis danych nie pozwalają przejść tego samego rzeczywistego flow.



## Release QA - Build 139

Build 139 nie zmienia żadnej interpretacji planu. Naprawia runner `study:mobile-smoke` po realnym Windows QA, w którym natychmiastowe usuwanie tymczasowego profilu Chromium zwróciło `EPERM` i przez `finally` mogło zamaskować właściwy błąd wcześniejszego etapu.

Nowy cleanup najpierw wysyła `Browser.close`, czeka na zakończenie procesu, na Windows używa awaryjnego `taskkill /T /F`, a usuwanie profilu ma retry. Cleanup warning nie jest wynikiem funkcjonalnego smoke i nie może zastąpić pierwotnego wyjątku.

Dlatego run Build 138 nie jest dowodem PASS mimo dojścia do `390x844`. Wymagany jest ponowny run Build 139 i jawne:
- `STUDY_MOBILE_SMOKE_OK 390x844`,
- `STUDY_MOBILE_SMOKE_OK 360x800`,
- `STUDY_MOBILE_SMOKE_ALL_OK`.

## Build 142 - regresje uniwersalności przed PUBLIC

Pełny lokalny `npm run check` po zielonym mobile smoke ujawnił 10 wcześniejszych regresji parsera w syntetycznych wariantach planów. Build 142 naprawia je bez zmiany wyniku aktywnego źródła. Produkcyjny audyt `licencjat-ii-rok-piel.-18.09.2026.xls` pozostaje dokładnie: 2313 kandydatów, 2145 READY, 168 REVIEW_REQUIRED, 168 grup, 861 bloków, 16 anomalii godzin, 168 kombinacji profili, 52 kombinacje z konfliktem, 5 unikalnych sygnatur konfliktu i 3 rozbieżności dnia tygodnia. Profil `MAIN:10 + G12:10A + G4:10B2` pozostaje 75/72/3/0.

Dodatkowy regression proof na `licencjat-ii-rok-piel.-01.09.2026.xls` wykazał semantycznie identyczny zestaw grup i kandydatów względem Build 141. Naprawy dotyczą rozróżniania zakresów czasu/dat, małych kompletnych macierzy, priorytetu jawnego typu grupy, lokalnych reguł sal/adresów oraz odmiany nazw w stopkach - nie hardkodują aktywnego planu.
## Build 143 - domknięcie fail-closed na krawędzi pasma tygodni

Pełny lokalny `npm run check` Build 142 pozostawił jeden FAIL: uszkodzony pierwszy wiersz tygodnia z wieloma prawidłowymi przypisaniami grup był pomijany, bo diagnostyka podejrzanych wierszy działała tylko między pierwszym i ostatnim poprawnie rozpoznanym tygodniem. Build 143 wykrywa taki przypadek także na pierwszej lub ostatniej krawędzi, ale poza pasmem reaguje wyłącznie na wiele realnych przypisań grup połączonych z jawnym, nierozpoznawalnym sygnałem tygodnia. Zakres `8.00 - 14.00` sam w sobie nie jest takim sygnałem.

Focused proof obejmuje obie krawędzie (`A8` i `A10`). Aktywny `licencjat-ii-rok-piel.-18.09.2026.xls` nadal daje 2313 kandydatów, 2145 READY, 168 REVIEW_REQUIRED, 168 grup i 861 bloków; profil `MAIN:10 + G12:10A + G4:10B2` nadal daje 75/72/3/0. Starszy XLS 01.09.2026 pozostaje rozpoznawany bez podejrzanych nierozpoznanych wierszy tygodni.

