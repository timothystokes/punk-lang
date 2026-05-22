// `_?` — resolve the single anonymous slot of a `(_)` function.
//
// From the data-processing redesign principle 3:
//
//   double:(_)+!{_? 2}
//
// `_?` is ONLY legal inside a function whose pattern is exactly `(_)`
// (a single anonymous slot). Anywhere else — including `(_ _)`,
// `(x:_)`, top-level, inside `(*)` — it is a syntax/runtime error.
//
// `*?` (resolve the variadic) is unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---------- valid uses ----------

test('`_?` resolves the only slot of a (_) function', () => {
  assert.equal(punk('double:(_)X!{_? 2}  double!21'), '{42}');
});

test('`_?` works as a single-expression body for (_)', () => {
  // 1-param body sugar: `(_)expr` ≡ `(_){expr}`
  assert.equal(punk('id:(_)_?  id!7'), '{7}');
});

test('`_?` works inside a nested `(_)` partial', () => {
  // outer (x:_) closes over x; inner (_) uses _? for its own arg.
  assert.equal(
    punk(`
      add:(x:_){(_)+!{x? _?}}
      inc:add!10
      inc!5
    `),
    '{15}'
  );
});

// ---------- invalid uses ----------

test('`_?` outside any function is a syntax/runtime error', () => {
  punkThrows('_?');
});

test('`_?` in a named-slot function is an error', () => {
  punkThrows('f:(x:_)_?  f!1');
});

test('`_?` in a multi-slot function is an error', () => {
  punkThrows('f:(_ _)_?  f!{1 2}');
});

test('`_?` in a variadic-only function is an error', () => {
  // `(*)` is variadic; `*?` resolves it. `_?` does NOT.
  punkThrows('f:(*)_?  f!{1 2 3}');
});

// ---------- `*?` still works ----------

test('`*?` resolves the variadic of a (*) function', () => {
  // `*?` lands the captured tmpl as one item; `.?` inlines its items
  // so `+!` sees the numbers individually.
  assert.equal(punk('sum:(*)+!*?.?  sum!{1 2 3}'), '{6}');
});
