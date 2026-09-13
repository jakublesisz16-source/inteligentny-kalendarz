# Architektura

## Założenie

Inteligentny Kalendarz jest aplikacją PWA typu local-first. Produkcyjna aplikacja nie wymaga własnego backendu, konta użytkownika ani chmurowej bazy danych.

Główny przepływ danych:

```text
React UI -> moduły domenowe/importery -> storage -> IndexedDB
```

## Stos

- React 19,
- TypeScript,
- Vite,
- IndexedDB jako trwała baza lokalna,
- Vitest do testów,
- Service Worker do PWA/offline.

Aktualny schemat IndexedDB ma numer `14`.

## Główne moduły

- `src/calendar` i `src/events` - kalendarz, wydarzenia, widoki miesiąca/tygodnia i konflikty terminów,
- `src/study` + `src/imports/xlsx` - import planu XLS/XLSX, grupy, kontrola jakości i porównywanie aktualizacji,
- `src/work` - grafik, współpracownicy, dyspozycyjność i podsumowania czasu pracy,
- `src/finance` - moduły finansowe - lokalne finanse miesiąca i wyjazdów,
- `src/shopping` - zakupy i lokalne przetwarzanie paragonów,
- `src/cycle` - lokalne dane cyklu i dziennika,
- `src/storage` - IndexedDB, migracje, backup, restore points i historia zmian,
- `src/settings` - ustawienia i transfer danych,
- `src/safety` - warstwa bezpieczeństwa danych i przywracania.

## Importy

Plany XLS/XLSX oraz grafiki/załączniki są analizowane po stronie klienta. Do bazy trafiają znormalizowane rekordy potrzebne aplikacji, a nie robocze pliki użytkownika jako część repozytorium.

Aktualizacja planu studiów korzysta z istniejącego mechanizmu diffu. Zmiany nie są stosowane do aktywnego planu bez jawnej akcji użytkownika.

## Backup i przywracanie

Eksport JSON zawiera kanoniczny logiczny stan aplikacji oraz checksum SHA256. Import:

1. sprawdza format i obsługiwaną wersję schematu,
2. weryfikuje checksum,
3. tworzy punkt przywracania bieżącego urządzenia,
4. zastępuje logiczny stan,
5. weryfikuje zapisany snapshot,
6. przy błędzie po zapisie próbuje automatycznego rollbacku.

## PWA i offline

Service Worker używa wersjonowanego cache aplikacji. Przy instalacji cache'uje powłokę aplikacji oraz wymagane zasoby lokalnego OCR/PDF. Stare cache należące do aplikacji są usuwane po aktywacji nowej wersji.

Prywatne pliki użytkownika z rozszerzeniami `.pdf`, `.xlsx`, `.xls` i `.json` nie są zapisywane do cache Service Workera.

## CI i wydanie

GitHub Actions wykonuje:

1. `npm ci`,
2. release preflight,
3. typecheck, testy i produkcyjny build,
4. projektowe quality gates,
5. audit zależności produkcyjnych.

Publiczne wydanie powinno być tworzone dopiero po zielonym CI oraz Visual QA na desktopie i telefonie.
