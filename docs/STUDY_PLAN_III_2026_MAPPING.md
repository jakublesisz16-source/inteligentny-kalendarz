# Plan studiów III rok pielęgniarstwo - mapa źródła 18.09.2026

> **Status: historyczny.** Ten dokument dotyczy wcześniej przekazanego pliku III roku. Aktualnym źródłem projektu od Build 131 jest `licencjat-ii-rok-piel.-18.09.2026.xls`; aktywna mapa znajduje się w `STUDY_PLAN_II_2026_MAPPING.md`.


Dokument opisuje strukturę źródłowego pliku `licencjat-iii-rok-piel.-18.09.2026.xlsx` i reguły, które importer ma zachować. To mapa referencyjna do QA oraz przyszłych zmian parsera, a nie zestaw danych zakodowanych na sztywno w aplikacji.

## 1. Struktura skoroszytu

Skoroszyt ma dwa istotne arkusze:

- `PLAN ZAJĘĆ` - zakres `A1:BC51`, plan grupowy tygodniami,
- `WYKŁADY` - zakres `A1:C33`, wykłady w konkretnych datach i godzinach.

W `PLAN ZAJĘĆ`:

- wiersz 1 - tytuł III roku, semestr zimowy 2026/2027,
- wiersze 2-6 - wielowierszowe i częściowo scalone nagłówki przedmiotów, typów zajęć, prowadzących, dni, godzin i lokalizacji,
- wiersze 7-21 - 15 tygodni planu,
- wiersze 22+ - stopki, lokalizacje, dopiski i legenda grup,
- wiersz 23 zawiera globalną legendę poziomów grup.

Tygodnie:

1. 05.10-09.10.2026
2. 12.10-16.10.2026
3. 19.10-23.10.2026
4. 26.10-30.10.2026
5. 02.11-06.11.2026
6. 09.11-13.11.2026
7. 16.11-20.11.2026
8. 23.11-27.11.2026
9. 30.11-04.12.2026
10. 07.12-11.12.2026
11. 14.12-18.12.2026
12. 04.01-08.01.2027
13. 11.01-15.01.2027
14. 18.01-22.01.2027
15. 25.01-29.01.2027

## 2. Model grup

Źródło podaje jedną globalną legendę:

- seminaria - grupy dziekańskie po 24 osoby - `MAIN`, grupy 1-12,
- ćwiczenia - 1/2 grupy dziekańskiej po 12 osób - `G12`, grupy 1a/1b ... 12a/12b,
- zajęcia praktyczne - 1/3 grupy dziekańskiej po 8 osób - `G8`, grupy 1a/1b/1c ... 12a/12b/12c.

Pełny model daje 72 odrębne oznaczenia: 12 MAIN + 24 G12 + 36 G8. Gwiazdki przy grupach, np. `4b*`, `6a **`, `1a***`, są przypisami źródła, a nie częścią identyfikatora grupy.

## 3. Mapa PLAN ZAJĘĆ

| Kolumny | Przedmiot / typ | Typowy termin | Grupy | Lokalizacja / reguła źródła |
| --- | --- | --- | --- | --- |
| B:E | GERIATRIA - zajęcia praktyczne - Prof. B. Czarkowska-Pączek | pon-pt 08:00-14:00 | G8 | B: ZOL Mehoffera 72/74; C:D Bonifraterskie Centrum Medyczne, Sapieżyńska 3; E: Ciołka 27, sala 101. W E mogą występować jawne wyjątki daty. |
| F:J | GERIATRIA - zajęcia praktyczne - dr hab. Ł. Czyżewski | pon-pt, źródło zapisuje m.in. `8.00.- 14.00.`; H/J 12:00-18:00 | G8 | F:G Ośrodek oo. Bonifratrów, Sapieżyńska 3; H/J Ciołka 27; I ZOL Mehoffera 72/74. H/J mogą mieć jawne wyjątki. |
| K:M | NEUROLOGIA - zajęcia praktyczne - dr hab. D. Koziorowski | pon-pt 08:00-14:00 | G8 | Klinika Neurologii WNoZ, Kondratowicza 8. |
| N:P | NEUROLOGIA - zajęcia praktyczne - prof. A. Kostera-Pruszczyk | pon-pt, jawny start 07:30 | G8 | Banacha 1a. Jawna godzina źródła ma pierwszeństwo przed ogólnym nagłówkiem. |
| Q:S | PSYCHIATRIA - zajęcia praktyczne - prof. A. Szulc | pon-pt 08:00-14:00 | G8 | Źródło podaje Partyzantów 2/4 tylko jako `pierwsze spotkanie`. Lokalizacja dotyczy wyłącznie pierwszego terminu danego bloku; kolejnych dni nie wolno uzupełniać przez domysł. |
| T | PSYCHIATRIA - zajęcia praktyczne - prof. T. Wolańczyk | pon-pt 08:00-14:00 | G8 | Klinika Psychiatrii Wieku Rozwojowego, Żwirki i Wigury 63a - stała lokalizacja. |
| U | PSYCHIATRIA - zajęcia praktyczne - dr hab. A. Silczuk | pon-pt 08:00-14:00 | G8 | Brak jednoznacznej lokalizacji w źródle - pozostawić jako brak danych / ostrzeżenie. |
| V | PSYCHIATRIA - zajęcia praktyczne - prof. A. Szulc | pon-pt 08:00-14:00 | G8 | Taka sama reguła `pierwsze spotkanie` jak Q:S. |
| W:X | GINEKOLOGIA - zajęcia praktyczne - prof. A. Ludwin | pon-pt, jawny start 07:00 | G8 | Pl. Starynkiewicza 1/3. |
| Y | GINEKOLOGIA - zajęcia praktyczne - prof. P. Węgrzyn | pon-pt | G8 | Żwirki i Wigury 63a. |
| Z:AA | GINEKOLOGIA - zajęcia praktyczne - prof. K. Czajkowski | pon-pt | G8 | Karowa 2. |
| AB | GINEKOLOGIA - zajęcia praktyczne - prof. A. Ludwin | pon-pt | G8 | Kontekst prof. Ludwina, zgodnie z lokalnymi nagłówkami/stopką. |
| AC:AE | ANESTEZJOLOGIA - zajęcia praktyczne | pon-pt 08:00-14:00 | G8 | AC Stępińska 19/25; AD Św. Wincentego 103; AE Cegłowska 80. Gwiazdki przy grupach są przypisami. |
| AF | ANESTEZJOLOGIA - CSM | piątek 08:00-14:00 | G8 | Pawińskiego 3a. W analizowanym pliku brak faktycznych tygodniowych przypisań grup do AF. |
| AG | OPIEKA PALIATYWNA - zajęcia praktyczne | pon-pt 08:00-14:00 | G8 | Hospicjum Ursynów, Pileckiego 105. |
| AH:AI | OPIEKA PALIATYWNA - zajęcia praktyczne | pon-pt 08:00-14:00 | G8 | Rezydencja Antonina, Czajewicza 23A, Piaseczno. |
| AJ | GERIATRIA - seminaria | poniedziałek 08:30-12:15 | MAIN | Stopka podaje dwa możliwe miejsca bez jednoznacznego przypisania do konkretnej grupy/dat. Nie zgadywać lokalizacji. |
| AK | GERIATRIA - seminaria | wtorek 15:00-18:45 | MAIN | Microsoft Teams - jawna lokalizacja zdalna z nagłówka. |
| AL | GERIATRIA - seminaria | czwartek 08:30-12:15 | MAIN | Stopka podaje dwa możliwe miejsca bez jednoznacznego przypisania. Nie zgadywać. |
| AM | NEUROLOGIA - seminaria | piątek 09:00-12:45 | MAIN | Klinika Neurologii WNoZ, ul. Kondratowicza 8 - stopka jawnie mówi, że w tej lokalizacji odbywają się zarówno zajęcia praktyczne, jak i seminaria wszystkich grup dziekańskich. |
| AN | PSYCHIATRIA - seminaria | poniedziałek 15:00-18:45 | MAIN | Mazowieckie Centrum Zdrowia, Partyzantów 2/4, Oddział 2SK - lokalizacja jest bezpośrednio w nagłówku przedmiotu. |
| AO:AP | OPIEKA PALIATYWNA - seminaria | pon/wt 15:00-18:45 | MAIN | Sala 3.DE 003, Szpital Pediatryczny, Żwirki i Wigury 63a. |
| AQ:AU | ZDROWIE PUBLICZNE - seminaria | pon/wt/pt 15:00-18:45 | MAIN | Sale 3 AH 001 / 5 DE 003 zgodnie z konkretną kolumną. |
| AV:AY | RATOWNICTWO MEDYCZNE - ćwiczenia | pon/wt 15:00-18:45 | G12 | Litewska 14/16, sale ćwiczeń 218/219. |
| AZ:BC | ZDROWIE PUBLICZNE - ćwiczenia | pon/wt/pt 15:00-18:45 | G12 | Sale 4 DE 002 / 4 DE 003 nr 1 zgodnie z konkretną kolumną. |

## 4. WYKŁADY

Arkusz wykładów zawiera 52 komórki z pełnymi godzinami.

Sekcja środowa - aula im. Prof. A. Grucy, ul. Lindleya 4:

- 07.10 - Neurologia 16:15-18:30; Psychiatria 18:30-20:00,
- 14.10, 21.10, 28.10 - Neurologia 16:15-18:30; Podstawy Ratownictwa 18:30-20:00,
- 04.11, 18.11, 25.11 - Neurologia 16:15-18:30; Geriatria 18:30-20:00,
- 02.12, 09.12, 16.12, 13.01, 20.01 - Neurologia 16:15-18:30; Zdrowie Publiczne 18:30-20:00,
- 27.01 - Neurologia 16:15-17:45.

Sekcja czwartkowa - Aula im. Prof. W. Grzywo-Dąbrowskiego, ul. Oczki 1:

- 08.10 - Ginekologia 15:00-17:15; Geriatria 17:15-19:30,
- 15.10, 22.10, 29.10 - Ginekologia 15:00-17:15; Anestezjologia 17:15-18:45,
- 05.11 - Ginekologia 15:00-17:15; Zdrowie Publiczne 17:15-18:45,
- 12.11, 19.11, 26.11, 03.12 - Geriatria 15:00-17:15; Zdrowie Publiczne 17:15-18:45,
- 10.12 - Geriatria 15:00-17:15; Podstawy Ratownictwa 17:15-18:45,
- 17.12 - Ginekologia 15:00-16:30; Podstawy Ratownictwa 16:30-18:00,
- 07.01 - Ginekologia 15:00-16:30; Geriatria 16:30-19:30,
- 14.01, 21.01, 28.01 - Ginekologia 15:00-16:30.

Źródłowa literówka `Drhab` nie może powodować dołączenia nazwiska prowadzącego do nazwy przedmiotu.

## 5. Reguły bezpieczeństwa importu

Importer ma zachować następujące zasady:

- dokładny lokalny dzień, czas, adres lub sala ma pierwszeństwo przed szerszym nagłówkiem sekcji,
- zapis czasu z kropkami, także z końcową kropką (`8.00. - 14.00.`), jest pełnoprawnym zakresem czasu,
- jawne przesunięcie startu, np. 07:00 lub 07:30, jest źródłem prawdy; matematyczny audyt godzin może wtedy być ostrzeżeniem, ale nie może nadpisać źródła,
- gwiazdki po grupie są przypisem i nie zmieniają tożsamości grupy,
- typ grupy wynika z typu zajęć i globalnej legendy, nie z samej litery `a/b/c`,
- `pierwsze spotkanie` nigdy nie może być rozszerzone na wszystkie spotkania ani na innego prowadzącego; przy kursie zajmującym dwa kolejne tygodnie lokalizacja dotyczy tylko najwcześniejszego terminu danej grupy, a nie pierwszego dnia każdego tygodnia,
- jeśli źródło podaje dwie możliwe lokalizacje bez mapowania do konkretnego terminu, importer pozostawia lokalizację nieustaloną,
- brak lokalizacji jest ostrzeżeniem nieblokującym, jeżeli przedmiot, grupa, dzień i pełne godziny są jednoznaczne,
- brak lub sprzeczność dnia/godzin/grupy/przedmiotu ma pozostać do sprawdzenia i nie może być zgadywana.

## 6. Oczekiwany wynik parsera dla pliku 18.09.2026

Po poprawnym rozpoznaniu całego źródła:

- 15 tygodni planu,
- 611 bloków źródłowych,
- 72 grupy: 12 MAIN + 24 G12 + 36 G8,
- 2103 kandydatów wydarzeń,
- z tego 2051 wpisów grupowych i 52 wykłady,
- 0 brakujących przedmiotów,
- 0 brakujących dat w rozpoznanych wpisach,
- 0 brakujących pełnych zakresów godzin,
- 0 nieprzetworzonych komórek przypisań,
- 0 niepogodzonych wyjątków daty,
- kontrola kompletności `safe`.

Ostrzeżenia o lokalizacji są oczekiwane tam, gdzie źródło nie rozstrzyga miejsca jednoznacznie. Przykładowo kolejne dni bloku prof. A. Szulca po pierwszym spotkaniu oraz zajęcia dr hab. A. Silczuk nie powinny dostać wymyślonego adresu.

## 7. Kontrola rozkładu po parserze

Rozkład 2103 kandydatów po poprawnym odczycie źródła:

| Przedmiot / typ | Liczba wydarzeń | Liczba grup | Uwagi |
| --- | ---: | ---: | --- |
| Geriatria - zajęcia praktyczne | 360 | 36 G8 | 10 dni na grupę; godziny 08:00-14:00 lub lokalnie 12:00-18:00. |
| Neurologia - zajęcia praktyczne | 360 | 36 G8 | 10 dni na grupę; część grup ma jawny start 07:30. |
| Psychiatria - zajęcia praktyczne | 360 | 36 G8 | 10 dni na grupę; część lokalizacji celowo pozostaje nieustalona. |
| Ginekologia - zajęcia praktyczne | 360 | 36 G8 | 10 dni na grupę; u prof. A. Ludwina jawny start 07:00. |
| Anestezjologia - zajęcia praktyczne | 180 | 36 G8 | 5 dni na grupę; CSM nie ma w tym pliku tygodniowych przypisań grup. |
| Opieka paliatywna - zajęcia praktyczne | 180 | 36 G8 | 5 dni na grupę. |
| Geriatria - seminaria | 36 | 12 MAIN | 3 spotkania na grupę; wtorki są online w Microsoft Teams. |
| Neurologia - seminaria | 12 | 12 MAIN | 1 spotkanie na grupę, Klinika Neurologii WNoZ, Kondratowicza 8. |
| Psychiatria - seminaria | 12 | 12 MAIN | 1 spotkanie na grupę. |
| Opieka paliatywna - seminaria | 24 | 12 MAIN | 2 spotkania na grupę. |
| Zdrowie publiczne - seminaria | 72 | 12 MAIN | 6 spotkań na grupę. |
| Ratownictwo medyczne - ćwiczenia | 48 | 24 G12 | 2 spotkania na grupę. |
| Zdrowie publiczne - ćwiczenia | 47 | 24 G12 | źródło daje 47 wpisów; dla G12:11B widoczny jest tylko jeden blok 5G mimo deklaracji 10G - importer nie dopisuje brakującego terminu. |
| Wykłady | 52 | wszyscy | 52 jawne terminy z arkusza `WYKŁADY`. |

Po poprawkach parser rozpoznaje również jawne `Teams` jako lokalizację zdalną i wiąże seminaria Neurologii z Kondratowicza 8, ponieważ źródło podaje tę lokalizację wprost dla zajęć praktycznych i seminariów.

## 8. Niejednoznaczności źródła, których nie wolno automatycznie poprawiać

- 291 kandydatów pozostaje bez fizycznej lokalizacji. Nie wynika to z błędu parsera: są to głównie kolejne dni Psychiatrii po jednorazowym `pierwszym spotkaniu`, zajęcia dr hab. A. Silczuk bez podanego miejsca oraz poniedziałkowe/czwartkowe seminaria Geriatrii, dla których źródło podaje dwie możliwe lokalizacje bez mapowania do konkretnego terminu.
- 34 audyty godzin są informacyjnie `SOURCE_INCONSISTENT`, ale nie blokują importu. Dotyczy to głównie jawnych przesunięć startu do 07:00/07:30, które mają pierwszeństwo przed arytmetycznym przeliczeniem godzin dydaktycznych, oraz pojedynczego niepełnego układu Zdrowia Publicznego G12:11B.
- Nie wolno syntetyzować brakującego drugiego spotkania G12:11B ani wybierać jednej z dwóch lokalizacji seminarium Geriatrii.
- Importer ma zachować dokładnie źródłowe daty i godziny nawet wtedy, gdy sumaryczne `G` nie zgadza się idealnie z czasem zegarowym.
