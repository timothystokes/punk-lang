// Text built-ins.
//
// From doc § "Text":
//   - Text builtins expect unstructured text. Structured input is
//     implicitly joined with a single space.
//   - Output is unstructured EXCEPT `split!` and `chars!` which produce
//     structured templates.
//   - Args are ordered "how then what" — modifier first, data last, so
//     `'`-partial yields a useful unary function.
//
// Functions covered: split join upper lower trim replace chars

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- split! -----------------------------------------------------------

test('split! — splits unstructured text by separator', () => {
  assert.equal(punk('split!{- foo-bar-baz}'), '{foo bar baz}');
});

test('split! — separator with no occurrences returns single-item template', () => {
  assert.equal(punk('split!{- "no-dashes-here-actually-yes"}'), '{no dashes here actually yes}');
});

test('split! — multi-character separator', () => {
  assert.equal(punk('split!{", " "a, b, c"}'), '{a b c}');
});

// ---- join! ------------------------------------------------------------

test('join! — joins items with separator', () => {
  assert.equal(punk('join!{- {red green blue}}'), '"red-green-blue"');
});

test('join! — empty list joins to empty text', () => {
  assert.equal(punk('join!{- {}}'), '""');
});

test('join! — single-item list has no separator inserted', () => {
  assert.equal(punk('join!{- {only}}'), '"only"');
});

// ---- upper! / lower! --------------------------------------------------

test('upper! — uppercases letters', () => {
  assert.equal(punk('upper!"hello"'), '"HELLO"');
});

test('lower! — lowercases letters', () => {
  assert.equal(punk('lower!"HELLO"'), '"hello"');
});

test('upper! on structured input — implicit join with space', () => {
  // `upper!{hello world}` ≡ `upper!join!{" " {hello world}}` ≡ `upper!"hello world"`
  assert.equal(punk('upper!{hello world}'), '"HELLO WORLD"');
});

test('lower! on structured input — implicit join with space', () => {
  assert.equal(punk('lower!{HELLO WORLD}'), '"hello world"');
});

// ---- trim! ------------------------------------------------------------

test('trim! — strips leading and trailing whitespace', () => {
  assert.equal(punk('trim!"  hi  "'), '"hi"');
});

test('trim! — empty stays empty', () => {
  assert.equal(punk('trim!""'), '""');
});

test('trim! — no internal whitespace touched', () => {
  assert.equal(punk('trim!"  a b  "'), '"a b"');
});

// ---- replace! ---------------------------------------------------------

test('replace! — replaces all occurrences', () => {
  assert.equal(punk('replace!{- \\_ "foo-bar-baz"}'), '"foo_bar_baz"');
});

test('replace! — no match returns input unchanged', () => {
  assert.equal(punk('replace!{x \\_ "abc"}'), '"abc"');
});

// ---- chars! -----------------------------------------------------------

test('chars! — splits text into one-character items', () => {
  assert.equal(punk('chars!"abc"'), '{a b c}');
});

test('chars! — empty text yields empty template', () => {
  assert.equal(punk('chars!""'), '{}');
});

// ---- partials with "how then what" ordering ---------------------------

test("partial — `split'-` is a unary text splitter", () => {
  const src = `dash-split:split'-
    dash-split!"a-b-c"`;
  assert.equal(punk(src), '{a b c}');
});

test("partial — `replace'{old new}` is a unary text transformer", () => {
  const src = `kebab-to-snake:replace'{- \\_}
    kebab-to-snake!"foo-bar-baz"`;
  assert.equal(punk(src), '"foo_bar_baz"');
});
