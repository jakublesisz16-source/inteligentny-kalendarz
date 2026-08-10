# Release Notes 1.0.0 - stan RC.7

Projekt jest obecnie w stanie **1.0.0-rc.7**, nie w finalnym 1.0.0. RC.5/RC.6 zamknęły blocker bezpieczeństwa i zgodności PDF.js 6, a RC.7 usuwa niedeterministyczną kolejność Change Journal ujawnioną przez powtarzające się sporadyczne FAIL Undo. Lokalna bramka stabilności RC.7 została potwierdzona. Finalne wydanie nadal czeka na rzeczywisty GitHub Pages deployment, Web Push backend i realne testy urządzeń.

# Release notes 1.0.0

## Aktualny status

Projekt jest obecnie w stanie **1.0.0-rc.7**, nie w finalnym 1.0.0. Funkcjonalny zakres jest zamknięty. RC.7 stabilizuje centralny Change Journal bez zmiany semantyki Undo, schema ani funkcji użytkowych. Zweryfikowany package-lock jest już dołączony do public-ready source.

## Czym jest Inteligentny Kalendarz

Local-first PWA łącząca:

- Dzisiaj i Kalendarz,
- Studia,
- Pracę i dyspozycyjność,
- Zakupy,
- prywatny moduł Cykl,
- Miejsca i Trasa,
- lokalne globalne wyszukiwanie,
- backup/restore/Data Transfer,
- opcjonalny Web Push.

## Prywatność

Canonical dane są przechowywane lokalnie w IndexedDB. Nie ma kont ani cloud sync. Backend Push przechowuje jedynie techniczne dane subskrypcji/harmonogramu i nie powinien znać treści kalendarza. Ręczne pliki backup/transfer są nieszyfrowane i mogą zawierać prywatne dane.

## Cykl - granice

Moduł nie diagnozuje. Szacunki mogą być niedostępne. Możliwe okno owulacji jest wyłącznie szerokim szacunkiem kalendarzowym, nie potwierdza owulacji, nie tworzy bezpiecznych dni i nie służy jako metoda antykoncepcji.

## PWA i Push

PWA może działać offline po wcześniejszym poprawnym online load. Web Push wymaga wdrożonego HTTPS frontendu, Workera, D1, Cron i VAPID. Globalny master switch jest device-local.

## Znane ograniczenia RC

- public-ready source zawiera zweryfikowany `package-lock.json` RC.7,
- GitHub Pages workflow jest przygotowany, ale rzeczywisty publiczny deploy nie został jeszcze wykonany,
- produkcyjny Cloudflare Worker/D1/VAPID nie został jeszcze skonfigurowany,
- realne testy Windows/Android/iOS, offline update i Web Push nie zostały wykonane,
- dlatego RC nie może zostać przemianowany na finalne 1.0.0.
