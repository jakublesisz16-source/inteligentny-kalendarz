# Changelog

## 1.2.0 - 2026-09-13

### Kalendarz

- spójny Miesiąc i Tydzień,
- wyraźniejsze kategorie Studia/Praca/Prywatne,
- mobile: tap dnia w Miesiącu tylko zaznacza datę; szczegóły otwierają się po świadomym wyborze wydarzenia,
- desktopowy drag i resize ręcznych wydarzeń,
- mobilny long-press drag i osobny uchwyt resize,
- bezpieczne formularze modalne na małych ekranach - główna akcja pozostaje dostępna przy otwartej klawiaturze.

### Finanse

- prosty widok transakcji miesięcznych,
- spójny układ Miesiąc/Wyjazd,
- trwałe Wyjazdy,
- ręczne wydatki zagraniczne z wyborem waluty,
- orientacyjne kursy zapisane lokalnie, bez zewnętrznego API,
- kompaktowe kategorie i ikony wydatków,
- mobilny szybki formularz z dostępnym `Zapisz`.

### Studia i Praca

- uproszczony import planu XLS/XLSX z bezpiecznym podglądem i wyborem grup,
- lokalny import grafiku PDF,
- czytelniejszy ekran Pracy i współpracowników,
- import PDF staje się akcją drugorzędną po wczytaniu aktywnego grafiku.

### Ustawienia, offline i bezpieczeństwo

- prostsze Ustawienia bez ukrywania podstawowych akcji,
- jeden przepływ backup/import danych,
- PWA i Service Worker z lokalnym offline shell,
- lokalny OCR paragonów,
- dodatkowe release/security/travel gates.

### Dane

- `DATABASE_SCHEMA_VERSION = 14`,
- brak migracji wymaganej przy przejściu z późnych checkpointów 1.2.0.

## 1.1.2

- hardening importu XLSX,
- aktualizacje bezpieczeństwa zależności,
- stabilny publiczny punkt bazowy przed 1.2.0.
