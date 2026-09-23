# Inteligentny Kalendarz

Lokalna aplikacja PWA do łączenia kalendarza, planu studiów, grafiku pracy, dyspozycyjności, finansów i codziennych zadań w jednym miejscu.

## Najważniejsze funkcje

- kalendarz miesiąca i tygodnia z wydarzeniami prywatnymi, studiami i pracą,
- import planu zajęć z XLS/XLSX z wyborem grup i bezpiecznym porównaniem aktualizacji,
- import i podgląd grafiku pracy oraz współpracowników,
- planowanie dyspozycyjności i podsumowania czasu pracy,
- lokalne finanse miesiąca i wyjazdów z katalogiem produktów, historią cen i uczącymi się sugestiami kategorii,
- Receipt Scanner 2.0: import paragonów ze zdjęć/PDF przez lokalny OCR oraz strukturalnych e-paragonów JSON, z review, rabatami, kaucjami i ochroną przed duplikatem,
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


## Workflow wydania

Projekt jest rozwijany w prywatnym checkpointcie roboczym, a do publikacji powstaje osobny oczyszczony snapshot PUBLIC. Stały lokalny katalog publikacyjny to `D:\Projekty\inteligentny-kalendarz-publish`.

1. Rozwój i testy prowadzimy na aktualnym PRIVATE.
2. Po zakończeniu etapu tworzymy nowy lekki PRIVATE bez `node_modules`, historii starych checkpointów i artefaktów builda.
3. Z tego samego stanu generujemy sanitizowany PUBLIC i uruchamiamy publiczne testy, build oraz release gates.
4. Użytkownik rozpakowuje/przekopiowuje zawartość finalnego PUBLIC do `D:\Projekty\inteligentny-kalendarz-publish`, pozostawiając istniejący `.git`.
5. Gdy PUBLIC jest już w tym folderze, push robimy zawsze z niego: `git add -A`, `git diff --cached --check`, `git commit -m "Release <release> Build <build>"`, `git push origin main`. Nie tworzymy osobnego katalogu publikacyjnego i nie generujemy skryptu push, jeśli użytkownik o to nie prosi.
6. GitHub Actions wykonuje końcową kontrolę, a workflow `Deploy GitHub Pages` publikuje `dist` po pushu do `main`.
7. Brak `.github/workflows/pages.yml` ma blokować release preflight i build.
8. Każde wydanie oznaczamy wersją i buildem, np. `1.2.0 - Build 130`, z tagiem `v1.2.0.130`.

PRIVATE nigdy nie jest publikowany. PUBLIC nie zawiera prywatnych checkpointów, `project-skills/`, dokumentów użytkownika, backupów ani sekretów.

## PWA i offline

Service Worker cache'uje wyłącznie zasoby aplikacji wymagane do działania offline. Prywatne pliki użytkownika, takie jak PDF, XLS/XLSX i JSON, nie są zapisywane w cache aplikacji.

## Backup danych

W Ustawieniach można wyeksportować cały logiczny stan aplikacji do pliku JSON. Import:

- sprawdza format i checksum pliku,
- odrzuca pliki uszkodzone lub pochodzące z nieobsługiwanej nowszej wersji schematu,
- przed zastąpieniem danych tworzy lokalny punkt przywracania,
- po zapisie weryfikuje odtworzony snapshot.

## Rozwój i CI

Workflow CI wykonuje instalację z lockfile, release preflight, kontrolę publicznych plików, typecheck, publiczne testy, build i projektowe quality gates. Osobny workflow Pages buduje ten sam stan i publikuje `dist`; oba workflow muszą pozostawać w repozytorium. Publiczne wydanie powinno być przygotowywane dopiero po zielonym CI i Visual QA na desktopie oraz telefonie.

## Licencja

Licencja publicznego repozytorium zostanie wybrana przed pierwszym publicznym wydaniem. Do tego czasu brak pliku `LICENSE` nie oznacza udzielenia dodatkowych praw do kodu.
