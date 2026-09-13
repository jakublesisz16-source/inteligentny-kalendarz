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

Pełna walidacja publicznej części projektu:

```bash
npm run check:public
```

Testy korzystające z lokalnych prywatnych fixture'ów są oddzielone od CI:

```bash
npm run test:private
```

`test:private` ma sens tylko wtedy, gdy lokalnie istnieją wymagane dane z `_PRIVATE_HISTORY/`.

Build produkcyjny powstaje przez:

```bash
npm run build
```


## Najprostszy workflow z GitHub Desktop

Projekt może być rozwijany i wydawany z jednego katalogu repozytorium - bez osobnego folderu `publish`, bez generowania `GITHUB_PREP` i bez kopiowania całego projektu przed każdym wydaniem.

1. Pracuj bezpośrednio w jednym lokalnym repozytorium otwartym w GitHub Desktop.
2. Prywatne pliki robocze trzymaj w `_LOCAL_ONLY/` albo w istniejącym `_PRIVATE_HISTORY/`. Oba katalogi są ignorowane przez Git.
3. Po zakończeniu zmian wykonaj zwykły commit do `main` w GitHub Desktop. Sam commit jest lokalny i niczego jeszcze nie publikuje.
4. W katalogu repozytorium uruchom `npm run release:local`.
5. Gdy zobaczysz `LOCAL_RELEASE_OK`, kliknij `Push origin` w GitHub Desktop.
6. Po pushu GitHub Actions wykonuje końcową kontrolę oraz audit zależności.

`release:local` wymaga gałęzi `main`, czystego working tree i sprawdza tylko to, co może trafić do publicznego repozytorium. Prywatne benchmarki nie blokują publicznego CI.

## PWA i offline

Service Worker cache'uje wyłącznie zasoby aplikacji wymagane do działania offline. Prywatne pliki użytkownika, takie jak PDF, XLS/XLSX i JSON, nie są zapisywane w cache aplikacji.

## Backup danych

W Ustawieniach można wyeksportować cały logiczny stan aplikacji do pliku JSON. Import:

- sprawdza format i checksum pliku,
- odrzuca pliki uszkodzone lub pochodzące z nieobsługiwanej nowszej wersji schematu,
- przed zastąpieniem danych tworzy lokalny punkt przywracania,
- po zapisie weryfikuje odtworzony snapshot.

## Rozwój i CI

Workflow GitHub Actions wykonuje instalację z lockfile, release preflight, kontrolę publicznych plików, typecheck, publiczne testy, build i projektowe quality gates. Publiczne wydanie powinno być przygotowywane dopiero po zielonym CI i Visual QA na desktopie oraz telefonie.

## Licencja

Licencja publicznego repozytorium zostanie wybrana przed pierwszym publicznym wydaniem. Do tego czasu brak pliku `LICENSE` nie oznacza udzielenia dodatkowych praw do kodu.
