# Odporność modelu Cykl 0.4.0

## 1. Jeden nietypowy miesiąc

Sekwencja podobna do `29, 30, 29, 30, 41` zachowuje 41 jako prawdziwą obserwację. Robust center nie skacze do nowej wartości, a walk-forward error i reliability zwiększają ostrożność. Jeden wynik nie jest sam w sobie `POSSIBLE_SHIFT`.

## 2. Powrót do wcześniejszego wzorca

Po `...41, 29, 30, 29` nietypowy cykl nadal istnieje w historii, ale najnowsze stabilniejsze dane pozwalają stopniowo odbudować reliability. Model nie pozostaje permanentnie rozszerzony tylko z powodu jednego dawnego odstępstwa.

## 3. Trwała zmiana wzorca

Seria kilku kolejnych cykli przesuniętych w tym samym kierunku może uruchomić `POSSIBLE_SHIFT`, ale dopiero przy wystarczającej historii po obu stronach porównania. Wtedy rośnie znaczenie recent data. Starsze rekordy nie są kasowane.

## 4. Wysoka zmienność

Jeżeli długości pozostają bardzo zmienne, model może zwrócić `UNRELIABLE`. Brak wąskiej prognozy jest poprawnym zachowaniem, nie awarią.

## 5. Pominięty wpis

Gap bliski wielokrotności własnego typowego cyklu może zostać oznaczony jako `POSSIBLE_MISSED_LOG`. Model niczego nie dodaje automatycznie i nie używa nierozstrzygniętego gapu do uczenia.

## 6. Kilka potencjalnie pominiętych wpisów

Przy typowym cyklu około 30 dni również gap około 90 dni jest traktowany jako sygnał niepełnej historii, nie jako dowód dokładnie dwóch brakujących miesiączek. Użytkowniczka może dodać tyle wpisów, ile faktycznie pamięta.

## 7. Observation break

Jeśli obie skrajne daty są prawdziwe, ale historia pomiędzy nimi jest niepełna, `OBSERVATION_BREAK` zachowuje daty i wyłącza cały odstęp z biologicznego modelu. Dzięki temu np. półroczna przerwa w korzystaniu z aplikacji nie tworzy sztucznego 180-dniowego cyklu.

## 8. Potwierdzony długi cykl

`CONFIRMED_SINGLE_CYCLE` oznacza świadomą decyzję użytkowniczki, że długi odstęp jest jedną realną obserwacją. Wtedy model zachowuje go jako cycle length i może obniżyć reliability.

## 9. Edycja dat

`previousGapDecision` dotyczy konkretnej pary sąsiadów. Edycja startDate, wstawienie nowego okresu między wpisami lub usunięcie sąsiada powoduje unieważnienie decyzji dla zmienionych relacji.

## 10. Brak endDate

Brak końca oznacza wyłącznie `Koniec nieuzupełniony`. Nie jest dowodem, że miesiączka nadal trwa.

## 11. Minięcie prediction window

Po minięciu wide window wynik wygasa. Model nie przesuwa okna o dzień każdego dnia, ponieważ brak nowego logu nie jest jednoznaczną informacją biologiczną.

## 12. Model odmawia prognozy

`UNAVAILABLE` i `UNRELIABLE` są pełnoprawnymi wynikami. Priorytetem jest brak fałszywej precyzji.
