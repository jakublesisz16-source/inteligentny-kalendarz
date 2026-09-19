# Plan studiĂłw II rok - mapa ĹşrĂłdĹ‚a 18.09.2026

## Status dokumentu

To jest aktywna mapa referencyjna dla aktualnego planu przekazanego do projektu:

- plik ĹşrĂłdĹ‚owy: `licencjat-ii-rok-piel.-18.09.2026.xls`,
- kierunek: pielÄ™gniarstwo stacjonarne pierwszego stopnia,
- rok: II,
- semestr: zimowy 2026/2027,
- arkusz planu grupowego: `PLAN ZAJÄÄ†`, zakres `A1:DK73`,
- arkusz wykĹ‚adĂłw: `WYKĹADY`, zakres `A1:C34`.

Poprzednia mapa `STUDY_PLAN_III_2026_MAPPING.md` dotyczy wczeĹ›niej przekazanego pliku III roku i nie jest aktywnym ĹşrĂłdĹ‚em dla bieĹĽÄ…cego kalendarza.

## Zasada nadrzÄ™dna

Importer odwzorowuje wyĹ‚Ä…cznie dane, ktĂłre moĹĽna jednoznacznie wyprowadziÄ‡ ze ĹşrĂłdĹ‚a. Brak dnia, peĹ‚nego zakresu godzin lub jednoznacznego przypisania lokalizacji pozostaje oznaczony jako niepeĹ‚ny. Parser nie uzupeĹ‚nia takich danych przez domysĹ‚.

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

Aktualny plan ma cztery poziomy przypisania. Parser rozpoznaje Ĺ‚Ä…cznie 168 identyfikatorĂłw:

| Poziom | Znaczenie | Liczba | PrzykĹ‚ad |
| --- | --- | ---: | --- |
| MAIN | grupa gĹ‚Ăłwna/dziekaĹ„ska | 14 | `MAIN:2` |
| G12 | grupa 12-osobowa | 28 | `G12:2A` |
| G8 | grupa 8-osobowa | 42 | `G8:2B` |
| G4 | grupa 4-osobowa | 84 | `G4:2B1` |

Dla planu zawierajÄ…cego G4 uĹĽytkownik wskazuje grupÄ™ gĹ‚ĂłwnÄ…, jednÄ… grupÄ™ 12-osobowÄ… oraz jednÄ… grupÄ™ 4-osobowÄ…. Grupa G4 jednoznacznie okreĹ›la odpowiadajÄ…cÄ… jej grupÄ™ G8, dlatego UI nie pokazuje G8 jako osobnego wyboru. W planach bez G4 wybĂłr G8 pozostaje dostÄ™pny.

PrzykĹ‚ad: jeĹ›li osoba naleĹĽy do grupy gĹ‚Ăłwnej 2, podziaĹ‚u 12-osobowego 2A oraz podziaĹ‚u 8-osobowego 2B, aplikacja nadal potrzebuje informacji, czy dokĹ‚adnÄ… grupÄ… 4-osobowÄ… jest `2B1` czy `2B2`. Tego nie wolno zgadywaÄ‡.

## Mapa sekcji arkusza PLAN ZAJÄÄ†

| Kolumny | Sekcja | Typ | Deklaracja | Model grup | ReguĹ‚a czasu/dnia |
| --- | --- | --- | --- | --- | --- |
| B:J | CHIRURGIA I BLOK OPERACYJNY | zajÄ™cia praktyczne | 80 godz. | ĹşrĂłdĹ‚owe wpisy G8; nagĹ‚Ăłwek wspomina teĹĽ blok G4 | zasadniczo pon.-pt. 08:00-14:00; J zawiera konkretne wtorki CSM 08:00-14:00 |
| K:AA | INTERNA | zajÄ™cia praktyczne | 80 godz. | G8 | baza pon.-pt. 08:00-14:00, z wyĹ‚Ä…czeniem dni zajÄ™Ä‡ u prof. R. Steca; kolumny Steca majÄ… jawne dni, ale brak peĹ‚nej godziny |
| AB:AP | PEDIATRIA | zajÄ™cia praktyczne | 80 godz. | G4 | zasadniczo pon.-pt. 08:00-14:00; AP zawiera konkretne terminy CSM 08:00-14:00 |
| AQ:AV | Podst. Rehab. Ä‡w. | Ä‡wiczenia | 20 godz. | G12 | czÄ™Ĺ›Ä‡ ukĹ‚adu ma staĹ‚e dni/godziny, a AQ7:AV7 zawiera dokĹ‚adne grupy + daty + godziny + sale w jednej komĂłrce |
| AW:BB | POZ | zajÄ™cia praktyczne | 40 godz. | G4 | ĹşrĂłdĹ‚o przypisuje tygodnie/grupy, ale nie podaje wystarczajÄ…co jednoznacznego dnia i peĹ‚nych godzin - pozostaje REVIEW_REQUIRED |
| BC:BE | PROM. ZDROWIA | zajÄ™cia praktyczne | 20 godz. | G8 | pon.-pt.; konkretne zakresy czasu w nagĹ‚Ăłwku, lokalizacje ograniczone do jawnych dni/dat |
| BF:BG | PROMOCJA ZDROWIA | seminaria | 10 godz. | MAIN | Ĺ›roda/piÄ…tek 15:00-18:45 wedĹ‚ug kolumn |
| BH:CW | POZ | seminaria | 15 godz. | MAIN | rozbudowana macierz pon.-pt. z trzema zakresami czasu; parser nie interpretuje narracyjnej tabeli sal jako zajÄ™Ä‡ |
| CX:CZ | POZ | Ä‡wiczenia | 5 godz. | G12 | CX 08:00-11:45, CY 12:00-15:45, CZ 15:00-18:45; jawne dni/lokalizacje z nagĹ‚ĂłwkĂłw |
| DA:DC | FARMAKOLOGIA | seminaria | ĹşrĂłdĹ‚o bez osobnej liczby w nagĹ‚Ăłwku sekcji | MAIN | poniedziaĹ‚ek/wtorek/czwartek 10:15-14:00 |
| DD:DE | INTERNA | seminaria | 15 godz. | MAIN | Ĺ›roda 15:45-19:30 / piÄ…tek 15:15-19:00 |
| DF:DG | PEDIATRIA NZYN | seminaria | 10 godz. | MAIN | Ĺ›roda 15:30-19:15 / piÄ…tek 15:15-19:00 |
| DH:DI | INTERNA | seminaria | 10 godz. | MAIN | Ĺ›roda/piÄ…tek 15:15-19:00 |
| DJ:DK | CHIRURGIA | seminaria | 15 godz. | MAIN | Ĺ›roda/piÄ…tek 15:15-19:00 |

## SzczegĂłlne reguĹ‚y i wyjÄ…tki

### Rehabilitacja AQ7:AV7

Te komĂłrki nie sÄ… zwykĹ‚ymi etykietami grup. KaĹĽda zawiera jednoczeĹ›nie grupÄ™, dokĹ‚adnÄ… datÄ™, peĹ‚ny czas i salÄ™. MuszÄ… mieÄ‡ pierwszeĹ„stwo przed tygodniem wiersza i nagĹ‚Ăłwkiem kolumny.

| KomĂłrka | Grupa | Data | Godziny | Lokalizacja |
| --- | --- | --- | --- | --- |
| AQ7 | 10A | 05.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. CioĹ‚ka 27 |
| AR7 | 10B | 05.10.2026 | 08:00-11:00 | sala 102 ZPK, ul. CioĹ‚ka 27 |
| AS7 | 10A | 06.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. CioĹ‚ka 27 |
| AT7 | 10A | 07.10.2026 | 12:00-15:00 | sala 101 ZPK, ul. CioĹ‚ka 27 |
| AU7 | 10B | 08.10.2026 | 08:00-14:00 | sala 101 ZPK, ul. CioĹ‚ka 27 |
| AV7 | 10B | 06.11.2026 | 08:00-14:00 | sala 101 ZPK, ul. CioĹ‚ka 27 |

AV7 jest szczegĂłlnie waĹĽne: dokĹ‚adna data 06.11 jest wpisana w komĂłrce znajdujÄ…cej siÄ™ w wierszu tygodnia 05.10-09.10. Jest to jawny wyjÄ…tek ĹşrĂłdĹ‚owy, a nie bĹ‚Ä…d do przesuniÄ™cia na 09.10.

### INTERNA - prof. R. Stec

NagĹ‚Ăłwek bazowy K3 mĂłwi `pon. - pt. 8.00 - 14.00 (bez dni, w ktĂłrych odbywajÄ… siÄ™ zajÄ™cia u Prof. R. Steca)`.

Kolumny zwiÄ…zane z prof. R. Stecem podajÄ… jawne dni tygodnia, ale nie podajÄ… peĹ‚nego zakresu godzin. Nie wolno odziedziczyÄ‡ dla nich 08:00-14:00 z bazy, poniewaĹĽ sama baza jawnie te dni wyĹ‚Ä…cza.

Skutek: 84 wpisy majÄ… poprawnÄ… datÄ™ i lokalizacjÄ™, ale pozostajÄ… `REVIEW_REQUIRED` bez czasu i nie sÄ… automatycznie zapisywane do kalendarza.

### POZ - zajÄ™cia praktyczne

NagĹ‚Ăłwek AW3 podaje jedynie, ĹĽe pierwsze spotkanie to szkolenie RODO/BHP od 08:30 oraz ĹĽe adresy jednostek zostanÄ… opublikowane pĂłĹşniej. W samych tygodniach sÄ… przypisania grup, ale ĹşrĂłdĹ‚o nie rozstrzyga peĹ‚nego dnia i godzin.

Skutek: 84 wpisy G4 pozostajÄ… `REVIEW_REQUIRED`. Parser nie tworzy z nich fikcyjnych wydarzeĹ„ caĹ‚odniowych ani nie wymyĹ›la 08:30 jako peĹ‚nego zakresu.

### PROMOCJA ZDROWIA - lokalizacje zaleĹĽne od dnia i daty

ReguĹ‚y lokalizacji sÄ… zakresowe, nie globalne dla caĹ‚ej kolumny:

- BC: `pon. - sala 202 w NZA` - tylko poniedziaĹ‚ek,
- BD: `pt. - sala 202 w NZA` - tylko piÄ…tek,
- BE: poniedziaĹ‚ek `sala 126 w CD`,
- BE: piÄ…tki 16.10-30.10 `sala 210 w NZJ`,
- BE: piÄ…tki 06.11-29.01 `sala 104, ul. Litewska 14/16`.

Wtorek-czwartek nie dziedziczÄ… sali z reguĹ‚y piÄ…tkowej lub poniedziaĹ‚kowej.

### POZ seminaria - narracyjna tabela sal

DuĹĽe scalenie w obszarze BI9:CV20 opisuje przypisania grup do sal. Nie jest to komĂłrka przypisujÄ…ca zajÄ™cia i nie moĹĽe generowaÄ‡ dodatkowego wydarzenia.

W ĹşrĂłdle wystÄ™puje takĹĽe przesuniÄ™te scalenie czasu przy CO/CQ. JeĹ›li zakres czasu nakĹ‚ada siÄ™ na dokĹ‚adnie jeden jednoznaczny nagĹ‚Ăłwek dnia, parser moĹĽe bezpiecznie odziedziczyÄ‡ ten dzieĹ„. DziÄ™ki temu CO7 `grupa 14` ma piÄ…tek 09.10.2026, 08:00-11:45 zamiast braku daty.

### POZ Ä‡wiczenia - kody jednostek

- CX: Ĺ›roda, sala 210 w NZJ,
- CZ: piÄ…tek, sala 102 w NZN.

Jednoznaczne kody jednostek mogÄ… zostaÄ‡ powiÄ…zane z peĹ‚nym adresem ze stopki, ale tylko gdy w ĹşrĂłdle istnieje jedno unikalne dopasowanie. Dla tego pliku adres to ul. CioĹ‚ka 27.

### LiterĂłwka daty w stopce

W wierszu 57 ĹşrĂłdĹ‚o zawiera zapis `12.11.2025`. Dokument dotyczy semestru 2026/2027, ale parser nie poprawia tej daty na 2026 bez jednoznacznego sygnaĹ‚u w ĹşrĂłdle. Jest to notatka ĹşrĂłdĹ‚owa, nie podstawa do tworzenia syntetycznego wydarzenia.

## WykĹ‚ady

WykĹ‚ady sÄ… wspĂłlne dla wszystkich grup (`groupScope=ALL`). Parser znalazĹ‚ 22 rzeczywiste wpisy z godzinami.

### Wtorki - AULA B, Centrum Dydaktyczne, ul. Trojdena 2a

- 13.10.2026 - FARMAKOLOGIA - 15:00-17:15
- 21.10.2026 - brak wykĹ‚adĂłw
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
- 26.01.2027 - brak wpisu wykĹ‚adowego

ĹąrĂłdĹ‚o informuje teĹĽ, ĹĽe Pediatria ma 6 godz. stacjonarnie i 44 godz. e-learning. E-learning bez konkretnych dat i godzin pozostaje informacjÄ…, nie wydarzeniami kalendarza.

### Czwartki - AULA A, Centrum Dydaktyczne, ul. Trojdena 2a

- 08.10.2026 - CHIRURGIA - 15:00-16:30
- 08.10.2026 - PROMOCJA ZDROWIA - 16:30-18:00
- 15.10.2026 - CHIRURGIA - 15:00-16:30
- 29.10.2026 - CHIRURGIA - 15:00-16:30
- 12.11.2026 - INTERNA - 15:00-18:45
- 19.11.2026 - INTERNA - 15:00-18:45
- 26.11.2026 - INTERNA - 15:00-18:45
- 17.12.2026 - INTERNA - 15:00-18:45
- 24.12.2026 - brak wykĹ‚adĂłw
- 11.12.2026 - brak wykĹ‚adĂłw w ĹşrĂłdle
- 18.12.2026 - brak wykĹ‚adĂłw w ĹşrĂłdle
- 07.01.2027 - INTERNA - 15:00-18:45
- 14.01.2027 - INTERNA - 15:00-18:45
- 21.01.2027 - brak wykĹ‚adĂłw

ĹąrĂłdĹ‚o informuje, ĹĽe Podstawy rehabilitacji majÄ… 25 godz. na platformie e-learningowej. Bez konkretnych terminĂłw nie sÄ… tworzone wydarzenia.

## Wynik parsera po poprawkach Build 131

Dla dokĹ‚adnie tego pliku:

- adapter: `nursing-week-matrix-v2`,
- 15 tygodni,
- 861 ĹşrĂłdĹ‚owych komĂłrek przypisaĹ„ grup,
- 861 blokĂłw ĹşrĂłdĹ‚owych,
- 2313 kandydatĂłw Ĺ‚Ä…cznie,
- 2291 kandydatĂłw grupowych,
- 22 wykĹ‚ady wspĂłlne,
- 2145 `READY`,
- 168 `REVIEW_REQUIRED`,
- 168 rozpoznanych identyfikatorĂłw grup,
- 0 grup `GENERIC`,
- 0 nieprzetworzonych komĂłrek przypisaĹ„,
- 0 podejrzanych wierszy grup poza tygodniami,
- 0 niepogodzonych wyjÄ…tkĂłw daty,
- completeness gate: `safe`,
- integrity gate: `safe`.

Wszystkie 168 wpisĂłw `REVIEW_REQUIRED` wynika z jawnych brakĂłw ĹşrĂłdĹ‚a:

- 84 x INTERNA / prof. R. Stec - brak peĹ‚nego zakresu godzin,
- 84 x POZ zajÄ™cia praktyczne - brak jednoznacznego dnia i peĹ‚nych godzin; czÄ™Ĺ›Ä‡ nie ma jeszcze jednoznacznej lokalizacji.

Nie sÄ… to wpisy do automatycznego zapisania w kalendarzu.

## PrzykĹ‚ad walidacji grupy 2

Dla przykĹ‚adowego wyboru:

- `MAIN:2`,
- `G12:2A`,
- `G4:2B1`,

wybĂłr jest poprawny i automatycznie obejmuje zajÄ™cia `G8:2B`. Parser zwraca 80 kandydatĂłw dla tej osoby, z czego 77 jest `READY`, a 3 pozostajÄ… do weryfikacji ĹşrĂłdĹ‚a:

- INTERNA 22.10.2026 - brak peĹ‚nych godzin,
- INTERNA 23.10.2026 - brak peĹ‚nych godzin,
- POZ w tygodniu 04.01-08.01.2027 - brak dokĹ‚adnego dnia/godzin/lokalizacji.

JeĹĽeli wĹ‚aĹ›ciwa podgrupa uĹĽytkownika to `2B2`, wynik naleĹĽy liczyÄ‡ z `G4:2B2`; aplikacja nie moĹĽe sama wybraÄ‡ miÄ™dzy `2B1` i `2B2`.

## ReguĹ‚y, ktĂłrych nie wolno Ĺ‚amaÄ‡ przy kolejnych aktualizacjach parsera

- nie dziedziczyÄ‡ godzin z nagĹ‚Ăłwka, ktĂłry jawnie wyĹ‚Ä…cza dany wyjÄ…tek/prowadzÄ…cego,
- nie zamieniaÄ‡ czasu rozpoczÄ™cia w peĹ‚ny zakres godzin,
- nie rozciÄ…gaÄ‡ lokalizacji ograniczonej do konkretnego dnia/dat na inne dni,
- nie interpretowaÄ‡ duĹĽych narracyjnych tabel sal jako komĂłrek zajÄ™Ä‡,
- dokĹ‚adna data wpisana w samej komĂłrce grupy ma pierwszeĹ„stwo przed tygodniem wiersza,
- nie poprawiaÄ‡ literĂłwek dat w ĹşrĂłdle przez domysĹ‚,
- nie tworzyÄ‡ wydarzeĹ„ dla e-learningu bez konkretnej daty i czasu,
- nie zgadywaÄ‡ podgrupy G4 uĹĽytkownika,
- brak ĹşrĂłdĹ‚owej informacji ma pozostaÄ‡ jawnie niepeĹ‚ny, a nie zostaÄ‡ uzupeĹ‚niony heurystykÄ….

## Build 134 - fingerprint i audyt jakoĹ›ci ĹşrĂłdĹ‚a

Build 134 nie zmienia parsera bieĹĽÄ…cego planu. Dodaje warstwÄ™ QA, ktĂłra ma odrĂłĹĽniaÄ‡ "parser wiernie odczytaĹ‚ ĹşrĂłdĹ‚o" od "ĹşrĂłdĹ‚o jest wewnÄ™trznie spĂłjne".

Aktywny plik:
- nazwa: `licencjat-ii-rok-piel.-18.09.2026.xls`,
- rozmiar: 147968 bajtĂłw,
- SHA-256: `2f3a36e9f4ec2baa0b3962ac1c5f4b01a5adb03150955eabb7deacd6c7b9d363`,
- format: XLS.

Fingerprint jest czÄ™Ĺ›ciÄ… `CURRENT_STATE.json`. Ta sama nazwa pliku przy innym SHA-256 oznacza nowe ĹşrĂłdĹ‚o i wymaga ponownego audytu.

Deterministyczny audyt wykonany tym samym readerem i adapterem co aplikacja potwierdza:
- 861 blokĂłw ĹşrĂłdĹ‚owych,
- 2313 kandydatĂłw,
- 2145 READY,
- 168 REVIEW_REQUIRED,
- 168 grup: MAIN 14, G12 28, G8 42, G4 84, GENERIC 0,
- 168 niepeĹ‚nych blokĂłw ĹşrĂłdĹ‚owych,
- 0 nieprzetworzonych komĂłrek przypisaĹ„,
- 0 niepogodzonych wyjÄ…tkĂłw daty,
- completeness `safe`,
- 16 nieblokujÄ…cych anomalii bilansu godzin,
- 168 poprawnych kombinacji profilu MAIN + G12 + G4,
- 52 kombinacje z co najmniej jednym konfliktem godzin,
- 5 unikalnych sygnatur konfliktu,
- 3 rozbieĹĽnoĹ›ci daty z nagĹ‚Ăłwkiem dnia tygodnia.

`safe` oznacza, ĹĽe parser nie wykryĹ‚ blokujÄ…cej utraty semantyki ĹşrĂłdĹ‚a. Nie oznacza, ĹĽe uczelniany arkusz nie zawiera sprzecznoĹ›ci.

### 16 anomalii bilansu godzin

Wszystkie sÄ… `SOURCE_INCONSISTENT` i pozostajÄ… nieblokujÄ…ce, poniewaĹĽ dotyczÄ… deklaracji informacyjnych/advisory, a parser zachowuje konkretne terminy z arkusza.

- CHIRURGIA seminaria: MAIN 10, 11 i 12 - po 5 godz. odczytanych wobec deklarowanych 15 godz.,
- INTERNA seminaria: MAIN 10, 11 i 12 - po 5 godz. wobec deklarowanych 15 godz.,
- POZ Ä‡w.: G12:2A - 10 godz. wobec deklarowanych 5 godz.; ĹşrĂłdĹ‚o zawiera dwa terminy tej grupy, 18.11.2026 i 16.12.2026,
- POZ seminaria: MAIN 2, 3 i 8 - po 12.33 godz. dydaktycznych wobec deklarowanych 15 godz.,
- POZ seminaria: MAIN 4, 5, 7, 9, 10 i 13 - po 13.67 godz. wobec deklarowanych 15 godz.

Nie wolno automatycznie usuwaÄ‡ drugiego terminu `G12:2A` ani wydĹ‚uĹĽaÄ‡/skrĂłcaÄ‡ seminariĂłw w celu matematycznego dopasowania deklaracji. Konkretne daty i godziny majÄ… pierwszeĹ„stwo przed bilansem opisowym.

### Konflikty godzin - piÄ™Ä‡ unikalnych sygnatur

Audyt enumeruje wszystkie 168 poprawnych kombinacji MAIN + G12 + G4 i liczy konflikty dopiero po filtrze pojedynczej osoby. Nie naleĹĽy interpretowaÄ‡ 52 kombinacji jako 52 faktycznych studentĂłw.

- 08.10.2026 - CHIRURGIA 15:00-16:30 vs POZ seminaria 12:00-15:45 - dotyczy 36 kombinacji,
- 18.11.2026 - PEDIATRIA 08:00-14:00 vs POZ Ä‡w. 12:00-15:45 - 2 kombinacje,
- 09.12.2026 - POZ Ä‡w. 08:00-11:45 vs PROM. ZDROWIA 08:00-11:00 - 2 kombinacje,
- 08.01.2027 - INTERNA seminaria 15:15-19:00 vs PROMOCJA ZDROWIA seminaria 15:00-18:45 - 12 kombinacji,
- 13.01.2027 - INTERNA 08:00-14:00 vs POZ Ä‡w. 08:00-11:45 - 2 kombinacje.

Konflikty sÄ… informacjÄ… QA. Parser nie przesuwa zajÄ™Ä‡ i nie usuwa jednego z nakĹ‚adajÄ…cych siÄ™ wpisĂłw.

### RozbieĹĽnoĹ›ci dnia tygodnia w arkuszu WYKĹADY

Audyt porĂłwnuje komĂłrki zawierajÄ…ce samÄ… datÄ™ z najbliĹĽszym nagĹ‚Ăłwkiem dnia tygodnia. W tym pliku wykrywa trzy rozbieĹĽnoĹ›ci:

- A5: `21.10.` znajduje siÄ™ pod nagĹ‚Ăłwkiem WTORKI, ale 21.10.2026 to Ĺ›roda,
- A30: `11.12.` znajduje siÄ™ pod nagĹ‚Ăłwkiem CZWARTKI, ale 11.12.2026 to piÄ…tek,
- A31: `18.12.` znajduje siÄ™ pod nagĹ‚Ăłwkiem CZWARTKI, ale 18.12.2026 to piÄ…tek.

Wszystkie trzy wiersze mĂłwiÄ… o braku wykĹ‚adĂłw, wiÄ™c nie tworzÄ… wydarzeĹ„ i nie wpĹ‚ywajÄ… na 22 rzeczywiste wpisy wykĹ‚adowe. Nadal pozostajÄ… bĹ‚Ä™dami jakoĹ›ci ĹşrĂłdĹ‚a.

### Powtarzalny audyt przyszĹ‚ych planĂłw

Kod: `src/study/study-source-audit.ts`.

Po zainstalowaniu zaleĹĽnoĹ›ci moĹĽna uruchomiÄ‡:

`IK_STUDY_XLS_PATH=<Ĺ›cieĹĽka_do_pliku> IK_STUDY_XLS_SHA256=<opcjonalny_oczekiwany_hash> npm run study:audit`

Runner uĹĽywa produkcyjnego readera XLS/XLSX i produkcyjnego adapter registry. Nie ma osobnej logiki interpretacji planu. Nowy plan moĹĽe zmieniÄ‡ liczby audytu; wtedy naleĹĽy najpierw ustaliÄ‡, czy jest to rzeczywista zmiana ĹşrĂłdĹ‚a, bĹ‚Ä…d parsera czy poprawna nowa struktura, a dopiero potem aktualizowaÄ‡ `CURRENT_STATE.activeStudyAudit` i tÄ™ mapÄ™.


## Release QA - Build 137

Aktywne ĹşrĂłdĹ‚o do lokalnej kontroli release: `licencjat-ii-rok-piel.-18.09.2026.xls`, SHA-256 `2f3a36e9f4ec2baa0b3962ac1c5f4b01a5adb03150955eabb7deacd6c7b9d363`, 147968 B. Plik nie jest doĹ‚Ä…czany do repozytorium ani checkpointu.

Produkcyny parser na tym ĹşrĂłdle daje deterministycznie: 2313 kandydatĂłw, 2145 READY, 168 REVIEW_REQUIRED, 168 grup, 861 blokĂłw ĹşrĂłdĹ‚owych, 16 anomalii bilansu godzin, 168 poprawnych kombinacji profili, 52 kombinacje z co najmniej jednÄ… kolizjÄ…, 5 unikalnych sygnatur kolizji i 3 rozbieĹĽnoĹ›ci dnia tygodnia w ĹşrĂłdle. Integrity pozostaje `safe`; brak nieprzetworzonych przypisaĹ„ grup i brak niezaaplikowanych wyjÄ…tkĂłw daty.

Referencyjny profil QA `MAIN:10 + G12:10A + G4:10B2` nie jest ustawieniem domyĹ›lnym aplikacji. SĹ‚uĹĽy wyĹ‚Ä…cznie jako regresja end-to-end obecnego ĹşrĂłdĹ‚a: 75 pozycji ĹşrĂłdĹ‚owych, 72 importowalne, 3 niepeĹ‚ne, 0 konfliktĂłw. Importowalne zajÄ™cia rozkĹ‚adajÄ… siÄ™ na 21 w paĹşdzierniku 2026, 14 w listopadzie, 9 w grudniu i 28 w styczniu 2027.

Build 137 dodaje teĹĽ fail-closed dla zduplikowanych `candidate.id`, zduplikowanych `sourceKey` i niespĂłjnych referencji `StudySourceBlock -> candidate`. SÄ… to reguĹ‚y uniwersalne - nie zaleĹĽÄ… od nazw przedmiotĂłw, grup ani tego semestru.

## Release QA - Build 138

Build 138 nie zmienia interpretacji arkusza. Dodaje powtarzalny mobile smoke prawdziwej Ĺ›cieĹĽki `XLS/XLSX -> wybĂłr grup -> podglÄ…d -> IndexedDB -> Kalendarz`.

Po uruchomieniu Vite na `http://127.0.0.1:5174`:

`npm run study:mobile-smoke -- --file="<Ĺ›cieĹĽka>/licencjat-ii-rok-piel.-18.09.2026.xls" --main=MAIN:10 --g12=G12:10A --g4=G4:10B2 --events=72 --incomplete=3`

Prywatny release reference dla tego ĹşrĂłdĹ‚a sprawdza `MAIN:10 + G12:10A + G4:10B2`, 72 importowalne wydarzenia i 3 wpisy niepeĹ‚ne na viewportach `390x844` oraz `360x800`. WartoĹ›ci nie sÄ… zaszyte jako domyĹ›lne w runnerze. Sprawdza teĹĽ, ĹĽe G8 nie wraca jako rÄ™czny wybĂłr, gdy wybrana G4 jednoznacznie go wyznacza, oraz ĹĽe zapisane dane w IndexedDB odpowiadajÄ… podglÄ…dowi. Screenshoty trafiajÄ… do `artifacts/visual-qa/study-mobile-smoke` i nie sÄ… czÄ™Ĺ›ciÄ… checkpointu.

Dla przyszĹ‚ego planu oczekiwane grupy i liczby moĹĽna podaÄ‡ argumentami `--main`, `--g12`, `--g4`, `--events`, `--incomplete`. Zmiana tych wartoĹ›ci jest zmianÄ… oczekiwaĹ„ testu dla konkretnego ĹşrĂłdĹ‚a, a nie zmianÄ… reguĹ‚ parsera. Runner ma failowaÄ‡, jeĹ›li struktura interfejsu lub zapis danych nie pozwalajÄ… przejĹ›Ä‡ tego samego rzeczywistego flow.



## Release QA - Build 139

Build 139 nie zmienia ĹĽadnej interpretacji planu. Naprawia runner `study:mobile-smoke` po realnym Windows QA, w ktĂłrym natychmiastowe usuwanie tymczasowego profilu Chromium zwrĂłciĹ‚o `EPERM` i przez `finally` mogĹ‚o zamaskowaÄ‡ wĹ‚aĹ›ciwy bĹ‚Ä…d wczeĹ›niejszego etapu.

Nowy cleanup najpierw wysyĹ‚a `Browser.close`, czeka na zakoĹ„czenie procesu, na Windows uĹĽywa awaryjnego `taskkill /T /F`, a usuwanie profilu ma retry. Cleanup warning nie jest wynikiem funkcjonalnego smoke i nie moĹĽe zastÄ…piÄ‡ pierwotnego wyjÄ…tku.

Dlatego run Build 138 nie jest dowodem PASS mimo dojĹ›cia do `390x844`. Wymagany jest ponowny run Build 139 i jawne:
- `STUDY_MOBILE_SMOKE_OK 390x844`,
- `STUDY_MOBILE_SMOKE_OK 360x800`,
- `STUDY_MOBILE_SMOKE_ALL_OK`.

## Build 142 - regresje uniwersalnoĹ›ci przed PUBLIC

PeĹ‚ny lokalny `npm run check` po zielonym mobile smoke ujawniĹ‚ 10 wczeĹ›niejszych regresji parsera w syntetycznych wariantach planĂłw. Build 142 naprawia je bez zmiany wyniku aktywnego ĹşrĂłdĹ‚a. Produkcyjny audyt `licencjat-ii-rok-piel.-18.09.2026.xls` pozostaje dokĹ‚adnie: 2313 kandydatĂłw, 2145 READY, 168 REVIEW_REQUIRED, 168 grup, 861 blokĂłw, 16 anomalii godzin, 168 kombinacji profili, 52 kombinacje z konfliktem, 5 unikalnych sygnatur konfliktu i 3 rozbieĹĽnoĹ›ci dnia tygodnia. Profil `MAIN:10 + G12:10A + G4:10B2` pozostaje 75/72/3/0.

Dodatkowy regression proof na `licencjat-ii-rok-piel.-01.09.2026.xls` wykazaĹ‚ semantycznie identyczny zestaw grup i kandydatĂłw wzglÄ™dem Build 141. Naprawy dotyczÄ… rozrĂłĹĽniania zakresĂłw czasu/dat, maĹ‚ych kompletnych macierzy, priorytetu jawnego typu grupy, lokalnych reguĹ‚ sal/adresĂłw oraz odmiany nazw w stopkach - nie hardkodujÄ… aktywnego planu.
## Build 143 - domkniÄ™cie fail-closed na krawÄ™dzi pasma tygodni

PeĹ‚ny lokalny `npm run check` Build 142 pozostawiĹ‚ jeden FAIL: uszkodzony pierwszy wiersz tygodnia z wieloma prawidĹ‚owymi przypisaniami grup byĹ‚ pomijany, bo diagnostyka podejrzanych wierszy dziaĹ‚aĹ‚a tylko miÄ™dzy pierwszym i ostatnim poprawnie rozpoznanym tygodniem. Build 143 wykrywa taki przypadek takĹĽe na pierwszej lub ostatniej krawÄ™dzi, ale poza pasmem reaguje wyĹ‚Ä…cznie na wiele realnych przypisaĹ„ grup poĹ‚Ä…czonych z jawnym, nierozpoznawalnym sygnaĹ‚em tygodnia. Zakres `8.00 - 14.00` sam w sobie nie jest takim sygnaĹ‚em.

Focused proof obejmuje obie krawÄ™dzie (`A8` i `A10`). Aktywny `licencjat-ii-rok-piel.-18.09.2026.xls` nadal daje 2313 kandydatĂłw, 2145 READY, 168 REVIEW_REQUIRED, 168 grup i 861 blokĂłw; profil `MAIN:10 + G12:10A + G4:10B2` nadal daje 75/72/3/0. Starszy XLS 01.09.2026 pozostaje rozpoznawany bez podejrzanych nierozpoznanych wierszy tygodni.
