// Patterns — shape-based matching.
//
// From doc § "Patterns":
//   - `(...)` is a pattern; `{...}` is a value. `()` matches only `{}`.
//   - `(_)` matches a template with exactly one thing.
//   - `(___)` matches any number of things (zero or more).
//   - Positional matching: `(_ _)` is exactly two things; `(_ _ _)` three.
//   - Literals match exact values: `(hello _)` etc.
//   - Only one variadic `___` per pattern.
//   - Patterns nest: `((_ _) _)`.
//   - Slots can be named: `(x:_ y:_)`.
//   - Patterns can have regex slots `/.../`; capture groups bind by index;
//     named groups `(?<name>...)` also reachable by name.
//   - Unmatched optional group binds to NULL.
//   - Patterns themselves can be named: `isFive:(5)`.
//
// Patterns are applied to queries — see conditions.test.mjs for that.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

test('a pattern is itself a value — prints as PDN', () => {
  assert.equal(punk('(_)'), '(_)');
  assert.equal(punk('(_ _)'), '(_ _)');
  assert.equal(punk('()'), '()');
});

test('a named pattern stores the pattern under a name', () => {
  assert.equal(punk('isFive:(5)  isFive?'), '(5)');
});

test('empty pattern matches empty template', () => {
  assert.equal(punk('{}?()'), 'TRUE');
});

test('empty pattern does not match a non-empty template', () => {
  assert.equal(punk('{1}?()'), 'FALSE');
});

test('`(_)` matches single-item template only', () => {
  assert.equal(punk('{x}?(_)'), 'TRUE');
  assert.equal(punk('{}?(_)'), 'FALSE');
  assert.equal(punk('{x y}?(_)'), 'FALSE');
});

test('`(___)` matches templates of any length, including empty', () => {
  assert.equal(punk('{}?(___)'), 'TRUE');
  assert.equal(punk('{a}?(___)'), 'TRUE');
  assert.equal(punk('{a b c}?(___)'), 'TRUE');
});

test('exact-count patterns', () => {
  assert.equal(punk('{a b}?(_ _)'), 'TRUE');
  assert.equal(punk('{a b c}?(_ _)'), 'FALSE');
  assert.equal(punk('{a}?(_ _)'), 'FALSE');
});

test('literal slot matches exact value, wildcard slot matches anything', () => {
  assert.equal(punk('{hello world}?(hello _)'), 'TRUE');
  assert.equal(punk('{bye world}?(hello _)'),   'FALSE');
  assert.equal(punk('{x 0}?(_ 0)'),             'TRUE');
  assert.equal(punk('{x 1}?(_ 0)'),             'FALSE');
});

test('three-slot literal/wildcard mix', () => {
  assert.equal(punk('{John Q Smith}?(John _ Smith)'), 'TRUE');
  assert.equal(punk('{Mary Q Smith}?(John _ Smith)'), 'FALSE');
});

test('TRUE as a literal slot', () => {
  assert.equal(punk('{TRUE a b}?(TRUE _ _)'), 'TRUE');
  assert.equal(punk('{FALSE a b}?(TRUE _ _)'), 'FALSE');
});

test('variadic mid-pattern — start ... end', () => {
  assert.equal(punk('{start a b c end}?(start ___ end)'), 'TRUE');
  assert.equal(punk('{start end}?(start ___ end)'),       'TRUE');
  assert.equal(punk('{start a b}?(start ___ end)'),       'FALSE');
});

test('variadic leading — `___ end`', () => {
  assert.equal(punk('{a b end}?(___ end)'), 'TRUE');
  assert.equal(punk('{end}?(___ end)'),     'TRUE');
  assert.equal(punk('{end a}?(___ end)'),   'FALSE');
});

test('variadic trailing — `start ___`', () => {
  assert.equal(punk('{start a b}?(start ___)'), 'TRUE');
  assert.equal(punk('{start}?(start ___)'),     'TRUE');
  assert.equal(punk('{a start}?(start ___)'),   'FALSE');
});

test('two variadics in one pattern is a syntax error', () => {
  punkThrows('{a b}?(___ ___)');
});

test('nested pattern — a pair followed by a single thing', () => {
  assert.equal(punk('{{a b} c}?((_ _) _)'), 'TRUE');
  assert.equal(punk('{{a b c} c}?((_ _) _)'), 'FALSE');
  assert.equal(punk('{a c}?((_ _) _)'),       'FALSE');
});

test('nested pattern with literal slot inside', () => {
  assert.equal(punk('{{John 30} ok}?((John _) _)'), 'TRUE');
  assert.equal(punk('{{Mary 30} ok}?((John _) _)'), 'FALSE');
});

test('named slots do not affect what is matched — only shape and order', () => {
  assert.equal(punk('{1 2}?(x:_ y:_)'), 'TRUE');
  assert.equal(punk('{1 2 3}?(x:_ y:_)'), 'FALSE');
});

test('regex slot — only digits', () => {
  assert.equal(punk('{42}?(/^\\d+$/)'),     'TRUE');
  assert.equal(punk('{abc}?(/^\\d+$/)'),    'FALSE');
});

test('regex slot mixed with wildcard', () => {
  assert.equal(punk('{x 42}?(_ /^\\d+$/)'), 'TRUE');
  assert.equal(punk('{x ab}?(_ /^\\d+$/)'), 'FALSE');
});
