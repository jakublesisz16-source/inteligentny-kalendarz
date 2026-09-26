# Roadmap - po Build234 verified

## Zamknięte - Verified Study Plan 25.09

- exact `licencjat-ii-rok-piel.-25.09.2026.xls`: SHA-256 + `study:audit` PASS,
- runtime: `ZWERYFIKOWANY`, profil `7 / 7A / 7B2`, 76 importowalnych + 3 niepełne,
- diff/apply/save -> Kalendarz PASS,
- konflikt 08.10.2026 POZ 12:00-15:45 vs CHIRURGIA 15:00-16:30 zachowany i jawnie pokazany.

## Zamknięte - Build234 PWA release closure

- dependency-complete Windows `check:public`: PASS, 319/319 wykonanych test files, 1836/1836 wykonanych tests, 2 optional skips,
- production build i release/security gates: PASS,
- Receipt Scanner first-open lazy boundary: PASS,
- Service Worker register/activate i transitive offline cache: PASS,
- installed-PWA offline lazy chunks: PASS,
- Build234 jest verified PRIVATE baseline i jedynym źródłem następnego PUBLIC.

## P1 - publikacja Build234

Finalny PUBLIC został przygotowany wyłącznie z exact Build234 verified PRIVATE i przeszedł fresh-unpack release/security/file-set validation. Następny krok to ręczne skopiowanie finalnego PUBLIC do istniejącego `D:\Projekty\inteligentny-kalendarz-publish`, zachowanie `.git` i kanoniczny `git add -A` -> `git diff --cached --check` -> commit -> push.

## P2 - następny development slice

Po release wybrać jeden bounded slice. Nie mieszać go z Receipt OCR/parserem bez reprodukowalnego błędu finansowego. Runtime mobile Work subview scroll-reset i Calendar Week explicit Add wracają do QA dopiero przy kolejnej zmianie tych powierzchni.

## Studia - przyszłe źródła

Każdy nowy oficjalny Excel przechodzi: uniwersalny parser -> schedule diff -> decyzja użytkownika -> Kalendarz. Status verified dla nowego źródła wymaga osobnego audytu i nowej referencji; sama nazwa pliku nigdy nie wystarcza.
