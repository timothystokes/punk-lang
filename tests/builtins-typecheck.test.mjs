// Type-check built-ins — all return TRUE or FALSE.
//
// From doc § "Type Checks":
//   - `isnum!t`    TRUE if `t` is a number
//   - `istext!t`   TRUE if `t` is text (unstructured template)
//   - `islist!t`   TRUE if `t` is a template with more than one item, or zero items
//   - `isfn!t`     TRUE if `t` is a function
//   - `isempty!t`  TRUE if `t` has no items

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

// ---- isnum! -----------------------------------------------------------

test('isnum! — TRUE for numeric values', () => {
  assert.equal(punk('isnum!42'), 'TRUE');
  assert.equal(punk('isnum!3.141'), 'TRUE');
  assert.equal(punk('isnum!-5'), 'TRUE');
});

test('isnum! — FALSE for words', () => {
  assert.equal(punk('isnum!hello'), 'FALSE');
});

test('isnum! — FALSE for text', () => {
  assert.equal(punk('isnum!"42"'), 'FALSE');
});

test('isnum! — FALSE for templates', () => {
  assert.equal(punk('isnum!{1 2 3}'), 'FALSE');
});

// ---- istext! ----------------------------------------------------------

test('istext! — TRUE for unstructured text', () => {
  assert.equal(punk('istext!"hello"'), 'TRUE');
  assert.equal(punk('istext!""'), 'TRUE');
});

test('istext! — FALSE for words', () => {
  // A bare Word is not text — text is the `"..."` form.
  assert.equal(punk('istext!hello'), 'FALSE');
});

test('istext! — FALSE for numbers', () => {
  assert.equal(punk('istext!42'), 'FALSE');
});

test('istext! — FALSE for structured templates', () => {
  assert.equal(punk('istext!{a b c}'), 'FALSE');
});

// ---- islist! ----------------------------------------------------------

test('islist! — TRUE for multi-item template', () => {
  assert.equal(punk('islist!{1 2 3}'), 'TRUE');
});

test('islist! — TRUE for empty template', () => {
  assert.equal(punk('islist!{}'), 'TRUE');
});

test('islist! — FALSE for a number', () => {
  assert.equal(punk('islist!42'), 'FALSE');
});

test('islist! — FALSE for unstructured text', () => {
  assert.equal(punk('islist!"abc"'), 'FALSE');
});

// ---- isfn! ------------------------------------------------------------

test('isfn! — TRUE for a function literal', () => {
  assert.equal(punk('isfn!(x:_){x?}'), 'TRUE');
});

test('isfn! — TRUE for a named function (resolved with `?`)', () => {
  assert.equal(punk('f:(x:_){x?}  isfn!{f?}'), 'TRUE');
});

test('isfn! — FALSE for a pattern without a body', () => {
  assert.equal(punk('isfn!(x:_)'), 'FALSE');
});

test('isfn! — FALSE for a plain template', () => {
  assert.equal(punk('isfn!{1 2 3}'), 'FALSE');
});

// ---- isempty! ---------------------------------------------------------

test('isempty! — TRUE for empty template', () => {
  assert.equal(punk('isempty!{}'), 'TRUE');
});

test('isempty! — TRUE for empty unstructured text', () => {
  assert.equal(punk('isempty!""'), 'TRUE');
});

test('isempty! — FALSE for non-empty template', () => {
  assert.equal(punk('isempty!{a}'), 'FALSE');
});

test('isempty! — FALSE for non-empty text', () => {
  assert.equal(punk('isempty!"x"'), 'FALSE');
});
