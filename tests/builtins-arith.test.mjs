// Arithmetic builtins.
//
// From doc § "Arithmetic":
//   +! *! variadic; -! /! ^! %! binary; min! max! variadic;
//   abs! neg! floor! ceil! round! sqrt! unary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punk } from './_punk.mjs';

test('+! sum', () => {
  assert.equal(punk('+!{1 2 3 4}'), '{10}');
  assert.equal(punk('+!{5}'),       '{5}');
  assert.equal(punk('+!{}'),        '{0}');
});

test('+! handles decimals', () => {
  assert.equal(punk('+!{0.5 0.25}'), '{0.75}');
});

test('+! handles negatives', () => {
  assert.equal(punk('+!{-1 -2 5}'), '{2}');
});

test('*! product', () => {
  assert.equal(punk('*!{2 3 4}'), '{24}');
  assert.equal(punk('*!{5}'),     '{5}');
  assert.equal(punk('*!{}'),      '{1}');
});

test('-! difference', () => {
  assert.equal(punk('-!{10 3}'), '{7}');
  assert.equal(punk('-!{0 5}'),  '{-5}');
});

test('/! division', () => {
  assert.equal(punk('/!{10 2}'), '{5}');
  assert.equal(punk('/!{1 4}'),  '{0.25}');
});

test('^! power', () => {
  assert.equal(punk('^!{2 10}'), '{1024}');
  assert.equal(punk('^!{2 0}'),  '{1}');
});

test('%! remainder', () => {
  assert.equal(punk('%!{10 3}'), '{1}');
  assert.equal(punk('%!{12 4}'), '{0}');
});

test('min! / max!', () => {
  assert.equal(punk('min!{4 2 9 5}'), '{2}');
  assert.equal(punk('max!{4 2 9 5}'), '{9}');
  assert.equal(punk('min!{-1 -5 3}'), '{-5}');
});

test('abs! / neg!', () => {
  assert.equal(punk('abs!-5'),  '{5}');
  assert.equal(punk('abs!5'),   '{5}');
  assert.equal(punk('neg!5'),   '{-5}');
  assert.equal(punk('neg!-5'),  '{5}');
});

test('floor! / ceil! / round!', () => {
  assert.equal(punk('floor!3.7'), '{3}');
  assert.equal(punk('ceil!3.2'),  '{4}');
  assert.equal(punk('round!3.5'), '{4}');
  assert.equal(punk('round!3.4'), '{3}');
});

test('sqrt!', () => {
  assert.equal(punk('sqrt!9'),  '{3}');
  assert.equal(punk('sqrt!16'), '{4}');
});
