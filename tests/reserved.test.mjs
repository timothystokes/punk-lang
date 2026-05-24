// Reserved values — TRUE, FALSE, NULL.
//
// Rules (from doc):
//   - Print bare at the REPL (no auto-wrap).
//   - Comparison/boolean builtins return TRUE/FALSE.
//   - `??` dispatches on them via `(TRUE){...} (FALSE){...}`.
//   - NULL is returned for invalid paths, unnamed-thing `.:?`, non-fn `._?`,
//     unmatched regex groups, void functions.
//   - NULL is not truthy.
//   - All three can be named, passed, compared, matched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

// ---------- Bare printing ----------

test('TRUE prints bare', () => {
  assert.equal(punk('TRUE'), 'TRUE');
});

test('FALSE prints bare', () => {
  assert.equal(punk('FALSE'), 'FALSE');
});

test('NULL prints bare', () => {
  assert.equal(punk('NULL'), 'NULL');
});

// ---------- Inside templates they're just values ----------

test('reserved values inside a structured template appear as-is', () => {
  assert.equal(punk('{TRUE FALSE NULL}'), '{TRUE FALSE NULL}');
});

// ---------- Naming ----------

test('reserved values can be bound to names', () => {
  // Reserved words wrap like any value Word, so `ok:TRUE` ≡ `ok:{TRUE}`
  // and the query returns the wrapped singleton.
  assert.equal(punk('ok:TRUE       ok?'),   '{TRUE}');
  assert.equal(punk('done:FALSE    done?'), '{FALSE}');
  assert.equal(punk('absent:NULL   absent?'),'{NULL}');
});

// ---------- NULL is produced by invalid paths ----------

test('querying an unbound name returns NULL', () => {
  assert.equal(punk('nope?'), 'NULL');
});

test('an out-of-range index returns NULL', () => {
  assert.equal(punk('xs:{a b c}  xs.99?'), 'NULL');
});

test('a missing named field inside a record returns NULL', () => {
  assert.equal(punk('r:{a:1 b:2}  r.c?'), 'NULL');
});

test('the name segment of an unnamed thing returns NULL', () => {
  assert.equal(punk('xs:{a b c}  xs.1.:?'), 'NULL');
});

test('the pattern segment of a non-function returns NULL', () => {
  assert.equal(punk('x:42  x._?'),       'NULL');
  assert.equal(punk('xs:{1 2}  xs._?'), 'NULL');
});

// ---------- Comparison & dispatch ----------

test('NULL equals NULL', () => {
  assert.equal(punk('=!{NULL NULL}'), 'TRUE');
});

test('NULL is not equal to FALSE', () => {
  assert.equal(punk('=!{NULL FALSE}'), 'FALSE');
});

test('TRUE is not equal to FALSE', () => {
  assert.equal(punk('=!{TRUE FALSE}'), 'FALSE');
});

test('reserved values can be matched by pattern', () => {
  assert.equal(
    punk('x:NULL  x??{ (NULL){"nope"} (_){"yep"} }!'),
    '"nope"'
  );
  assert.equal(
    punk('x:TRUE  x??{ (TRUE){"yes"} (FALSE){"no"} }!'),
    '"yes"'
  );
});
