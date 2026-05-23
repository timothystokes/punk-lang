// Collection built-ins.
//
// From doc § "Collections":
//   - HOF callbacks take one or two args: `(item)` or `(item index)`.
//     `item` preserves Named-ness; use `item.:?` for its name.
//   - `reduce!` is special: its callback is (acc value).
//   - HOFs take behaviour first, data last (so `'`-partial is useful).
//
// Functions covered:
//   map filter reduce find each count sort rev unique contains
//
// Callback-arity is covered exhaustively in hof-arity.test.mjs;
// this file only sanity-checks each builtin's data behaviour.
//
// Notes on REPL display:
//   - A template prints as `{...}`.
//   - A single bare item like a number or word still REPL-wraps as `{x}`.
//   - TRUE/FALSE/NULL print bare.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- map! -------------------------------------------------------------

test('map! — applies fn to each item', () => {
  assert.equal(
    punk('map!{(n:_){X!{n? 10}}~ {1 2 3}}'),
    '{10 20 30}'
  );
});

test('map! — empty template maps to empty', () => {
  assert.equal(
    punk('map!{(n:_){X!{n? 2}} {}}'),
    '{}'
  );
});

// ---- filter! ----------------------------------------------------------

test('filter! — keeps items where predicate is TRUE', () => {
  assert.equal(
    punk('filter!{(n:_){>!{n? 2}}~ {1 2 3 4 5}}'),
    '{3 4 5}'
  );
});

test('filter! — empty result when no item passes', () => {
  assert.equal(
    punk('filter!{(n:_){>!{n? 100}}~ {1 2 3}}'),
    '{}'
  );
});

// ---- reduce! ----------------------------------------------------------

test('reduce! — folds left-to-right with seed', () => {
  // Callback is (acc value); acc first so `reduce'fn` partials cleanly.
  assert.equal(
    punk('reduce!{(a:_ b:_){+!{a? b?}}~ 0 {1 2 3 4}}'),
    '{10}'
  );
});

test('reduce! — seed is returned for empty collection', () => {
  assert.equal(
    punk('reduce!{(a:_ b:_){+!{a? b?}}~ 99 {}}'),
    '{99}'
  );
});

// ---- find! ------------------------------------------------------------

test('find! — first item matching predicate', () => {
  assert.equal(
    punk('find!{(n:_){>!{n? 2}}~ {1 2 3 4 5}}'),
    '{3}'
  );
});

test('find! — NULL when nothing matches', () => {
  assert.equal(
    punk('find!{(n:_){>!{n? 100}}~ {1 2 3}}'),
    'NULL'
  );
});

// ---- each! ------------------------------------------------------------

test('each! — returns NULL', () => {
  // Side-effect only; value is NULL.
  assert.equal(
    punk('each!{(v:_){v?} {1 2 3}}'),
    'NULL'
  );
});

// ---- count! -----------------------------------------------------------

test('count! — number of items matching predicate', () => {
  assert.equal(
    punk('count!{(n:_){>!{n? 2}}~ {1 2 3 4 5}}'),
    '{3}'
  );
});

test('count! — zero when no item matches', () => {
  assert.equal(
    punk('count!{(n:_){>!{n? 100}}~ {1 2 3}}'),
    '{0}'
  );
});

// ---- sort! ------------------------------------------------------------

test('sort! — unary form, ascending', () => {
  assert.equal(
    punk('sort!{3 1 4 1 5 9 2 6}'),
    '{1 1 2 3 4 5 6 9}'
  );
});

test('sort! — with comparator (TRUE if a should come before b)', () => {
  // Descending: a comes before b when a > b.
  assert.equal(
    punk('sort!{(a:_ b:_){>!{a? b?}}~ {3 1 4 1 5}}'),
    '{5 4 3 1 1}'
  );
});

// ---- rev! -------------------------------------------------------------

test('rev! — reverses items', () => {
  assert.equal(punk('rev!{1 2 3 4}'), '{4 3 2 1}');
});

test('rev! — empty stays empty', () => {
  assert.equal(punk('rev!{}'), '{}');
});

// ---- unique! ----------------------------------------------------------

test('unique! — removes duplicates, keeps first occurrence', () => {
  assert.equal(punk('unique!{a b a c b d}'), '{a b c d}');
});

test('unique! — already-unique list unchanged', () => {
  assert.equal(punk('unique!{1 2 3}'), '{1 2 3}');
});

// ---- contains! --------------------------------------------------------

test('contains! — TRUE when present', () => {
  assert.equal(punk('contains!{b {a b c}}'), 'TRUE');
});

test('contains! — FALSE when absent', () => {
  assert.equal(punk('contains!{z {a b c}}'), 'FALSE');
});

// ---- partial-friendly arg order ---------------------------------------

test("partial — `map'fn` is a unary list transformer", () => {
  const src = `double:map'(n:_){X!{n? 2}}~
    double!{1 2 3}`;
  assert.equal(punk(src), '{2 4 6}');
});

test("partial — `reduce'{fn 0}` is a list summer", () => {
  const src = `sum:reduce'{(a:_ b:_){+!{a? b?}}~ 0}
    sum!{1 2 3 4}`;
  assert.equal(punk(src), '{10}');
});
