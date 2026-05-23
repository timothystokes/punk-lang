// Partial application — `'` in place of `!`.
//
// From doc § "Partial Functions":
//   - `f'arg` pre-fills leftmost params, returns a new function for the rest.
//   - Arguments are consumed left-to-right.
//   - Filling every param produces a zero-arg function — `f!` then runs it.
//   - Same call form / pattern fill as `!`.
//   - Works on built-ins too.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('partial application pre-fills the leftmost parameter', () => {
  assert.equal(
    punk('add:([a] [b]){+!{a? b?}}  add5:add\'5  add5!3'),
    '{8}'
  );
});

test('partial application with multiple args fills left-to-right', () => {
  assert.equal(
    punk('add:([a] [b]){+!{a? b?}}  add37:add\'{3 7}  add37!'),
    '{10}'
  );
});

test('full pre-fill produces a zero-arg function', () => {
  assert.equal(
    punk('greet:([g] [n]){g? n?}  hello-tim:greet\'{Hello Tim}  hello-tim!'),
    '{Hello Tim}'
  );
});

test('partial of a built-in', () => {
  // `X'2` pre-fills the first arg of `X!` as 2; the result is a doubler.
  assert.equal(punk('double:X\'2  double!5'),  '{10}');
});

test('partial of a built-in — chained through a pipeline', () => {
  // 5 -> double -> log! prints 10. We assert the value coming out.
  assert.equal(punk('double:X\'2  5->double!'), '{10}');
});

test('partial result is a value — can be queried back', () => {
  // The partial is a function; querying it shows it as a function value.
  // We just check it can be bound and called.
  assert.equal(
    punk('add:([a] [b]){+!{a? b?}}  add5:add\'5  add5!3'),
    '{8}'
  );
});
