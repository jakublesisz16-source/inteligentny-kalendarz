# Roadmap - Build244 release-test contract cleanup

## P0 - close Build244

- keep the Build243 Finance Items + Study current-plan product code unchanged,
- replace the two stale historical CSS assertions exposed by Windows Build243 validation,
- keep historical regression tests version-agnostic within the 1.2.0 release line,
- run static/release/fresh-unpack gates,
- apply the Build244 patch over the existing Windows publish tree and rerun `npm run check:public` plus `npm run security:dependencies`,
- perform real-phone visual QA of the unchanged Build243 Finance Items and Study current-plan surfaces,
- publish only after the technical gate is fully green.

## P1 - continue bounded product work

After Build244 closure, choose the next concrete issue from real-device QA or an explicit user request. Do not reopen stable Today, Calendar Week, Work, Receipt OCR/parser or Study parsing without evidence.

## P2 - future Study source updates

Each new official Excel continues through the universal parser, schedule diff and explicit apply decision. Do not hardcode a semester/subject or create a parallel static schedule database.
