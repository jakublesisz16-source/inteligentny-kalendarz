# Inteligentny Kalendarz

Local-first PWA do planowania dnia, kalendarza, studiów, pracy i finansów. Dane użytkownika są przechowywane lokalnie w IndexedDB; aplikacja nie wymaga konta ani własnego backendu.

## Wersja

- APP_VERSION: `1.2.0`
- DATABASE_SCHEMA_VERSION: `14`
- React 19 + TypeScript + Vite
- statyczny deployment przez GitHub Pages
- PWA z lokalnym cache powłoki aplikacji

## Najważniejsze funkcje

- `Dzisiaj` - szybki plan dnia i wydarzenia.
- `Kalendarz` - Miesiąc/Tydzień, filtry Studia/Praca/Prywatne, drag & resize dla bezpiecznych ręcznych wydarzeń.
- `Finanse` - miesięczne transakcje, kategorie, ręczne wydatki oraz wyjazdy z walutami i orientacyjnym przeliczeniem offline.
- `Studia` - lokalny import planu XLS/XLSX z podglądem, wyborem grup i aktualizacją istniejącego planu.
- `Praca` - lokalny import grafiku PDF, własne zmiany, współpracownicy i dyspozycyjność.
- `Ustawienia` - podstawy, instalacja PWA, backup/restore oraz historia/kosz.
- lokalny OCR paragonów - Tesseract.js/PDF.js bez zewnętrznego API OCR.

## Uruchomienie lokalne

Wymagany Node.js 22.

```bash
npm ci
npm run check
npm run dev -- --host 0.0.0.0 --port 5174
```

Nie używaj `npm audit fix --force`, `npm install --force` ani `npm install --legacy-peer-deps`.

## Testy i build

```bash
npm run typecheck
npm run test
npm run build
npm run check
```

`npm run build` wykonuje również gate'y Service Workera, bezpieczeństwa i krytycznych ścieżek wersji wyjazdowej.

## GitHub Pages

Repozytorium zawiera workflowy:

- `.github/workflows/ci.yml` - pełny `npm run check` dla pull requestów,
- `.github/workflows/pages.yml` - `npm ci`, `npm run check`, upload `dist` i deploy GitHub Pages po pushu do `main`.

`vite.config.ts` używa `base: './'`, więc build działa jako project site GitHub Pages bez wpisywania nazwy repo do kodu aplikacji.

## Dane i prywatność

- dane aplikacji pozostają lokalnie w IndexedDB,
- brak własnego backendu, chmury synchronizującej dane i analityki,
- XLS/XLSX/PDF są analizowane lokalnie,
- lokalny OCR nie wysyła obrazu ani surowego tekstu do API,
- kursy walut w Finansach są orientacyjne i zapisane lokalnie w aplikacji,
- backup/transfer danych tworzy lokalny plik JSON, który może zawierać prywatne dane i powinien być chroniony,
- `Trasa` może otworzyć Google Maps dopiero po świadomym kliknięciu użytkownika.

Szczegóły: `docs/PRIVACY.md`.

## Publiczne repozytorium

Nie commituj:

- `.env` i sekretów,
- prywatnych PDF/XLS/XLSX,
- backupów/eksportów JSON,
- archiwów ZIP,
- wewnętrznych handoffów i materiałów checkpointu,
- danych identyfikujących użytkownika lub współpracowników.

Przed publikacją można dodatkowo uruchomić gate na osobnym, sanitizowanym katalogu:

```bash
node scripts/public-package-gate.mjs <katalog-publiczny>
```

Więcej: `docs/PUBLIC_REPOSITORY.md`.
