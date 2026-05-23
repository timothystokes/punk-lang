// `_?` — resolve the single anonymous slot of a `(_)` function.
//
// From the data-processing redesign principle 3:
//
//   double:(_)+!{_? 2}
//
// `_?` is ONLY legal inside a function whose pattern is exactly `(_)`
// (a single anonymous slot). Anywhere else — including `(_ _)`,
// `([x])`, top-level, inside `(*)` — it is a syntax/runtime error.
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
  // outer ([x]) closes over x; inner (_) uses _? for its own arg.
  // `~` slices the outer body so `inc` binds to the inner fn directly.
  assert.equal(
    punk(`
      add:([x]){(_)+!{x? _?}}~
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
  punkThrows('f:([x])_?  f!1');
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

// ---------- `*` body-reference: as-passed args, regardless of match ----------
//
// `*` in a body is the WHOLE argument template, independent of how the
// pattern matched. Path access (`*.1?`, `*.name?`) walks into it.

test('`*?` lands the whole args template even when the pattern bound labels', () => {
  // `*?` lands the whole args Tmpl as ONE item inside the body tmpl,
  // so the body `{*?}` wraps it once more — same rule as any single-query body.
  assert.equal(punk('f:([a] [b]){*?}  f!{x y}'), '{{x y}}');
});

test('`*.1?` reads the first positional argument', () => {
  assert.equal(punk('first:(_ *){*.1?}  first!{a b c}'), '{a}');
});

test('`*.N?` indexes into the args by position', () => {
  assert.equal(punk('second:(*){*.2?}  second!{a b c}'), '{b}');
  assert.equal(punk('third:(*){*.3?}   third!{a b c}'),  '{c}');
});

test('`*.name?` reads a Named entry from the args', () => {
  assert.equal(
    punk('getName:(name:_ *){*.name?}  getName!{name:Sally age:32}'),
    '{Sally}',
  );
  // For a multi-item value the query lands the whole tmpl as one item,
  // nesting it inside the body's wrapping tmpl.
  assert.equal(
    punk('full:(*){*.name?}  full!{name:{Sally Smith}}'),
    '{{Sally Smith}}',
  );
});

test('`*` reflects the as-passed args even when context-match labelled them', () => {
  assert.equal(
    punk('f:(name:[n]){*.name?}  f!{name:Sally}'),
    '{Sally}',
  );
});

test('`*.#?` is the length of the args template', () => {
  assert.equal(punk('count:(*){*.#?}  count!{a b c d}'), '{4}');
});
