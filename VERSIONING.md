# Wersjonowanie

Publiczne wydania używają semver: `MAJOR.MINOR.PATCH`.

## 1.2.0

Pierwsze publiczne wydanie gałęzi 1.2 z przebudowanym Kalendarzem, Finansami/Wyjazdami, usprawnionymi Studiami i Pracą oraz mobilnymi poprawkami formularzy.

Schema IndexedDB: `14`.

Wewnętrzne checkpointy developerskie mogą mieć dodatkowe numery robocze, ale nie są częścią publicznego numeru wersji ani publicznego repozytorium.

## Zasada wydania

Każdy publiczny release powinien przejść:

```bash
npm ci
npm run check
```

oraz smoke test PWA na desktopie i telefonie.
