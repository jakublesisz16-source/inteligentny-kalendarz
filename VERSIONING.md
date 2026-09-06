# Wersjonowanie Inteligentnego Kalendarza

Aplikacja używa wyłącznie prostego numerowania SemVer.

- Kandydat do wydania: `X.Y.Z-rc.N`, np. `1.1.0-rc.11`.
- Wydanie stabilne: `X.Y.Z`, np. `1.1.0`.
- Mała poprawka bez nowych funkcji: zwiększ `Z`, np. `1.1.1`.
- Nowe funkcje zgodne wstecz: zwiększ `Y` i wyzeruj `Z`, np. `1.2.0`.
- Duża niezgodna zmiana produktu lub danych: zwiększ `X`.

Oznaczenia developerskie typu `DEV`, `FIX`, `GATE`, `BLOCKER` mogą występować wyłącznie w prywatnych raportach technicznych. Nie są częścią numeru aplikacji, nazwy publicznej paczki ani interfejsu użytkownika.

W Ustawieniach użytkownik widzi tylko numer wersji, numer schematu bazy i informację o trybie lokalnym.
