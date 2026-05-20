// Escape rules — black-box checks via behaviour rather than display.
//
// From doc § "Special Characters" and § "Escapes inside text":
//   - `\` before any character makes that character literal.
//   - Whitespace cannot be escaped — Punk has NO `\<space>` etc.
//   - `\n` -> newline; `\t` -> tab.
//   - `\X` for non-special X is a no-op (`\s` is just `s`).
//
// The REPL's printed form re-escapes special chars so the display is
// round-trippable. Rather than encode every printer rule, most tests
// below verify escape semantics by behaviour — e.g. `=!` equality with
// the canonical form, character counts via `chars!t.#?`, or "did this
// special construct fire?".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- `\?` does not trigger a query ------------------------------------

test('`\\?` keeps `?` literal — no query is fired', () => {
  const src = `name:Tim  =!{"What is your name?" "{What is your name\\?}"}`;
  assert.equal(punk(src), 'TRUE');
});

// ---- `\!` does not trigger execution ----------------------------------

test('`\\!` keeps `!` literal — no execution is fired', () => {
  const src = `f:(x:_){x?}  =!{"Hello f!" "Hello f\\!"}`;
  assert.equal(punk(src), 'TRUE');
});

// ---- `\:` keeps colon literal -----------------------------------------

test('`\\:` is a literal colon — no name binding', () => {
  const src = `=!{"foo:bar" "foo\\:bar"}`;
  assert.equal(punk(src), 'TRUE');
});

// ---- `\{` and `\}` — literal braces inside text -----------------------

test('`\\{` and `\\}` are literal braces in text — 3 chars', () => {
  assert.equal(punk('chars!"\\{x\\}".#?'), '{3}');
});

// ---- `\(` / `\)` ------------------------------------------------------

test('`\\(` and `\\)` are literal parens — 3 chars', () => {
  assert.equal(punk('chars!"\\(x\\)".#?'), '{3}');
});

// ---- `\[` / `\]` ------------------------------------------------------

test('`\\[` and `\\]` are literal brackets — 3 chars (not a box)', () => {
  assert.equal(punk('chars!"\\[x\\]".#?'), '{3}');
});

// ---- `\"` inside text -------------------------------------------------

test('`\\"` is a literal quote inside unstructured text — 8 chars', () => {
  // "say \"hi\"" — s a y space " h i "
  assert.equal(punk('chars!"say \\"hi\\"".#?'), '{8}');
});

// ---- `\\` is a literal backslash --------------------------------------

test('`\\\\` is one literal backslash', () => {
  assert.equal(punk('chars!"\\\\".#?'), '{1}');
});

// ---- `\/` literal slash ----------------------------------------------

test('`\\/` is a literal forward slash', () => {
  assert.equal(punk('chars!"\\/".#?'), '{1}');
});

// ---- `\~`, `\#`, `\\\'`, `\-` ----------------------------------------

test('`\\~` is a literal tilde', () => {
  assert.equal(punk('chars!"\\~".#?'), '{1}');
});

test('`\\#` is a literal hash (would otherwise open a comment)', () => {
  assert.equal(punk('chars!"\\#".#?'), '{1}');
});

test("`\\'` is a literal apostrophe", () => {
  assert.equal(punk("chars!\"\\'\".#?"), '{1}');
});

test('`\\-` is a literal hyphen — prevents `->` pairing', () => {
  // "a\->b" — a, -, >, b
  assert.equal(punk('chars!"a\\->b".#?'), '{4}');
});

// ---- whitespace escapes ----------------------------------------------

test('`\\n` is one newline character', () => {
  assert.equal(punk('chars!"\\n".#?'), '{1}');
});

test('`\\t` is one tab character', () => {
  assert.equal(punk('chars!"\\t".#?'), '{1}');
});

test('`\\n` matches a real newline', () => {
  const src = `=!{"a\nb" "a\\nb"}`;
  assert.equal(punk(src), 'TRUE');
});

// ---- escape on non-special is a no-op ---------------------------------

test('`\\X` for non-special X is just X (\\s is `s`)', () => {
  assert.equal(punk('=!{"s" "\\s"}'), 'TRUE');
});

test('`\\a` is just `a`', () => {
  assert.equal(punk('=!{"a" "\\a"}'), 'TRUE');
});

// ---- what does NOT need escaping --------------------------------------

test('`.` does not need escaping outside path tokens — 2 chars in "a."', () => {
  assert.equal(punk('chars!"a.".#?'), '{2}');
});

test('decimal numbers have unescaped dots', () => {
  assert.equal(punk('isnum!3.141'), 'TRUE');
});

test('`_` and `___` are ordinary text outside patterns', () => {
  assert.equal(punk('chars!"___".#?'), '{3}');
});

test('symbol-named builtins do NOT need escaping', () => {
  assert.equal(punk('+!{1 2}'), '{3}');
});

// ---- no escape for whitespace itself ----------------------------------

test('`\\<space>` is a tokenize error — no whitespace escape exists', () => {
  punkThrows('"a\\ b"');
});
