# Granice zdrowotne modułu Cykl 0.4.0

Moduł jest osobistym trackerem historii miesiączek i lokalnym narzędziem do szacowania kolejnego możliwego początku na podstawie własnych zapisanych danych.

- Cykl jest liczony od pierwszego dnia jednej miesiączki do pierwszego dnia kolejnej.
- Model nie używa 28 dni jako indywidualnej domyślnej wartości.
- Szacunek nie jest diagnozą ani obietnicą biologiczną.
- Moduł nie wskazuje przyczyny nietypowego cyklu.
- `isUserMarkedAtypical` nie jest diagnozą i nie zmienia matematycznej wagi obserwacji.
- Moduł nie przewiduje owulacji, dni płodnych ani "bezpiecznych dni".
- Moduł nie jest metodą antykoncepcji.
- Moduł nie przewiduje ciąży.
- W 0.4.0 UI nie pokazuje liczbowych procentów prawdopodobieństwa, ponieważ indywidualna historia jest małym zbiorem danych i nie chcemy sugerować kalibracji lepszej niż rzeczywiście posiadamy.
- Więcej zapisanych miesięcy daje więcej informacji, ale nie gwarantuje węższego zakresu. Większa zmienność może obniżyć wiarygodność.
- Model może świadomie nie pokazać użytecznej prognozy.
- `POSSIBLE_MISSED_LOG` i `OBSERVATION_BREAK` dotyczą jakości historii danych, nie stanu zdrowia.

Jeżeli coś w cyklu budzi niepokój zdrowotny, właściwym źródłem oceny jest profesjonalista medyczny, a nie sam kalendarz.

## Rozszerzenie granic w 0.6.0

Dziennik Cyklu zapisuje wyłącznie własne obserwacje użytkowniczki: krwawienie, ból, samopoczucie i krótką notatkę. Nie klasyfikuje obserwacji jako normalnych lub nieprawidłowych, nie diagnozuje, nie przypisuje przyczyn i nie generuje zaleceń medycznych. Dane Dziennika nie wpływają w 0.6.0 na prognozę miesiączki. Analiza wzorców i owulacja pozostają poza zakresem tej wersji.

## Rozszerzenie granic w 0.6.1

`Własne wzorce` są wyłącznie opisem zapisanej historii. Mogą pokazać medianę długości zakończonych miesiączek oraz najczęściej zapisaną wartość krwawienia, bólu lub samopoczucia przy wystarczającej liczbie obserwacji. Nie oceniają, czy wynik jest normalny lub nieprawidłowy, nie wskazują przyczyn, nie przewidują przyszłych objawów i nie generują porad zdrowotnych.

Analizie nie podlega treść notatek. Wzorce nie wpływają na `cycle-v1` i nie dodają owulacji, fertile window ani bezpiecznych dni.

## Rozszerzenie granic w 0.6.2

Dziennik może opcjonalnie zapisać wyłącznie fakt `Lek przeciwbólowy: Tak / Nie`. Aplikacja nie ocenia, czy lek był konieczny, nie zapisuje nazwy, dawki ani godziny, nie rekomenduje preparatu i nie generuje reminderów lekowych. Pole jest niezależne od poziomu bólu - aplikacja nie wyciąga wniosków z kombinacji tych odpowiedzi.

`painMedicationTaken` nie jest analizowane przez Własne wzorce 0.6.1 i nie wpływa na prognozę `cycle-v1`.



## Rozszerzenie granic w 0.6.3

0.6.3 może pokazać wyłącznie szerokie, kalendarzowe `Możliwe okno owulacji` pochodne od stabilnej prognozy następnej miesiączki. Estimate nie wykrywa ani nie potwierdza owulacji. Nie tworzy fertile window, dni płodnych, bezpiecznych dni, probability ciąży ani zaleceń dotyczących antykoncepcji lub współżycia. Nie używa BBT, LH, śluzu szyjkowego, bólu, plamienia, notatek, `painMedicationTaken` ani Własnych wzorców. Wynik może być niedostępny i nigdy nie jest przedstawiany jako pojedynczy pewny dzień.
