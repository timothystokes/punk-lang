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
  assert.equal(
    punk('shout:upper  shout!hello'),
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
    punk('shout:upper  Hello->shout!'),
    '"HELLO"'
  );
});

test('whitespace around `->` is a syntax error', () => {
  punkThrows('Hello -> upper!');
  punkThrows('Hello-> upper!');
  punkThrows('Hello ->upper!');
});
