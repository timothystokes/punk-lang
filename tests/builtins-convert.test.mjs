// Conversion built-ins.
//
// From doc § "Conversion":
//   - `num!t` — parses `t` as a number; runtime error on non-numeric text.
//   - There is no `text!` builtin — use `"{thing?}"` interpolation instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk, punkThrows } from './_punk.mjs';

// ---- num! -------------------------------------------------------------

test('num! — parses integer text', () => {
  assert.equal(punk('num!"42"'), '{42}');
});

test('num! — parses decimal text', () => {
  assert.equal(punk('num!"3.141"'), '{3.141}');
});

test('num! — parses negative number text', () => {
  assert.equal(punk('num!"-7"'), '{-7}');
});

test('num! — result is a real number usable in arithmetic', () => {
  assert.equal(punk('+!{num!"3" num!"4"}'), '{7}');
});

test('num! — non-numeric text is a runtime error', () => {
  punkThrows('num!"hello"');
});

test('num! — empty text is a runtime error', () => {
  punkThrows('num!""');
});

// ---- text via interpolation (no text! builtin) ------------------------

test('rendering a value as text — interpolate into `"..."` (cascade)', () => {
  // Text is inert; `!` triggers cascade through embedded queries.
  assert.equal(punk('x:42  "{x?}"!'), '"42"');
});

test('rendering a template as text via interpolation', () => {
  assert.equal(punk('t:{a b c}  "{t?}"!'), '"a b c"');
});
