# Cycle prediction model 0.4.0

Model `cycle-v1` jest lokalnym, deterministycznym modelem opisującym wyłącznie historię zapisanych początków miesiączek. Nie jest modelem diagnostycznym i nie wykorzystuje danych innych użytkowniczek.

## Dane wejściowe

Źródłem prawdy są `CyclePeriod.startDate`. Długość pełnego cyklu jest liczona jako liczba lokalnych dni kalendarzowych pomiędzy kolejnymi rzeczywistymi `startDate`. `endDate` służy wyłącznie do historii krwawienia i nie zmienia długości cyklu.

Nie ma ukrytej wartości 28 dni. Przy 0-1 pełnym cyklu model zwraca `UNAVAILABLE`. Przy 2-3 może zwrócić `PRELIMINARY`. Standardowy szacunek wymaga co najmniej 4 pełnych obserwacji, ale sama liczba obserwacji nie gwarantuje wiarygodnego wyniku.

## Luki w obserwacji

Nietypowo długi odstęp może być `POSSIBLE_MISSED_LOG`. Nierozstrzygnięty odstęp nie trafia do `completedCycleLengths`. Użytkowniczka może dodać brakujący wpis, potwierdzić `CONFIRMED_SINGLE_CYCLE` albo wybrać `OBSERVATION_BREAK`.

`OBSERVATION_BREAK` zachowuje obie prawdziwe daty, ale wyłącza odstęp z uczenia, robust spread, walk-forward calibration i change detection. Decyzja jest przypisana do relacji poprzedni start -> bieżący start przez `previousGapDecision`. Zmiana dat lub sąsiedztwa wpisów unieważnia decyzję dla zmienionej relacji.

Po `OBSERVATION_BREAK` starsza poprawna historia może nadal wspierać szacunek, ale dopóki po przerwie nie pojawią się co najmniej dwa nowe pełne cykle, UI wymusza niską wiarygodność. Sama przerwa nie jest traktowana jako biologiczna zmienność.

## Center i recency

Bieżące centrum jest `weighted median`. Nowsze pełne cykle otrzymują umiarkowanie większą wagę przez jawny `RECENCY_DECAY`. Przy dobrze podpartej możliwej zmianie wzorca decay jest zwiększany w stronę najnowszych obserwacji, ale starsza historia nie jest kasowana.

## Zmienność i niepewność

Bazowa zmienność używa `weighted MAD * 1.4826`. Drugim składnikiem jest rzeczywisty historyczny błąd walk-forward. Finalna szerokość niepewności jest jedną ścieżką:

`max(sampleSizeFloor, robustSpread, walkForwardMedianAbsoluteError, sparseRangeGuard)`

Dla 2-3 pełnych cykli `sampleSizeFloor` jest większy, a `sparseRangeGuard` chroni przed fałszywie wąskim wynikiem, gdy bardzo mała historia zawiera skrajnie różne długości. Po osiągnięciu standardowego progu te zabezpieczenia nie zastępują rzeczywistego robust spread i walk-forward error. Nie ma niezależnego mnożenia tej samej anomalii przez spread + surprise + regime multiplier. `observationSurprise` służy głównie do diagnostics, reliability i wyjaśnienia.

## Walk-forward calibration

Dla historycznego targetu `L5` model może korzystać tylko z `L1-L4`. Nie wolno używać `L5` ani przyszłych obserwacji. Z prób powstają absolute error oraz informacja, czy target znalazłby się w primary/wide window.

## Rozkład i okna

Wewnętrzny rozkład jest deterministycznym dyskretnym rozkładem wokół robust center z szerokością wynikającą z final uncertainty. UI 0.4.0 celowo nie pokazuje procentów. Z rozkładu powstają ciągłe `PRIMARY WINDOW` i `WIDE WINDOW`.

Po minięciu `WIDE WINDOW` model nie przesuwa dat codziennie. Wynik staje się `EXPIRED`/niepewny, ponieważ brak nowego wpisu może oznaczać zarówno późniejszą miesiączkę, jak i pominięte logowanie.

## Reliability

UI używa tylko `Niska`, `Umiarkowana`, `Wyższa`. Reliability uwzględnia liczbę pełnych cykli, final uncertainty, walk-forward sample count, recent surprise i possible shift. Wysoka zmienność może dać `UNRELIABLE` nawet przy dużej liczbie miesięcy.

## Possible shift

Pojedynczy outlier nie uruchamia zmiany wzorca. `POSSIBLE_SHIFT` wymaga wystarczająco dużej historii łącznie, minimum trzech ostatnich obserwacji wspierających kierunek oraz wcześniejszej grupy porównawczej. Przy małej historii model jedynie zwiększa ostrożność.

## Atypical flag

`isUserMarkedAtypical` jest metadanym użytkowniczki i NIE zmienia matematycznej wagi obserwacji. To zabezpieczenie przed confirmation bias. Robust statistics odpowiadają za odporność modelu.

## Anti-fixture tuning

Parametry modelu nie mogą być dobierane pod pojedyncze syntetyczne sekwencje testowe. Testy mają sprawdzać właściwości i rodziny perturbacji: podobne outliery, podobne przesunięcia, 2x/3x luki oraz stabilność wobec niewielkiej zmiany parametrów. Dokładna data okna nie jest snapshotem, jeśli testowana właściwość tego nie wymaga.

## Ograniczenia

Model opisuje wyłącznie zapisane daty. Nie zna przyczyn zmian, nie przewiduje owulacji, dni płodnych ani ciąży. Im mniej kompletna historia, tym mniejsza wiarygodność. `OBSERVATION_BREAK` pozwala jawnie oddzielić jakość danych od biologicznej zmienności.

## Izolacja Dziennika Cyklu od modelu w 0.6.0

Nowy `CycleJournalEntry` nie jest wejściem `cycle-v1`. `predictNextPeriod()` nadal korzysta wyłącznie z `CyclePeriod` i dotychczasowych decyzji jakości historii. Krwawienie, ból, samopoczucie i notatka z Dziennika nie zmieniają wag, median, spread, statusu, reliability ani okien prognozy.

## Izolacja Własnych wzorców od modelu w 0.6.1

`CyclePatternSummary` nie jest wejściem `cycle-v1`. `buildCyclePatternSummary()` opisuje wyłącznie przeszłe zapisy i nie jest wywoływane przez `predictNextPeriod()`. Wyniki takie jak typowa długość miesiączki, najczęstsze krwawienie, ból lub samopoczucie nie zmieniają median długości cyklu, spread, walk-forward, reliability, statusów ani okien prognozy.

## Izolacja informacji o leku przeciwbólowym w 0.6.2

`CycleJournalEntry.painMedicationTaken` NIE jest wejściem `cycle-v1`. Odpowiedź `Tak`, `Nie` albo brak odpowiedzi nie zmienia `predictNextPeriod()`, median długości cyklu, spread, walk-forward, reliability, statusów ani okien prognozy.



## Warstwa derived 0.6.3

`CycleOvulationEstimate` jest warstwą pochodną nad gotowym `CyclePrediction` i NIE zmienia `cycle-v1`. `predictNextPeriod()` nadal ma te same wejścia, parametry, statusy, reliability, diagnostics i okna. Helper 0.6.3 może jedynie odczytać `READY + MODERATE/HIGHER + primaryWindow`; nie przekazuje żadnych danych z powrotem do modelu.
