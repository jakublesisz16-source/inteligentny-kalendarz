# Publiczne repozytorium

Repozytorium publiczne zawiera wyłącznie kod źródłowy, statyczne zasoby PWA, testy, konfigurację builda oraz publiczną dokumentację.

## Nie publikuj

- `.env`, tokenów i kluczy,
- prywatnych PDF/XLS/XLSX,
- backupów i eksportów JSON,
- archiwów ZIP/7z/rar,
- prywatnych benchmark fixture'ów,
- handoffów, prywatnych not wersji i wewnętrznej historii projektu,
- screenshotów lub logów zawierających dane użytkownika,
- danych identyfikujących współpracowników lub inne osoby.

`.gitignore` zawiera reguły ochronne dla najczęstszych prywatnych artefaktów.

## Przed push

```bash
npm ci
npm run check
```

Dodatkowo sanitizowany katalog przygotowany do publikacji można sprawdzić:

```bash
node scripts/public-package-gate.mjs <katalog-publiczny>
```

## GitHub Pages

Push do `main` uruchamia workflow GitHub Pages. Po zielonym deploymentcie wykonaj smoke test wersji produkcyjnej na desktopie i telefonie.
