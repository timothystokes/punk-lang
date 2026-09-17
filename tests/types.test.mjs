// Top-level "Types of things" — exhaustive REPL formatting for every
// kind of value, the auto-wrap rule, and the print-bare rule.
//
// Auto-wrap rule (from doc):
//   Only Words and Numbers auto-wrap into a single-item structured
//   template when they appear as the final REPL value (e.g. resolved
//   via a query). Everything else prints bare. A bare Word/Number can
//   no longer stand alone as a whole top-level statement — it must
//   always be written inside `{...}`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('a bare Word cannot stand alone as a top-level value', () => {
  punkThrows('Sydney');
});

test('a queried bare Word auto-wraps into a structured template', () => {
  assert.equal(punk('{Sydney}.1?'), '{Sydney}');
});

test('a bare Word with non-letters still auto-wraps', () => {
  assert.equal(punk('{red-green-blue}.1?'), '{red-green-blue}');
  assert.equal(punk('{&}.1?'), '{&}');
});

test('a bare Number auto-wraps', () => {
  assert.equal(punk('{42}.1?'),    '{42}');
  assert.equal(punk('{0}.1?'),     '{0}');
  assert.equal(punk('{-5}.1?'),    '{-5}');
  assert.equal(punk('{0.5}.1?'),   '{0.5}');
  assert.equal(punk('{3.141}.1?'), '{3.141}');
});

test('an unstructured template prints as-is, never wrapped', () => {
  assert.equal(punk('"Hello world"'), '"Hello world"');
  assert.equal(punk('""'), '""');
});

test('a structured template prints as-is, never wrapped', () => {
  assert.equal(punk('{1 2 3}'),    '{1 2 3}');
  assert.equal(punk('{}'),         '{}');
  assert.equal(punk('{Sydney}'),   '{Sydney}');
  assert.equal(punk('{a {b c} d}'),'{a {b c} d}');
});

test('reserved values TRUE / FALSE / NULL print bare (no auto-wrap)', () => {
  assert.equal(punk('{TRUE}.1?'),  'TRUE');
  assert.equal(punk('{FALSE}.1?'), 'FALSE');
  assert.equal(punk('{NULL}.1?'),  'NULL');
});

test('a pattern prints bare', () => {
  assert.equal(punk('([a] [b])'), '([a] [b])');
  assert.equal(punk('(_)'),       '(_)');
  assert.equal(punk('(*)'),     '(*)');
});

test('a function literal prints bare', () => {
  assert.equal(punk('([n]){n?}'),       '([n]){n?}');
  assert.equal(punk('([s])"hello {s?}"'), '([s])"hello {s?}"');
});

test('multiple top-level entries: REPL returns only the final value', () => {
  assert.equal(punk('x:{5}  x?'), '{5}');
  assert.equal(punk('a:{1}  b:{2}  a?'), '{1}');
});

test('whitespace and newlines around a value are ignored', () => {
  assert.equal(punk('\n  {42}  \n'), '{42}');
  assert.equal(punk('\t"Hi"\t'),   '"Hi"');
});

test('a block comment is ignored', () => {
  assert.equal(punk('# this is a comment # {7}'), '{7}');
  assert.equal(punk('{7} # trailing comment #'),  '{7}');
});
