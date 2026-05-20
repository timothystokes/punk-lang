// Boolean built-ins — `and!`, `or!`, `not!`, `xor!`.
//
// From doc § "Boolean Logic":
//   - `and!{a b ...}` — TRUE iff every item is TRUE (variadic).
//   - `or!{a b ...}`  — TRUE if any item is TRUE (variadic).
//   - `not!a`         — inverts a single boolean.
//   - `xor!{a b}`     — TRUE iff exactly one of a or b is TRUE.
//
// Reserved TRUE/FALSE print bare (no `{}` wrap).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- and! -------------------------------------------------------------

test('and! — all TRUE', () => {
  assert.equal(punk('and!{TRUE TRUE TRUE}'), 'TRUE');
});

test('and! — one FALSE makes it FALSE', () => {
  assert.equal(punk('and!{TRUE TRUE FALSE}'), 'FALSE');
});

test('and! — single bare arg', () => {
  assert.equal(punk('and!TRUE'), 'TRUE');
  assert.equal(punk('and!FALSE'), 'FALSE');
});

test('and! — short-circuits at first FALSE (variadic)', () => {
  assert.equal(punk('and!{FALSE TRUE TRUE TRUE}'), 'FALSE');
});

// ---- or! --------------------------------------------------------------

test('or! — any TRUE makes it TRUE', () => {
  assert.equal(punk('or!{FALSE TRUE FALSE}'), 'TRUE');
});

test('or! — all FALSE is FALSE', () => {
  assert.equal(punk('or!{FALSE FALSE FALSE}'), 'FALSE');
});

test('or! — single bare arg', () => {
  assert.equal(punk('or!TRUE'), 'TRUE');
  assert.equal(punk('or!FALSE'), 'FALSE');
});

// ---- not! -------------------------------------------------------------

test('not! — inverts TRUE to FALSE', () => {
  assert.equal(punk('not!TRUE'), 'FALSE');
});

test('not! — inverts FALSE to TRUE', () => {
  assert.equal(punk('not!FALSE'), 'TRUE');
});

// ---- xor! -------------------------------------------------------------

test('xor! — exactly one TRUE', () => {
  assert.equal(punk('xor!{TRUE FALSE}'), 'TRUE');
  assert.equal(punk('xor!{FALSE TRUE}'), 'TRUE');
});

test('xor! — both TRUE is FALSE', () => {
  assert.equal(punk('xor!{TRUE TRUE}'), 'FALSE');
});

test('xor! — both FALSE is FALSE', () => {
  assert.equal(punk('xor!{FALSE FALSE}'), 'FALSE');
});

// ---- composition --------------------------------------------------------

test('boolean ops compose', () => {
  // not!(and!{TRUE FALSE}) == TRUE
  assert.equal(punk('not!and!{TRUE FALSE}'), 'TRUE');
  // or!{and!{TRUE TRUE} FALSE} == TRUE
  assert.equal(punk('or!{and!{TRUE TRUE} FALSE}'), 'TRUE');
});

test('boolean ops in conditions', () => {
  // and! result feeds a `??` dispatch.
  const src = `and!{TRUE TRUE}??{
    (TRUE){yes}
    (FALSE){no}
  }!`;
  assert.equal(punk(src), '{yes}');
});
