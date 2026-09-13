# Prywatność

## Local-first

Inteligentny Kalendarz przechowuje dane aplikacji lokalnie w IndexedDB przeglądarki. Aplikacja nie wymaga konta użytkownika ani własnego backendu do przechowywania kalendarza, planu studiów, grafiku, finansów, zakupów czy danych cyklu.

Nie ma wbudowanej analityki ani trackera zachowania użytkownika.

## Pliki użytkownika

Importowane XLS/XLSX/PDF oraz obrazy używane w lokalnych przepływach są przetwarzane przez aplikację po stronie klienta. Repozytorium publiczne nie powinno zawierać takich plików ani screenshotów użytkownika.

Service Worker celowo nie cache'uje prywatnych plików `.pdf`, `.xlsx`, `.xls` i `.json`.


## Lokalne kursy walut 1.2.0.85

Bieżące przeliczenia wyjazdowe korzystają z kursów wbudowanych lokalnie w aplikację. Moduł kursów nie wysyła kwoty wydatku, opisu, miejsca, kategorii ani nazwy wyjazdu do zewnętrznego API. Przeliczenie do PLN odbywa się lokalnie, a zapisany wydatek zachowuje użyty kurs jako część lokalnych danych transakcji.

## Backup i eksport

Backup JSON i eksport Excel są tworzone lokalnie. Mogą zawierać prywatne dane i nie są szyfrowane, dlatego należy przechowywać je w bezpiecznym miejscu.

Plik JSON używany do importu posiada checksum integralności. Przed zastąpieniem danych aplikacja tworzy lokalny punkt przywracania.

## Usługi zewnętrzne

Aplikacja nie wysyła kalendarza ani importowanych planów do własnego serwera. Otwarcie funkcji trasy może skierować użytkownika do Google Maps - w takim przypadku adres docelowy jest przekazywany tej zewnętrznej usłudze dopiero po świadomej akcji użytkownika.

Hosting statyczny (np. GitHub Pages) dostarcza pliki aplikacji i otrzymuje standardowe żądania sieciowe potrzebne do ich pobrania, ale prywatna baza IndexedDB nie jest publikowana razem z aplikacją.

## Cykl i dane wrażliwe

Dane Cyklu i Dziennika pozostają lokalne w aplikacji. Mogą wejść do ręcznie utworzonego backupu/transferu JSON, dlatego taki plik należy traktować jako prywatny.

## Repozytorium publiczne

Przed przygotowaniem GitHub source działa sanitizator i public-package gate. Blokowane są m.in.:

- prywatne checkpointy i handoffy,
- XLS/XLSX/PDF oraz backupy,
- sekrety i pliki środowiskowe,
- niezatwierdzone zdjęcia, screenshoty, audio i wideo,
- lokalne buildy, cache i archiwa.
