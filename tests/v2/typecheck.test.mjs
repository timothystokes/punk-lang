// Type checks + conversion builtins (docs §Type Checks, §Conversion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse }    from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings } from '../../src/v2/builtins.js';
import { formatValue } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src) => formatValue(val(src));

test('isnum!', () => {
  assert.equal(fmt('isnum!3'), 'TRUE');
  assert.equal(fmt('isnum!hi'), 'FALSE');
  assert.equal(fmt('isnum!{1 2}'), 'FALSE');
});

test('istext!', () => {
  assert.equal(fmt('istext!hi'), 'TRUE');
  assert.equal(fmt('istext!3'), 'FALSE');
});

test('islist!: empty and many-item are lists, single-item is not', () => {
  assert.equal(fmt('islist!{}'), 'TRUE');
  assert.equal(fmt('islist!{a b c}'), 'TRUE');
  assert.equal(fmt('islist!{x}'), 'FALSE');
  assert.equal(fmt('islist!hi'), 'FALSE');
});

test('isfn!', () => {
  assert.equal(fmt('double:(n){* n 2} isfn!double?'), 'TRUE');
  assert.equal(fmt('isfn!3'), 'FALSE');
});

test('isempty!', () => {
  assert.equal(fmt('isempty!{}'), 'TRUE');
  assert.equal(fmt('isempty!{a}'), 'FALSE');
  assert.equal(fmt("isempty!\"\""), 'FALSE'); // regex, not empty value
});

test('num! parses numeric text', () => {
  assert.equal(fmt('num!42'), '42');
  assert.equal(fmt('num!3.14'), '3.14');
  assert.equal(fmt('num!-7'), '-7');
});

test('num! is identity on numbers', () => {
  assert.equal(fmt('num!7'), '7');
});

test('num! errors on non-numeric text', () => {
  assert.throws(() => val('num!hi'), /num: cannot parse/);
});

test('text! renders any value as text', () => {
  assert.equal(fmt('text!42'), '42');
  assert.equal(fmt('text!{a b c}'), '{a b c}');
  assert.equal(fmt('text!TRUE'), 'TRUE');
});

test('type-check builtins bind as values', () => {
  // unary type checks don't partial usefully; just verify they bind.
  assert.equal(fmt('check:isnum? check!7'), 'TRUE');
});
