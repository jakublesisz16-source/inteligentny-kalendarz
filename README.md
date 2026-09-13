# Inteligentny Kalendarz

Lokalna aplikacja PWA do łączenia kalendarza, planu studiów, grafiku pracy, dyspozycyjności, finansów i codziennych zadań w jednym miejscu.

## Najważniejsze funkcje

- kalendarz miesiąca i tygodnia z wydarzeniami prywatnymi, studiami i pracą,
- import planu zajęć z XLS/XLSX z wyborem grup i bezpiecznym porównaniem aktualizacji,
- import i podgląd grafiku pracy oraz współpracowników,
- planowanie dyspozycyjności i podsumowania czasu pracy,
- lokalne finanse miesiąca i wyjazdów,
- zakupy, cykl i widok `Dzisiaj`,
- opcjonalne oznaczenia świąt w Polsce i kalendarza akademickiego WUM,
- backup/import całego logicznego stanu aplikacji w jednym pliku JSON,
- działanie jako instalowalna PWA i podstawowa obsługa offline.

## Prywatność

Aplikacja jest projektowana jako local-first. Dane użytkownika są przechowywane lokalnie w przeglądarce/IndexedDB. Eksportowane pliki JSON lub Excel mogą zawierać prywatne dane i nie są szyfrowane - należy przechowywać je w bezpiecznym miejscu.

Repozytorium nie powinno zawierać prywatnych PDF/XLS/XLSX, backupów, zdjęć paragonów, screenshotów użytkownika ani lokalnych plików `.env`.

## Uruchomienie lokalne

Wymagany jest Node.js 22.

```bash
npm ci
npm run dev
```

Pełna walidacja projektu:

```bash
npm run check
npm run security:dependencies
```

Build produkcyjny powstaje przez:

```bash
npm run build
```

## PWA i offline

Service Worker cache'uje wyłącznie zasoby aplikacji wymagane do działania offline. Prywatne pliki użytkownika, takie jak PDF, XLS/XLSX i JSON, nie są zapisywane w cache aplikacji.

## Backup danych

W Ustawieniach można wyeksportować cały logiczny stan aplikacji do pliku JSON. Import:

- sprawdza format i checksum pliku,
- odrzuca pliki uszkodzone lub pochodzące z nieobsługiwanej nowszej wersji schematu,
- przed zastąpieniem danych tworzy lokalny punkt przywracania,
- po zapisie weryfikuje odtworzony snapshot.

## Rozwój i CI

Workflow GitHub Actions wykonuje instalację z lockfile, release preflight, typecheck, testy, build i projektowe quality gates. Publiczne wydanie powinno być przygotowywane dopiero po zielonym CI i Visual QA na desktopie oraz telefonie.

## Licencja

Licencja publicznego repozytorium zostanie wybrana przed pierwszym publicznym wydaniem. Do tego czasu brak pliku `LICENSE` nie oznacza udzielenia dodatkowych praw do kodu.
