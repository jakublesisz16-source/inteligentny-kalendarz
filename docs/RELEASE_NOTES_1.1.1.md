# Inteligentny Kalendarz 1.1.1

`1.1.1` jest małym patchem brandingowym do stabilnego wydania 1.1.0. Nie zmienia modelu danych ani działania importów, OCR, Studiów, Pracy czy Kalendarza.

## Zmiany

- symbol kalendarza ze splash screena zastępuje tekstowe `IK` w lewym górnym brandingu aplikacji,
- ten sam symbol jest używany jako główna ikona PWA,
- nowe nazwy plików ikon 192/512 i Apple Touch pomagają ominąć stary cache ikon Androida i przeglądarki,
- Service Worker otrzymuje cache `v1.1.1`,
- zachowane są publiczne poprawki CI/Pages wykluczające testy wymagające prywatnych fixture'ów.

## Dane i kompatybilność

- APP_VERSION: `1.1.1`
- DATABASE_SCHEMA_VERSION: `13`
- brak migracji danych,
- dane użytkownika pozostają lokalne,
- prywatne pliki i `_PRIVATE_HISTORY` nie są częścią paczki publicznej.

## Aktualizacja ikony na Androidzie

Po wdrożeniu 1.1.1 Android może jeszcze przez pewien czas zachowywać ikonę starej instalacji. Jeśli launcher jej nie odświeży, należy odinstalować istniejącą PWA i zainstalować ją ponownie ze strony GitHub Pages.
