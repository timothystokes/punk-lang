// Conditions — using patterns to make decisions.
//
// From doc § "Using Patterns", "Using Patterns for conditions", "Truthiness":
//   - `value?(pattern)` — bare predicate, returns TRUE/FALSE.
//   - `value?(pattern){template}` — if-then; returns template on match,
//     NULL on miss.
//   - `value??{ (p1){t1} (p2){t2} ... }` — multi-branch; first match wins;
//     no matching branch is a runtime error.
//   - Truthiness: FALSE and NULL are falsy; everything else (including 0,
//     {}, ()) is truthy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('bare predicate — match returns TRUE', () => {
  assert.equal(punk('number:5  number?(5)'), 'TRUE');
});

test('bare predicate — non-match returns FALSE', () => {
  assert.equal(punk('number:5  number?(6)'), 'FALSE');
});

test('if-then on match returns the template result', () => {
  assert.equal(
    punk('number:5  number?(5){Found five.}'),
    '{Found five.}'
  );
});

test('if-then on miss returns NULL', () => {
  assert.equal(
    punk('number:5  number?(6){Found six.}'),
    'NULL'
  );
});

test('multi-branch dispatch — first matching pattern wins', () => {
  const src = `number:5
    number??{
      (5){Found five.}
      (7){Found seven.}
      (_){Found something else.}
    }`;
  assert.equal(punk(src), '{Found five.}');
});

test('multi-branch falls through to wildcard', () => {
  const src = `number:99
    number??{
      (5){Found five.}
      (7){Found seven.}
      (_){Found something else.}
    }`;
  assert.equal(punk(src), '{Found something else.}');
});

test('multi-branch with no matching branch is a runtime error', () => {
  punkThrows(`number:99
    number??{
      (5){five}
      (7){seven}
    }`);
});

test('multi-branch matches `(___)` as a catch-all for any shape', () => {
  assert.equal(
    punk('xs:{a b c}  xs??{(___){any}}'),
    '{any}'
  );
});

test('truthiness — FALSE is falsy', () => {
  const src = `x:FALSE  x??{(TRUE){t}(FALSE){f}}`;
  assert.equal(punk(src), '{f}');
});

test('truthiness — NULL is falsy', () => {
  // Using `(NULL)` as an explicit branch (any value is matchable).
  assert.equal(
    punk('x:NULL  x??{(NULL){nope}(_){yep}}'),
    '{nope}'
  );
});

test('truthiness — 0 is truthy', () => {
  // 0 is neither FALSE nor NULL; it falls to the catch-all.
  assert.equal(
    punk('x:0  x??{(FALSE){f}(NULL){n}(_){truthy}}'),
    '{truthy}'
  );
});

test('truthiness — empty template `{}` is truthy', () => {
  assert.equal(
    punk('x:{}  x??{(FALSE){f}(NULL){n}(_){t}(___){tt}}'),
    '{tt}'
  );
});

test('match template references pattern-bound name', () => {
  // `tagger` example: a regex slot named `n` bound inside the template.
  assert.equal(
    punk('tagger:(n:/^\\d+$/){Number:n?}  tagger!42'),
    '{Number:42}'
  );
});
