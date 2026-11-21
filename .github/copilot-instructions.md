# Punk: instructions for AI assistants

The language is defined by these artifacts. Read them rather than relying
on memory; do not duplicate their content here.

- `README.md`: the language tour and the source of truth for the language.
- `docs/punk-specification.md`: numbered MUST/MUST NOT rules (checked `[x]` when implemented and tested).
- `lessons/`: one markdown file per lesson (`NN-topic.md`, `README.md` is the intro) of worked examples with their outputs.
- `examples/` and `lib/`: example programs and the standard Punk libraries.

If code conflicts with the README or the specification, the code is the bug.
Flag any conflict and ask before reinterpreting a rule.

## Layout

- `src/`: tokenize, parse, eval (entry `src/punk.js`, CLI `src/cli.js`, library in `src/builtins.js`).
- `tests/spec.test.mjs`: one test per spec rule ID. `tests/docs.test.mjs`: runs every example in the README and `lessons/` against its stated output.
- `web/`: the browser site (code left, output right) built from `lessons/` by `npm run build:web` into `site/`; `tests/web.test.mjs` checks the bundle runs without Node. `.github/workflows/pages.yml` deploys it to GitHub Pages.

## Workflow

- Run `npm test` before and after changes.
- A language change means: update the specification (add or tick a rule), implement it, add a test for the rule ID, then update the README, `lessons/` and examples.
- Fix language bugs in the right phase (tokenize, parse or eval).
- Implement in a functional style: plain functions and closures, no `class` or `this`.
- Never push unless asked. Co-author AI-assisted commits to `Copilot`.
