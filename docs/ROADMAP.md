# Roadmap - Build248 test-contract closure

## P0 - close Build248

- keep raw Study parser and verified fingerprints source-faithful,
- apply recurring-pattern assumptions only after raw verification,
- persist/show assumption provenance and never infer date/day,
- keep explicit future official values authoritative,
- finish Source of Truth cleanup and file inventory,
- rerun dependency-complete Windows `npm run check:public` after strict test-fixture fix,
- rerun `npm run source:hygiene` after workspace-ignore fix,
- keep Build246/247 product behavior unchanged,
- run `npm run security:dependencies` before publication.

## P1 - exact active Study source QA

When `licencjat-ii-rok-piel.-25.09.2026.xls` is locally available again, run `study:audit` and real import preview with Build248. Record the exact number of operationally inferred entries separately from the unchanged raw verified counts. Do not change raw fingerprints unless the official source itself changes.

## P2 - future official Study updates

Every new XLS/XLSX follows: raw parser -> audit/verification -> recurring-pattern assumption layer -> schedule diff -> explicit user apply. A new explicit source value overrides any earlier assumption.

## P3 - bounded product work

Only address concrete regressions or explicitly agreed features. Stable Today, mobile full Week, Work, Receipt OCR/parser and established Finance behavior stay closed without evidence.

- rerun the dependency-complete Windows public suite after the two stale Study assertions are updated; no product code changes are expected.
