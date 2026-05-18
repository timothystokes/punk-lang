// Text builtins (Phase 17).
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

test('split! with text sep', () => {
  assert.equal(fmt('split!{- foo-bar-baz}'), '{foo bar baz}');
});

test('split! with regex sep', () => {
  // `\t` (escape) tokenizes to a literal tab inside the word; regex \s+ matches.
  assert.equal(fmt('split!{"\\s+" hello\\tworld}'), '{hello world}');
});

test('split! partials as dash-split', () => {
  assert.equal(fmt("dash-split:split'- dash-split!a-b-c"), '{a b c}');
});

test('join! with text sep', () => {
  assert.equal(fmt('join!{- {red green blue}}'), 'red-green-blue');
});

test('join! roundtrips with split!', () => {
  assert.equal(fmt('join!{- split!{- a-b-c}}'), 'a-b-c');
});

test('upper! / lower!', () => {
  assert.equal(fmt('upper!hello'), 'HELLO');
  assert.equal(fmt('lower!HELLO'), 'hello');
});

test('trim! removes outer whitespace', () => {
  // \t and \n are real whitespace escapes; \X for other chars is literal X.
  assert.equal(fmt('trim!\t\nhi\t\n'), 'hi');
});

test('replace! literal old', () => {
  assert.equal(fmt('replace!{- _ foo-bar-baz}'), 'foo_bar_baz');
});

test('replace! with regex (global)', () => {
  assert.equal(fmt('replace!{"\\d" X a1b2c3}'), 'aXbXcX');
});

test('chars! splits text into single-char things', () => {
  assert.equal(fmt('chars!abc'), '{a b c}');
});

test('upper! through pipeline / partial', () => {
  assert.equal(fmt('map!{upper? {hello world}}'), '{HELLO WORLD}');
});

test('text builtins error on non-text', () => {
  assert.throws(() => val('upper!TRUE'), /upper: expected text/);
});
