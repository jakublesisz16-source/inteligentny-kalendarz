# Szacowane okno możliwej owulacji 0.6.3

## Czym jest

0.6.3 dodaje małą, lokalną warstwę derived nad istniejącym `CyclePrediction`. Nie wykrywa rzeczywistej owulacji. Jeżeli `cycle-v1` zwróci `READY`, `primaryWindow` i reliability `MODERATE` lub `HIGHER`, helper `deriveOvulationEstimate()` pokazuje jeden szeroki zakres możliwej owulacji.

Przepływ jest jednokierunkowy:

`CyclePeriod -> cycle-v1 -> CyclePrediction -> deriveOvulationEstimate -> UI`

Dziennik Cyklu, `painMedicationTaken`, Własne wzorce i notatki nie są wejściem tego obliczenia.

## Reguła dat

Produkt używa jawnego, szerokiego założenia kalendarzowego: możliwa owulacja może przypadać około 10-16 dni przed kolejną miesiączką. Dla `primaryWindow`:

- początek estimate = `primaryWindow.startDate - 16 dni`,
- koniec estimate = `primaryWindow.endDate - 10 dni`.

Wynikiem jest zawsze zakres. Nie wyznacza się pojedynczego `estimatedOvulationDate`, nie używa 14. dnia cyklu i nie istnieje 28-dniowy fallback.

## Gating

Daty są dostępne tylko dla `READY + MODERATE/HIGHER + primaryWindow`. `LOW`, `PRELIMINARY`, `UNAVAILABLE`, `UNRELIABLE`, `EXPIRED` i brak `primaryWindow` dają `UNAVAILABLE`.

## Twarde granice

Estimate:

- nie potwierdza owulacji,
- nie tworzy fertile window ani "dni płodnych",
- nie oznacza "bezpiecznych dni",
- nie podaje prawdopodobieństwa ciąży,
- nie jest metodą antykoncepcji,
- nie rekomenduje współżycia ani planowania ciąży,
- nie korzysta z BBT, LH, śluzu szyjkowego ani innych danych biologicznych,
- nie jest zapisywany w IndexedDB, backupie ani Data Transfer,
- nie generuje Web Push.

UI pokazuje: `To tylko szacunek kalendarzowy. Nie potwierdza owulacji i nie służy do wyznaczania bezpiecznych dni ani jako metoda antykoncepcji.`

## Źródła granic produktu

Granice produktu oparto na ogólnych informacjach edukacyjnych i ostrożności opisanej przez:

- NHS - Periods and fertility in the menstrual cycle,
- NHS - Natural family planning,
- U.S. Office on Women's Health - Ovulation calculator.

Źródła te są podstawą ostrożnego języka produktu, a nie mechanizmem diagnozy ani indywidualnego potwierdzania owulacji.
