// Reflection + serialization builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.js';
import { parse }    from '../src/parse.js';
import { evalProgram, forceTmplItems } from '../src/eval.js';
import { rootEnv } from '../src/env.js';
import { defaultBindings } from '../src/builtins.js';
import { formatValue, isNamed } from '../src/values.js';

const env = () => rootEnv(defaultBindings());
const val = (src, e = env()) => evalProgram(parse(tokenize(src)), e).value;
const fmt = (src) => formatValue(val(src));

test('name! constructs a NamedThing', () => {
  const r = val('name!{greeting hi}');
  assert.equal(r.kind, 'named');
  assert.equal(r.name, 'greeting');
  assert.equal(r.value.value, 'hi');
});

test('pattern! returns pattern items as values', () => {
  const r = val('f:(a b c){body} pattern!f?');
  assert.equal(formatValue(r), '{a b c}');
});

test('pattern! evaluates NamedThings in pattern slots', () => {
  const r = val('el:(lang:en class:big){child} pattern!el?');
  // Items are NamedThings whose values are text.
  const items = r.items;
  assert.equal(items.length, 2);
  assert.ok(isNamed(items[0]));
  assert.equal(items[0].name, 'lang');
  assert.equal(items[0].value.value, 'en');
});

test('template! returns body items as values', () => {
  const r = val('f:(){a b c} template!f?');
  assert.equal(formatValue(r), '{a b c}');
});

test('serialize! round-trips through deserialize!', () => {
  assert.equal(fmt('deserialize!serialize!42'), '42');
  assert.equal(fmt('deserialize!serialize!{a b c}'), '{a b c}');
});

test('deserialize! re-parses textual Punk', () => {
  // Build "key:value" without escaping the colon: chars are joined with empty sep.
  // We avoid `\:` (escaped). Easiest: serialize a constructed NamedThing.
  const r = val('serialize!name!{key value}');
  assert.equal(r.value, 'key:value');
  const r2 = val('deserialize!serialize!42');
  assert.equal(r2.kind, 'num');
  assert.equal(r2.value, 42);
});

test('serialize! escapes spaces in text so multi-word values round-trip', () => {
  // text "buy milk" inside a tmpl must survive a serialize/deserialize cycle
  // as a single text item, not be split into multiple words.
  const r = val('deserialize!serialize!{t0 buy\\ milk}');
  assert.equal(r.kind, 'tmpl');
  const items = forceTmplItems(r);
  assert.equal(items.length, 2);
  assert.equal(items[0].value, 't0');
  assert.equal(items[1].value, 'buy milk');
});

test('serialize! escapes delimiter chars in text', () => {
  // text "weird stuff" inside a NamedThing value round-trips.
  const r = val('deserialize!serialize!{k v:weird\\ stuff}');
  assert.equal(r.kind, 'tmpl');
  const items = forceTmplItems(r);
  assert.equal(items.length, 2);
  assert.equal(items[1].kind, 'named');
  assert.equal(items[1].name, 'v');
  assert.equal(items[1].value.value, 'weird stuff');
});
