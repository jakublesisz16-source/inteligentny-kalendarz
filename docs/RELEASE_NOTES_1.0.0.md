# Release Notes 1.0.0 - GitHub-only

## Status

`1.0.0` jest pierwszym stabilnym wydaniem Inteligentnego Kalendarza. Zakres funkcjonalny jest zamknięty, a źródłowy artefakt jest przygotowany do publikacji przez GitHub Pages.

## Architektura finalna

- GitHub Pages hostuje statyczną PWA,
- canonical dane pozostają w lokalnym IndexedDB,
- brak kont i cloud sync,
- brak Cloudflare Worker/D1/Cron/VAPID,
- brak Web Push w webowym `1.0.0`,
- Service Worker odpowiada tylko za offline/cache,
- czysty planner przypomnień i preferencje pozostają jako opcjonalny fundament pod przyszłą aplikację Android z lokalnymi powiadomieniami.

## Funkcje wydania

- Dzisiaj i Kalendarz,
- Studia z lokalnym importem XLSX,
- Praca z lokalnym importem tekstowego PDF,
- Zakupy,
- prywatny moduł Cykl i Dziennik Cyklu,
- Miejsca i świadome otwarcie trasy,
- lokalne globalne wyszukiwanie,
- Backup/Restore, Restore Points i Data Transfer,
- instalowalna PWA i działanie offline po poprawnym pierwszym załadowaniu.

## Prywatność

Aplikacja nie ma backendu przechowującego kalendarz. Dane użytkownika są lokalne poza świadomymi operacjami użytkownika, np. ręcznym przeniesieniem eksportu albo otwarciem zewnętrznej trasy. Pliki backup/transfer są nieszyfrowane i należy traktować je jak prywatne dane.

## Cykl - granice

Moduł nie diagnozuje. Możliwe okno owulacji jest wyłącznie szerokim szacunkiem kalendarzowym, nie potwierdza owulacji, nie tworzy bezpiecznych dni i nie służy jako metoda antykoncepcji.

## Gate wydania

Przed finalnym bumpem potwierdzono na Windows `npm ci`, pełne `npm run check`, 344/344 testów oraz production build. `npm audit` zgłosił 2 problemy Moderate i 0 High/Critical, co mieści się w ustalonym progu release gate.

Po publikacji finalnego artefaktu należy wykonać krótki smoke działającego GitHub Pages/PWA. Jeżeli ujawni realny blocker, poprawka powinna ograniczyć się wyłącznie do niego.
