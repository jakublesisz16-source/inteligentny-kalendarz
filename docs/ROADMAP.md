# Roadmap - Build242 release-test contract closure

## P0 - close Build242 release gate

- apply the Build242 stale-test-contract patch over the dependency-complete Windows publish tree,
- rerun `npm run check:public`,
- confirm all historical regression tests are green without pinning obsolete exact build numbers,
- if green, run `npm run security:dependencies` and publish Build242 from the existing Git checkout,
- keep accepted Dzisiaj and Build239 mobile Week behavior unchanged.

## P1 - periodic consolidation

After several additional patches or before release:

- run dependency-complete typecheck and full public suite,
- close remaining focused/adjacent validation listed in `CURRENT_STATE.json`,
- run production dependency audit and release gates,
- create a fresh full PRIVATE checkpoint and validate it after unpacking.

## P2 - future product work

Choose only from real-device issues or explicit user requests. Do not start another global redesign of stable Today/Calendar/Work/Finance/Study surfaces without evidence. Future official Study Excel updates continue through the universal parser and explicit schedule diff before calendar apply.
