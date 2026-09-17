// Numbers — formatting rules and edge cases.
//
// From doc:
//   - `42`     whole number
//   - `0.5`    leading zero required for decimals
//   - `-5`     leading `-` is part of the number
//   - `3.141`  `.` inside a number is just text
//   - A bare Number is never a value on its own — it must always be
//     wrapped in `{...}`. When a query resolves to a bare Number item,
//     the REPL still auto-wraps it for display (display only).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('a bare Number cannot stand alone as a top-level value', () => {
  punkThrows('0');
  punkThrows('42');
  punkThrows('-5');
});

test('whole numbers display-wrap when a query yields a bare Number', () => {
  assert.equal(punk('{0}.1?'),      '{0}');
  assert.equal(punk('{1}.1?'),      '{1}');
  assert.equal(punk('{42}.1?'),     '{42}');
  assert.equal(punk('{999999}.1?'),'{999999}');
});

test('negative whole numbers — leading `-` is part of the number', () => {
  assert.equal(punk('{-1}.1?'),  '{-1}');
  assert.equal(punk('{-42}.1?'), '{-42}');
});

test('decimal numbers — leading zero required', () => {
  assert.equal(punk('{0.5}.1?'),   '{0.5}');
  assert.equal(punk('{3.141}.1?'), '{3.141}');
});

test('negative decimal numbers', () => {
  assert.equal(punk('{-0.5}.1?'),   '{-0.5}');
  assert.equal(punk('{-3.141}.1?'), '{-3.141}');
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

test('querying a Number via a bound singleton template', () => {
  // `n:{3.141}` binds the number as the *one* item in n.
  // `.N?` indexes the tmpl, so anything past position 1 is out of bounds.
  assert.equal(punk('n:{3.141}   n.1?'), '{3.141}');
  assert.equal(punk('n:{3.141}   n.2?'), 'NULL');
  assert.equal(punk('n:{3.141}   n.3?'), 'NULL');
  assert.equal(punk('n:{42}      n.1?'), '{42}');
  assert.equal(punk('n:{42}      n.2?'), 'NULL');
});

test('querying a Number wrapped in a template — same rules', () => {
  assert.equal(punk('{3.141}.1?'), '{3.141}');
  assert.equal(punk('{3.141}.3?'), 'NULL');
  assert.equal(punk('{45.7}.4?'),  'NULL');
});

test('chained path on a Number indexes its characters', () => {
  // `.1?` first picks the number out of the wrapping tmpl, then `.M?`
  // indexes the number's character form (numbers convert to chars when
  // path-indexed directly).
  assert.equal(punk('n:{42}      n.1.1?'), '{4}');
  assert.equal(punk('n:{42}      n.1.2?'), '{2}');
  assert.equal(punk('n:{42}      n.1.3?'), 'NULL');
  assert.equal(punk('n:{3.141}   n.1.1?'), '{3}');
  assert.equal(punk('n:{3.141}   n.1.2?'), '{.}');
  assert.equal(punk('n:{45.7}    n.1.4?'), '{7}');
  assert.equal(punk('n:{42}      n.1.#?'), '{2}');
});

test('zero forms', () => {
  assert.equal(punk('{0}.1?'),    '{0}');
  assert.equal(punk('{0.0}.1?'),  '{0.0}');
  assert.equal(punk('{-0}.1?'),   '{-0}');
});

test('numbers inside a template print without auto-wrap', () => {
  // Numbers auto-wrap only when they are the bare final REPL value.
  // Inside a structured template they're just items.
  assert.equal(punk('{1 2 3}'), '{1 2 3}');
});

test('numbers can be bound to a name', () => {
  assert.equal(punk('pi:{3.141}  pi?'), '{3.141}');
});

test('a digit-led token cannot be a name', () => {
  // Numbers and names are syntactically distinct.
  // (Cross-tested in named.test.mjs)
  assert.equal(punk('{42}.1?'), '{42}');
});

test('arithmetically extreme values still print as written', () => {
  assert.equal(punk('{1000000}.1?'),   '{1000000}');
  assert.equal(punk('{-1000000}.1?'),  '{-1000000}');
});
