// Numbers — formatting rules and edge cases.
//
// From doc:
//   - `42`     whole number
//   - `0.5`    leading zero required for decimals
//   - `-5`     leading `-` is part of the number
//   - `3.141`  `.` inside a number is just text
//   - Numbers auto-wrap at the REPL (display only).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('whole numbers auto-wrap', () => {
  assert.equal(punk('0'),     '{0}');
  assert.equal(punk('1'),     '{1}');
  assert.equal(punk('42'),    '{42}');
  assert.equal(punk('999999'),'{999999}');
});

test('negative whole numbers — leading `-` is part of the number', () => {
  assert.equal(punk('-1'),  '{-1}');
  assert.equal(punk('-42'), '{-42}');
});

test('decimal numbers — leading zero required', () => {
  assert.equal(punk('0.5'),   '{0.5}');
  assert.equal(punk('3.141'), '{3.141}');
});

test('negative decimal numbers', () => {
  assert.equal(punk('-0.5'),   '{-0.5}');
  assert.equal(punk('-3.141'), '{-3.141}');
});

test('a bare `.5` is NOT a number — it would look like a path segment', () => {
  // `.5` on its own is illegal at the top level; it tokenizes as a path
  // segment without a target.
  punkThrows('.5');
});

test('querying a Number literal directly is a syntax error', () => {
  // `3.141.1?` is ambiguous with a path — disallowed.
  punkThrows('3.141.1?');
  punkThrows('42.1?');
});

test('querying a Number via a name is fine — implicit template wrap', () => {
  assert.equal(punk('n:3.141   n.3?'), '{.}');
  assert.equal(punk('n:45.7    n.1?'), '{4}');
  assert.equal(punk('n:42      n.2?'), '{2}');
});

test('querying a Number wrapped in a template is fine', () => {
  assert.equal(punk('{3.141}.3?'), '{.}');
  assert.equal(punk('{45.7}.4?'),  '{7}');
});

test('zero forms', () => {
  assert.equal(punk('0'),    '{0}');
  assert.equal(punk('0.0'),  '{0.0}');
  assert.equal(punk('-0'),   '{-0}');
});

test('numbers inside a template print without auto-wrap', () => {
  // Numbers auto-wrap only when they are the bare final REPL value.
  // Inside a structured template they're just items.
  assert.equal(punk('{1 2 3}'), '{1 2 3}');
});

test('numbers can be bound to a name', () => {
  assert.equal(punk('pi:3.141  pi?'), '{3.141}');
});

test('a digit-led token cannot be a name', () => {
  // Numbers and names are syntactically distinct.
  // (Cross-tested in named.test.mjs)
  assert.equal(punk('42'), '{42}');
});

test('arithmetically extreme values still print as written', () => {
  assert.equal(punk('1000000'),   '{1000000}');
  assert.equal(punk('-1000000'),  '{-1000000}');
});
