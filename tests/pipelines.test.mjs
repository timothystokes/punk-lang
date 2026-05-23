// Pipelines — `->` for chaining values through functions.
//
// From doc § "Pipelines":
//   - `->` must be written with NO whitespace around it.
//   - With trailing `!`, the pipeline runs: value flows through each stage.
//   - Without `!`, a pipeline is itself a value — a composed function.
//   - Each stage receives exactly one thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('single-stage pipeline executes', () => {
  // upper!hello -> {HELLO}-ish. Pipeline form: Hello->upper!
  assert.equal(punk('Hello->upper!'), '"HELLO"');
});

test('two-stage pipeline executes left-to-right', () => {
  // Hello -> upper -> lower! → "hello"
  assert.equal(punk('Hello->upper->lower!'), '"hello"');
});

test('pipeline without `!` is a value — a composed function', () => {
  // Composing without running: result is a function value.
  // We check it by binding and querying.
  const src = `f:upper->lower  f?`;
  // f? returns the pipeline value as-is.
  assert.equal(punk(src), 'upper->lower');
});

test('composed pipeline can be called later with `!`', () => {
  // `shout:upper?` binds shout to the upper builtin (the `?` queries
  // the existing function; bare `upper` would just be the literal word).
  assert.equal(
    punk('shout:upper?  shout!hello'),
    '"HELLO"'
  );
});

test('multi-stage composition executes when called', () => {
  assert.equal(
    punk('clean:upper->lower  clean!Hello'),
    '"hello"'
  );
});

test('composed pipeline is itself a stage of another pipeline', () => {
  assert.equal(
    punk('shout:upper?  Hello->shout!'),
    '"HELLO"'
  );
});

test('whitespace around `->` is a syntax error', () => {
  punkThrows('Hello -> upper!');
  punkThrows('Hello-> upper!');
  punkThrows('Hello ->upper!');
});

// Pipeline stage shape: a pipeline always delivers ONE thing to each
// stage. That one thing keeps its shape — if it's a multi-item tmpl,
// the next stage's slot receives the tmpl as its single argument. The
// pipeline must not silently spread, wrap, or unwrap that value.

test('pipeline a multi-item tmpl into a 1-arg fn — slot receives the tmpl', () => {
  // len takes ONE arg (a tmpl) and returns its item count.
  // Piping xs (a 3-item tmpl) must deliver xs as that single arg.
  assert.equal(
    punk(`
      len:(t:_){t.#?}
      xs:{1 2 3}
      xs?->len!
    `),
    '{3}',
  );
});

test('pipeline seed: tmpl literal pipes the WHOLE tmpl as one arg', () => {
  // Under the new no-spread `?` model, `{xs?}` is a 1-item tmpl whose
  // single item is xs's value (a 3-item tmpl), giving `{{1 2 3}}`.
  // Piped into len, the slot receives that outer 1-item tmpl, so
  // `t.#?` is 1. To spread xs into the seed instead, use `{xs?.?}`.
  assert.equal(
    punk(`
      len:(t:_){t.#?}
      xs:{1 2 3}
      {xs?}->len!
    `),
    '{1}',
  );
});

test('pipeline seed: `.?` spreads inside seed to recover length-3 behaviour', () => {
  assert.equal(
    punk(`
      len:(t:_){t.#?}
      xs:{1 2 3}
      {xs?.?}->len!
    `),
    '{3}',
  );
});

test('pipeline into a 1-remaining partial — slot receives the tmpl, hof iterates', () => {
  // map takes (fn coll); pre-fill fn, then deliver coll via pipeline.
  // The piped tmpl must reach the coll slot intact so map iterates over
  // its items and produces a 3-item tmpl of results. Callback uses `~`
  // so each transformed item is bare, not `{n}`-wrapped.
  assert.equal(
    punk(`
      xs:{10 20 30}
      grow:map'(s:_){+!{s? 1}}~
      xs?->grow!
    `),
    '{11 21 31}',
  );
});

test('pipeline into a 1-remaining partial matches direct call', () => {
  // Direct and pipeline forms must produce the same value.
  const direct = punk(`
    xs:{10 20 30}
    grow:map'(s:_){+!{s? 1}}~
    grow!{xs?}
  `);
  const piped = punk(`
    xs:{10 20 30}
    grow:map'(s:_){+!{s? 1}}~
    xs?->grow!
  `);
  assert.equal(piped, direct);
});

test('scalar values still pipe through 1-arg stages unchanged', () => {
  // Regression: simple scalar pipelines must keep working.
  assert.equal(punk('Hello->upper!'), '"HELLO"');
  assert.equal(punk('double:X\'2  5->double!'), '{10}');
});
