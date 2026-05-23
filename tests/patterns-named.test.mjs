// Named patterns — `name:(...)` binds a pattern under a name; `(name?)`
// uses it as the pattern part of a function by *splicing* the named
// pattern's slots into the call-site pattern.
//
// From doc § "Named patterns":
//   - Patterns are first-class values. `point:(x:_ y:_)` binds the
//     pattern under `point`. Querying `point?` returns the pattern.
//   - `(point?){body}` resolves `point` at function-build time, expects
//     a Pattern, and splices its slots in. The slot names from the
//     named pattern are visible in the body.
//   - The same named pattern can be reused across multiple functions.
//   - Resolving the reference to anything that isn't a Pattern is an
//     error.
//   - The named pattern is NOT wrapped in a singleton template by the
//     short-form rule — Patterns have their own structural identity.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('a named pattern is stored as the pattern itself (no wrap)', () => {
  // The pattern binds directly under the name — querying it returns the
  // pattern, NOT a singleton template containing the pattern.
  assert.equal(punk('point:(x:_ y:_)  point?'), '(x:_ y:_)');
});

test('a named pattern with a literal slot retains the literal', () => {
  assert.equal(punk('isFive:(5)  isFive?'), '(5)');
});

test('a named pattern with a rest slot retains it', () => {
  assert.equal(punk('rest:(_ *)  rest?'), '(_ *)');
});

test('(p?){body} splices the named pattern into a function pattern', () => {
  // distance over a 2-d point: same as writing (x:_ y:_){...} inline.
  const src = `
    point:(x:_ y:_)
    sumXY:(point?){+!{x? y?}}
    sumXY!{3 4}
  `;
  assert.equal(punk(src), '{7}');
});

test('the same named pattern can be reused across multiple functions', () => {
  const src = `
    point:(x:_ y:_)
    showX:(point?){x?}
    showY:(point?){y?}
    {showX!{10 20} showY!{10 20}}
  `;
  assert.equal(punk(src), '{{10} {20}}');
});

test('a named pattern with a rest slot splices into a function', () => {
  // first item bound to head, rest bound to tail (a tmpl of the rest).
  const src = `
    cons:(head:_ tail:*)
    headOf:(cons?){head?}
    headOf!{a b c}
  `;
  assert.equal(punk(src), '{a}');
});

test('(p?){body} where p resolves to a non-Pattern is an error', () => {
  // p resolves to a Tmpl, not a Pattern — function build fails.
  punkThrows('p:{1 2}  f:(p?){_?}');
});

test('(p?){body} where p is unbound is an error', () => {
  punkThrows('f:(p?){_?}  f!{x}');
});

test('a named pattern composed of a single literal still splices', () => {
  // isFive only matches calls with exactly {5}.
  const src = `
    isFive:(5)
    check:(isFive?){yes}
    check!{5}
  `;
  assert.equal(punk(src), '{yes}');
});

test('a named pattern can be passed around as a value', () => {
  // patterns are first-class values; assigning to a new name preserves
  // the pattern unchanged.
  assert.equal(punk('p:(x:_ y:_)  q:p?  q?'), '(x:_ y:_)');
});
