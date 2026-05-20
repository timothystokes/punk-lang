// Eval rules — `?` vs `!` cascading behaviour.
//
// From doc § "When things actually run":
//   - `?` is a query: resolves only the single path it's attached to.
//   - `!` is execute: evaluates the whole template — every embedded query
//     is resolved and every function reached is run; substitutions cascade
//     through any nested templates that result.
//   - A template in source or held in a name does no work on its own.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('a template held in a name does nothing until triggered', () => {
  // Binding alone — no `?` or `!` — yields no observable side effect.
  // We assert by checking the final REPL value is the binding's value when
  // queried, not some evaluated side-effect form.
  assert.equal(
    punk('name:Bob  msg:"Hi {name?}"  msg?'),
    '"Hi {name?}"'
  );
});

test('`?` resolves exactly one level — embedded queries are not touched', () => {
  assert.equal(
    punk('inner:World  outer:"Hello {inner?}"  outer?'),
    '"Hello {inner?}"'
  );
});

test('`!` cascades through nested templates', () => {
  assert.equal(
    punk('inner:World  outer:"Hello {inner?}"  outer!'),
    '"Hello World"'
  );
});

test('`!` runs functions reached inside the template', () => {
  assert.equal(
    punk('shout:(s:_){upper!s?}  msg:"I said {shout!hi}"  msg!'),
    '"I said HI"'
  );
});

test('`!` cascades into nested unstructured templates inserted by substitution', () => {
  // outer expands to "Hello {inner?}" then continues to resolve {inner?}.
  assert.equal(
    punk('inner:Earth  outer:"Hello {inner?}"  greet:"Say: {outer!}"  greet!'),
    '"Say: Hello Earth"'
  );
});

test('a query without `?` is just literal text', () => {
  assert.equal(
    punk('name:Bob  name'),
    '{name}'
  );
});

test('a template without `!` is just data, even at the REPL', () => {
  assert.equal(
    punk('{1 2 3}'),
    '{1 2 3}'
  );
});
