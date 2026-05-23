// Atoms — the one mutable cell in Punk (Clojure's name for boxes).
//
// From doc § "Atoms":
//   - `@name` IS the atom; no `:` binding form.
//   - Brought into existence by writing into it: `value->@name!`.
//   - Read: `@name->fn!` (atom on the LEFT of `->`).
//   - Write: `value->@name!` (atom on the RIGHT of `->`).
//   - Same atom can appear on both sides in one chain: read, transform, write.
//   - Atoms sit outside the normal namespace.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('write then read an atom', () => {
  // Write 42 into @n, then pipe it through a function that returns it.
  // Pipe seed wraps uniformly: `42->@n!` stores `{42}`. Reading the
  // atom and calling a 1-slot fn produces `{{42}}` — the body has one
  // item (`v?`) and a fn body is always returned as a template.
  assert.equal(
    punk('42->@n!  @n->(v:_){v?}!'),
    '{{42}}'
  );
});

test('overwriting an atom replaces its contents', () => {
  assert.equal(
    punk('1->@n!  2->@n!  @n->(v:_){v?}!'),
    '{{2}}'
  );
});

test('read-transform-write — counter increment', () => {
  // 0 into @c, then read+1 back twice.
  const src = `0->@c!
    @c->+'1->@c!
    @c->+'1->@c!
    @c->(v:_){v?}!`;
  assert.equal(punk(src), '{2}');
});

test('an atom can hold any value, including a template', () => {
  // The atom stores the stage's running value (here `{a b c}`).
  // Reading and passing through a 1-slot fn wraps once more: args
  // is `{{a b c}}`, slot binds the inner template, body returns
  // `{ {a b c} }`.
  assert.equal(
    punk('{a b c}->@xs!  @xs->(v:_){v?}!'),
    '{{a b c}}'
  );
});

test('atoms and ordinary names do not interact', () => {
  // n as a regular name; @n as an atom. They are different things.
  // `n?.?` first reads n's value (the auto-wrapped `{1}`), then `.?`
  // inlines that tmpl's items — landing `1` bare in the parent.
  // The atom read goes through a 1-slot fn, picking up a uniform wrap.
  assert.equal(
    punk('n:1  2->@n!  {n?.? @n->(v:_){v?}!}!'),
    '{1 {{2}}}'
  );
});
