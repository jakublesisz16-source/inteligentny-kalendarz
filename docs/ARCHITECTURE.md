# Architektura

## Założenie

Inteligentny Kalendarz jest statyczną, local-first aplikacją PWA. Produkcja nie wymaga serwera aplikacyjnego ani kont użytkowników.

```text
GitHub Pages
  -> React/Vite PWA
      -> IndexedDB (dane użytkownika)
      -> Cache Storage (wyłącznie powłoka PWA i lokalne zasoby OCR)
```

## Warstwy

- `src/app` - składanie głównych widoków aplikacji.
- `src/calendar`, `src/events` - kalendarz i wydarzenia.
- `src/finance`, `src/shopping` - Finanse, kategorie, paragony i lokalny OCR.
- `src/study`, `src/imports/xlsx` - import i utrzymanie planu studiów.
- `src/work`, `src/imports/pdf` - grafik pracy i PDF.
- `src/storage` - IndexedDB, backup/restore, migracje i journaling.
- `src/safety`, `src/data-transfer` - historia, kosz, restore points i przenoszenie danych.
- `public/service-worker.js` - cache powłoki PWA; bez Web Push.

## Zasady danych

Canonical dane użytkownika są zapisywane lokalnie w IndexedDB. Widoki analityczne, podsumowania miesiąca i podglądy są derived UI i nie tworzą osobnego backendu ani synchronizacji.

## Offline

Service Worker cache'uje statyczną powłokę aplikacji i lokalne zasoby OCR. Prywatne dokumenty użytkownika (`.pdf`, `.xls`, `.xlsx`, `.json`) nie są celowo zapisywane jako pliki użytkownika w Cache Storage.

## Importy

- XLS/XLSX są analizowane lokalnie i przechodzą walidację formatu przed zapisem.
- PDF grafiku pracy jest analizowany lokalnie.
- obrazy/PDF paragonów są przetwarzane lokalnym Tesseract.js/PDF.js.

## Deployment

`vite.config.ts` używa względnego `base: './'`. GitHub Actions buduje `dist` i publikuje go przez GitHub Pages.
