# Roadmap - Build250 canonical Study group assignment

## P0 - close Build250

- expose MAIN/G12/G8/G4 as four independent manual assignments for the active 25.09 plan,
- filter Study events only by exact partition type + exact group label,
- keep raw parser, exact 25.09 all-candidate fingerprint, recurring-pattern rules and schema 14 unchanged,
- preserve the historical verified QA candidate set by making its G8 selection explicit,
- run full Windows `npm run check:public`, `npm run security:dependencies`, `npm run release:preflight` and `npm run source:hygiene`,
- on the real app choose the user's actual G8 assignment manually, use `Zastosuj do planu`, then verify Calendar events against representative Excel weeks.

## P1 - exact 25.09 reality-check

Use the exact `licencjat-ii-rok-piel.-25.09.2026.xls` when locally available. Validate at least one representative event from each partition MAIN/G12/G8/G4 plus the known 08.10 overlap and recurring-pattern assumptions. Persisted active groups must contain four explicit assignments when all four partitions exist.

## P2 - future official Study update

A future university workbook is not assumed to share the same layout. Run raw parser/audit first, inspect the real workbook manually, update the mapping/adapter only where the new source requires it, then diff/review/apply. Do not generalize current group-name relationships into future plans.

## P3 - bounded product work

Do not reopen accepted Today, full mobile Week, Work roster, Receipt OCR/parser or stable Finance surfaces without a concrete regression. After Build249 closure, prefer real-device defects, performance work with measured impact, or explicitly requested features.


## Build251 - zamknięcie exact-source Study QA

- [x] zachować exact XLS 25.09 wyłącznie w PRIVATE recovery,
- [x] zamrozić raw fingerprint aktualnego profilu 4/4A/4B/4C1,
- [x] zamrozić operational fingerprint po recurring-pattern assumptions,
- [x] udokumentować 2 bezpieczne inferencje Interny 17-18.12,
- [x] zachować 1 nierozstrzygnięty POZ bez zgadywania daty,
- [ ] Windows `check:public`, dependency audit i `study:current-source:qa`,
- [ ] runtime screenshot/check 17-18.12 oraz potwierdzenie braku wymyślonego terminu POZ.


## Build252 - release blocker copy closure

- [x] poprawić gramatykę komunikatu wielokrotnego wyboru MAIN/G12/G8/G4,
- [ ] ponowić Windows `check:public` i dependency audit,
- [ ] uruchomić `study:current-source:qa`,
- [ ] potwierdzić runtime Internę 17-18.12 i brak wymyślonego terminu POZ.

## Build253 - wierna prezentacja niepełnych danych źródłowych

- [x] usunąć poziomy pewności i język sugerujący ocenę wiarygodności,
- [x] nie tworzyć wydarzenia dziennego z wpisu, który w Excelu ma tylko zakres tygodnia,
- [x] pokazać tydzień, wymiar godzin i notatkę źródłową, jeśli występują w Excelu,
- [x] zachować neutralny, minimalistyczny wygląd,
- [ ] Windows `check:public` i dependency audit,
- [ ] runtime check tygodnia 12-18.10 dla POZ `G4:4C1`.



## Build254 - zamknięcie stale test-contract po Build253

Mały build bez zmian produktu. Po ponownym pełnym Windows PASS pozostaje wyłącznie runtime QA prezentacji POZ 12-16.10 w Kalendarzu i potem publikacja.
