import test from 'node:test';
import assert from 'node:assert';
import { tokenize } from '../../src/v2/tokenize.js';
import { parse } from '../../src/v2/parse.js';
import { evalProgram } from '../../src/v2/eval.js';
import { rootEnv } from '../../src/v2/env.js';
import { defaultBindings } from '../../src/v2/builtins.js';
import { NULL, TRUE } from '../../src/v2/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;

test('assert!{expected actual} passes when equal', () => {
  const r = val('assert!{3 +!{1 2}}');
  assert.strictEqual(r, NULL);
});

test('assert!{expected actual} fails when not equal', () => {
  assert.throws(() => val('assert!{4 +!{1 2}}'), /expected 4, got 3/);
});

test('assert!{} works with text equality', () => {
  const r = val('assert!{hello hello}');
  assert.strictEqual(r, NULL);
});

test('assert!{} works with tmpl equality', () => {
  const r = val('xs:{1 2 3} assert!{ {1 2 3} xs? }');
  assert.strictEqual(r, NULL);
});

test('assert!cond passes when TRUE', () => {
  const r = val('assert!TRUE');
  assert.strictEqual(r, NULL);
});

test('assert!cond fails when FALSE', () => {
  assert.throws(() => val('assert!FALSE'), /assert: condition is FALSE/);
});

test('assert!cond fails on non-bool', () => {
  assert.throws(() => val('assert!42'), /condition must be TRUE\/FALSE/);
});

test('assert! partials as is-three', () => {
  const r = val("is-three:assert'3 is-three!+!{1 2}");
  assert.strictEqual(r, NULL);
});

test('assert!{} on inequality reports values', () => {
  assert.throws(() => val('assert!{4 +!{2 5}}'), /expected 4, got 7/);
});
