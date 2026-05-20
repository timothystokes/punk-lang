// `assert!` built-in.
//
// From doc § "Testing":
//   - `assert!{expected actual}` — passes silently (returns NULL) when
//     `actual` equals `expected`; raises a runtime error otherwise.
//   - `assert!cond`              — passes silently when `cond` is truthy;
//     raises a runtime error otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- two-arg form: expected first, actual second ----------------------

test('assert! — pass returns NULL', () => {
  assert.equal(punk('assert!{3 +!{1 2}}'), 'NULL');
});

test('assert! — pass on text equality', () => {
  assert.equal(punk('assert!{HELLO upper!hello}'), 'NULL');
});

test('assert! — fail raises a runtime error', () => {
  punkThrows('assert!{4 +!{1 2}}');
});

test('assert! — partials cleanly (expected first)', () => {
  // `is-three:assert!'3` then `is-three!actual` evaluates actual vs 3.
  const src = `is-three:assert!'3
    is-three!+!{1 2}`;
  assert.equal(punk(src), 'NULL');
});

test("assert! — partials and fails when actual doesn't match", () => {
  const src = `is-three:assert!'3
    is-three!+!{1 5}`;
  punkThrows(src);
});

// ---- single-arg form: assert truthy -----------------------------------

test('assert! — truthy condition passes', () => {
  assert.equal(punk('assert!TRUE'), 'NULL');
});

test('assert! — FALSE raises a runtime error', () => {
  punkThrows('assert!FALSE');
});

test('assert! — NULL raises a runtime error', () => {
  punkThrows('assert!NULL');
});

test('assert! — 0 is truthy and passes (per Punk truthiness)', () => {
  // Only FALSE and NULL are falsy; 0 / {} / () are all truthy.
  assert.equal(punk('assert!0'), 'NULL');
});

test('assert! — empty template {} is truthy and passes', () => {
  assert.equal(punk('assert!{}'), 'NULL');
});

// ---- a test file is just a template of asserts ------------------------

test('a file of asserts — first failure stops execution with an error', () => {
  const src = `{
      assert!{1 1}
      assert!{1 2}
      assert!{3 3}
    }!`;
  punkThrows(src);
});
